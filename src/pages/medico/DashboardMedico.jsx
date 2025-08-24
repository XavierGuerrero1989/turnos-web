// src/pages/DashboardMedico.jsx
import React, { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../../firebase";

const DashboardMedico = () => {
  // 1) Al cargar, guarda/actualiza config/medico con uid + email
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await setDoc(
            doc(db, "config", "medico"),
            {
              uid: user.uid,
              email: user.email || null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.error("Error guardando config/medico:", e);
        }
      }
    });
    return () => unsub();
  }, []);

  // 2) Botón: llama callable y redirige a data.url
  const handleConectarGoogle = async () => {
    try {
      const getUrl = httpsCallable(functions, "getGoogleAuthUrl");
      const { data } = await getUrl();
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        alert("No se recibió la URL de Google. Revisá la función.");
      }
    } catch (e) {
      console.error("Error en getGoogleAuthUrl:", e);
      alert("No se pudo iniciar la conexión con Google.");
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Dashboard del Médico
      </h1>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
            Conectar Google (Calendar/Meet)
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            Necesario para crear reuniones de Google Meet al aceptar turnos.
          </p>
        </div>

        <button
          onClick={handleConectarGoogle}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            background: "#111827",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Conectar con Google
        </button>
      </div>
    </div>
  );
};

export default DashboardMedico;
