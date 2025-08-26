// src/pages/medico/PacienteFicha.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  doc, getDoc, updateDoc,
  collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, deleteDoc
} from "firebase/firestore";
import Swal from "sweetalert2";

// helpers
const toDateTimeStr = (ts) => {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};
const toDate = (yyyy_mm_dd, hhmm = "00:00") => {
  if (!yyyy_mm_dd) return null;
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

export default function PacienteFicha() {
  const { role, loading, user } = useAuth(); // user = médico logueado
  const { id: pacienteId } = useParams();    // /medico/paciente/:id
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [pac, setPac] = useState(null);
  const [form, setForm] = useState({ nombre:"", apellido:"", dni:"", email:"", telefono:"" });
  const [saving, setSaving] = useState(false);

  // 🔹 NUEVO: estado para datos clínicos
  const [clin, setClin] = useState({
    edad: "",
    antecedentesPersonales: "",
    antecedentesQuirurgicos: "",
    medicacion: "",
    gestas: "",
    partos: "",
    cesareas: "",
    abortos: "",
    ritmoMenstrual: "",
    pareja: "", // "si" | "no" | ""
    ultimoControlGinecologico: "",
    metodoAnticonceptivo: "",
    antecedentesAHF: "",
  });

  const [sols, setSols] = useState([]);              // solicitudes del paciente
  const [evols, setEvols] = useState([]);            // evoluciones del paciente
  const [nuevoTxt, setNuevoTxt] = useState("");
  const [posting, setPosting] = useState(false);

  // cargar paciente
  useEffect(() => {
    if (!pacienteId) return;
    getDoc(doc(db, "usuarios", pacienteId))
      .then(s => {
        const data = s.data() || {};
        setPac({ id: pacienteId, ...data });
        setForm({
          nombre: data.nombre || "",
          apellido: data.apellido || "",
          dni: data.dni || "",
          email: data.email || "",
          telefono: data.telefono || "",
        });
        // 🔹 Cargar datos clínicos existentes
        const c = data.clinica || {};
        setClin({
          edad: c.edad ?? "",
          antecedentesPersonales: c.antecedentesPersonales ?? "",
          antecedentesQuirurgicos: c.antecedentesQuirurgicos ?? "",
          medicacion: c.medicacion ?? "",
          gestas: c.gestas ?? "",
          partos: c.partos ?? "",
          cesareas: c.cesareas ?? "",
          abortos: c.abortos ?? "",
          ritmoMenstrual: c.ritmoMenstrual ?? "",
          pareja: c.pareja ?? "",
          ultimoControlGinecologico: c.ultimoControlGinecologico ?? "",
          metodoAnticonceptivo: c.metodoAnticonceptivo ?? "",
          antecedentesAHF: c.antecedentesAHF ?? "",
        });
      })
      .catch((e) => console.error(e));
  }, [pacienteId]);

  // suscribirse a solicitudes del paciente (contexto)
  useEffect(() => {
    if (!pacienteId) return;
    const qRef = query(collection(db, "solicitudes"), where("pacienteId","==",pacienteId));
    const unsub = onSnapshot(qRef, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // ordenar por fecha de turno si existe, sino createdAt
      arr.sort((a,b) => {
        const ad = toDate(a.propuesta?.dia || a.diaSolicitado, a.propuesta?.hora);
        const bd = toDate(b.propuesta?.dia || b.diaSolicitado, b.propuesta?.hora);
        return (bd?.getTime() ?? 0) - (ad?.getTime() ?? 0);
      });
      setSols(arr);
    });
    return () => unsub();
  }, [pacienteId]);

  // suscribirse a evoluciones del paciente
  useEffect(() => {
    if (!pacienteId) return;
    const qRef = query(collection(db, "evoluciones"), where("pacienteId","==",pacienteId));
    const unsub = onSnapshot(qRef, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // más recientes primero
      arr.sort((a,b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setEvols(arr);
    });
    return () => unsub();
  }, [pacienteId]);

  const proximoTurno = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    return sols
      .filter(s => s.estado === "confirmada" && s.propuesta?.dia)
      .map(s => ({ ...s, _when: toDate(s.propuesta.dia, s.propuesta.hora) }))
      .filter(s => s._when && s._when >= hoy)
      .sort((a,b) => a._when - b._when)[0] || null;
  }, [sols]);

  const ultimasSolicitudes = useMemo(() => sols.slice(0,5), [sols]);

  const savePaciente = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      // sanitizar numéricos (permitir vacío)
      const toNum = (v) => (v === "" || v === null ? "" : Number(v));
      const clinica = {
        edad: toNum(clin.edad),
        antecedentesPersonales: clin.antecedentesPersonales || "",
        antecedentesQuirurgicos: clin.antecedentesQuirurgicos || "",
        medicacion: clin.medicacion || "",
        gestas: toNum(clin.gestas),
        partos: toNum(clin.partos),
        cesareas: toNum(clin.cesareas),
        abortos: toNum(clin.abortos),
        ritmoMenstrual: clin.ritmoMenstrual || "",
        pareja: clin.pareja || "",
        ultimoControlGinecologico: clin.ultimoControlGinecologico || "",
        metodoAnticonceptivo: clin.metodoAnticonceptivo || "",
        antecedentesAHF: clin.antecedentesAHF || "",
      };

      await updateDoc(doc(db, "usuarios", pacienteId), {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        clinica, // 👈 agrupado en un objeto
        updatedAt: serverTimestamp(),
      });
      Swal.fire("Guardado", "Datos del paciente actualizados.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const agregarEvolucion = async () => {
    if (!nuevoTxt.trim()) {
      return Swal.fire("Escribí algo", "El texto de la evolución está vacío.", "warning");
    }
    setPosting(true);
    try {
      await addDoc(collection(db, "evoluciones"), {
        pacienteId,
        medicoId: user?.uid || "",
        medicoNombre: user?.displayName || "",  // opcional
        texto: nuevoTxt.trim(),
        createdAt: serverTimestamp(),
      });
      setNuevoTxt("");
      Swal.fire("Agregado", "Evolución registrada.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo guardar la evolución", "error");
    } finally {
      setPosting(false);
    }
  };

  const eliminarEvolucion = async (ev) => {
    const ok = await Swal.fire({
      title: "Eliminar evolución",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await deleteDoc(doc(db, "evoluciones", ev.id));
      Swal.fire("Eliminada", "Evolución eliminada.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo eliminar", "error");
    }
  };

  if (role !== "medico") return null;

  return (
    <div className="container" style={{ display:"grid", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Link to="/medico/pacientes" className="btn btn-outline">◀ Volver</Link>
        <h2 style={{ margin:0 }}>Ficha del paciente</h2>
      </div>

      {/* Datos básicos + clínicos */}
      <div className="card" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <form className="stack" onSubmit={savePaciente}>
          {/* Básicos */}
          <div className="stack">
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e)=>setForm(f=>({...f, nombre:e.target.value}))} />
          </div>
          <div className="stack">
            <label className="label">Apellido</label>
            <input className="input" value={form.apellido} onChange={(e)=>setForm(f=>({...f, apellido:e.target.value}))} />
          </div>
          <div className="stack">
            <label className="label">DNI</label>
            <input className="input" value={form.dni} onChange={(e)=>setForm(f=>({...f, dni:e.target.value}))} />
          </div>
          <div className="stack">
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={(e)=>setForm(f=>({...f, email:e.target.value}))} />
          </div>
          <div className="stack">
            <label className="label">Teléfono</label>
            <input className="input" value={form.telefono} onChange={(e)=>setForm(f=>({...f, telefono:e.target.value}))} />
          </div>

          {/* 🔹 Sección clínica */}
          <hr style={{ border:"none", borderTop:"1px solid var(--border)", margin:"8px 0" }} />
          <h3 style={{ margin:"0 0 4px" }}>Datos clínicos</h3>

          <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(3, minmax(0,1fr))" }}>
            <div>
              <label className="label">Edad</label>
              <input className="input" type="number" min="0" value={clin.edad} onChange={e=>setClin(c=>({...c, edad:e.target.value}))} />
            </div>
            <div>
              <label className="label">Gestas</label>
              <input className="input" type="number" min="0" value={clin.gestas} onChange={e=>setClin(c=>({...c, gestas:e.target.value}))} />
            </div>
            <div>
              <label className="label">Partos</label>
              <input className="input" type="number" min="0" value={clin.partos} onChange={e=>setClin(c=>({...c, partos:e.target.value}))} />
            </div>
            <div>
              <label className="label">Cesáreas</label>
              <input className="input" type="number" min="0" value={clin.cesareas} onChange={e=>setClin(c=>({...c, cesareas:e.target.value}))} />
            </div>
            <div>
              <label className="label">Abortos</label>
              <input className="input" type="number" min="0" value={clin.abortos} onChange={e=>setClin(c=>({...c, abortos:e.target.value}))} />
            </div>
            <div>
              <label className="label">Pareja</label>
              <select className="input" value={clin.pareja} onChange={e=>setClin(c=>({...c, pareja:e.target.value}))}>
                <option value="">—</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(2, minmax(0,1fr))" }}>
            <div>
              <label className="label">Ritmo menstrual</label>
              <input className="input" placeholder="p.ej. regular 28 días" value={clin.ritmoMenstrual} onChange={e=>setClin(c=>({...c, ritmoMenstrual:e.target.value}))} />
            </div>
            <div>
              <label className="label">Último control ginecológico</label>
              <input className="input" type="date" value={clin.ultimoControlGinecologico} onChange={e=>setClin(c=>({...c, ultimoControlGinecologico:e.target.value}))} />
            </div>
            <div>
              <label className="label">Método anticonceptivo</label>
              <input className="input" value={clin.metodoAnticonceptivo} onChange={e=>setClin(c=>({...c, metodoAnticonceptivo:e.target.value}))} />
            </div>
          </div>

          <div className="stack">
            <div>
              <label className="label">Antecedentes personales</label>
              <textarea className="input" rows={3} value={clin.antecedentesPersonales} onChange={e=>setClin(c=>({...c, antecedentesPersonales:e.target.value}))} />
            </div>
            <div>
              <label className="label">Antecedentes quirúrgicos</label>
              <textarea className="input" rows={3} value={clin.antecedentesQuirurgicos} onChange={e=>setClin(c=>({...c, antecedentesQuirurgicos:e.target.value}))} />
            </div>
            <div>
              <label className="label">Medicación</label>
              <textarea className="input" rows={3} value={clin.medicacion} onChange={e=>setClin(c=>({...c, medicacion:e.target.value}))} />
            </div>
            <div>
              <label className="label">Antecedentes AHF</label>
              <textarea className="input" rows={3} value={clin.antecedentesAHF} onChange={e=>setClin(c=>({...c, antecedentesAHF:e.target.value}))} />
            </div>
          </div>

          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        {/* Contexto rápido: próximo turno + últimas solicitudes */}
        <div className="stack">
          <div className="card" style={{ border:"1px solid var(--border)", borderRadius:12, padding:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Próximo turno</div>
            {!proximoTurno ? (
              <div className="helper">No hay turnos confirmados próximos.</div>
            ) : (
              <div>
                <div><b>{proximoTurno.propuesta.dia}</b> · <b>{proximoTurno.propuesta.hora || "-"}</b> ({proximoTurno.franja === "manana" ? "Mañana" : "Tarde"})</div>
                {proximoTurno.pago && (
                  <div className="helper" style={{ marginTop:6 }}>
                    Pago: <b style={{ color: proximoTurno.pago === "confirmado" ? "green" : "crimson" }}>
                      {proximoTurno.pago === "confirmado" ? "Confirmado" : "Pendiente"}
                    </b>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card" style={{ border:"1px solid var(--border)", borderRadius:12, padding:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Últimas solicitudes</div>
            {ultimasSolicitudes.length === 0 ? (
              <div className="helper">Sin solicitudes aún.</div>
            ) : ultimasSolicitudes.map(s => (
              <div key={s.id} className="helper" style={{ padding:"6px 0", borderTop:"1px solid var(--border)" }}>
                {(s.propuesta?.dia || s.diaSolicitado) || "-"}
                {s.propuesta?.hora ? ` · ${s.propuesta.hora}` : ""}
                {` · ${s.franja === "manana" ? "Mañana" : "Tarde"} — `}
                <b>{s.estado}</b>
              </div>
            ))}
            <div style={{ marginTop:8 }}>
              <Link className="btn btn-outline" to="/medico/solicitudes">Ver solicitudes</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Evolución clínica (INTACTA) */}
      <div className="card">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h3 style={{ marginTop:0, marginBottom:8 }}>Evolución clínica</h3>
          <span className="helper">
            Registrá observaciones clínicas; se guarda fecha y autor.
          </span>
        </div>

        {/* Nueva evolución */}
        <div className="stack">
          <label className="label">Nueva entrada</label>
          <textarea
            className="input"
            rows={5}
            placeholder="Escribí la evolución, hallazgos, diagnóstico presuntivo, indicaciones, etc."
            value={nuevoTxt}
            onChange={(e)=>setNuevoTxt(e.target.value)}
          />
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-primary" onClick={agregarEvolucion} disabled={posting}>
              {posting ? "Guardando..." : "Agregar evolución"}
            </button>
          </div>
        </div>

        {/* Listado evoluciones */}
        <div style={{ marginTop:16, display:"grid", gap:10 }}>
          {evols.length === 0 ? (
            <div className="helper">Aún no hay evoluciones registradas.</div>
          ) : evols.map(ev => (
            <div key={ev.id} className="card" style={{ border:"1px solid var(--border)", borderRadius:12, padding:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontWeight:700 }}>
                  {toDateTimeStr(ev.createdAt)}
                  {ev.medicoNombre ? ` · ${ev.medicoNombre}` : ""}
                </div>
                <button className="btn btn-outline" onClick={() => eliminarEvolucion(ev)}>Eliminar</button>
              </div>
              <div style={{ marginTop:8, whiteSpace:"pre-wrap" }}>{ev.texto}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
