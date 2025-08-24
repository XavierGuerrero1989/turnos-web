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
} from "firebase/firestore";
import Swal from "sweetalert2";

const toISO = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

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
      qRef = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"));
    } else {
      qRef = query(
        collection(db, "solicitudes"),
        where("estado", "==", filter),
        orderBy("createdAt", "desc")
      );
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingList(false);
      },
      () => setLoadingList(false)
    );

    return () => unsub();
  }, [role, filter]);

  const proponerHorario = async (sol) => {
    const diaBase = sol.propuesta?.dia || sol.diaSolicitado || toISO(new Date());
    const horaBase = sol.propuesta?.hora || "10:00";

    const { value } = await Swal.fire({
      title: "Proponer horario",
      html: `
        <div style="text-align:left">
          <label style="display:block; font-weight:600; margin:6px 0 4px">Día</label>
          <input id="sw-dia" type="date" value="${diaBase}" class="swal2-input" style="width:100%; margin:0" />
          <label style="display:block; font-weight:600; margin:12px 0 4px">Hora exacta</label>
          <input id="sw-hora" type="time" value="${horaBase}" class="swal2-input" style="width:100%; margin:0" />
        </div>
      `,
      focusConfirm: false,
      confirmButtonText: "Proponer",
      showCancelButton: true,
      preConfirm: () => {
        const dia = document.getElementById("sw-dia").value;
        const hora = document.getElementById("sw-hora").value;
        if (!dia || !hora) {
          Swal.showValidationMessage("Completá día y hora");
          return;
        }
        return { dia, hora };
      },
    });

    if (!value) return;

    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        propuesta: { dia: value.dia, hora: value.hora },
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
                  {sol.pacienteNombre || "Paciente sin nombre"} · {sol.pacienteId?.slice(0, 6)}…
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
