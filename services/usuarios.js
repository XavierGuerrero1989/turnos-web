import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export async function ensureUsuario(uid, email, role="paciente") {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { email, role, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}
