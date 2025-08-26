// auth/RedirectByRole.jsx
import { useAuth } from "./AuthProvider.jsx";
import { Navigate } from "react-router-dom";

export default function RedirectByRole() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return role === "medico"
    ? <Navigate to="/medico" replace />
    : <Navigate to="/paciente" replace />;
}
