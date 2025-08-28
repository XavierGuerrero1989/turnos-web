export default function Privacidad() {
  return (
    <div className="container legal">
      <h1>Política de Privacidad – GineTurnos</h1>
      <p><strong>Última actualización:</strong> 27 de agosto de 2025</p>

      <h3>1. Responsable del tratamiento</h3>
      <p>
        El responsable del tratamiento de los datos personales es <strong>GineTurnos</strong>, en
        cumplimiento de la Ley 25.326 de Protección de Datos Personales de la República Argentina.
      </p>

      <h3>2. Datos recolectados</h3>
      <ul>
        <li>Datos de identificación: nombre, apellido, DNI, correo electrónico, teléfono.</li>
        <li>Datos de uso: historial de turnos, confirmaciones, notificaciones enviadas.</li>
        <li>No se recolectan datos sensibles clínicos, salvo en módulos habilitados expresamente por médico y paciente.</li>
      </ul>

      <h3>3. Finalidad del tratamiento</h3>
      <p>
        Los datos se utilizan exclusivamente para:
      </p>
      <ul>
        <li>Gestionar turnos médicos y recordatorios.</li>
        <li>Enviar notificaciones relacionadas a la atención.</li>
        <li>Mejorar el funcionamiento del sistema y la experiencia de usuario.</li>
      </ul>
      <p>No se emplearán para fines comerciales ajenos ni se cederán a terceros no vinculados.</p>

      <h3>4. Almacenamiento y seguridad</h3>
      <p>
        Los datos se almacenan en servidores de <strong>Google Firebase/Firestore</strong>, con
        estándares internacionales de seguridad. Se aplican medidas técnicas y organizativas para
        resguardar la confidencialidad, integridad y disponibilidad de la información.
      </p>

      <h3>5. Cesiones y transferencias</h3>
      <p>
        Los datos no se cederán a terceros salvo obligación legal o consentimiento expreso del usuario.
        En caso de transferencias internacionales, se garantiza un nivel adecuado de protección conforme
        a la normativa argentina.
      </p>

      <h3>6. Derechos de los titulares</h3>
      <p>
        El usuario puede ejercer sus derechos de acceso, rectificación, actualización y supresión (ARCO)
        en cualquier momento escribiendo a <strong>[correo de contacto de GineTurnos]</strong>.
      </p>
      <p>
        La Dirección Nacional de Protección de Datos Personales es el órgano de control de la Ley 25.326,
        y el usuario puede presentar denuncias allí en caso de incumplimiento.
      </p>

      <h3>7. Conservación</h3>
      <p>
        Los datos se conservarán mientras la cuenta del usuario esté activa o durante los plazos exigidos
        por la normativa aplicable.
      </p>

      <h3>8. Consentimiento</h3>
      <p>
        El uso del sistema implica la aceptación expresa de esta Política de Privacidad. El consentimiento
        podrá ser revocado en cualquier momento, lo que implicará la baja de la cuenta y eliminación de los
        datos en la medida permitida por la ley.
      </p>
    </div>
  );
}
