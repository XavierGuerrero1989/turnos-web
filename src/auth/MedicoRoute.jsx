import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

export function MedicoRoute({ children }) {
  const { user, role, loading } = useAuth();

  // Esperar SIEMPRE a que termine de cargar y a tener rol
  if (loading || role == null) return null;

  if (!user) return <Navigate to="/login" replace />;

  // Robustez ante "medica/médico/Medico"
  const isMedico = String(role).toLowerCase().startsWith("medic");
  if (!isMedico) return <Navigate to="/paciente" replace />;

  return children;
}
