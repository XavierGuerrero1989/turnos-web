import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import "./SolicitarTurno.css"; // 👈 CSS del componente

// Helpers de fecha
const toISO = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const firstOfMonth = (y, m) => new Date(y, m, 1);
const monthLabel = (d) =>
  d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const startOfWeekMon = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function SolicitarTurno() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();

  // Redirigir si NO es paciente
  useEffect(() => {
    if (!loading && (!user || role === "medico")) {
      nav(role === "medico" ? "/medico" : "/login", { replace: true });
    }
  }, [user, role, loading, nav]);

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    firstOfMonth(today.getFullYear(), today.getMonth())
  );
  const [disponibilidades, setDisponibilidades] = useState({}); // { "YYYY-MM-DD": { manana:bool, tarde:bool } }
  const [loadingData, setLoadingData] = useState(true);

  // selección
  const [selectedDay, setSelectedDay] = useState(null); // "YYYY-MM-DD"
  const [franja, setFranja] = useState(""); // "manana" | "tarde"
  const [comentario, setComentario] = useState("");

  // Traer todas las disponibilidades (MVP)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = await getDocs(collection(db, "disponibilidades"));
        const map = {};
        q.forEach((docSnap) => {
          const d = docSnap.data();
          map[docSnap.id] = {
            manana: !!(
              d.manana?.abierto ??
              d.manana ??
              d.maniana?.abierto ??
              d.maniana
            ),
            tarde: !!(d.tarde?.abierto ?? d.tarde),
          };
        });
        setDisponibilidades(map);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  // Calendario mensual (6 filas x 7 col)
  const calendarGrid = useMemo(() => {
    const gridStart = startOfWeekMon(
      firstOfMonth(currentMonth.getFullYear(), currentMonth.getMonth())
    );
    return Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
  }, [currentMonth]);

  const inThisMonth = (d) => d.getMonth() === currentMonth.getMonth();

  const prevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(firstOfMonth(d.getFullYear(), d.getMonth()));
    setSelectedDay(null);
    setFranja("");
  };

  const nextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(firstOfMonth(d.getFullYear(), d.getMonth()));
    setSelectedDay(null);
    setFranja("");
  };

  const handleSelectDay = (d) => {
    const iso = toISO(d);

    // Solo permitir futuro/presente
    if (d < new Date(today.toDateString())) return;

    // Solo permitir si hay al menos una franja abierta
    const disp = disponibilidades[iso];
    if (!disp || (!disp.manana && !disp.tarde)) return;

    setSelectedDay(iso);

    // Autoseleccionar franja si hay una sola abierta
    if (disp.manana && !disp.tarde) setFranja("manana");
    else if (!disp.manana && disp.tarde) setFranja("tarde");
    else setFranja("");
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!selectedDay)
      return Swal.fire(
        "Falta elegir día",
        "Seleccioná un día disponible.",
        "warning"
      );
    if (!franja)
      return Swal.fire("Falta la franja", "Elegí mañana o tarde.", "warning");

    try {
      // ✅ Fix: guardamos perfilData para usarlo sin romper
      let perfilData = null;

      // Buscar datos del paciente en /usuarios/{uid}
      let pacienteNombre = user?.displayName || "";
      try {
        const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (perfilSnap.exists()) {
          perfilData = perfilSnap.data();
          const full = [perfilData.nombre, perfilData.apellido]
            .filter(Boolean)
            .join(" ")
            .trim();
          if (full) pacienteNombre = full;
        }
      } catch (e) {
        console.warn("No se pudo leer usuario:", e);
      }

      if (!pacienteNombre || !pacienteNombre.trim()) {
        pacienteNombre = `Paciente ${user.uid.slice(0, 6)}`;
      }

      await addDoc(collection(db, "solicitudes"), {
        pacienteId: user.uid,
        pacienteNombre,
        pacienteEmail: user.email || perfilData?.email || "",
        diaSolicitado: selectedDay,
        franja,
        comentario: comentario || "",
        estado: "pendiente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await Swal.fire(
        "Solicitud enviada",
        "El médico te propondrá un horario específico.",
        "success"
      );
      nav("/mis-turnos");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err.message || "No se pudo enviar la solicitud", "error");
    }
  };

  if (loading || loadingData) return null;

  // obtener disponibilidad del día seleccionado
  const selDisp = selectedDay
    ? disponibilidades[selectedDay] || { manana: false, tarde: false }
    : null;

  return (
    <div className="container solicitarTurnoLayout">
      {/* Calendario */}
      <div className="stCard">
        <div className="stCalendarHeader">
          <button className="btn btn-outline" onClick={prevMonth}>
            ◀
          </button>

          <h2 className="stMonthTitle">{monthLabel(currentMonth)}</h2>

          <button className="btn btn-outline" onClick={nextMonth}>
            ▶
          </button>

          <span className="helper stHelper">Elegí un día disponible</span>
        </div>

        <div className="stWeekdays">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="stWeekdayCell">
              {d}
            </div>
          ))}
        </div>

        <div className="stCalendarGrid">
          {calendarGrid.map((d) => {
            const iso = toISO(d);
            const isToday = iso === toISO(today);
            const disp = disponibilidades[iso];
            const hasAny = disp && (disp.manana || disp.tarde);
            const isPast = d < new Date(today.toDateString());
            const selected = selectedDay === iso;

            const disabled = !inThisMonth(d) || isPast || !hasAny;

            const isAvailable = !disabled; // disponible real (en este mes, no pasado y con franjas)

            return (
              <button
                key={iso}
                onClick={() => !disabled && handleSelectDay(d)}
                disabled={disabled}
                className={[
                  "stDay",
                  isAvailable ? "stDay--available" : "stDay--unavailable",
                  selected ? "stDay--selected" : "",
                  isToday ? "stDay--today" : "",
                  inThisMonth(d) ? "" : "stDay--otherMonth",
                ].join(" ")}
                title={
                  disabled
                    ? "Día no disponible"
                    : `Seleccionar ${d.toLocaleDateString("es-AR")}`
                }
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel de solicitud */}
      <div className="stCard">
        <h3 className="stPanelTitle">Solicitar turno</h3>

        <form onSubmit={submit} className="stack-lg">
          <div className="stack">
            <label className="label">Día seleccionado</label>
            <input
              className="input"
              value={selectedDay || ""}
              placeholder="Elegí un día en el calendario"
              disabled
            />
          </div>

          <div className="stack">
            <label className="label">Franja</label>

            <div className="btn-row stFranjaRow">
              <button
                type="button"
                onClick={() => selDisp?.manana && setFranja("manana")}
                className={`btn ${franja === "manana" ? "btn-primary" : "btn-outline"}`}
                disabled={!selDisp || !selDisp.manana}
              >
                Mañana {selDisp?.manana ? "" : " (no disponible)"}
              </button>

              <button
                type="button"
                onClick={() => selDisp?.tarde && setFranja("tarde")}
                className={`btn ${franja === "tarde" ? "btn-primary" : "btn-outline"}`}
                disabled={!selDisp || !selDisp.tarde}
              >
                Tarde {selDisp?.tarde ? "" : " (no disponible)"}
              </button>
            </div>
          </div>

          <div className="stack">
            <label className="label">Comentario (opcional)</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Motivo de la consulta, preferencia de horario, etc."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            Enviar solicitud
          </button>
        </form>
      </div>
    </div>
  );
}
