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

    const unsub = onSnapshot(qRef, (snap) => {
      let arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (filter !== "todas") {
        arr.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      }
      setItems(arr);
      setLoadingList(false);
    });

    return () => unsub();
  }, [role, filter]);

  // ⬇️ TODA LA LÓGICA DE ACCIONES SE MANTIENE TAL CUAL ⬇️
  // proponerHorario, marcarReprogramar, cancelar, emptyMsg
  // (no la repito para no hacer ruido, es idéntica a la tuya)

  const emptyMsg = useMemo(() => {
    if (loadingList) return "Cargando…";
    if (filter === "pendiente") return "No hay solicitudes pendientes.";
    if (filter === "propuesta") return "No hay solicitudes con propuesta.";
    return "No hay solicitudes.";
  }, [loadingList, filter]);

  if (role !== "medico") return null;

  return (
    <div className="container solLayout">
      <h2>Solicitudes de turno</h2>

      {/* Filtros */}
      <div className="solFilters">
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
      <div className="solList">
        {items.length === 0 ? (
          <div className="card">{emptyMsg}</div>
        ) : (
          items.map((sol) => (
            <div key={sol.id} className="card solCard">
              <div className="solInfo">
                <div className="solPaciente">
                  {sol.pacienteNombre || "Paciente sin nombre"}
                </div>

                {sol.pacienteEmail && (
                  <div className="muted">{sol.pacienteEmail}</div>
                )}

                <div className="solMeta">
                  Día pedido: <strong>{sol.diaSolicitado}</strong> ·{" "}
                  <strong>{sol.franja}</strong>
                </div>

                {sol.propuesta && (
                  <div className="solMeta">
                    Propuesta:{" "}
                    <strong>{sol.propuesta.dia}</strong>{" "}
                    {normalizeHora(sol.propuesta.hora)}
                  </div>
                )}

                <div className="solEstado">
                  Estado: <strong>{sol.estado}</strong>
                </div>
              </div>

              <div className="solActions">
                {(sol.estado === "pendiente" || sol.estado === "propuesta") && (
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
