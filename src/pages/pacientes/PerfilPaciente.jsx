// src/pages/paciente/MiPerfilPaciente.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db, auth } from "../../firebase.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export default function MiPerfilPaciente() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paciente, setPaciente] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    fechaNacimiento: "",
    email: ""
  });

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setPaciente(data);
        setForm({
          nombre: data.nombre || "",
          apellido: data.apellido || "",
          dni: data.dni || "",
          telefono: data.telefono || "",
          fechaNacimiento: data.fechaNacimiento || "",
          email: data.email || user.email
        });
      }
    };
    fetchData();
  }, [user]);

  const guardarCambios = async () => {
    try {
      const ref = doc(db, "usuarios", user.uid);
      await updateDoc(ref, {
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        telefono: form.telefono,
        fechaNacimiento: form.fechaNacimiento
      });
      setPaciente({ ...paciente, ...form });
      setEditando(false);
      Swal.fire("Actualizado", "Tus datos se guardaron correctamente.", "success");
    } catch (err) {
      Swal.fire("Error", "No se pudieron guardar los cambios.", "error");
    }
  };

  const cambiarPassword = async () => {
    await sendPasswordResetEmail(auth, user.email);
    Swal.fire("Correo enviado", "Revisa tu bandeja para restablecer la contraseña.", "info");
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!paciente) return <div className="container"><p>Cargando perfil...</p></div>;

  return (
    <div className="container">
      <h1>MI PERFIL</h1>

      {/* Datos básicos */}
      <div className="card stack">
        <h2>Datos básicos</h2>
        {editando ? (
          <div className="stack">
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Apellido</label>
              <input
                className="input"
                type="text"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              />
            </div>
            <div>
              <label className="label">DNI</label>
              <input
                className="input"
                type="text"
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                className="input"
                type="text"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input
                className="input"
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) =>
                  setForm({ ...form, fechaNacimiento: e.target.value })
                }
              />
            </div>
            <p className="helper">Email: {form.email}</p>

            <div className="btn-row">
              <button className="btn btn-primary" onClick={guardarCambios}>Guardar</button>
              <button className="btn btn-outline" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <p><strong>Nombre:</strong> {paciente.nombre}</p>
            <p><strong>Apellido:</strong> {paciente.apellido}</p>
            <p><strong>DNI:</strong> {paciente.dni}</p>
            <p><strong>Teléfono:</strong> {paciente.telefono}</p>
            <p><strong>Fecha de nacimiento:</strong> {paciente.fechaNacimiento}</p>
            <p><strong>Email:</strong> {paciente.email}</p>

            <button className="btn btn-primary" onClick={() => setEditando(true)}>
              Editar datos
            </button>
          </div>
        )}
      </div>

      {/* Seguridad */}
      <div className="card stack">
        <h2>Seguridad</h2>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={cambiarPassword}>
            Cambiar contraseña
          </button>
          <button className="btn btn-outline" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
