import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

export async function listarDisponibilidad({ dia }) {
  const q = query(collection(db, "disponibilidades"), where("dia", "==", dia));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function crearDisponibilidad(payload) {
  return addDoc(collection(db, "disponibilidades"), payload);
}

export async function actualizarDisponibilidad(id, patch) {
  return updateDoc(doc(db, "disponibilidades", id), patch);
}
