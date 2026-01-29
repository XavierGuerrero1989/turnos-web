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

import "./Solicitudes.css";

/* ================= HELPERS ================= */
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

const fmtFechaES = (iso) =>
  !iso ? "" : iso.split("-").reverse().join("/");

/* ================= COMPONENT ================= */
export default function Solicitudes() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pendiente");
  const [loadingList, setLoadingList] = useState(true);

  /* ================= DATA ================= */
  useEffect(() => {
    if (role !== "medico") return;
    setLoadingList(true);

    let qRef;
    if (filter === "todas") {
      qRef = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"));
    } else {
      qRef = query(
        collection(db, "solicitudes"),
        where("estado", "==", filter)
      );
    }

    const unsub = onSnapshot(qRef, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (filter !== "todas") {
        arr.sort(
          (a, b) =>
            (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
        );
      }
      setItems(arr);
      setLoadingList(false);
    });

    return () => unsub();
  }, [role, filter]);

  /* ================= ACTIONS ================= */
  const proponerHorario = async (sol) => {
    const franja = sol.franja === "tarde" ? "tarde" : "manana";
    const rango = SLOT_DEFS[franja];
    if (!rango) {
      return Swal.fire("Error", "No se pudo determinar la franja.", "error");
    }

    const diaBase = sol.propuesta?.dia || sol.diaSolicitado || toISO(new Date());

    const buildOptionsHTML = async (diaISO) => {
      const taken = new Set();

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

      const slots = generateSlots(rango.start, rango.end, 20);
      return slots
        .map((hhmm) => {
          const ocupado = taken.has(hhmm);
          return `<option value="${hhmm}" ${
            ocupado ? "disabled" : ""
          }>${hhmm} — ${ocupado ? "CON TURNO" : "DISPONIBLE"}</option>`;
        })
        .join("");
    };

    const { value } = await Swal.fire({
      title:
        sol.estado === "propuesta"
          ? "Editar propuesta"
          : "Proponer horario",
      html: `
        <label>Día</label>
        <input id="sw-dia" type="date" class="swal2-input" value="${diaBase}" />
        <label>Horario</label>
        <select id="sw-hora" class="swal2-input"></select>
      `,
      didOpen: async () => {
        const diaInput = document.getElementById("sw-dia");
        const horaSelect = document.getElementById("sw-hora");
        horaSelect.innerHTML = await buildOptionsHTML(diaInput.value);
        diaInput.addEventListener("change", async () => {
          horaSelect.innerHTML = await buildOptionsHTML(diaInput.value);
        });
      },
      showCancelButton: true,
      confirmButtonText: "Guardar",
      preConfirm: () => {
        const dia = document.getElementById("sw-dia").value;
        const hora = document.getElementById("sw-hora").value;
        if (!dia || !hora) {
          Swal.showValidationMessage("Completá día y horario");
          return false;
        }
        return { dia, hora };
      },
    });

    if (!value) return;

    await updateDoc(doc(db, "solicitudes", sol.id), {
      estado: "propuesta",
      propuesta: { dia: value.dia, hora: value.hora, franja },
      updatedAt: serverTimestamp(),
    });

    Swal.fire("OK", "Propuesta enviada.", "success");
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

  /* ================= RENDER ================= */
  return (
    <div className="container solLayout">
      <h2>Solicitudes de turno</h2>

      <div className="solFilters">
        {["pendiente", "propuesta", "todas"].map((f) => (
          <button
            key={f}
            className={`btn ${
              filter === f ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setFilter(f)}
          >
            {f === "pendiente"
              ? "Pendientes"
              : f === "propuesta"
              ? "Con propuesta"
              : "Todas"}
          </button>
        ))}
      </div>

      <div className="solList">
        {items.length === 0 ? (
          <div className="card">{emptyMsg}</div>
        ) : (
          items.map((sol) => (
            <div key={sol.id} className="card solCard">
              <div className="solInfo">
                <div className="solPaciente">
                  {sol.pacienteNombre || "Paciente"}
                </div>
                {sol.pacienteEmail && (
                  <div className="muted">{sol.pacienteEmail}</div>
                )}
                <div className="solMeta">
                  Día pedido: <b>{sol.diaSolicitado}</b> ·{" "}
                  <b>{sol.franja}</b>
                </div>
                {sol.propuesta && (
                  <div className="solMeta">
                    Propuesta: <b>{sol.propuesta.dia}</b>{" "}
                    {normalizeHora(sol.propuesta.hora)}
                  </div>
                )}
                <div className="solEstado">
                  Estado: <b>{sol.estado}</b>
                </div>
              </div>

              <div className="solActions">
                {(sol.estado === "pendiente" ||
                  sol.estado === "propuesta") && (
                  <button
                    className="btn btn-primary"
                    onClick={() => proponerHorario(sol)}
                  >
                    {sol.estado === "propuesta"
                      ? "Editar propuesta"
                      : "Proponer horario"}
                  </button>
                )}

                <button
                  className="btn btn-outline"
                  onClick={() => marcarReprogramar(sol)}
                >
                  Marcar reprogramar
                </button>

                <button
                  className="btn btn-outline"
                  onClick={() => cancelar(sol)}
                >
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
