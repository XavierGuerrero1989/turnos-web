// src/pages/medico/RecetasMedico.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import Swal from "sweetalert2";

export default function RecetasMedico() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  // Guard: solo médico
  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("solicitada"); // solicitada | entregada | todas
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const qRef = query(collection(db, "recetas"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(list);
      },
      console.error
    );
    return () => unsub();
  }, []);

  const pendientes = useMemo(
    () => rows.filter((r) => String(r.estado || "").toLowerCase() === "solicitada"),
    [rows]
  );

  const entregadas = useMemo(
    () => rows.filter((r) => String(r.estado || "").toLowerCase() === "entregada"),
    [rows]
  );

  const pendientesCount = pendientes.length;

  const marcarEntregada = async (r) => {
    const ok = await Swal.fire({
      title: "Marcar como entregada",
      text: "¿Confirmás que esta receta ya fue entregada?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, entregar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    setBusyId(r.id);
    try {
      await updateDoc(doc(db, "recetas", r.id), {
        estado: "entregada",
        updatedAt: serverTimestamp(),
        deliveredAt: serverTimestamp(),
      });
      Swal.fire("Listo ✅", "Marcada como entregada.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo actualizar la receta.", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;
  if (role !== "medico") return null;

  const renderRecetaItem = (r, { showAction }) => {
    const obra = String(r.obraSocial || "").toUpperCase();
    const isIoma = obra === "IOMA";
    const estado = String(r.estado || "").toLowerCase() || "-";

    const createdLabel =
      r.createdAt?.toDate?.() ? r.createdAt.toDate().toLocaleString() : null;

    const deliveredLabel =
      r.deliveredAt?.toDate?.() ? r.deliveredAt.toDate().toLocaleString() : null;

    return (
      <li key={r.id} className="item" style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "start",
          }}
        >
          <div>
            <div>
              <strong>{r.pacienteNombre || r.pacienteEmail || r.pacienteId || "Paciente"}</strong>{" "}
              <span className="muted">· {obra || "-"}</span>
            </div>

            {isIoma && r.dni ? <div className="muted">DNI: {r.dni}</div> : null}

            {r.medicacionSolicitada ? (
              <div style={{ marginTop: 6 }}>
                <div className="muted">Medicación solicitada:</div>
                <div>{r.medicacionSolicitada}</div>
              </div>
            ) : null}

            <div className="muted" style={{ marginTop: 6 }}>
              Estado: <b>{estado}</b>

              {createdLabel && (
                <>
                  {" "}
                  · <span className="muted">Solicitada:</span>{" "}
                  <b>{createdLabel}</b>
                </>
              )}

              {estado === "entregada" && deliveredLabel ? (
                <>
                  {" "}
                  · <span className="muted">Entregada:</span>{" "}
                  <b>{deliveredLabel}</b>
                </>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {showAction && estado === "solicitada" ? (
              <button
                className="btn btn-primary"
                disabled={busyId === r.id}
                onClick={() => marcarEntregada(r)}
              >
                {busyId === r.id ? "Guardando..." : "Marcar entregada"}
              </button>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
        </div>
      </li>
    );
  };

  const showPendientes = filter === "solicitada" || filter === "todas";
  const showHistorial = filter === "entregada" || filter === "todas";

  return (
    <div className="container" style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Recetas</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted">
            Pendientes: <b>{pendientesCount}</b>
          </span>
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="solicitada">Solicitadas</option>
            <option value="entregada">Entregadas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
      </div>

      {/* 🔴 PENDIENTES */}
      {showPendientes && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recetas pendientes</h3>
          {pendientes.length === 0 ? (
            <div className="muted">No hay recetas pendientes.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {pendientes.map((r) => renderRecetaItem(r, { showAction: true }))}
            </ul>
          )}
        </div>
      )}

      {/* 📁 HISTORIAL */}
      {showHistorial && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Historial de recetas entregadas</h3>
          {entregadas.length === 0 ? (
            <div className="muted">Todavía no hay recetas entregadas.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {entregadas.map((r) => renderRecetaItem(r, { showAction: false }))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
