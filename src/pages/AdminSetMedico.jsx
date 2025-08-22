import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "../auth/AuthProvider.jsx";

export default function AdminSetMedico() {
  const { user } = useAuth(); // Debe ser tu usuario (superadmin)
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const setRole = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const fn = httpsCallable(getFunctions(), "setUserRole");
      const res = await fn({ email, role: "medico" });
      setMsg(`OK: ${res.data.uid} ahora es "medico". Decile que cierre y vuelva a iniciar sesión.`);
    } catch (err) {
      setMsg("Error: " + (err?.message || "falló"));
    }
  };

  if (!user) return <p>Iniciá sesión con tu usuario superadmin.</p>;

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2>Habilitar médico</h2>
      <form onSubmit={setRole}>
        <input
          placeholder="email@delmedico.com"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          style={{ width:"100%", padding:10, border:"1px solid #ddd", borderRadius:8, margin:"8px 0" }}
          required
        />
        <button className="btn btn-primary" type="submit">Asignar rol médico</button>
      </form>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
