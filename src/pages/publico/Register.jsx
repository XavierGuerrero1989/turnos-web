// src/pages/publico/Register.jsx
import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../firebase.js";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../../auth/AuthProvider.jsx";

export default function Register() {
  const nav = useNavigate();
  const { user, role } = useAuth();

  // si ya está logueado, lo saco de /register
  useEffect(() => {
    if (user) {
      if (role === "medico") nav("/medico");
      else nav("/");
    }
  }, [user, role, nav]);

  const [form, setForm] = useState({
    nombre: "", apellido: "", dni: "", telefono: "", email: "", password: "",
  });
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      await Swal.fire("Error", "La contraseña debe tener al menos 8 caracteres", "error");
      return;
    }
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);

      // opcional: que el displayName sea "Nombre Apellido"
      await updateProfile(user, { displayName: `${form.nombre} ${form.apellido}`.trim() });

      // guardamos datos base
      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        telefono: form.telefono,
        email: form.email,
        role: "paciente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await Swal.fire("¡Listo!", "Usuario creado con éxito.", "success");
      nav("/"); // ← redirigir a Home (quedando logueado)
    } catch (err) {
      await Swal.fire("Error", err.message || "No se pudo crear la cuenta", "error");
    }
  };

  return (
    <div style={{ display:"flex", justifyContent:"center", marginTop:60 }}>
      <div style={{
        background:"#fff", padding:30, borderRadius:12,
        boxShadow:"0 10px 20px rgba(2,6,23,.06)", width:"100%", maxWidth:420
      }}>
        <div style={{ display:"flex", alignItems:"center", marginBottom:20 }}>
          <div style={{
            background:"var(--primary)", color:"#fff", fontWeight:700,
            borderRadius:10, width:36, height:36, display:"grid", placeItems:"center", marginRight:10
          }}>Gt</div>
          <h2 style={{ margin:0 }}>GineTurnos</h2>
        </div>

        <h3 style={{ textAlign:"center", margin:"0 0 14px" }}>Crear cuenta</h3>

        <form onSubmit={submit}>
          <input name="nombre" placeholder="Nombre" value={form.nombre} onChange={onChange} required style={inputStyle}/>
          <input name="apellido" placeholder="Apellido" value={form.apellido} onChange={onChange} required style={inputStyle}/>
          <input name="dni" placeholder="DNI" value={form.dni} onChange={onChange} required style={inputStyle}/>
          <input name="telefono" placeholder="Teléfono" value={form.telefono} onChange={onChange} required style={inputStyle}/>
          <input type="email" name="email" placeholder="Correo electrónico" value={form.email} onChange={onChange} required style={inputStyle}/>
          <input type="password" name="password" placeholder="Contraseña (mínimo 8 caracteres)" value={form.password} onChange={onChange} required style={inputStyle}/>

          <button type="submit" className="btn btn-primary" style={{ width:"100%", marginTop:10 }}>
            Registrarse
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width:"100%", padding:"10px 12px", marginBottom:10,
  border:"1px solid var(--border, #e2e8f0)", borderRadius:8, outline:"none",
};
