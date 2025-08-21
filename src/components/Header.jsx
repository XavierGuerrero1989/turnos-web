import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";

export default function Header(){
  const { user, role } = useAuth();
  const nav = useNavigate();
  const logout = async () => { await signOut(auth); nav("/login"); };

  return (
    <header className="header">
      <Link to="/" className="brand">
        <span className="brand-badge">Tx</span>
        <span>Turnos</span>
      </Link>
      {user && (
        <>
          <Link to="/solicitar-turno">Solicitar turno</Link>
          <Link to="/mis-turnos">Mis turnos</Link>
          <Link to="/perfil">Mi perfil</Link>
        </>
      )}
      {role === "medico" && (
        <>
          <Link to="/medico">Dashboard</Link>
          <Link to="/medico/disponibilidad">Disponibilidad</Link>
          <Link to="/medico/solicitudes">Solicitudes</Link>
          <Link to="/medico/turnos">Turnos</Link>
          <Link to="/medico/pacientes">Pacientes</Link>
          <Link to="/medico/invitar">Invitar</Link>
        </>
      )}
      <span style={{ marginLeft:"auto" }}>
        {!user ? <Link to="/login">Login</Link> : <button className="btn btn-outline" onClick={logout}>Salir</button>}
      </span>
    </header>
  );
}
