// src/pages/medico/Pacientes.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase.js";
import { collection, onSnapshot } from "firebase/firestore";
import Swal from "sweetalert2";

import "./Pacientes.css";

export default function Pacientes() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [pacientes, setPacientes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [qText, setQText] = useState("");

  // Suscripción pacientes
  useEffect(() => {
    if (role !== "medico") return;
    setLoadingList(true);

    const ref = collection(db, "usuarios");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const an = `${(a.nombre || "").toLowerCase()} ${(a.apellido || "").toLowerCase()}`.trim();
          const bn = `${(b.nombre || "").toLowerCase()} ${(b.apellido || "").toLowerCase()}`.trim();
          return an.localeCompare(bn);
        });
        setPacientes(arr);
        setLoadingList(false);
      },
      (err) => {
        console.error(err);
        setPacientes([]);
        setLoadingList(false);
      }
    );
    return () => unsub();
  }, [role]);

  // Búsqueda global
  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return pacientes;
    return pacientes.filter((p) =>
      `${p.nombre || ""} ${p.apellido || ""}`.toLowerCase().includes(t) ||
      (p.dni || "").toString().includes(t) ||
      (p.email || "").toLowerCase().includes(t) ||
      (p.telefono || "").toLowerCase().includes(t)
    );
  }, [pacientes, qText]);

  const copiar = async (texto, label) => {
    try {
      await navigator.clipboard.writeText(texto);
      Swal.fire(label, texto, "success");
    } catch {
      Swal.fire("No se pudo copiar", texto, "warning");
    }
  };

  const verFicha = (p) => {
    nav(`/medico/paciente/${p.uid}`);
  };

  if (role !== "medico") return null;

  return (
    <div className="container pacLayout">
      <h2>Pacientes</h2>

      {/* Buscador */}
      <div className="pacSearch">
        <input
          className="input"
          placeholder="Buscar por nombre, apellido, DNI, email o teléfono…"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
        />
      </div>

      {/* Lista */}
      {loadingList ? (
        <div className="card">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="card">No se encontraron pacientes.</div>
      ) : (
        <div className="pacList">
          {filtered.map((p) => {
            const nombre =
              `${p.nombre || ""} ${p.apellido || ""}`.trim() || "Paciente";

            return (
              <div key={p.uid} className="card pacCard">
                <div className="pacInfo">
                  <div className="pacName">{nombre}</div>
                  <div className="pacMeta">
                    DNI: <b>{p.dni || "-"}</b> · Email: <b>{p.email || "-"}</b> · Tel:{" "}
                    <b>{p.telefono || "-"}</b>
                  </div>
                </div>

                <div className="pacActions">
                  <button className="btn btn-primary" onClick={() => verFicha(p)}>
                    Ver ficha
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={() => copiar(p.email || "", "Email copiado")}
                    disabled={!p.email}
                  >
                    Copiar email
                  </button>

                  <button
                    className="btn btn-outline"
                    onClick={() => copiar(p.telefono || "", "Teléfono copiado")}
                    disabled={!p.telefono}
                  >
                    Copiar teléfono
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
