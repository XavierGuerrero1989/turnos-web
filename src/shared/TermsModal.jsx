import { useState } from "react";
import { Link } from "react-router-dom";

export default function TermsModal({ onAccept }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="modal-backdrop">
      <div className="modal card">
        <h3 className="title">Términos y Condiciones</h3>

        <div className="scroll-box">
          <p>
            Para continuar, debés aceptar los <strong>Términos y Condiciones</strong> y la
            <strong> Política de Privacidad</strong> de GineTurnos. También consentís el uso de
            tus datos para brindar el servicio (Firebase/Firestore, recordatorios y trazabilidad).
          </p>
          <ul className="list">
            <li>Cumplimiento: Ley 25.326 (AR) – Protección de Datos Personales.</li>
            <li>Finalidades: gestión de turnos y comunicaciones del servicio.</li>
            <li>Conservación: vigencia de la cuenta o por requerimientos legales.</li>
            <li>Derechos: acceso/rectificación/supresión bajo solicitud del titular.</li>
          </ul>
          <p>
            Documentos completos:
            <br />
            <Link to="/terminos" target="_blank" className="link">Ver Términos y Condiciones</Link><br />
            <Link to="/privacidad" target="_blank" className="link">Ver Política de Privacidad</Link>
          </p>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>Acepto los Términos, la Privacidad y el uso de mis datos para la prestación.</span>
        </label>

        <div className="actions">
          <button className="btn primary" disabled={!checked} onClick={onAccept}>
            Aceptar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}
