// src/pages/publico/Login.jsx
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase.js";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";

export default function Login() {
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [err, setErr]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nav = useNavigate();
  const { user, role, loading } = useAuth();

  // Si ya está logueado Y ya tenemos rol, redirigimos por rol
  useEffect(() => {
    if (loading) return;
    if (user && role) {
      const isMedico = String(role).toLowerCase().startsWith("medic");
      nav(isMedico ? "/medico" : "/paciente", { replace: true });
    }
  }, [user, role, loading, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // ✅ Dejamos que App -> RedirectByRole decida cuando role esté listo
      nav("/", { replace: true });
    } catch (e) {
      setErr(e?.message || "Error al iniciar sesión");
      setSubmitting(false);
    }
  };

  // Mientras resolvemos auth, no mostramos el form para evitar parpadeos
  if (loading) return null;

  return (
    <div className="center-screen">
      <Card className="form-narrow">
        <div className="stack-lg">
          <div style={{ textAlign:"center" }}>
            <div className="brand" style={{ justifyContent:"center", marginBottom:8 }}>
              <span className="brand-badge">Gt</span>
              <span>GineTurnos</span>
            </div>
            <h2 style={{ margin:"0 0 4px" }}>Iniciar sesión</h2>
            <p className="helper">Entrá con tu correo y contraseña</p>
          </div>

          <form onSubmit={submit} className="stack-lg">
            <Input
              id="email"
              label="Correo electrónico"
              type="email"
              placeholder="usuario@correo.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              required
              disabled={submitting}
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              placeholder="Tu contraseña"
              value={pass}
              onChange={e=>setPass(e.target.value)}
              required
              disabled={submitting}
            />
            {err && <div className="error">{err}</div>}

            <div className="btn-row">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Ingresando..." : "Entrar"}
              </Button>
              <Link to="/register" className="btn btn-outline">Crear cuenta</Link>
            </div>
          </form>

          <p className="helper">¿Olvidaste tu contraseña? (lo sumamos luego)</p>
        </div>
      </Card>
    </div>
  );
}
