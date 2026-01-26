// src/pages/medico/Solicitudes.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  addDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";

// === Helpers ===
const toISO = (d) => d.toISOString().slice(0, 10);
const SLOT_DEFS = {
  manana: { start: "08:00", end: "12:00" },
  tarde: { start: "14:00", end: "18:00" },
};
const timeToMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};
const minutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const normalizeHora = (v) => {
  if (!v) return null;
  const s = String(v);
  if (!s.includes(":")) return `${s.padStart(2, "0")}:00`;
  const [hh, mm = "00"] = s.split(":");
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const generateSlots = (startHHMM, endHHMM, stepMin = 20) => {
  const out = [];
  let t = timeToMinutes(startHHMM);
  const end = timeToMinutes(endHHMM);
  while (t <= end) {
    out.push(minutesToHHMM(t));
    t += stepMin;
  }
  return out;
};

const fmtFechaES = (iso) => (!iso ? "" : iso.split("-").reverse().join("/"));

export default function Solicitudes() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pendiente");
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (role !== "medico") return;
    setLoadingList(true);

    let qRef;
    if (filter === "todas") {
      qRef = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"));
    } else {
      qRef = query(collection(db, "solicitudes"), where("estado", "==", filter));
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (filter !== "todas") {
          arr.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        }
        setItems(arr);
        setLoadingList(false);
      },
      (err) => {
        console.error("onSnapshot(solicitudes) error:", err);
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [role, filter]);

  const proponerHorario = async (sol) => {
    const franja = sol.franja === "tarde" ? "tarde" : "manana";
    const rango = SLOT_DEFS[franja];
    if (!rango) {
      return Swal.fire("Error", "No se pudo determinar la franja.", "error");
    }

    const diaBase = sol.propuesta?.dia || sol.diaSolicitado || toISO(new Date());

    // === Obtener horarios ya ocupados (solicitudes confirmadas) ===
    const buildOptionsHTML = async (diaISO) => {
      const taken = new Set();

      // Buscar solicitudes confirmadas ese día
      const qConf = query(
        collection(db, "solicitudes"),
        where("estado", "==", "confirmada"),
        where("propuesta.dia", "==", diaISO)
      );
      const snap = await getDocs(qConf);
      snap.forEach((d) => {
        const h = normalizeHora(d.data().propuesta?.hora);
        if (h) taken.add(h);
      });

      // Generar slots y marcar ocupados
      const slots = generateSlots(rango.start, rango.end, 20);
      return slots
        .map((hhmm) => {
          const ocupado = taken.has(hhmm);
          const label = `${hhmm} — ${ocupado ? "CON TURNO" : "DISPONIBLE"}`;
          return `<option value="${hhmm}" ${ocupado ? "disabled" : ""}>${label}</option>`;
        })
        .join("");
    };

    const { value } = await Swal.fire({
      title: sol.estado === "propuesta" ? "Editar propuesta" : "Proponer horario",
      html: `
        <div style="text-align:left">
          <label style="display:block; font-weight:600; margin:6px 0 4px">Día</label>
          <input id="sw-dia" type="date" value="${diaBase}" class="swal2-input" style="width:100%; margin:0" />
          <label style="display:block; font-weight:600; margin:12px 0 4px">Horario</label>
          <select id="sw-hora" class="swal2-input" style="width:100%; margin:0"></select>
        </div>
      `,
      didOpen: async () => {
        const diaInput = document.getElementById("sw-dia");
        const horaSelect = document.getElementById("sw-hora");
        horaSelect.innerHTML = await buildOptionsHTML(diaInput.value);
        diaInput.addEventListener("change", async () => {
          horaSelect.innerHTML = `<option>Cargando…</option>`;
          horaSelect.innerHTML = await buildOptionsHTML(diaInput.value);
        });
      },
      confirmButtonText: sol.estado === "propuesta" ? "Actualizar" : "Proponer",
      showCancelButton: true,
      preConfirm: () => {
        const dia = document.getElementById("sw-dia").value;
        const hora = document.getElementById("sw-hora").value;
        if (!dia) return Swal.showValidationMessage("Elegí un día");
        if (!hora) return Swal.showValidationMessage("Elegí un horario");
        return { dia, hora };
      },
    });

    if (!value) return;

    try {
      // 1) Guardar la propuesta en la solicitud
      await updateDoc(doc(db, "solicitudes", sol.id), {
        propuesta: { dia: value.dia, hora: value.hora, franja },
        estado: "propuesta",
        updatedAt: serverTimestamp(),
      });

      // 2) Disparar email via Extension (colección "mail")
      const to = (sol.pacienteEmail || "").trim().toLowerCase();
      if (to) {
        const paciente = sol.pacienteNombre || "Paciente";
        const diaES = fmtFechaES(value.dia);
        const hora = normalizeHora(value.hora);

        const subject = "Te propusieron un horario para tu turno";
        const html = `
          <div style="font-family:Arial,sans-serif; line-height:1.5; color:#111;">
            <h2 style="margin:0 0 12px;">Nueva propuesta de horario</h2>
            <p>Hola <b>${paciente}</b>,</p>
            <p>La doctora te propuso el siguiente horario para tu turno:</p>
            <div style="padding:12px; border:1px solid #eee; border-radius:10px; display:inline-block;">
              <div><b>Fecha:</b> ${diaES}</div>
              <div><b>Hora:</b> ${hora}</div>
            </div>
            <p style="margin-top:16px;">
              Para confirmar o rechazar la propuesta, ingresá a:
              <br/>
              <a href="https://gineturnos.com/paciente/mis-turnos" target="_blank" rel="noreferrer">
                https://gineturnos.com/paciente/mis-turnos
              </a>
            </p>
            <p style="font-size:12px; color:#666; margin-top:18px;">
              Si no solicitaste este turno, podés ignorar este correo.
            </p>
          </div>
        `;

        await addDoc(collection(db, "mail"), {
          to: [to],
          message: { subject, html },
          createdAt: serverTimestamp(),
          meta: {
            type: "propuesta_turno",
            solicitudId: sol.id,
            pacienteId: sol.pacienteId || null,
          },
        });
      } else {
        console.warn("No hay pacienteEmail en la solicitud, no se envía mail.");
      }

      Swal.fire("OK", "Propuesta enviada al paciente (y notificada por mail).", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo proponer horario", "error");
    }
  };

  const marcarReprogramar = async (sol) => {
    await updateDoc(doc(db, "solicitudes", sol.id), {
      estado: "reprogramar",
      updatedAt: serverTimestamp(),
    });
  };

  const cancelar = async (sol) => {
    const ok = await Swal.fire({
      title: "Cancelar solicitud",
      text: "¿Seguro?",
      icon: "warning",
      showCancelButton: true,
    });
    if (!ok.isConfirmed) return;
    await updateDoc(doc(db, "solicitudes", sol.id), {
      estado: "cancelada",
      updatedAt: serverTimestamp(),
    });
  };

  const emptyMsg = useMemo(() => {
    if (loadingList) return "Cargando…";
    if (filter === "pendiente") return "No hay solicitudes pendientes.";
    if (filter === "propuesta") return "No hay solicitudes con propuesta.";
    return "No hay solicitudes.";
  }, [loadingList, filter]);

  if (role !== "medico") return null;

  return (
    <div className="container" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2>Solicitudes de turno</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className={`btn ${filter === "pendiente" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFilter("pendiente")}
        >
          Pendientes
        </button>
        <button
          className={`btn ${filter === "propuesta" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFilter("propuesta")}
        >
          Con propuesta
        </button>
        <button
          className={`btn ${filter === "todas" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setFilter("todas")}
        >
          Todas
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.length === 0 ? (
          <div className="card">{emptyMsg}</div>
        ) : (
          items.map((sol) => (
            <div
              key={sol.id}
              className="card"
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {sol.pacienteNombre || "Paciente sin nombre"}
                  {sol.pacienteEmail && <span style={{ marginLeft: 8 }}>{sol.pacienteEmail}</span>}
                </div>
                <div>
                  Día pedido: <strong>{sol.diaSolicitado}</strong> · Franja:{" "}
                  <strong>{sol.franja}</strong>
                </div>
                {sol.propuesta && (
                  <div>
                    Propuesta: <strong>{sol.propuesta.dia}</strong>{" "}
                    {normalizeHora(sol.propuesta.hora)}
                  </div>
                )}
                <div>
                  Estado: <strong>{sol.estado}</strong>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(sol.estado === "pendiente" || sol.estado === "propuesta") && (
                  <button className="btn btn-primary" onClick={() => proponerHorario(sol)}>
                    {sol.estado === "propuesta" ? "Editar propuesta" : "Proponer horario"}
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => marcarReprogramar(sol)}>
                  Marcar reprogramar
                </button>
                <button className="btn btn-outline" onClick={() => cancelar(sol)}>
                  Cancelar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
