// src/pages/pacientes/HomePaciente.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from "firebase/firestore";
import Swal from "sweetalert2";

export default function HomePaciente() {
  const { user, loading } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [sols, setSols] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (loading || !user) return;
    getDoc(doc(db,"usuarios",user.uid)).then(snap => setPerfil(snap.data() || null)).catch(console.error);

    const qRef = query(collection(db,"solicitudes"), where("pacienteId","==",user.uid));
    const unsub = onSnapshot(qRef, (snap) => {
      const arr = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      // ordenar en memoria (más recientes primero)
      arr.sort((a,b)=>(b.createdAt?.seconds??0)-(a.createdAt?.seconds??0));
      setSols(arr);
    }, console.error);
    return () => unsub();
  }, [loading, user]);

  const propuestas = useMemo(() => sols.filter(s => s.estado === "propuesta"), [sols]);
  const confirmadasFuturas = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return sols.filter(s => s.estado === "confirmada" && s.propuesta?.dia && new Date(s.propuesta.dia) >= today)
               .sort((a,b)=> new Date(a.propuesta.dia+"T"+a.propuesta.hora) - new Date(b.propuesta.dia+"T"+b.propuesta.hora));
  }, [sols]);
  const proxima = confirmadasFuturas[0] || null;
  const recientes = sols.slice(0,5);

  const aceptar = async (sol) => {
    setBusyId(sol.id);
    // optimista
    setSols(prev => prev.map(x => x.id===sol.id ? ({...x, estado:"confirmada"}) : x));
    try {
      await updateDoc(doc(db,"solicitudes",sol.id), { estado:"confirmada" });
      Swal.fire("Confirmado ✅","Tu turno fue confirmado.","success");
    } catch (e) {
      console.error(e);
      setSols(prev => prev.map(x => x.id===sol.id ? ({...x, estado:"propuesta"}) : x));
      Swal.fire("Error", e.message || "No se pudo confirmar el turno","error");
    } finally { setBusyId(null); }
  };

  const rechazar = async (sol) => {
    const ok = await Swal.fire({title:"Rechazar propuesta", text:"¿Querés rechazar esta propuesta?", icon:"question", showCancelButton:true});
    if (!ok.isConfirmed) return;
    setBusyId(sol.id);
    setSols(prev => prev.map(x => x.id===sol.id ? ({...x, estado:"pendiente", propuesta:null}) : x));
    try {
      await updateDoc(doc(db,"solicitudes",sol.id), { estado:"pendiente", propuesta:null });
      Swal.fire("Listo","Volvimos la solicitud a pendiente.","success");
    } catch (e) {
      console.error(e);
      setSols(prev => prev.map(x => x.id===sol.id ? ({...x, estado:"propuesta"}) : x));
      Swal.fire("Error", e.message || "No se pudo actualizar","error");
    } finally { setBusyId(null); }
  };

  return (
    <div className="container" style={{ display:"grid", gap:12 }}>
      <h2>Hola {perfil ? `${perfil.nombre} ${perfil.apellido}` : (user?.email || "Paciente")} 👋</h2>

      {/* Próximo turno */}
      <div className="card">
        <h3 style={{ marginTop:0 }}>Próximo turno</h3>
        {!proxima ? (
          <div>No tenés turnos confirmados. <a href="/solicitar-turno">Solicitá uno</a>.</div>
        ) : (
          <div>
            <div><b>{proxima.propuesta.dia}</b> · <b>{proxima.propuesta.hora}</b> ({proxima.propuesta.franja === "manana" ? "Mañana" : "Tarde"})</div>
            <div style={{ marginTop:8 }}><a className="btn btn-outline" href="/mis-turnos">Ver detalle</a></div>
          </div>
        )}
      </div>

      {/* Propuestas pendientes */}
      <div className="card">
        <h3 style={{ marginTop:0 }}>Propuestas pendientes</h3>
        {propuestas.length === 0 ? (
          <div>No tenés propuestas pendientes.</div>
        ) : propuestas.map(sol => (
          <div key={sol.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, padding:"8px 0", borderTop:"1px solid var(--border)" }}>
            <div>
              <div><b>{sol.propuesta?.dia}</b> a las <b>{sol.propuesta?.hora}</b> · {sol.franja === "manana" ? "Mañana" : "Tarde"}</div>
              <div className="helper">Tu solicitud: {sol.diaSolicitado} ({sol.franja === "manana" ? "Mañana" : "Tarde"})</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-primary" disabled={busyId===sol.id} onClick={()=>aceptar(sol)}>
                {busyId===sol.id ? "Confirmando..." : "Aceptar"}
              </button>
              <button className="btn btn-outline" disabled={busyId===sol.id} onClick={()=>rechazar(sol)}>
                {busyId===sol.id ? "Procesando..." : "Rechazar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mis solicitudes (resumen) */}
      <div className="card">
        <h3 style={{ marginTop:0 }}>Mis solicitudes</h3>
        {recientes.length === 0 ? (
          <div>No hay solicitudes aún.</div>
        ) : recientes.map(sol => (
          <div key={sol.id} className="helper" style={{ padding:"6px 0", borderTop:"1px solid var(--border)" }}>
            {sol.diaSolicitado} · {sol.franja === "manana" ? "Mañana" : "Tarde"} — <b>{sol.estado}</b>
          </div>
        ))}
        <div style={{ marginTop:8 }}>
          <a className="btn btn-outline" href="/mis-turnos">Ver todas</a>
          <a className="btn btn-primary" href="/solicitar-turno" style={{ marginLeft:8 }}>Solicitar turno</a>
        </div>
      </div>

      {/* Info útil */}
      <div className="card">
  <h3 style={{ marginTop:0 }}>Información útil</h3>
  <ul style={{ paddingLeft:"20px", margin:0 }}>
    <li>Recordá que debés estar lista 5 minutos antes de tu cita.</li>
    <li>La doctora te enviará el link de la videollamada por mail a la casilla que nos informaste.</li>
    <li>Ten en cuenta que si no tienes el comprobante de pago enviado al mail de la doctora, el turno se considera cancelado.</li>
  </ul>
</div>
    </div>
  );
}
