// src/pages/medico/Pacientes.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase.js";
import { collection, onSnapshot } from "firebase/firestore";
import Swal from "sweetalert2";

export default function Pacientes() {
  const { role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && role !== "medico") nav("/", { replace: true });
  }, [role, loading, nav]);

  const [pacientes, setPacientes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [qText, setQText] = useState("");

  // Suscripción a la colección de usuarios (pacientes)
  useEffect(() => {
    if (role !== "medico") return;
    setLoadingList(true);

    const ref = collection(db, "usuarios");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }));
        // Orden básico por nombre/apellido
        arr.sort((a, b) => {
          const an = `${(a.nombre || "").toLowerCase()} ${(a.apellido || "").toLowerCase()}`.trim();
          const bn = `${(b.nombre || "").toLowerCase()} ${(b.apellido || "").toLowerCase()}`.trim();
          return an.localeCompare(bn);
        });
        setPacientes(arr);
        setLoadingList(false);
      },
      (err) => {
        console.error("onSnapshot(usuarios) error:", err);
        setPacientes([]);
        setLoadingList(false);
      }
    );
    return () => unsub();
  }, [role]);

  // Búsqueda GLOBAL (nombre, apellido, DNI, email, teléfono)
  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return pacientes;
    return pacientes.filter((p) => {
      return (
        `${p.nombre || ""} ${p.apellido || ""}`.toLowerCase().includes(t) ||
        (p.dni || "").toString().toLowerCase().includes(t) ||
        (p.email || "").toLowerCase().includes(t) ||
        (p.telefono || "").toLowerCase().includes(t)
      );
    });
  }, [pacientes, qText]);

  const copiar = async (texto, label = "Copiado") => {
    try {
      await navigator.clipboard.writeText(texto);
      Swal.fire(label, texto, "success");
    } catch (e) {
      Swal.fire("No se pudo copiar", texto, "warning");
    }
  };

  const verFicha = (p) => {
    nav(`/medico/paciente/${p.uid}`);
  };

  if (role !== "medico") return null;

  return (
    <div className="container" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ marginBottom: 0 }}>Pacientes</h2>

      {/* Barra de búsqueda */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          className="input"
          placeholder="Buscar por nombre, apellido, DNI, email o teléfono…"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          style={{ minWidth: 320 }}
        />
      </div>

      {/* Lista */}
      {loadingList ? (
        <div className="card">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="card">No se encontraron pacientes con ese criterio.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((p) => {
            const nombre = `${p.nombre || ""} ${p.apellido || ""}`.trim() || "Paciente";
            return (
              <div
                key={p.uid}
                className="card"
                style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
              >
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{nombre}</div>
                  <div className="helper">
                    DNI: <b>{p.dni || "-"}</b> · Email: <b>{p.email || "-"}</b> · Tel: <b>{p.telefono || "-"}</b>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => verFicha(p)}>
                    Ver ficha
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => copiar(p.email || "", "Email copiado")}
                    disabled={!p.email}
                    title={p.email ? "Copiar email" : "Sin email"}
                  >
                    Copiar email
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => copiar(p.telefono || "", "Teléfono copiado")}
                    disabled={!p.telefono}
                    title={p.telefono ? "Copiar teléfono" : "Sin teléfono"}
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
