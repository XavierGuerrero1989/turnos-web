// src/pages/auth/RecuperarPassword.jsx
import { useState } from "react";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";

export default function RecuperarPassword() {
const [email, setEmail] = useState("");
const [sending, setSending] = useState(false);
const [ok, setOk] = useState(false);
const [error, setError] = useState("");

const handleSubmit = async (e) => {
e.preventDefault();
setSending(true);
setError("");
try {
// Opcional: URL de redirección post-reset
const actionCodeSettings = {
url: import.meta.env.VITE_APP_URL || window.location.origin,
handleCodeInApp: false,
};
await sendPasswordResetEmail(auth, email, actionCodeSettings);
setOk(true);
} catch (err) {
console.error(err);
setError(
err?.message?.replace("Firebase: ", "") || "No pudimos enviar el correo. Intenta nuevamente."
);
} finally {
setSending(false);
}
};

return (
<div className="container auth-page">
<div className="card card-md">
<h1 className="title">Recuperar contraseña</h1>
<p className="muted">Ingresá tu email y te enviaremos un enlace para restablecerla.</p>

{ok ? (
<div className="alert success">
<p>Listo. Revisá tu casilla de correo para continuar con el restablecimiento.</p>
<Link className="btn" to="/login">Volver al login</Link>
</div>
) : (
<form onSubmit={handleSubmit} className="form vstack gap-12">
<label className="label">
<span>Email</span>
<input
type="email"
className="input"
placeholder="tu@email.com"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
/>
</label>

{error && <div className="alert error">{error}</div>}

<button className="btn primary" disabled={sending}>
{sending ? "Enviando..." : "Enviar enlace"}
</button>

<div className="muted small">
<Link to="/login">Volver</Link>
</div>
</form>
)}
</div>
</div>
);
}