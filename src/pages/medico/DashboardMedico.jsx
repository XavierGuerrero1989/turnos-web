// src/pages/medico/DashboardMedico.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  documentId,
} from "firebase/firestore";

import "./DashboardMedico.css";

// Helpers fecha/hora
const toISO = (d) => d.toISOString().slice(0, 10);
const hoyISO = () => toISO(new Date());
const fmtHora = (hhmm) => {
  if (!hhmm) return "";
  const [h, m = "00"] = String(hhmm).split(":");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const fmtFechaES = (iso) => (!iso ? "" : iso.split("-").reverse().join("/"));

export default function DashboardMedico() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  // Guard: solo médico
  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  // Filtros rango
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISO(d);
  });
  const [hasta, setHasta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return toISO(d);
  });

  // KPIs
  const [turnosHoy, setTurnosHoy] = useState(0);
  const [propuestasCount, setPropuestasCount] = useState(0);
  const [proximosCount, setProximosCount] = useState(0);
  const [pacientesCount, setPacientesCount] = useState(0);
  const [recetasPendientesCount, setRecetasPendientesCount] = useState(0);

  // Listas
  const [agendaHoy, setAgendaHoy] = useState([]);
  const [pendientesPropuesta, setPendientesPropuesta] = useState([]);
  const [solicitudesNuevas, setSolicitudesNuevas] = useState([]);
  const [ultEvo, setUltEvo] = useState([]);
  const [pacMap, setPacMap] = useState({});
  const [recetasPendientes, setRecetasPendientes] = useState([]);

  // Confirmadas HOY
  useEffect(() => {
    const qRef = query(
      collection(db, "solicitudes"),
      where("estado", "==", "confirmada"),
      where("propuesta.dia", "==", hoyISO())
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.propuesta?.hora || "").localeCompare(b.propuesta?.hora || "")
        );
      setAgendaHoy(rows);
      setTurnosHoy(rows.length);
    });
    return () => unsub();
  }, []);

  // Propuestas pendientes
  useEffect(() => {
    const qRef = query(
      collection(db, "solicitudes"),
      where("estado", "==", "propuesta")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort(
        (a, b) =>
          (a.propuesta?.dia || "").localeCompare(b.propuesta?.dia || "") ||
          (a.propuesta?.hora || "").localeCompare(b.propuesta?.hora || "")
      );
      setPendientesPropuesta(rows);
      setPropuestasCount(rows.length);
    });
    return () => unsub();
  }, []);

  // Próximos turnos (confirmadas en rango)
  useEffect(() => {
    const qRef = query(
      collection(db, "solicitudes"),
      where("estado", "==", "confirmada")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const count = snap.docs
        .map((d) => d.data())
        .filter((s) => {
          const dia = s.propuesta?.dia;
          return dia && dia >= desde && dia <= hasta;
        }).length;
      setProximosCount(count);
    });
    return () => unsub();
  }, [desde, hasta]);

  // Pacientes
  useEffect(() => {
    const qRef = query(
      collection(db, "usuarios"),
      where("role", "==", "paciente")
    );
    const unsub = onSnapshot(qRef, (snap) =>
      setPacientesCount(snap.size)
    );
    return () => unsub();
  }, []);

  // Recetas pendientes (conteo)
  useEffect(() => {
    const qRef = query(collection(db, "recetas"));
    const unsub = onSnapshot(qRef, (snap) => {
      const count = snap.docs
        .map((d) => d.data())
        .filter(
          (r) => String(r.estado || "").toLowerCase() === "solicitada"
        ).length;
      setRecetasPendientesCount(count);
    });
    return () => unsub();
  }, []);

  // Últimas recetas solicitadas
  useEffect(() => {
    const qRef = query(
      collection(db, "recetas"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const pendientes = rows.filter(
        (r) => String(r.estado || "").toLowerCase() === "solicitada"
      );
      setRecetasPendientes(pendientes.slice(0, 5));
    });
    return () => unsub();
  }, []);

  // Solicitudes nuevas
  useEffect(() => {
    const qRef = query(
      collection(db, "solicitudes"),
      where("estado", "==", "pendiente")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort(
        (a, b) =>
          (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      );
      setSolicitudesNuevas(rows.slice(0, 5));
    });
    return () => unsub();
  }, []);

  // Últimas evoluciones + pacientes
  useEffect(() => {
    const qRef = query(
      collection(db, "evoluciones"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsub = onSnapshot(qRef, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUltEvo(rows);

      const ids = [
        ...new Set(rows.map((r) => r.pacienteId).filter(Boolean)),
      ];
      if (!ids.length) {
        setPacMap({});
        return;
      }

      const chunks = [];
      for (let i = 0; i < ids.length; i += 10)
        chunks.push(ids.slice(i, i + 10));

      const map = {};
      await Promise.all(
        chunks.map(async (chunk) => {
          const s = await getDocs(
            query(
              collection(db, "usuarios"),
              where(documentId(), "in", chunk)
            )
          );
          s.forEach((u) => {
            map[u.id] = u.data();
          });
        })
      );
      setPacMap(map);
    });
    return () => unsub();
  }, []);

  const nombreDe = (id) => {
    const u = pacMap[id];
    if (!u) return id;
    return (
      [u.nombre, u.apellido].filter(Boolean).join(" ").trim() ||
      u.email ||
      id
    );
  };

  if (role !== "medico") return null;

  return (
    <div className="container dmLayout">
      {/* Acciones */}
      <div className="dmActions">
        <Link to="/medico/invitar" className="btn btn-primary">
          Invitar paciente
        </Link>
        <Link to="/medico/solicitudes" className="btn btn-outline">
          Ver solicitudes
        </Link>
        <Link to="/medico/recetas" className="btn btn-outline">
          Recetas
        </Link>
        <Link to="/medico/disponibilidad" className="btn btn-outline">
          Disponibilidad
        </Link>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="card">
          <div className="muted">Turnos HOY</div>
          <div className="kpiValue">{turnosHoy}</div>
          <div className="muted">Confirmados</div>
        </div>

        <div className="card">
          <div className="muted">Propuestas</div>
          <div className="kpiValue">{propuestasCount}</div>
          <div className="muted">Pendientes</div>
        </div>

        <div className="card">
          <div className="muted">Próximos turnos</div>
          <div className="kpiValue">{proximosCount}</div>
          <div className="muted">En rango</div>
        </div>

        <div className="card">
          <div className="muted">Pacientes</div>
          <div className="kpiValue">{pacientesCount}</div>
          <div className="muted">Totales</div>
        </div>

        <div className="card">
          <div className="muted">Recetas pendientes</div>
          <div className="kpiValue">{recetasPendientesCount}</div>
          <div className="muted">Solicitadas</div>
          <Link to="/medico/recetas" className="btn btn-outline mt8">
            Ver recetas
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="card dmDateFilters">
        <div>
          <label className="muted">Desde</label>
          <input
            type="date"
            className="input"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div>
          <label className="muted">Hasta</label>
          <input
            type="date"
            className="input"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <Link to="/medico/turnos" className="btn btn-outline">
          Ver agenda
        </Link>
      </div>

      {/* Recetas pendientes */}
      <div className="card">
        <h3 className="dmCardTitle">
          Recetas pendientes
          <Link to="/medico/recetas" className="btn btn-outline">
            Abrir
          </Link>
        </h3>
        {recetasPendientes.length === 0 ? (
          <div className="muted">No hay recetas pendientes.</div>
        ) : (
          <ul className="dmList">
            {recetasPendientes.map((r) => (
              <li key={r.id} className="item">
                <strong>
                  {r.pacienteNombre ||
                    r.pacienteEmail ||
                    r.pacienteId ||
                    "Paciente"}
                </strong>
                <div className="muted">
                  {r.medicacionSolicitada || "-"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Agenda + Evoluciones */}
      <div className="dmTwoCol">
        <div className="card">
          <h3>Agenda de hoy</h3>
          {agendaHoy.length === 0 ? (
            <div className="muted">No hay turnos hoy.</div>
          ) : (
            <ul className="dmList">
              {agendaHoy.map((t) => (
                <li key={t.id} className="item">
                  <strong>{fmtHora(t.propuesta?.hora)}</strong> —{" "}
                  {t.pacienteNombre ||
                    t.pacienteEmail ||
                    t.pacienteId ||
                    "Paciente"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Últimas evoluciones</h3>
          {ultEvo.length === 0 ? (
            <div className="muted">Sin evoluciones.</div>
          ) : (
            <ul className="dmList">
              {ultEvo.map((e) => (
                <li key={e.id} className="item">
                  <div className="muted">
                    {e.createdAt?.toDate
                      ? e.createdAt.toDate().toLocaleString()
                      : ""}
                  </div>
                  <div>
                    <strong>{nombreDe(e.pacienteId)}</strong>
                  </div>
                  {e.texto && <div>{e.texto}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Propuestas pendientes */}
      <div className="card">
        <h3>Propuestas pendientes</h3>
        {pendientesPropuesta.length === 0 ? (
          <div className="muted">No hay propuestas.</div>
        ) : (
          <ul className="dmList">
            {pendientesPropuesta.map((s) => (
              <li key={s.id} className="item dmRow">
                <div>
                  <strong>{fmtFechaES(s.propuesta?.dia)}</strong>{" "}
                  · {fmtHora(s.propuesta?.hora)} ·{" "}
                  {s.franja === "manana" ? "Mañana" : "Tarde"}
                  <div className="muted">
                    {s.pacienteNombre ||
                      s.pacienteEmail ||
                      s.pacienteId ||
                      "Paciente"}
                  </div>
                </div>
                <Link
                  to="/medico/solicitudes"
                  className="btn btn-outline"
                >
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Solicitudes nuevas */}
      <div className="card">
        <h3>Solicitudes nuevas</h3>
        {solicitudesNuevas.length === 0 ? (
          <div className="muted">No hay solicitudes.</div>
        ) : (
          <ul className="dmList">
            {solicitudesNuevas.map((s) => (
              <li key={s.id} className="item">
                <strong>{fmtFechaES(s.diaSolicitado)}</strong> ·{" "}
                {s.franja === "manana" ? "Mañana" : "Tarde"}
                <div className="muted">
                  {s.pacienteNombre ||
                    s.pacienteEmail ||
                    s.pacienteId ||
                    "Paciente"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pacientes recientes */}
      <div className="card">
        <h3>Pacientes recientes</h3>
        <PacientesRecientes />
      </div>
    </div>
  );
}

function PacientesRecientes() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const qRef = query(
      collection(db, "usuarios"),
      where("role", "==", "paciente")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) =>
          (b.updatedAt?.seconds ?? 0) -
          (a.updatedAt?.seconds ?? 0)
      );
      setRows(list.slice(0, 5));
    });
    return () => unsub();
  }, []);

  if (rows.length === 0)
    return <div className="muted">Sin pacientes.</div>;

  return (
    <ul className="dmList">
      {rows.map((p) => {
        const nombre =
          [p.nombre, p.apellido].filter(Boolean).join(" ").trim() ||
          "- -";
        return (
          <li key={p.id} className="item dmRow">
            <div>
              <div>{nombre}</div>
              <div className="muted">{p.email}</div>
            </div>
            <button
              className="btn btn-outline"
              onClick={() => nav(`/medico/paciente/${p.id}`)}
            >
              Abrir
            </button>
          </li>
        );
      })}
    </ul>
  );
}
