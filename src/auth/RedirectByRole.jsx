import { useAuth } from "./AuthProvider.jsx";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Redirige por rol SOLO en "/".
 * No hace nada si ya estás dentro del subárbol correcto.
 * No decide hasta que haya rol.
 */
export default function RedirectByRole({ indexOnly = true }) {
  const { user, role, loading } = useAuth();
  const loc = useLocation();

  // No decidas sin datos
  if (loading || role == null) return null;
  if (!user) return <Navigate to="/login" replace />;

  const isMedico = String(role).toLowerCase().startsWith("medic");
  const isPaciente = String(role).toLowerCase().startsWith("pacien");

  // Si ya estás en el subárbol correcto, no toques nada
  if (isMedico && loc.pathname.startsWith("/medico")) return null;
  if (isPaciente && loc.pathname.startsWith("/paciente")) return null;

  // Redirigir SOLO en la raíz
  if (indexOnly && loc.pathname !== "/") return null;

  const target = isMedico ? "/medico" : "/paciente";
  return <Navigate to={target} replace />;
}
