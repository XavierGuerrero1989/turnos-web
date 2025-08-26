// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header.jsx";
import { ProtectedRoute } from "./auth/ProtectedRoute.jsx";
import { MedicoRoute } from "./auth/MedicoRoute.jsx";
import RedirectByRole from "./auth/RedirectByRole.jsx";

// Público
import Login from "./pages/publico/Login.jsx";
import Register from "./pages/publico/Register.jsx";
import Onboarding from "./pages/publico/Onboarding.jsx";

// Paciente
import HomePaciente from "./pages/pacientes/HomePaciente.jsx";
import SolicitarTurno from "./pages/pacientes/SolicitarTurno.jsx";
import MisTurnos from "./pages/pacientes/MisTurnos.jsx";
import PerfilPaciente from "./pages/pacientes/PerfilPaciente.jsx";

// Médico
import DashboardMedico from "./pages/medico/DashboardMedico.jsx";
import Disponibilidad from "./pages/medico/Disponibilidad.jsx";
import Solicitudes from "./pages/medico/Solicitudes.jsx";
import TurnosConfirmados from "./pages/medico/TurnosConfirmados.jsx";
import Pacientes from "./pages/medico/Pacientes.jsx";
import InvitarPaciente from "./pages/medico/InvitarPaciente.jsx";
import PacienteFicha from "./pages/medico/PacienteFicha.jsx";

import AdminSetMedico from "./pages/AdminSetMedico.jsx";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        {/* Público */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Redirect raíz según rol */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RedirectByRole />
            </ProtectedRoute>
          }
        />

        {/* Paciente */}
        <Route path="/paciente" element={
          <ProtectedRoute><HomePaciente /></ProtectedRoute>
        } />
        <Route path="/paciente/solicitar-turno" element={
          <ProtectedRoute><SolicitarTurno /></ProtectedRoute>
        } />
        <Route path="/paciente/mis-turnos" element={
          <ProtectedRoute><MisTurnos /></ProtectedRoute>
        } />
        <Route path="/paciente/perfil" element={
          <ProtectedRoute><PerfilPaciente /></ProtectedRoute>
        } />

        {/* Médico */}
        <Route path="/medico" element={
          <MedicoRoute><DashboardMedico /></MedicoRoute>
        } />
        <Route path="/medico/disponibilidad" element={
          <MedicoRoute><Disponibilidad /></MedicoRoute>
        } />
        <Route path="/medico/solicitudes" element={
          <MedicoRoute><Solicitudes /></MedicoRoute>
        } />
        <Route path="/medico/turnos" element={
          <MedicoRoute><TurnosConfirmados /></MedicoRoute>
        } />
        <Route path="/medico/pacientes" element={
          <MedicoRoute><Pacientes /></MedicoRoute>
        } />
        <Route path="/medico/invitar" element={
          <MedicoRoute><InvitarPaciente /></MedicoRoute>
        } />
        <Route path="/medico/paciente/:id" element={<PacienteFicha />} />

        {/* Admin */}
        <Route path="/admin/set-medico" element={
          <ProtectedRoute><AdminSetMedico /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
