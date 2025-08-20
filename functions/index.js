// functions/index.js  (ESM)
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

export const setUserRole = onCall(async (request) => {
  const { auth: callerAuth, data } = request;

  if (!callerAuth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  // ⚠️ Reemplazá por tu UID personal para actuar como superadmin
  const SUPERADMIN_UIDS = new Set(["TU_UID_PERSONAL_AQUI"]);

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
