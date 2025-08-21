// src/pages/Onboarding.jsx
import { useEffect, useState } from "react";
import { isSignInWithEmailLink, signInWithEmailLink, updatePassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import Swal from "sweetalert2";

export default function Onboarding() {
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ nombre:"", dni:"", telefono:"", password:"" });
  const [step, setStep] = useState("confirm"); // confirm → datos
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const stored = window.localStorage.getItem("emailForSignIn");
      if (stored) setEmail(stored);
    }
  }, []);

  const confirmar = async e => {
    e.preventDefault(); setErr("");
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      setStep("datos");
    } catch (e) { setErr(e.message); }
  };

  const guardar = async e => {
    e.preventDefault(); setErr("");
    try {
      if (!auth.currentUser) throw new Error("No autenticado");
      const uid = auth.currentUser.uid;

      await updateProfile(auth.currentUser, { displayName: form.nombre });

      await setDoc(doc(db, "usuarios", uid), {
        email: auth.currentUser.email,
        role: "paciente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, "perfiles", uid), {
        ...form,
        completed: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (form.password) {
        await updatePassword(auth.currentUser, form.password);
      }

      Swal.fire("¡Listo!", "Tu cuenta fue creada, ya podés ingresar.", "success");
    } catch (e) { setErr(e.message); }
  };

  if (step === "confirm") {
    return (
      <form onSubmit={confirmar}>
        <h2>Confirmar email</h2>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <button>Confirmar</button>
        {err && <p>{err}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={guardar}>
      <h2>Completar datos</h2>
      <input name="nombre" placeholder="Nombre completo" value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} />
      <input name="dni" placeholder="DNI" value={form.dni} onChange={e=>setForm({...form, dni:e.target.value})} />
      <input name="telefono" placeholder="Teléfono" value={form.telefono} onChange={e=>setForm({...form, telefono:e.target.value})} />
      <input name="password" type="password" placeholder="Contraseña" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
      <button>Guardar</button>
      {err && <p>{err}</p>}
    </form>
  );
}
