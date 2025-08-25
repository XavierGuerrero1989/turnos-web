// src/pages/medico/Turnos.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";

// Helpers fecha/hora
const toDate = (yyyy_mm_dd, hhmm = "00:00") => {
  if (!yyyy_mm_dd) return null;
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

export default function TurnosConfirmados() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [all, setAll] = useState([]);           // todas las confirmadas
  const [loadingList, setLoadingList] = useState(true);
  const [range, setRange] = useState("hoy");    // "hoy" | "manana" | "semana" | "todos"
  const [qText, setQText] = useState("");       // búsqueda por nombre/email

  // Suscripción a confirmadas
  useEffect(() => {
    if (role !== "medico") return;
    setLoadingList(true);

    // Un solo where -> evitamos índice compuesto
    const qRef = query(
      collection(db, "solicitudes"),
      where("estado", "==", "confirmada")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const arr = snap.docs.map((d) => {
          const data = d.data();
          const dia = data.propuesta?.dia || data.diaSolicitado;
          const hora = data.propuesta?.hora || null;
          const when = toDate(dia, hora);
          return {
            id: d.id,
            ...data,
            _when: when,
            _dia: dia,
            _hora: hora,
            pago: data.pago || "pendiente", // normalizamos
          };
        });

        // ordenar por fecha/hora asc (próximos primero)
        arr.sort((a, b) => {
          const ta = a._when ? a._when.getTime() : 0;
          const tb = b._when ? b._when.getTime() : 0;
          return ta - tb;
        });

        setAll(arr);
        setLoadingList(false);
      },
      (err) => {
        console.error("onSnapshot(Turnos confirmados) error:", err);
        setAll([]);
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [role]);

  // Filtros: búsqueda GLOBAL + rango (solo si no hay texto)
const filtered = useMemo(() => {
  const text = qText.trim().toLowerCase();

  // 1) Si hay texto, buscar en TODOS los turnos (global)
  if (text) {
    return all.filter((x) =>
      (x.pacienteNombre || "").toLowerCase().includes(text) ||
      (x.pacienteEmail || "").toLowerCase().includes(text)
    );
  }

  // 2) Si NO hay texto, aplicar el rango seleccionado
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  return all.filter((x) => {
    const d = x._when;
    if (range === "hoy") return d && d.toDateString() === today.toDateString();
    if (range === "manana") return d && d.toDateString() === tomorrow.toDateString();
    if (range === "semana") return d && d >= today && d <= weekEnd;
    return true; // "todos"
  });
}, [all, range, qText]);


  // Acciones
  const marcarAtendido = async (sol) => {
    const ok = await Swal.fire({
      title: "Marcar como atendido",
      text: `¿Confirmás que el turno de ${sol.pacienteNombre || "Paciente"} ya fue atendido?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, marcar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "atendida" });
      Swal.fire("Listo", "Turno marcado como atendido.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo actualizar", "error");
    }
  };

  const reprogramar = async (sol) => {
    const ok = await Swal.fire({
      title: "Reprogramar",
      text: "La solicitud volverá a estado pendiente y podrás proponer otro horario.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, reprogramar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        estado: "reprogramar", // o "pendiente", si preferís
        propuesta: null,
      });
      Swal.fire("Listo", "Marcado para reprogramar.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo actualizar", "error");
    }
  };

  const cancelar = async (sol) => {
    const ok = await Swal.fire({
      title: "Cancelar turno",
      text: "¿Seguro que querés cancelar este turno confirmado?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "No",
    });
    if (!ok.isConfirmed) return;
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "cancelada" });
      Swal.fire("Cancelado", "El turno fue cancelado.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo cancelar", "error");
    }
  };

  const marcarPago = async (sol) => {
    if (sol.pago === "confirmado") return; // ya está
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { pago: "confirmado" });
      Swal.fire("Listo", "Pago marcado como confirmado.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo actualizar el pago", "error");
    }
  };

  if (role !== "medico") return null;

  return (
    <div className="container" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ marginBottom: 0 }}>Turnos confirmados</h2>

      {/* Controles */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${range === "hoy" ? "btn-primary" : "btn-outline"}`} onClick={() => setRange("hoy")}>Hoy</button>
          <button className={`btn ${range === "manana" ? "btn-primary" : "btn-outline"}`} onClick={() => setRange("manana")}>Mañana</button>
          <button className={`btn ${range === "semana" ? "btn-primary" : "btn-outline"}`} onClick={() => setRange("semana")}>Próx. 7 días</button>
          <button className={`btn ${range === "todos" ? "btn-primary" : "btn-outline"}`} onClick={() => setRange("todos")}>Todos</button>
        </div>
        <input
          className="input"
          placeholder="Buscar por nombre o email…"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          style={{ minWidth: 260, marginLeft: "auto" }}
        />
      </div>

      {/* Métricas rápidas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="helper">Total confirmados</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{all.length}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="helper">En vista actual</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{filtered.length}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="helper">Hoy</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {
              all.filter((x) => x._when && isSameDay(x._when, new Date(new Date().setHours(0,0,0,0)))).length
            }
          </div>
        </div>
      </div>

      {/* Lista */}
      {loadingList ? (
        <div className="card">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="card">No hay turnos en esta vista.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((sol) => (
            <div
              key={sol.id}
              className="card"
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
            >
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {sol.pacienteNombre || "Paciente"}{" "}
                  {sol.pacienteEmail ? (
                    <span style={{ color: "var(--muted)" }}>· {sol.pacienteEmail}</span>
                  ) : null}
                </div>
                <div style={{ color: "var(--muted)" }}>
                  Fecha: <b>{sol._dia}</b>{" "}
                  {sol._hora ? <>· Hora: <b>{sol._hora}</b></> : null}{" "}
                  · Franja: <b>{sol.franja === "manana" ? "Mañana" : "Tarde"}</b>
                </div>
                {sol.comentario && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: "var(--muted)" }}>Comentario:</span> {sol.comentario}
                  </div>
                )}
                {/* Badge de estado de pago */}
                <div style={{ marginTop: 6 }}>
                  Pago:{" "}
                  <span
                    style={{
                      fontWeight: 700,
                      color: sol.pago === "confirmado" ? "green" : "crimson",
                    }}
                  >
                    {sol.pago === "confirmado" ? "Confirmado" : "Pendiente"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-primary" onClick={() => marcarAtendido(sol)}>
                  Marcar atendido
                </button>
                <button className="btn btn-outline" onClick={() => reprogramar(sol)}>
                  Reprogramar
                </button>
                <button className="btn btn-outline" onClick={() => cancelar(sol)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => marcarPago(sol)}
                  disabled={sol.pago === "confirmado"}
                  title={sol.pago === "confirmado" ? "Pago ya confirmado" : "Marcar pago como confirmado"}
                >
                  {sol.pago === "confirmado" ? "Pago confirmado" : "Ya pagó"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
