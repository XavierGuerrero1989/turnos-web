import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import { useState, useEffect } from "react";

export default function Header() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const logout = async () => { await signOut(auth); nav("/login"); };

  // Cerrar menú al navegar
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const PacLinks = () => (
    <>
      <Link to="/paciente/solicitar-turno">Solicitar turno</Link>
      <Link to="/paciente/mis-turnos">Mis turnos</Link>
      <Link to="/paciente/perfil">Mi perfil</Link>
    </>
  );
  const MedLinks = () => (
    <>
      <Link to="/medico">Dashboard</Link>
      <Link to="/medico/solicitudes">Solicitudes</Link>
      <Link to="/medico/turnos">Turnos</Link>
      <Link to="/medico/pacientes">Pacientes</Link>
      <Link to="/medico/disponibilidad">Disponibilidad</Link>
      <Link to="/medico/invitar">Invitar</Link>
    </>
  );

  return (
    <>
      <header className={`header ${open ? "is-open": ""}`}>
        <div className="header-inner">
          <Link to={role === "medico" ? "/medico" : "/"} className="brand">
            <span className="brand-badge">Tx</span>
            <span>Turnos</span>
          </Link>

          {!loading && user && (
            <>
              {/* Desktop */}
              <nav className="nav-links">
                {role === "medico" ? <MedLinks/> : <PacLinks/>}
              </nav>
              {/* Mobile toggle */}
              <button
                className="menu-btn"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-label="Abrir menú"
              >
                <span/><span/><span/>
              </button>
            </>
          )}

          <span className="spacer" />
          {!user ? <Link to="/login">Login</Link> : (
            <button className="btn btn-outline" onClick={logout}>Salir</button>
          )}
        </div>
      </header>

      {/* Mobile menu (debajo del header) */}
      {!loading && user && (
        <nav className="mobile-menu">
          {role === "medico" ? <MedLinks/> : <PacLinks/>}
        </nav>
      )}
    </>
  );
}
