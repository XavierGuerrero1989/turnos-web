// src/pages/InvitarPaciente.jsx
import { useState } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import Swal from "sweetalert2";

const actionCodeSettings = {
  url: window.location.origin + "/onboarding", // ruta de retorno
  handleCodeInApp: true,
};

export default function InvitarPaciente({ medicoUid }) {
  const [form, setForm] = useState({ nombre:"", email:"" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault(); setErr(""); setMsg("");
    try {
      await setDoc(doc(db, "invitaciones", form.email), {
        nombre: form.nombre,
        invitedBy: medicoUid,
        createdAt: serverTimestamp(),
        status: "sent",
      });

      window.localStorage.setItem("emailForSignIn", form.email);
      await sendSignInLinkToEmail(auth, form.email, actionCodeSettings);
      setMsg(`Invitación enviada a ${form.email}`);
      Swal.fire("Invitación enviada", `Se mandó un link a ${form.email}`, "success");
    } catch (e) { setErr(e.message); }
  };

  return (
    <form onSubmit={submit}>
      <h2>Invitar paciente</h2>
      <input name="nombre" placeholder="Nombre completo" value={form.nombre} onChange={handleChange} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
      <button type="submit">Invitar</button>
      {msg && <p>{msg}</p>}
      {err && <p>{err}</p>}
    </form>
  );
}
