// src/pages/medico/InvitarPaciente.jsx
import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db, auth } from "../../firebase.js";
import { doc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { sendSignInLinkToEmail } from "firebase/auth";
import Swal from "sweetalert2";

export default function InvitarPaciente() {
  const { user } = useAuth(); // médico
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    dni: "",
    telefono: "",
  });
  const [sending, setSending] = useState(false);

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      return Swal.fire("Falta el email", "Ingresá el correo de la paciente.", "warning");
    }
    setSending(true);
    try {
      // 1) Crear registro de invitación
      const inviteRef = await addDoc(collection(db, "invitaciones"), {
        email: form.email.trim().toLowerCase(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        telefono: form.telefono.trim(),
        creadoPor: user?.uid || null,
        creadoPorEmail: user?.email || null,
        estado: "enviada",
        createdAt: serverTimestamp(),
      });

      // 2) Enviar link mágico de registro al correo con continueUrl al onboarding
      const origin = window.location.origin;
      const actionCodeSettings = {
        url:
          `${origin}/onboarding` +
          `?invite=${inviteRef.id}` +
          `&email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, form.email.trim().toLowerCase(), actionCodeSettings);

      // 3) Feedback
      await Swal.fire(
        "Invitación enviada",
        `Le enviamos a ${form.email} un enlace para registrarse.`,
        "success"
      );

      // 4) Limpiar form
      setForm({ nombre: "", apellido: "", email: "", dni: "", telefono: "" });
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No se pudo enviar la invitación", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container">
      <h2>Invitar paciente</h2>

      <div className="card">
        <form className="stack" onSubmit={submit}>
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => onChange("nombre", e.target.value)}
              placeholder="Nombre de la paciente"
            />
          </div>

          <div>
            <label className="label">Apellido</label>
            <input
              className="input"
              value={form.apellido}
              onChange={(e) => onChange("apellido", e.target.value)}
              placeholder="Apellido de la paciente"
            />
          </div>

          <div>
            <label className="label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="paciente@correo.com"
            />
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label className="label">DNI</label>
              <input
                className="input"
                value={form.dni}
                onChange={(e) => onChange("dni", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                className="input"
                value={form.telefono}
                onChange={(e) => onChange("telefono", e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={sending}>
              {sending ? "Enviando..." : "Invitar paciente"}
            </button>
          </div>

          <p className="helper">
            Le llegará un email con un enlace seguro para crear su cuenta y completar su perfil.
          </p>
        </form>
      </div>
    </div>
  );
}
