import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase.js";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";

export default function Login(){
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      nav("/");
    } catch (e) {
      setErr(e.message || "Error al iniciar sesión");
    }
  };

  return (
    <div className="center-screen">
      <Card className="form-narrow">
        <div className="stack-lg">
          <div style={{textAlign:"center"}}>
            <div className="brand" style={{justifyContent:"center", marginBottom:8}}>
              <span className="brand-badge">Tx</span>
              <span>Turnos</span>
            </div>
            <h2 style={{margin:"0 0 4px"}}>Iniciar sesión</h2>
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
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              placeholder="Tu contraseña"
              value={pass}
              onChange={e=>setPass(e.target.value)}
              required
            />
            {err && <div className="error">{err}</div>}

            <div className="form-actions">
              <Button type="submit">Entrar</Button>
              <Link to="/register" className="btn btn-outline">Crear cuenta</Link>
            </div>
          </form>

          <p className="helper">
            ¿Olvidaste tu contraseña? (lo sumamos luego)
          </p>
        </div>
      </Card>
    </div>
  );
}
