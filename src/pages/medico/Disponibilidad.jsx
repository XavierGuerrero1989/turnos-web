// src/pages/medico/Disponibilidad.jsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase.js";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  setDoc
} from "firebase/firestore";

// ---- helpers de fecha ----
const toISO = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const startOfWeekMon = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Lunes, ..., 6=Domingo
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
};
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const firstOfMonth = (year, month) => new Date(year, month, 1); // month: 0-11
const monthLabel = (d) => d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

export default function Disponibilidad() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  // Redirigir si NO es médico
  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(firstOfMonth(today.getFullYear(), today.getMonth()));
  const [selectedWeekStart, setSelectedWeekStart] = useState(startOfWeekMon(today));
  const [disponibilidades, setDisponibilidades] = useState({});
  const [loadingData, setLoadingData] = useState(true);

  // Cargar TODAS las disponibilidades (simple). Luego podés optimizar a un rango si querés.
  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(db, "disponibilidades"));
        const data = {};
        snapshot.forEach((d) => { data[d.id] = d.data(); });
        setDisponibilidades(data);
      } catch (err) {
        console.error("Error cargando disponibilidades:", err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  // Días de la semana seleccionada (Lun‑Dom)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(selectedWeekStart, i));
  }, [selectedWeekStart]);

  // Calendario mensual (6 filas x 7 días)
  const calendarGrid = useMemo(() => {
    const first = firstOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const gridStart = startOfWeekMon(first);
    return Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
  }, [currentMonth]);

  const isInSelectedWeek = (date) => {
    const start = selectedWeekStart;
    const end = addDays(start, 6);
    return date >= start && date <= end;
  };

  const prevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(firstOfMonth(d.getFullYear(), d.getMonth()));
  };
  const nextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(firstOfMonth(d.getFullYear(), d.getMonth()));
  };

  // Cambiar disponibilidad de un día / franja
  const toggleDisponibilidad = async (fechaISO, franja) => {
    const actual = disponibilidades[fechaISO] || { manana: false, tarde: false };
    const updated = { ...actual, dia: fechaISO, [franja]: !actual[franja] };

    try {
      await setDoc(doc(db, "disponibilidades", fechaISO), updated, { merge: true });
      setDisponibilidades((prev) => ({ ...prev, [fechaISO]: updated }));
    } catch (err) {
      console.error("Error guardando disponibilidad:", err);
    }
  };

  if (loadingData) return <p style={{ padding:16 }}>Cargando disponibilidades…</p>;
  if (role !== "medico") return null;

  return (
    <div className="container" style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* ---------- Calendario mensual ---------- */}
      <div style={{
        background:"#fff", border:"1px solid var(--border)", borderRadius:16,
        boxShadow:"var(--shadow)", padding:16
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <button className="btn btn-outline" onClick={prevMonth}>◀</button>
          <h2 style={{ margin:0, textTransform:"capitalize" }}>{monthLabel(currentMonth)}</h2>
          <button className="btn btn-outline" onClick={nextMonth}>▶</button>
          <span style={{ marginLeft:"auto", color:"var(--muted)" }}>
            Seleccioná un día para elegir su semana (Lun‑Dom)
          </span>
        </div>

        {/* encabezado de días */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8,
          color:"var(--muted)", fontWeight:600, marginBottom:6
        }}>
          {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d)=>(
            <div key={d} style={{ textAlign:"center" }}>{d}</div>
          ))}
        </div>

        {/* grilla de fechas */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8 }}>
          {calendarGrid.map((d) => {
            const inMonth = d.getMonth() === currentMonth.getMonth();
            const selected = isInSelectedWeek(d);
            const isToday = toISO(d) === toISO(today);
            return (
              <button
                key={toISO(d)}
                onClick={() => setSelectedWeekStart(startOfWeekMon(d))}
                style={{
                  padding:"10px 0",
                  border:"1px solid " + (selected ? "var(--primary)" : "var(--border)"),
                  borderRadius:12,
                  background: selected ? "var(--primary-bg)" : "#fff",
                  color: inMonth ? "inherit" : "#94a3b8",
                  fontWeight: isToday ? 700 : 500,
                  cursor:"pointer"
                }}
                title={`Seleccionar semana de ${d.toLocaleDateString("es-AR")}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Semana seleccionada (controles) ---------- */}
      <div>
        <h3 style={{ margin:"8px 0" }}>
          Semana seleccionada: {toISO(weekDays[0])} a {toISO(weekDays[6])}
        </h3>
        <p className="helper">Tildá Mañana/Tarde por cada día para abrir o cerrar turnos.</p>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",
        gap:12
      }}>
        {weekDays.map((d) => {
          const fechaISO = toISO(d);
          const disp = disponibilidades[fechaISO] || { manana: false, tarde: false };
          return (
            <div key={fechaISO} style={{
              background:"#fff", border:"1px solid var(--border)", borderRadius:12,
              boxShadow:"var(--shadow)", padding:14, display:"flex", flexDirection:"column", gap:10
            }}>
              <div style={{ fontWeight:700 }}>
                {d.toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"short" })}
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button
                  onClick={() => toggleDisponibilidad(fechaISO, "manana")}
                  className={disp.manana ? "btn btn-primary" : "btn btn-outline"}
                  style={{ flex:1 }}
                >
                  Mañana {disp.manana ? "✅" : ""}
                </button>
                <button
                  onClick={() => toggleDisponibilidad(fechaISO, "tarde")}
                  className={disp.tarde ? "btn btn-primary" : "btn btn-outline"}
                  style={{ flex:1 }}
                >
                  Tarde {disp.tarde ? "✅" : ""}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
