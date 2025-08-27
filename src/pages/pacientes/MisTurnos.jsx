import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  collection, query, where, onSnapshot,
  doc, updateDoc
} from "firebase/firestore";
import Swal from "sweetalert2";

export default function MisTurnos() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [tab, setTab] = useState("todas"); // "todas" | "pendiente" | "propuesta" | "confirmada"
  const [busyId, setBusyId] = useState(null);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (loading || !user) return;
    setLoadingList(true);

    // SIN orderBy para evitar índice compuesto
    const qRef = query(
      collection(db, "solicitudes"),
      where("pacienteId", "==", user.uid)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setLastError(null);
        // Ordenamos en memoria por createdAt desc
        const arr = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setItems(arr);
        setLoadingList(false);
      },
      (err) => {
        console.error("onSnapshot(MisTurnos) error:", err);
        setLastError(err?.message || String(err));
        setItems([]);
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, [loading, user]);

  const filtered = useMemo(() => {
    if (tab === "todas") return items;
    return items.filter(x => x.estado === tab);
  }, [items, tab]);

  const aceptarPropuesta = async (sol) => {
    setBusyId(sol.id);
    // Optimistic update
    setItems(prev => prev.map(x => x.id === sol.id ? { ...x, estado: "confirmada" } : x));
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "confirmada" });
      Swal.fire("Confirmado ✅", "Tu turno fue confirmado.", "success");
    } catch (e) {
      console.error(e);
      // revertir si falló
      setItems(prev => prev.map(x => x.id === sol.id ? { ...x, estado: "propuesta" } : x));
      Swal.fire("Error", e.message || "No se pudo confirmar el turno", "error");
    } finally {
      setBusyId(null);
    }
  };

  const rechazarPropuesta = async (sol) => {
    const ok = await Swal.fire({
      title: "Rechazar propuesta",
      text: "¿Querés rechazar esta propuesta para que el médico sugiera otro horario?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, rechazar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    setBusyId(sol.id);
    // Optimistic update
    setItems(prev => prev.map(x => x.id === sol.id ? { ...x, estado: "pendiente", propuesta: null } : x));
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        estado: "pendiente",
        propuesta: null,
      });
      Swal.fire("Listo", "Volvimos la solicitud a pendiente.", "success");
    } catch (e) {
      console.error(e);
      // revertir si falló
      setItems(prev => prev.map(x => x.id === sol.id ? { ...x, estado: "propuesta" } : x));
      Swal.fire("Error", e.message || "No se pudo actualizar", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container" style={{ display:"grid", gap:12 }}>
      <h2 style={{ marginBottom:0 }}>Mis turnos</h2>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8 }}>
        {["todas","pendiente de ver por el médico","propuesta de horario por parte del médico","confirmada"].map(t => (
          <button
            key={t}
            className={`btn ${tab === t ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {lastError && (
        <div className="card" style={{ color: "crimson" }}>
          Error cargando turnos: {lastError}
        </div>
      )}

      {loadingList ? (
        <div className="card">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="card">No hay turnos en esta vista.</div>
      ) : (
        filtered.map((sol) => (
          <div key={sol.id} className="card" style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12 }}>
            <div>
              <div style={{ fontWeight:700, marginBottom:4 }}>
                {sol.estado === "propuesta"
                  ? "Propuesta recibida"
                  : sol.estado === "confirmada"
                  ? "Turno confirmado"
                  : "Solicitud creada"} · {sol.estado}
              </div>
              <div style={{ color:"var(--muted)" }}>
                Día pedido: <b>{sol.diaSolicitado}</b> · Franja: <b>{sol.franja === "manana" ? "Mañana" : "Tarde"}</b>
              </div>
              {sol.propuesta && (
                <div style={{ marginTop:6 }}>
                  <span style={{ color:"var(--muted)" }}>Propuesta del médico:</span>{" "}
                  <b>{sol.propuesta.dia}</b> a las <b>{sol.propuesta.hora}</b>
                </div>
              )}
            </div>

            {sol.estado === "propuesta" ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => aceptarPropuesta(sol)}
                  disabled={busyId === sol.id}
                >
                  {busyId === sol.id ? "Confirmando..." : "Aceptar"}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => rechazarPropuesta(sol)}
                  disabled={busyId === sol.id}
                >
                  {busyId === sol.id ? "Procesando..." : "Rechazar"}
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
