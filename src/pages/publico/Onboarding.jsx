// src/pages/publico/Onboarding.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { auth, db } from "../../firebase.js";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import { useAuth } from "../../auth/AuthProvider.jsx";

export default function Onboarding() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { loading, user, role } = useAuth();

  const href = typeof window !== "undefined" ? window.location.href : "";
  const linkValido = useMemo(() => isSignInWithEmailLink(auth, href), [href]);

  // email tomado del query param ?email=
  const linkEmail = useMemo(() => {
    const raw = sp.get("email");
    try {
      return raw ? decodeURIComponent(raw).toLowerCase() : "";
    } catch {
      return raw || "";
    }
  }, [sp]);

  const [email, setEmail] = useState(linkEmail || "");
  const [askPassword, setAskPassword] = useState(true); // permitir crear password ahora
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  // si ya está logueado, redirigir por rol
  useEffect(() => {
    if (loading) return;
    if (user && role) {
      const isMedico = String(role).toLowerCase().startsWith("medic");
      nav(isMedico ? "/medico" : "/paciente", { replace: true });
    }
  }, [loading, user, role, nav]);

  const mensajeLink = useMemo(() => {
    if (linkValido) return "";
    return "El enlace es inválido o expiró. Pedí uno nuevo o volvé a iniciar sesión.";
  }, [linkValido]);

  const crearPerfilSiFalta = async (u) => {
    try {
      const ref = doc(db, "usuarios", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            email: u.email || email,
            role: "paciente",
            nombre: "",
            apellido: "",
            dni: "",
            hasPassword: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (e) {
      console.warn("crearPerfilSiFalta:", e);
    }
  };

  // ✅ NUEVO: aplicar datos de invitación (si vienen en ?invite=...)
  const aplicarInvitacion = async (u) => {
    const inviteId = sp.get("invite");
    if (!inviteId) return;

    try {
      const invRef = doc(db, "invitaciones", inviteId);
      const invSnap = await getDoc(invRef);
      if (!invSnap.exists()) return;

      const inv = invSnap.data();

      // Seguridad básica: si el email de invitación existe, debe coincidir con el email del usuario
      const invEmail = String(inv.email || "").toLowerCase().trim();
      const userEmail = String(u.email || email || "").toLowerCase().trim();
      if (invEmail && userEmail && invEmail !== userEmail) return;

      // Merge: solo seteamos si hay dato real (evita pisar con strings vacíos)
      const payload = {
        email: u.email || email,
        role: "paciente",
        invitacionId: inviteId,
        updatedAt: serverTimestamp(),
      };

      if (inv.nombre?.trim()) payload.nombre = inv.nombre.trim();
      if (inv.apellido?.trim()) payload.apellido = inv.apellido.trim();
      if (inv.dni?.trim()) payload.dni = inv.dni.trim();
      if (inv.telefono?.trim()) payload.telefono = inv.telefono.trim();

      await setDoc(doc(db, "usuarios", u.uid), payload, { merge: true });

      // Marcar invitación como aceptada (opcional, pero recomendado)
      await updateDoc(invRef, {
        estado: "aceptada",
        pacienteUid: u.uid,
        acceptedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("aplicarInvitacion:", e);
    }
  };

  const setHasPasswordFlag = async (u, value) => {
    try {
      const ref = doc(db, "usuarios", u.uid);
      await setDoc(
        ref,
        { hasPassword: !!value, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("setHasPasswordFlag:", e);
    }
  };

  const validarPassword = (p, p2) => {
    if (!askPassword) return null; // no se pide
    if (!p) return "Elegí una contraseña.";
    if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    // opcional: fuerza mínima
    const tieneNum = /\d/.test(p);
    const tieneLetra = /[A-Za-z]/.test(p);
    if (!tieneNum || !tieneLetra) return "Usá letras y números.";
    if (p !== p2) return "Las contraseñas no coinciden.";
    return null;
    // Si querés reglas más duras (símbolo, mayúscula, etc.), las añadimos.
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    setErr("");

    if (!linkValido) {
      setErr(mensajeLink);
      return;
    }
    if (!email) {
      setErr("Ingresá tu email para completar el acceso.");
      return;
    }
    const errPass = validarPassword(pass, pass2);
    if (errPass) {
      setErr(errPass);
      return;
    }

    setWorking(true);
    try {
      // 1) completar el sign in con el link mágico
      const cred = await signInWithEmailLink(auth, email, href);

      // 2) crear perfil si no existe
      await crearPerfilSiFalta(cred.user);

      // ✅ 2.1) aplicar datos desde la invitación si existe ?invite=
      await aplicarInvitacion(cred.user);

      // 3) si el usuario decidió crear password ahora, lo seteamos
      if (askPassword) {
        await updatePassword(cred.user, pass); // requiere login reciente: acá lo tenemos
        await setHasPasswordFlag(cred.user, true);
      }

      // 4) dejamos que el router redirija por rol
      nav("/", { replace: true });
    } catch (e) {
      let msg = e?.message || "No se pudo completar el acceso.";
      if (e?.code === "auth/invalid-action-code") msg = "El enlace expiró o ya fue usado.";
      if (e?.code === "auth/invalid-email") msg = "El email ingresado no es válido.";
      if (e?.code === "auth/weak-password") msg = "La contraseña es muy débil.";
      if (e?.code === "auth/requires-recent-login")
        msg = "Por seguridad, volvé a abrir el enlace para configurar tu contraseña.";
      setErr(msg);
      setWorking(false);
    }
  };

  if (loading) return null;

  return (
    <div className="center-screen">
      <Card className="form-narrow">
        <div className="stack-lg">
          <div style={{ textAlign: "center" }}>
            <div
              className="brand"
              style={{ justifyContent: "center", marginBottom: 8 }}
            >
              <span className="brand-badge">Gt</span>
              <span>GineTurnos</span>
            </div>
            <h2 style={{ margin: "0 0 4px" }}>Confirmar email</h2>
            <p className="helper">
              {linkValido
                ? "Ingresá tu correo para completar el acceso con el enlace. Podés crear una contraseña ahora."
                : mensajeLink}
            </p>
          </div>

          <form onSubmit={submit} className="stack-lg">
            <Input
              id="email"
              label="Correo electrónico"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!linkValido || working}
            />

            {/* Toggle para crear contraseña ahora */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={askPassword}
                onChange={(e) => setAskPassword(e.target.checked)}
                disabled={!linkValido || working}
              />
              Crear una contraseña ahora (opcional)
            </label>

            {askPassword && (
              <>
                <Input
                  id="password"
                  label="Contraseña"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  disabled={!linkValido || working}
                />
                <Input
                  id="password2"
                  label="Confirmar contraseña"
                  type="password"
                  placeholder="Repetí tu contraseña"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  required
                  disabled={!linkValido || working}
                />
              </>
            )}

            {err && <div className="error">{err}</div>}

            <div className="btn-row">
              <Button type="submit" disabled={!linkValido || working}>
                {working ? "Confirmando..." : "Confirmar"}
              </Button>
              <Link to="/login" className="btn btn-outline">
                Volver a Login
              </Link>
            </div>
          </form>

          <p className="helper">
            Abriste un enlace de acceso por correo. Si no lo solicitaste vos,
            ignorá el mensaje.
          </p>
        </div>
      </Card>
    </div>
  );
}

