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
} from "firebase/firestore";
import Swal from "sweetalert2";

// === Helpers generales ===
const toISO = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

// === Helpers de slots ===
const SLOT_DEFS = {
  manana: { start: "08:00", end: "12:00" },
  tarde:  { start: "14:00", end: "18:00" },
};

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function generateSlots(startHHMM, endHHMM, stepMin = 20) {
  const out = [];
  let t = timeToMinutes(startHHMM);
  const end = timeToMinutes(endHHMM);
  while (t <= end) {
    out.push(minutesToHHMM(t));
    t += stepMin;
  }
  return out;
}

export default function Solicitudes() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pendiente"); // "pendiente" | "propuesta" | "todas"
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (role !== "medico") return;
    setLoadingList(true);

    let qRef;
    if (filter === "todas") {
      // solo orderBy -> no requiere índice compuesto adicional
      qRef = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"));
    } else {
      // evitamos índice compuesto: NO usamos orderBy aquí
      qRef = query(collection(db, "solicitudes"), where("estado", "==", filter));
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (filter !== "todas") {
          // orden en memoria por createdAt desc
          arr.sort(
            (a, b) =>
              (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
          );
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
    // franja de la solicitud del paciente
    const franja = sol.franja === "tarde" ? "tarde" : "manana";
    const rango = SLOT_DEFS[franja];
    if (!rango) {
      return Swal.fire("Error", "No se pudo determinar la franja (mañana/tarde).", "error");
    }

    // día base preseleccionado
    const diaBase = sol.propuesta?.dia || sol.diaSolicitado || toISO(new Date());

    // lee turnos confirmados del día y arma opciones del select
    const buildOptionsHTML = async (diaISO) => {
      const q = query(
        collection(db, "turnosConfirmados"),
        where("dia", "==", diaISO)
      );
      const snap = await getDocs(q);
      const taken = new Set();
      snap.forEach((d) => {
        const h = d.data().hora; // "HH:MM"
        if (typeof h === "string") taken.add(h);
      });

      const slots = generateSlots(rango.start, rango.end, 20); // cada 20'
      const opts = slots
        .map((hhmm) => {
          const ocupado = taken.has(hhmm);
          const label = `${hhmm} — ${ocupado ? "CON TURNO" : "DISPONIBLE"}`;
          return `<option value="${hhmm}" ${ocupado ? "disabled" : ""}>${label}</option>`;
        })
        .join("");

      return opts;
    };

    const { value } = await Swal.fire({
      title: "Proponer horario",
      html: `
        <div style="text-align:left">
          <div style="margin-bottom:10px">
            <label style="display:block; font-weight:600; margin:6px 0 4px">Franja</label>
            <input class="swal2-input" value="${franja === "manana" ? "Mañana" : "Tarde"}" disabled style="width:100%; margin:0" />
          </div>
          <div style="margin-bottom:10px">
            <label style="display:block; font-weight:600; margin:6px 0 4px">Día</label>
            <input id="sw-dia" type="date" value="${diaBase}" class="swal2-input" style="width:100%; margin:0" />
          </div>
          <div>
            <label style="display:block; font-weight:600; margin:12px 0 4px">Horario (cada 20')</label>
            <select id="sw-hora" class="swal2-input" style="width:100%; margin:0"></select>
            <div class="helper" style="margin-top:6px">Las opciones deshabilitadas están <strong>con turno</strong>.</div>
          </div>
        </div>
      `,
      didOpen: async () => {
        const diaInput = document.getElementById("sw-dia");
        const horaSelect = document.getElementById("sw-hora");

        // carga inicial
        horaSelect.innerHTML = await buildOptionsHTML(diaInput.value);

        // recargar si cambia el día
        diaInput.addEventListener("change", async () => {
          horaSelect.innerHTML = `<option>Cargando…</option>`;
          horaSelect.innerHTML = await buildOptionsHTML(diaInput.value);
        });
      },
      focusConfirm: false,
      confirmButtonText: "Proponer",
      showCancelButton: true,
      preConfirm: () => {
        const dia = (document.getElementById("sw-dia") || {}).value;
        const hora = (document.getElementById("sw-hora") || {}).value;
        if (!dia) {
          Swal.showValidationMessage("Elegí un día");
          return;
        }
        if (!hora) {
          Swal.showValidationMessage("Elegí un horario disponible");
          return;
        }
        return { dia, hora };
      },
    });

    if (!value) return;

    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        propuesta: { dia: value.dia, hora: value.hora, franja },
        estado: "propuesta",
        updatedAt: serverTimestamp(),
      });
      Swal.fire("Enviado", "Propuesta de horario enviada al paciente.", "success");
    } catch (e) {
      Swal.fire("Error", e.message || "No se pudo proponer horario", "error");
    }
  };

  const marcarReprogramar = async (sol) => {
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        estado: "reprogramar",
        updatedAt: serverTimestamp(),
      });
      Swal.fire("Marcado", "Solicitud marcada para reprogramar.", "success");
    } catch (e) {
      Swal.fire("Error", e.message || "No se pudo actualizar", "error");
    }
  };

  const cancelar = async (sol) => {
    const ok = await Swal.fire({
      title: "Cancelar solicitud",
      text: "¿Seguro que querés cancelar esta solicitud?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "No",
    });
    if (!ok.isConfirmed) return;

    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        estado: "cancelada",
        updatedAt: serverTimestamp(),
      });
      Swal.fire("Cancelada", "La solicitud fue cancelada.", "success");
    } catch (e) {
      Swal.fire("Error", e.message || "No se pudo cancelar", "error");
    }
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
      <h2 style={{ marginBottom: 0 }}>Solicitudes de turno</h2>
      <p className="helper">Revisá solicitudes pendientes y proponé un horario específico.</p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

      {/* Lista */}
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
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {(sol.pacienteNombre && sol.pacienteNombre.trim()) || "Paciente sin nombre"}
                  {sol.pacienteEmail && (
                    <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                      {sol.pacienteEmail}
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--muted)" }}>
                  Día pedido: <strong>{sol.diaSolicitado}</strong> · Franja:{" "}
                  <strong>{sol.franja === "manana" ? "Mañana" : "Tarde"}</strong>
                </div>
                {sol.comentario && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: "var(--muted)" }}>Comentario:</span> {sol.comentario}
                  </div>
                )}
                {sol.propuesta && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: "var(--muted)" }}>Propuesta:</span>{" "}
                    <strong>{sol.propuesta.dia}</strong> a las{" "}
                    <strong>{sol.propuesta.hora}</strong>
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  Estado: <span style={{ fontWeight: 700 }}>{sol.estado}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-primary" onClick={() => proponerHorario(sol)}>
                  Proponer horario
                </button>
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
