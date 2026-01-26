import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
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

import "./MisTurnos.css";

const ZOOM_LINK =
  "https://us05web.zoom.us/j/86001038612?pwd=OgxbifZ8e5otNQ7l3Ff1CJ6HKQpAJS.1";
const ZOOM_CODE = "21Kbh8";

// Soporta "YYYY-MM-DD" o Date o Timestamp-like
function formatDiaConSemana(value) {
  if (!value) return "";

  let d = null;

  if (typeof value === "string") {
    const parts = value.split("-");
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      d = new Date(y, m, day);
    } else {
      const tryDate = new Date(value);
      if (!Number.isNaN(tryDate.getTime())) d = tryDate;
    }
  } else if (value?.toDate) {
    d = value.toDate();
  } else if (value instanceof Date) {
    d = value;
  } else if (value?.seconds) {
    d = new Date(value.seconds * 1000);
  }

  if (!d || Number.isNaN(d.getTime())) return String(value);

  const diaSemana = d.toLocaleDateString("es-AR", { weekday: "long" });
  const fecha = d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const niceWeekday = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  return `${niceWeekday} ${fecha}`;
}

export default function MisTurnos() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // ✅ Dropdown de filtro
  const [filter, setFilter] = useState("todas"); // "todas" | "pendiente" | "propuesta" | "confirmada"

  const [busyId, setBusyId] = useState(null);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (loading || !user) return;
    setLoadingList(true);

    const qRef = query(
      collection(db, "solicitudes"),
      where("pacienteId", "==", user.uid)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setLastError(null);
        const arr = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
          );
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
    if (filter === "todas") return items;
    return items.filter((x) => x.estado === filter);
  }, [items, filter]);

  const aceptarPropuesta = async (sol) => {
    setBusyId(sol.id);
    setItems((prev) =>
      prev.map((x) => (x.id === sol.id ? { ...x, estado: "confirmada" } : x))
    );
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "confirmada" });
      Swal.fire("Confirmado ✅", "Tu turno fue confirmado.", "success");
    } catch (e) {
      console.error(e);
      setItems((prev) =>
        prev.map((x) => (x.id === sol.id ? { ...x, estado: "propuesta" } : x))
      );
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
    setItems((prev) =>
      prev.map((x) =>
        x.id === sol.id ? { ...x, estado: "pendiente", propuesta: null } : x
      )
    );
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), {
        estado: "pendiente",
        propuesta: null,
      });
      Swal.fire("Listo", "Volvimos la solicitud a pendiente.", "success");
    } catch (e) {
      console.error(e);
      setItems((prev) =>
        prev.map((x) => (x.id === sol.id ? { ...x, estado: "propuesta" } : x))
      );
      Swal.fire("Error", e.message || "No se pudo actualizar", "error");
    } finally {
      setBusyId(null);
    }
  };

  const verCodigoZoom = async () => {
    await Swal.fire({
      title: "Código de acceso",
      html: `<b>${ZOOM_CODE}</b>`,
      icon: "info",
      confirmButtonText: "Listo",
    });
  };

  const filterOptions = [
    { key: "todas", label: "Todas" },
    { key: "pendiente", label: "Pendiente (lo ve el médico)" },
    { key: "propuesta", label: "Propuesta (aceptar/rechazar)" },
    { key: "confirmada", label: "Confirmada" },
  ];

  return (
    <div className="container mtLayout">
      <div className="mtHeader">
        <h2 className="mtTitle">Mis turnos</h2>

        {/* ✅ Filtros + dropdown */}
        <div className="mtFilters">
          <label className="mtFiltersLabel" htmlFor="mtFilterSelect">
            Filtros
          </label>
          <select
            id="mtFilterSelect"
            className="mtSelect"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {filterOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
        <div className="mtList">
          {filtered.map((sol) => {
            const estadoLabel =
              sol.estado === "propuesta"
                ? "Propuesta recibida"
                : sol.estado === "confirmada"
                ? "Turno confirmado"
                : "Solicitud creada";

            const franjaLabel = sol.franja === "manana" ? "Mañana" : "Tarde";

            const diaPedido = formatDiaConSemana(sol.diaSolicitado);
            const propuestaDia = sol.propuesta?.dia
              ? formatDiaConSemana(sol.propuesta.dia)
              : "";

            return (
              <div key={sol.id} className="card mtCard">
                <div className="mtCardMain">
                  <div className="mtCardTitle">
                    {estadoLabel} · <span className="mtBadge">{sol.estado}</span>
                  </div>

                  <div className="mtMeta">
                    Día pedido: <b>{diaPedido || "-"}</b> · Franja:{" "}
                    <b>{franjaLabel}</b>
                  </div>

                  {sol.propuesta && (
                    <div className="mtProposal">
                      <span className="mtMuted">Propuesta del médico:</span>{" "}
                      <b>{propuestaDia}</b> a las <b>{sol.propuesta.hora}</b>
                    </div>
                  )}

                  {/* ✅ Info importante DENTRO del turno confirmado */}
                  {sol.estado === "confirmada" && (
                    <div className="mtImportant">
                      <div className="mtImportantTitle">Información importante</div>
                      <a
                        className="mtLink"
                        href={ZOOM_LINK}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Link para ingresar a la reunión
                      </a>

                      <button
                        type="button"
                        className="btn btn-outline mtCodeBtn"
                        onClick={verCodigoZoom}
                      >
                        Ver código de acceso
                      </button>
                    </div>
                  )}
                </div>

                {sol.estado === "propuesta" ? (
                  <div className="mtCardActions">
                    <button
                      className="btn btn-primary"
                      onClick={() => aceptarPropuesta(sol)}
                      disabled={busyId === sol.id}
                      type="button"
                    >
                      {busyId === sol.id ? "Confirmando..." : "Aceptar"}
                    </button>

                    <button
                      className="btn btn-outline"
                      onClick={() => rechazarPropuesta(sol)}
                      disabled={busyId === sol.id}
                      type="button"
                    >
                      {busyId === sol.id ? "Procesando..." : "Rechazar"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
