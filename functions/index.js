// functions/index.js  (ESM)
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { config as functionsConfig } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";



initializeApp();

/* =======================
   TU FUNCIÓN EXISTENTE
   ======================= */
export const setUserRole = onCall(async (request) => {
  const { auth: callerAuth, data } = request;

  if (!callerAuth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  // ⚠️ Reemplazá por tu UID personal para actuar como superadmin
  const SUPERADMIN_UIDS = new Set(["ijPbcQYE5aOJsY5z6H6fGggRFzv1"]);

  if (!SUPERADMIN_UIDS.has(callerAuth.uid)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }

  const { email, uid, role } = data || {};
  if (!role || (role !== "medico" && role !== "paciente")) {
    throw new HttpsError("invalid-argument", "Role inválido.");
  }

  const auth = getAuth();
  const db = getFirestore();

  let targetUid = uid;

  try {
    if (!targetUid && email) {
      const user = await auth.getUserByEmail(email);
      targetUid = user.uid;
    }
    if (!targetUid) {
      throw new HttpsError("invalid-argument", "Debes enviar uid o email.");
    }

    await auth.setCustomUserClaims(targetUid, { role });

    // Opcional: registrar en Firestore para auditoría / UI
    await db.collection("usuarios").doc(targetUid).set(
      {
        role,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true, uid: targetUid, role };
  } catch (err) {
    console.error("setUserRole error:", err);
    throw new HttpsError("internal", err?.message || "Error al asignar rol");
  }
});

/* =========================================
   🔗 INTEGRACIÓN GOOGLE CALENDAR / MEET
   ========================================= */

// Lee credenciales de firebase functions:config:get
function getOAuthClient() {
  const cfg = functionsConfig().google || {};
  if (!cfg.client_id || !cfg.client_secret || !cfg.redirect_uri) {
    throw new Error("Faltan credenciales OAuth en functions:config (google.client_id/client_secret/redirect_uri).");
  }
  return new OAuth2Client(cfg.client_id, cfg.client_secret, cfg.redirect_uri);
}

/** 1) Devuelve la URL para que el MÉDICO conecte su Google Calendar (OAuth) */
export const getGoogleAuthUrl = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  if (req.auth.token.role !== "medico") throw new HttpsError("permission-denied", "Solo médicos.");

  const oAuth2 = getOAuthClient();
  const scopes = ["https://www.googleapis.com/auth/calendar.events"];
  const url = oAuth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state: JSON.stringify({ uid: req.auth.uid }),
  });
  return { url };
});

/** 2) Callback HTTP donde Google redirige luego del consentimiento
 *     Guarda tokens en /googleTokens/{medicoUid}
 */
export const oauthCallback = onRequest(async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const stateRaw = req.query.state ? JSON.parse(String(req.query.state)) : null;
    const medicoUid = stateRaw?.uid;
    if (!code || !medicoUid) return res.status(400).send("Missing code/state.");

    const oAuth2 = getOAuthClient();
    const { tokens } = await oAuth2.getToken(code);
    const db = getFirestore();
    await db.collection("googleTokens").doc(medicoUid).set(
      {
        tokens,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res
      .status(200)
      .send("✅ Google Calendar conectado. Ya podés cerrar esta pestaña y volver a la app.");
  } catch (e) {
    console.error(e);
    return res.status(500).send("OAuth error");
  }
});

/** 3) Paciente ACEPTA propuesta → crear evento en Calendar con Google Meet
 *     y guardar en /turnosConfirmados
 */
export const confirmarTurnoYCrearMeet = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Iniciá sesión.");
  const { solicitudId } = req.data || {};
  if (!solicitudId) throw new HttpsError("invalid-argument", "Falta solicitudId.");

  const db = getFirestore();

  const solRef = db.collection("solicitudes").doc(solicitudId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) throw new HttpsError("not-found", "Solicitud no existe.");
  const sol = solSnap.data();

  // Paciente solo puede confirmar su propia solicitud
  if (req.auth.uid !== sol.pacienteId) throw new HttpsError("permission-denied", "No autorizado.");
  if (sol.estado !== "propuesta" || !sol.propuesta?.dia || !sol.propuesta?.hora) {
    throw new HttpsError("failed-precondition", "La solicitud no tiene propuesta vigente.");
  }

  // UID/email del médico (guardado en /config/medico)
  const cfgMed = await db.collection("config").doc("medico").get();
  const medicoUid = cfgMed.exists ? cfgMed.data().uid : null;
  const medicoEmail = cfgMed.exists ? cfgMed.data().email : null;
  if (!medicoUid) throw new HttpsError("failed-precondition", "No hay médico configurado.");

  // Tokens del médico
  const tSnap = await db.collection("googleTokens").doc(medicoUid).get();
  if (!tSnap.exists) throw new HttpsError("failed-precondition", "El médico no conectó Google Calendar.");
  const { tokens } = tSnap.data();

  // Cliente Calendar
  const oAuth2 = getOAuthClient();
  oAuth2.setCredentials(tokens);
  const calendar = google.calendar({ version: "v3", auth: oAuth2 });

  // Fechas
  const startISO = `${sol.propuesta.dia}T${sol.propuesta.hora}:00`;
  const end = new Date(`${sol.propuesta.dia}T${sol.propuesta.hora}:00`);
  end.setMinutes(end.getMinutes() + 30); // duración 30'
  const endISO = end.toISOString().slice(0, 19);

  // Invitados
  const pacienteEmail = req.auth.token.email || sol.pacienteEmail || undefined;
  const attendees = [
    medicoEmail ? { email: medicoEmail } : null,
    pacienteEmail ? { email: pacienteEmail } : null,
  ].filter(Boolean);

  // Crear evento + Meet
  const requestId = `meet-${solicitudId}-${Date.now()}`;
  const ev = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: "Consulta médica",
      description: sol.comentario || "",
      start: { dateTime: startISO, timeZone: "America/Argentina/Buenos_Aires" },
      end: { dateTime: endISO, timeZone: "America/Argentina/Buenos_Aires" },
      attendees,
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const event = ev.data;
  const meetLink = event.hangoutLink;
  const eventId = event.id;

  // Guardar turno confirmado
  const turnoRef = db.collection("turnosConfirmados").doc();
  await turnoRef.set({
    pacienteId: sol.pacienteId,
    pacienteNombre: sol.pacienteNombre || "",
    dia: sol.propuesta.dia,
    hora: sol.propuesta.hora,
    meetLink,
    calendarEventId: eventId,
    origenSolicitudId: solicitudId,
    estado: "confirmado",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Actualizar solicitud
  await solRef.update({
    estado: "aceptada",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, meetLink, eventId, turnoId: turnoRef.id };
});


export const functions = getFunctions(app, "us-central1"); 