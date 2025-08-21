import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

export async function crearTurnoConfirmado(payload) {
  return addDoc(collection(db, "turnosConfirmados"), payload);
}

export async function listarTurnosPaciente(pacienteId) {
  const q = query(collection(db, "turnosConfirmados"), where("pacienteId", "==", pacienteId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarTurno(id, patch) {
  return updateDoc(doc(db, "turnosConfirmados", id), patch);
}
