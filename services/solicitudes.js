import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

export async function crearSolicitud(payload) {
  return addDoc(collection(db, "solicitudes"), payload);
}

export async function listarSolicitudesPaciente(pacienteId) {
  const q = query(collection(db, "solicitudes"), where("pacienteId", "==", pacienteId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function actualizarSolicitud(id, patch) {
  return updateDoc(doc(db, "solicitudes", id), patch);
}
