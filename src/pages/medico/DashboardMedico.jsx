// src/pages/medico/DashboardMedico.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  collection, query, where, orderBy, limit, onSnapshot,
  getDocs, documentId
} from "firebase/firestore";

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

  // Filtros para próximos turnos
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return toISO(d);
  });
  const [hasta, setHasta] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 60); return toISO(d);
  });

  // KPIs
  const [turnosHoy, setTurnosHoy] = useState(0);
  const [propuestasCount, setPropuestasCount] = useState(0);
  const [proximosCount, setProximosCount] = useState(0);
  const [pacientesCount, setPacientesCount] = useState(0);

  // Listas
  const [agendaHoy, setAgendaHoy] = useState([]);               // confirmadas hoy
  const [pendientesPropuesta, setPendientesPropuesta] = useState([]); // estado: "propuesta"
  const [solicitudesNuevas, setSolicitudesNuevas] = useState([]);     // estado: "pendiente"
  const [ultEvo, setUltEvo] = useState([]);                     // evoluciones recientes
  const [pacMap, setPacMap] = useState({});                     // id -> {nombre, apellido, email}

  // Confirmadas HOY
  useEffect(() => {
    const qRef = query(
      collection(db, "solicitudes"),
      where("estado", "==", "confirmada"),
      where("propuesta.dia", "==", hoyISO())
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.propuesta?.hora || "").localeCompare(b.propuesta?.hora || ""));
      setAgendaHoy(rows);
      setTurnosHoy(rows.length);
    });
    return () => unsub();
  }, []);

  // Propuestas pendientes
  useEffect(() => {
    const qRef = query(collection(db, "solicitudes"), where("estado", "==", "propuesta"));
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.propuesta?.dia || "").localeCompare(b.propuesta?.dia || "") ||
          (a.propuesta?.hora || "").localeCompare(b.propuesta?.hora || "")
        );
      setPendientesPropuesta(rows);
      setPropuestasCount(rows.length);
    });
    return () => unsub();
  }, []);

  // Próximos turnos (confirmadas en rango) — filtra en memoria para evitar índice compuesto
  useEffect(() => {
    const qRef = query(collection(db, "solicitudes"), where("estado", "==", "confirmada"));
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

  // Pacientes (conteo simple)
  useEffect(() => {
    const qRef = query(collection(db, "usuarios"), where("role", "==", "paciente"));
    const unsub = onSnapshot(qRef, (snap) => setPacientesCount(snap.size));
    return () => unsub();
  }, []);

  // Solicitudes nuevas (pendiente) — ordenamos en memoria para evitar índice compuesto
  useEffect(() => {
    const qRef = query(collection(db, "solicitudes"), where("estado", "==", "pendiente"));
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setSolicitudesNuevas(rows.slice(0, 5));
    });
    return () => unsub();
  }, []);

  // Últimas evoluciones + mapa de pacientes
  useEffect(() => {
    const qRef = query(collection(db, "evoluciones"), orderBy("createdAt", "desc"), limit(5));
    const unsub = onSnapshot(qRef, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUltEvo(rows);

      const ids = [...new Set(rows.map((r) => r.pacienteId).filter(Boolean))];
      if (!ids.length) { setPacMap({}); return; }

      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

      const map = {};
      await Promise.all(chunks.map(async (chunk) => {
        const s = await getDocs(
          query(collection(db, "usuarios"), where(documentId(), "in", chunk))
        );
        s.forEach((u) => { map[u.id] = u.data(); });
      }));
      setPacMap(map);
    });
    return () => unsub();
  }, []);

  const nombreDe = (id) => {
    const u = pacMap[id];
    if (!u) return id; // while loading
    const full = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
    return full || u.email || id;
  };

  if (role !== "medico") return null;

  return (
    <div className="container" style={{ display: "grid", gap: 16 }}>
      {/* Acciones */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link to="/medico/invitar" className="btn btn-primary">Invitar paciente</Link>
        <Link to="/medico/solicitudes" className="btn btn-outline">Ver solicitudes</Link>
        <Link to="/medico/disponibilidad" className="btn btn-outline">Disponibilidad</Link>
      </div>

      {/* KPI cards (responsive con .kpi-grid) */}
      <div className="kpi-grid">
        <div className="card">
          <div className="muted">Turnos HOY</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{turnosHoy}</div>
          <div className="muted">Confirmados para hoy</div>
        </div>
        <div className="card">
          <div className="muted">Pendientes de confirmar</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{propuestasCount}</div>
          <div className="muted">Propuestas enviadas</div>
        </div>
        <div className="card">
          <div className="muted">Próximos turnos</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{proximosCount}</div>
          <div className="muted">En el rango seleccionado</div>
        </div>
        <div className="card">
          <div className="muted">Pacientes</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{pacientesCount}</div>
          <div className="muted">Total en sistema</div>
        </div>
      </div>

      {/* Filtros de rango */}
      <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <label className="muted" htmlFor="desde">Desde</label>
          <input id="desde" type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="muted" htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div style={{ alignSelf: "center" }}>
          <Link to="/medico/turnos" className="btn btn-outline">Ver agenda completa</Link>
        </div>
      </div>

      {/* Agenda de hoy + Últimas evoluciones */}
      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Agenda de hoy</h3>
          {agendaHoy.length === 0 ? (
            <div className="muted">No hay turnos confirmados para hoy.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {agendaHoy.map((t) => (
                <li key={t.id} className="item">
                  <strong>{fmtHora(t.propuesta?.hora)}</strong>{" "}
                  — {t.pacienteNombre || t.pacienteEmail || t.pacienteId || "Paciente"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Últimas evoluciones</h3>
          {ultEvo.length === 0 ? (
            <div className="muted">Sin evoluciones recientes.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {ultEvo.map((evo) => (
                <li key={evo.id} className="item">
                  <div className="muted">
                    {evo.createdAt?.toDate ? evo.createdAt.toDate().toLocaleString() : ""}
                  </div>
                  <div>
                    <span className="muted">Paciente:</span>{" "}
                    {evo.pacienteNombre || nombreDe(evo.pacienteId)}
                  </div>
                  {evo.texto && <div>{evo.texto}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Propuestas pendientes (sin Confirmar/Rechazar) */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Propuestas pendientes</h3>
        {pendientesPropuesta.length === 0 ? (
          <div className="muted">No hay propuestas pendientes.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {pendientesPropuesta.map((s) => (
              <li key={s.id} className="item" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <div>
                  <strong>{fmtFechaES(s.propuesta?.dia)}</strong>{" "}
                  · <strong>{fmtHora(s.propuesta?.hora)}</strong>{" "}
                  · {s.franja === "manana" ? "Mañana" : "Tarde"} —{" "}
                  <span className="muted">
                    ({s.pacienteNombre || s.pacienteEmail || s.pacienteId || "Paciente"})
                  </span>
                </div>
                <div className="btn-row">
                  <Link to="/medico/solicitudes" className="btn btn-outline">Ver solicitud</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Solicitudes nuevas */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Solicitudes nuevas</h3>
        {solicitudesNuevas.length === 0 ? (
          <div className="muted">No hay solicitudes pendientes.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {solicitudesNuevas.map((s) => (
              <li key={s.id} className="item">
                <strong>{fmtFechaES(s.diaSolicitado)}</strong> ·{" "}
                {s.franja === "manana" ? "Mañana" : "Tarde"} —{" "}
                <span className="muted">
                  {s.pacienteNombre || s.pacienteEmail || s.pacienteId || "Paciente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pacientes recientes */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pacientes recientes</h3>
        <PacientesRecientes />
      </div>
    </div>
  );
}

// Subcomponente: Pacientes recientes (sin índice compuesto)
function PacientesRecientes() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const qRef = query(collection(db, "usuarios"), where("role", "==", "paciente"));
    const unsub = onSnapshot(qRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordenamos en cliente por updatedAt desc y tomamos 5
      list.sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
      setRows(list.slice(0, 5));
    });
    return () => unsub();
  }, []);

  if (rows.length === 0) return <div className="muted">Sin pacientes aún.</div>;

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {rows.map((p) => {
        const nombre = [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "- -";
        const email = p.email || "";
        return (
          <li key={p.id} className="item" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
            <div>
              <div>{nombre}</div>
              <div className="muted">{email}</div>
            </div>
            <button className="btn btn-outline" onClick={() => nav(`/medico/paciente/${p.id}`)}>
              Abrir
            </button>
          </li>
        );
      })}
    </ul>
  );
}
