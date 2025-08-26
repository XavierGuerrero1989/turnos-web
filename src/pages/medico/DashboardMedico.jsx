// src/pages/medico/DashboardMedico.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  collection, query, where, onSnapshot, orderBy, limit,
  getDocs, doc, updateDoc
} from "firebase/firestore";
import Swal from "sweetalert2";

// Helpers
const toDate = (yyyy_mm_dd, hhmm = "00:00") => {
  if (!yyyy_mm_dd) return null;
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const fmtDay = (d) => d.toISOString().slice(0, 10);
const todayStr = () => fmtDay(new Date());

export default function DashboardMedico() {
  const { role, loading } = useAuth();
  const [sols, setSols] = useState([]);         // solicitudes
  const [pacs, setPacs] = useState([]);         // pacientes
  const [evols, setEvols] = useState([]);       // evoluciones
  const [busyId, setBusyId] = useState(null);

  // Filtros (por defecto: últimos 30 días hacia adelante)
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return fmtDay(d);
  });
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 60);
    return fmtDay(d);
  });

  // Gate
  if (loading) return null;
  if (role !== "medico") return null;

  // Suscripción a solicitudes
  useEffect(() => {
    const qRef = query(collection(db, "solicitudes"));
    const unsub = onSnapshot(qRef, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSols(arr);
    });
    return () => unsub();
  }, []);

  // Pacientes (no necesito tiempo real, sólo un fetch al entrar)
  useEffect(() => {
    const fetch = async () => {
      const qRef = query(collection(db, "usuarios"), where("role", "==", "paciente"));
      const res = await getDocs(qRef);
      setPacs(res.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetch();
  }, []);

  // Últimas evoluciones (live)
  useEffect(() => {
    const qRef = query(collection(db, "evoluciones"), orderBy("createdAt", "desc"), limit(10));
    const unsub = onSnapshot(qRef, (snap) => {
      setEvols(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Derivados
  const hoy = todayStr();

  const agendaHoy = useMemo(() => {
    return sols
      .filter((s) => s.estado === "confirmada" && s.propuesta?.dia === hoy)
      .map((s) => ({ ...s, _when: toDate(s.propuesta.dia, s.propuesta.hora) }))
      .sort((a, b) => (a._when?.getTime() ?? 0) - (b._when?.getTime() ?? 0));
  }, [sols, hoy]);

  const propuestasPend = useMemo(() => {
    // filtro por rango si la propuesta tiene fecha
    return sols
      .filter((s) => s.estado === "propuesta")
      .filter((s) => {
        const d = toDate(s.propuesta?.dia, s.propuesta?.hora);
        if (!d) return true;
        return fmtDay(d) >= from && fmtDay(d) <= to;
      })
      .sort((a, b) => {
        const ad = toDate(a.propuesta?.dia, a.propuesta?.hora);
        const bd = toDate(b.propuesta?.dia, b.propuesta?.hora);
        return (ad?.getTime() ?? 0) - (bd?.getTime() ?? 0);
      });
  }, [sols, from, to]);

  const solicitudesNuevas = useMemo(() => {
    return sols
      .filter((s) => s.estado === "pendiente")
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      .slice(0, 6);
  }, [sols]);

  const proximasConfirmadas = useMemo(() => {
    const fromD = new Date(from);
    const toD = new Date(to);
    return sols
      .filter((s) => s.estado === "confirmada" && s.propuesta?.dia)
      .map((s) => ({ ...s, _when: toDate(s.propuesta.dia, s.propuesta.hora) }))
      .filter((s) => s._when && s._when >= fromD && s._when <= toD)
      .sort((a, b) => a._when - b._when);
  }, [sols, from, to]);

  // KPIs
  const kpiHoy = agendaHoy.length;
  const kpiPend = propuestasPend.length;
  const kpiProx = proximasConfirmadas.length;
  const kpiPacs = pacs.length;

  // Actions
  const aceptar = async (sol) => {
    setBusyId(sol.id);
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "confirmada" });
      Swal.fire("Confirmado ✅", "Turno confirmado.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo confirmar", "error");
    } finally {
      setBusyId(null);
    }
  };

  const rechazar = async (sol) => {
    const ok = await Swal.fire({
      title: "Rechazar propuesta",
      text: "¿Querés rechazar esta propuesta?",
      icon: "question",
      showCancelButton: true,
    });
    if (!ok.isConfirmed) return;
    setBusyId(sol.id);
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "pendiente", propuesta: null });
      Swal.fire("Listo", "La propuesta fue rechazada.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo rechazar", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container" style={{ display: "grid", gap: 12 }}>
      {/* Encabezado + acciones rápidas */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <div className="btn-row">
          <Link to="/medico/invitar" className="btn btn-primary">Invitar paciente</Link>
          <Link to="/medico/solicitudes" className="btn btn-outline">Ver solicitudes</Link>
          <Link to="/medico/disponibilidad" className="btn btn-outline">Disponibilidad</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Kpi label="Turnos HOY" value={kpiHoy} helper="Confirmados para hoy" />
        <Kpi label="Pendientes de confirmar" value={kpiPend} helper="Propuestas enviadas" />
        <Kpi label="Próximos turnos" value={kpiProx} helper="En el rango seleccionado" />
        <Kpi label="Pacientes" value={kpiPacs} helper="Total en sistema" />
      </div>

      {/* Filtros */}
      <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12 }}>
        <div>
          <label className="label">Desde</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div style={{ alignSelf: "end" }}>
          <Link to="/medico/turnos" className="btn btn-outline">Ver agenda completa</Link>
        </div>
      </div>

      {/* Grids principales */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        {/* Columna izquierda */}
        <div className="stack">
          {/* Agenda de hoy */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Agenda de hoy</h3>
            {agendaHoy.length === 0 ? (
              <div className="helper">No hay turnos confirmados para hoy.</div>
            ) : (
              agendaHoy.map((s) => (
                <Row key={s.id}
                  left={
                    <>
                      <b>{s.propuesta.hora || "-"}</b> · {s.pacienteNombre || s.pacienteId || "Paciente"}
                    </>
                  }
                  right={
                    <Link className="btn btn-outline" to={`/medico/paciente/${s.pacienteId || ""}`}>
                      Ver ficha
                    </Link>
                  }
                />
              ))
            )}
          </div>

          {/* Propuestas pendientes (acciones) */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Propuestas pendientes</h3>
            {propuestasPend.length === 0 ? (
              <div className="helper">No hay propuestas pendientes de confirmación.</div>
            ) : (
              propuestasPend.map((s) => (
                <Row
                  key={s.id}
                  left={
                    <>
                      <b>{s.propuesta?.dia || "-"}</b> · {s.propuesta?.hora || "-"} ·{" "}
                      {s.franja === "manana" ? "Mañana" : "Tarde"} —{" "}
                      <span className="helper">({s.pacienteNombre || s.pacienteId || "Paciente"})</span>
                    </>
                  }
                  right={
                    <div className="btn-row">
                      <button className="btn btn-primary" disabled={busyId === s.id} onClick={() => aceptar(s)}>
                        {busyId === s.id ? "Confirmando..." : "Confirmar"}
                      </button>
                      <button className="btn btn-outline" disabled={busyId === s.id} onClick={() => rechazar(s)}>
                        {busyId === s.id ? "Procesando..." : "Rechazar"}
                      </button>
                    </div>
                  }
                />
              ))
            )}
          </div>

          {/* Solicitudes nuevas */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Solicitudes nuevas</h3>
            {solicitudesNuevas.length === 0 ? (
              <div className="helper">No hay solicitudes pendientes.</div>
            ) : (
              solicitudesNuevas.map((s) => (
                <Row
                  key={s.id}
                  left={
                    <>
                      <b>{s.diaSolicitado || "-"}</b> · {s.franja === "manana" ? "Mañana" : "Tarde"} —{" "}
                      <span className="helper">{s.pacienteNombre || s.pacienteId || "Paciente"}</span>
                    </>
                  }
                  right={<Link className="btn btn-outline" to="/medico/solicitudes">Gestionar</Link>}
                />
              ))
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="stack">
          {/* Últimas evoluciones */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Últimas evoluciones</h3>
            {evols.length === 0 ? (
              <div className="helper">Sin evoluciones recientes.</div>
            ) : (
              evols.map((ev) => (
                <div key={ev.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 700 }}>
                    {new Date(ev.createdAt?.seconds ? ev.createdAt.seconds * 1000 : Date.now()).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  <div className="helper">
                    Paciente: <Link to={`/medico/paciente/${ev.pacienteId}`}>{ev.pacienteId}</Link>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{ev.texto}</div>
                </div>
              ))
            )}
          </div>

          {/* Pacientes recientes */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Pacientes recientes</h3>
            {pacs.length === 0 ? (
              <div className="helper">Sin pacientes aún.</div>
            ) : (
              pacs
                .slice() // copia
                .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
                .slice(0, 8)
                .map((p) => (
                  <Row
                    key={p.id}
                    left={<>{p.nombre || "-"} {p.apellido || ""} <span className="helper">· {p.email}</span></>}
                    right={<Link className="btn btn-outline" to={`/medico/paciente/${p.id}`}>Abrir</Link>}
                  />
                ))
            )}
            <div style={{ marginTop: 8 }}>
              <Link className="btn btn-outline" to="/medico/pacientes">Ver todos</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- UI Helpers --- */
function Kpi({ label, value, helper }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div className="helper">{helper}</div>
    </div>
  );
}

function Row({ left, right }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
