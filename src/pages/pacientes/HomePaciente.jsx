// src/pages/pacientes/HomePaciente.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.jsx";
import { db } from "../../firebase.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";
import { Navigate, Link, useLocation } from "react-router-dom";
import TermsModal from "../../shared/TermsModal.jsx";
import "./HomePaciente.css";

export default function HomePaciente() {
  // ✅ Un solo useAuth: traemos todo junto
  const { user, role, loading } = useAuth();
  const loc = useLocation();

  const [perfil, setPerfil] = useState(null);
  const [sols, setSols] = useState([]);
  const [busyId, setBusyId] = useState(null);

  // 🧾 Recetas
  const [recetas, setRecetas] = useState([]);

  // ⬇️ Estado para términos (sin versionado)
  const [mustAccept, setMustAccept] = useState(false);
  const [loadingTerms, setLoadingTerms] = useState(true);

  const RCTA_URL =
    "https://app.rcta.me/patients/5a2aa02e6105ae448d2999b56a0214a5ea19868a";

  // ⛔ Mientras carga auth, no mostramos nada (evita parpadeos)
  if (loading) return null;

  // ✅ Guardia de rol: si es médico, fuera de acá
  if (role === "medico") {
    return <Navigate to="/medico" replace />;
  }

  useEffect(() => {
    if (!user) return;

    // Perfil
    getDoc(doc(db, "usuarios", user.uid))
      .then((snap) => setPerfil(snap.data() || null))
      .catch(console.error);

    // Mis solicitudes (turnos)
    const qRef = query(collection(db, "solicitudes"), where("pacienteId", "==", user.uid));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setSols(arr);
      },
      console.error
    );

    // Mis recetas
    const qRec = query(collection(db, "recetas"), where("pacienteId", "==", user.uid));
    const unsubRec = onSnapshot(
      qRec,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setRecetas(arr);
      },
      console.error
    );

    return () => {
      unsub();
      unsubRec();
    };
  }, [user]);

  // 🔒 Chequeo de términos (solo aceptación booleana)
  useEffect(() => {
    const checkTerms = async () => {
      if (!user?.uid) return;
      try {
        const uref = doc(db, "usuarios", user.uid);
        const snap = await getDoc(uref);
        const data = snap.data() || {};
        const accepted = data?.terminos?.aceptado === true;
        setMustAccept(!accepted);
      } catch (e) {
        console.error(e);
        // si falla, por seguridad pedimos aceptación
        setMustAccept(true);
      } finally {
        setLoadingTerms(false);
      }
    };
    checkTerms();
  }, [user?.uid]);

  const handleAcceptTerms = async () => {
    if (!user?.uid) return;
    try {
      const uref = doc(db, "usuarios", user.uid);
      await setDoc(
        uref,
        {
          terminos: {
            aceptado: true,
            acceptedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      setMustAccept(false);
      Swal.fire("Listo ✅", "Aceptaste los Términos y la Privacidad.", "success");
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e.message || "No pudimos registrar tu aceptación.", "error");
    }
  };

  // ✅ Scroll a la card cuando viene #receta (desde nav o desde otra pantalla)
  useEffect(() => {
    if (loc.hash !== "#receta") return;
    const t = setTimeout(() => {
      const el = document.getElementById("receta");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [loc.hash]);

  const propuestas = useMemo(() => sols.filter((s) => s.estado === "propuesta"), [sols]);

  const confirmadasFuturas = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sols
      .filter(
        (s) =>
          s.estado === "confirmada" &&
          s.propuesta?.dia &&
          new Date(s.propuesta.dia) >= today
      )
      .sort(
        (a, b) =>
          new Date(a.propuesta.dia + "T" + a.propuesta.hora) -
          new Date(b.propuesta.dia + "T" + b.propuesta.hora)
      );
  }, [sols]);

  const proxima = confirmadasFuturas[0] || null;
  const recientes = sols.slice(0, 5);

  // 🧾 Receta activa (solicitada)
  const recetaActiva = useMemo(
    () => recetas.find((r) => String(r.estado || "").toLowerCase() === "solicitada") || null,
    [recetas]
  );

  // 🧾 Historial (entregadas)
  const recetasHistoricas = useMemo(
    () => recetas.filter((r) => String(r.estado || "").toLowerCase() === "entregada"),
    [recetas]
  );

  // 👇 "Primera vez" según pedido: no hay entregadas aún
  const esPrimeraVezReceta = useMemo(() => recetasHistoricas.length === 0, [recetasHistoricas]);

  const aceptar = async (sol) => {
    setBusyId(sol.id);
    setSols((prev) => prev.map((x) => (x.id === sol.id ? { ...x, estado: "confirmada" } : x)));
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "confirmada" });
      Swal.fire("Confirmado ✅", "Tu turno fue confirmado.", "success");
    } catch (e) {
      console.error(e);
      setSols((prev) => prev.map((x) => (x.id === sol.id ? { ...x, estado: "propuesta" } : x)));
      Swal.fire("Error", e.message || "No se pudo confirmar el turno", "error");
    } finally {
      setBusyId(null);
    }
  };

  const rechazar = async (sol) => {
    const ok = await Swal.fire({
      title: "Rechazar propuesta",
      text: "¿Querés rechazar esta propuesta?",
      icon: "question",
      showCancelButton: true,
    });
    if (!ok.isConfirmed) return;
    setBusyId(sol.id);
    setSols((prev) =>
      prev.map((x) => (x.id === sol.id ? { ...x, estado: "pendiente", propuesta: null } : x))
    );
    try {
      await updateDoc(doc(db, "solicitudes", sol.id), { estado: "pendiente", propuesta: null });
      Swal.fire("Listo", "Volvimos la solicitud a pendiente.", "success");
    } catch (e) {
      console.error(e);
      setSols((prev) => prev.map((x) => (x.id === sol.id ? { ...x, estado: "propuesta" } : x)));
      Swal.fire("Error", e.message || "No se pudo actualizar", "error");
    } finally {
      setBusyId(null);
    }
  };

  // 🧾 Abrir modal para solicitar receta (Swal)
  const abrirModalReceta = async () => {
    if (!user?.uid) return;

    if (!loadingTerms && mustAccept) {
      Swal.fire(
        "Falta aceptar términos",
        "Para solicitar una receta, aceptá Términos y Privacidad.",
        "warning"
      );
      return;
    }

    if (recetaActiva) {
      Swal.fire(
        "Solicitud en curso",
        "Ya tenés una solicitud de receta en curso. Esperá la respuesta de la doctora.",
        "info"
      );
      return;
    }

    const html = `
      <div style="text-align:left; display:grid; gap:10px;">
        <div style="font-size:14px; line-height:1.4;">
          <b>Receta ginecológica online</b><br/>
          Completá los datos para solicitar tu receta.
        </div>

        <div>
          <label style="font-size:13px; display:block; margin-bottom:6px;">Obra social</label>
          <select id="obraSocial" class="swal2-input" style="width:100%; margin:0;">
            <option value="IOMA">IOMA</option>
            <option value="OTRAS">Otras</option>
          </select>
        </div>

        <div id="dniWrap">
          <label style="font-size:13px; display:block; margin-bottom:6px;">DNI</label>
          <input id="dni" class="swal2-input" style="width:100%; margin:0;" placeholder="Ingresá tu DNI" />
        </div>

        <div>
          <label style="font-size:13px; display:block; margin-bottom:6px;">Indicar medicación ginecológica solicitada</label>
          <textarea id="medicacion" class="swal2-textarea" style="width:100%; margin:0;" placeholder="Ej: nombre, dosis, presentación..."></textarea>
        </div>

        <div style="font-size:12px; opacity:.85;">
          ⏱️ Demora estimada: según disponibilidad.<br/>
          💲 Costo: según indicación de la doctora.
        </div>
      </div>
    `;

    await Swal.fire({
      title: "Solicitar receta",
      html,
      showCancelButton: true,
      confirmButtonText: "Enviar",
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      didOpen: () => {
        const sel = document.getElementById("obraSocial");
        const dniWrap = document.getElementById("dniWrap");

        const toggle = () => {
          const v = sel?.value || "IOMA";
          if (dniWrap) dniWrap.style.display = v === "IOMA" ? "block" : "none";
        };

        if (sel) sel.addEventListener("change", toggle);
        toggle();
      },
      preConfirm: () => {
        const obraSocial = document.getElementById("obraSocial")?.value || "IOMA";
        const dni = (document.getElementById("dni")?.value || "").trim();
        const medicacionSolicitada = (document.getElementById("medicacion")?.value || "").trim();

        if (!medicacionSolicitada) {
          Swal.showValidationMessage("Indicá la medicación solicitada.");
          return false;
        }
        if (obraSocial === "IOMA" && !dni) {
          Swal.showValidationMessage("Ingresá tu DNI (IOMA).");
          return false;
        }

        return { obraSocial, dni, medicacionSolicitada };
      },
    }).then(async (res) => {
      if (!res.isConfirmed || !res.value) return;

      const { obraSocial, dni, medicacionSolicitada } = res.value;

      try {
        await addDoc(collection(db, "recetas"), {
          pacienteId: user.uid,
          pacienteEmail: (perfil?.email || user.email || "").toLowerCase(),
          pacienteNombre: perfil ? `${perfil.nombre || ""} ${perfil.apellido || ""}`.trim() : "",
          obraSocial,
          dni: obraSocial === "IOMA" ? dni : "",
          medicacionSolicitada,
          estado: "solicitada",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (obraSocial === "IOMA") {
          await Swal.fire(
            "Solicitud enviada ✅",
            "Tu solicitud de receta fue enviada con éxito.",
            "success"
          );
        } else {
          await Swal.fire({
            title: "Información",
            icon: "info",
            html: `
              <div style="text-align:left; line-height:1.6;">
                <p>Si es su primera solicitud de receta, por favor ingresar al siguiente link y completar sus datos personales a la mayor brevedad posible.</p>
                <p>
                  <a href="${RCTA_URL}" target="_blank" rel="noreferrer">
                    ${RCTA_URL}
                  </a>
                </p>
              </div>
            `,
            confirmButtonText: "Entendido",
          });
        }
      } catch (e) {
        console.error(e);
        Swal.fire("Error", e.message || "No se pudo enviar la solicitud de receta.", "error");
      }
    });
  };

  const fmtDateTime = (ts) => {
    try {
      return ts?.toDate?.() ? ts.toDate().toLocaleString() : "";
    } catch {
      return "";
    }
  };

  return (
    <div className="container" style={{ display: "grid", gap: 12 }}>
      {/* Modal de Términos: aparece sólo si falta aceptar y ya cargó el chequeo */}
      {!loadingTerms && mustAccept && <TermsModal onAccept={handleAcceptTerms} />}

      <h2>
        Hola {perfil ? `${perfil.nombre} ${perfil.apellido}` : user?.email || "Paciente"} 👋
      </h2>

      {/* Información útil (banner destacado) */}
      <div
        className="card"
        style={{ background: "#fff7e6", border: "1px solid #ffcc80", position: "relative" }}
      >
        <h3
          style={{
            marginTop: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Información importante
          <button
            className="btn btn-outline"
            style={{ padding: "4px 8px", fontSize: "18px" }}
            onClick={() => {
              Swal.fire({
                title: "Pago de la consulta",
                html: `
                  <div style="text-align:left; line-height:1.6">
                    <p>⚠️ Recordá realizar el pago de tu consulta:</p>
                    <ul>
                      <li><b>$30.000</b> — Consulta Ginecológica</li>
                      <li><b>$40.000</b> — Consulta de Fertilidad</li>
                    </ul>
                    <p><b>Alias:</b> DRAYRODRIGUEZ.MP</p>
                    <p style="margin-top:10px">
                      📌 <b>Importante:</b><br/>
                      Enviá el comprobante de pago a la casilla drayaninarodriguez@gmail.com hasta 24 horas antes de tu turno.<br/>
                      Si no lo recibimos en ese plazo, el turno se considerará <b>cancelado</b>.
                    </p>
                  </div>
                `,
                confirmButtonText: "Entendido",
                icon: "warning",
              });
            }}
          >
            ⚠️
          </button>
        </h3>
        <ul style={{ paddingLeft: "20px", margin: 0 }}>
          <li>Recordá estar lista 5 minutos antes de tu cita.</li>
          <li>El link de la videollamada lo veras en la sección "Mis Turnos" dentro de tu turno confirmado.</li>
          <li>Si no enviás el comprobante de pago al mail de la doctora, el turno se considera cancelado.</li>
        </ul>
      </div>

      {/* Próximo turno */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Próximo turno</h3>
        {!proxima ? (
          <div>
            No tenés turnos confirmados.{" "}
            <Link className="btn btn-outline" to="/paciente/solicitar-turno">
              Solicitar uno
            </Link>
          </div>
        ) : (
          <div>
            <div>
              <b>{proxima.propuesta.dia}</b> · <b>{proxima.propuesta.hora}</b>{" "}
              ({proxima.propuesta.franja === "manana" ? "Mañana" : "Tarde"})
            </div>
            <div style={{ marginTop: 8 }}>
              <Link className="btn btn-outline" to="/paciente/mis-turnos">
                Ver detalle
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 🧾 Receta ginecológica online (Opción A) */}
      <div
        id="receta"
        className="card"
        style={{
          scrollMarginTop: 90, // por si tu header es fijo
          border: "1px solid var(--border)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Receta ginecológica online</h3>

        {!recetaActiva ? (
          <>
            <div className="helper" style={{ marginBottom: 10 }}>
              Podés solicitar tu receta sin pedir un turno. Te informaremos cuando esté lista.
            </div>
            <button className="btn btn-primary" onClick={abrirModalReceta}>
              Solicitar receta
            </button>
          </>
        ) : (
          <>
            {/* ✅ NUEVO: receta activa como "card item" */}
            <div className="item receta-activa">
              <div className="receta-activa__top">
                <strong>Solicitud en curso</strong>
                <span className="receta-activa__badge">
                  {String(recetaActiva.estado || "").toLowerCase()}
                </span>
              </div>

              {recetaActiva.medicacionSolicitada && (
                <div className="receta-activa__med">
                  <strong>{recetaActiva.medicacionSolicitada}</strong>
                </div>
              )}

              <div className="muted receta-activa__meta">
                <span>
                  Obra social: <b>{String(recetaActiva.obraSocial || "").toUpperCase()}</b>
                </span>
                {recetaActiva.dni ? (
                  <span>
                    DNI: <b>{recetaActiva.dni}</b>
                  </span>
                ) : null}
              </div>

              <div className="muted">
                Solicitada el <b>{fmtDateTime(recetaActiva.createdAt)}</b>
              </div>

              <div className="receta-activa__actions">
                <button
                  className="btn btn-outline"
                  onClick={() =>
                    Swal.fire(
                      "Solicitud en curso",
                      "Ya tenés una solicitud de receta en curso. Esperá la respuesta de la doctora.",
                      "info"
                    )
                  }
                >
                  Ver estado
                </button>
              </div>
            </div>

            {/* ✅ NUEVO: Recuadro de info SOLO si OTRAS y es primera vez */}
            {String(recetaActiva.obraSocial || "").toUpperCase() === "OTRAS" && (
              <div className="receta-info">
                <div className="receta-info__title">Información importante</div>
                <div className="receta-info__text">
                  Si es la primera vez que solicitás una receta por este medio, no olvides ingresar tu
                  información personal dentro del siguiente link:
                </div>
                <a className="receta-info__link" href={RCTA_URL} target="_blank" rel="noreferrer">
                  {RCTA_URL}
                </a>
              </div>
            )}
          </>
        )}

        {/* 📁 Historial de recetas entregadas */}
        {recetasHistoricas.length > 0 && (
          <>
            <hr style={{ margin: "14px 0" }} />
            <h4 style={{ margin: "0 0 8px" }}>Solicitudes anteriores</h4>

            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {recetasHistoricas.map((r) => {
                const obra = String(r.obraSocial || "").toUpperCase();
                const isIoma = obra === "IOMA";
                const deliveredLabel = fmtDateTime(r.deliveredAt);

                return (
                  <li key={r.id} className="item" style={{ display: "grid", gap: 6 }}>
                    <div>
                      <strong>{r.medicacionSolicitada || "—"}</strong>
                    </div>

                    <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>
                        Obra social: <b>{obra || "-"}</b>
                      </span>
                      {isIoma && r.dni ? (
                        <span>
                          DNI: <b>{r.dni}</b>
                        </span>
                      ) : null}
                    </div>

                    <div className="muted">
                      {deliveredLabel ? (
                        <>
                          Entregada el <b>{deliveredLabel}</b>
                        </>
                      ) : (
                        <>Entregada</>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Propuestas pendientes */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Propuestas del médico pendientes de confirmación</h3>
        {propuestas.length === 0 ? (
          <div>No tenés propuestas pendientes.</div>
        ) : (
          propuestas.map((sol) => (
            <div
              key={sol.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                padding: "8px 0",
                borderTop: "1px solid var(--border)",
              }}
              className="home-propuesta-row"
            >
              <div>
                <div>
                  <b>{sol.propuesta?.dia}</b> a las <b>{sol.propuesta?.hora}</b> ·{" "}
                  {sol.propuesta?.franja === "manana" ? "Mañana" : "Tarde"}
                </div>
                <div className="helper">
                  Tu solicitud: {sol.diaSolicitado} ({sol.franja === "manana" ? "Mañana" : "Tarde"})
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }} className="home-propuesta-actions">
                <button
                  className="btn btn-primary"
                  disabled={busyId === sol.id}
                  onClick={() => aceptar(sol)}
                >
                  {busyId === sol.id ? "Confirmando..." : "Aceptar"}
                </button>
                <button
                  className="btn btn-outline"
                  disabled={busyId === sol.id}
                  onClick={() => rechazar(sol)}
                >
                  {busyId === sol.id ? "Procesando..." : "Rechazar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mis solicitudes (resumen) */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Mis solicitudes</h3>
        {recientes.length === 0 ? (
          <div>No hay solicitudes aún.</div>
        ) : (
          recientes.map((sol) => (
            <div
              key={sol.id}
              className="helper"
              style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}
            >
              {sol.diaSolicitado} · {sol.franja === "manana" ? "Mañana" : "Tarde"} —{" "}
              <b>{sol.estado}</b>
            </div>
          ))
        )}
        <div style={{ marginTop: 8, display: "flex", gap: 8 }} className="home-bottom-actions">
          <Link className="btn btn-outline" to="/paciente/mis-turnos">
            Ver todas
          </Link>
          <Link className="btn btn-primary" to="/paciente/solicitar-turno">
            Solicitar turno
          </Link>
        </div>
      </div>
    </div>
  );
}
