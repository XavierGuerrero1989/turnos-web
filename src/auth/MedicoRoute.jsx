// auth/MedicoRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

export function MedicoRoute({ children }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "medico") return <Navigate to="/paciente" replace />;
  return children;
}
