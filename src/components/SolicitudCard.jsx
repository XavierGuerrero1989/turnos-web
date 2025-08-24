import React from "react";

const Line = ({ label, value }) => (
<div className="text-sm flex gap-2"><span className="font-medium min-w-28">{label}:</span> <span className="text-gray-700">{value}</span></div>
);

const SolicitudCard = ({ solicitud, children }) => {
return (
<div className="border rounded-2xl p-4 mb-3 bg-white shadow-sm">
<div className="flex items-start justify-between gap-4">
<div className="space-y-1">
<div className="text-base font-semibold">{solicitud.pacienteNombre || "Paciente"}</div>
<Line label="Fecha solicitada" value={new Date(solicitud.fechaSolicitada).toLocaleDateString()} />
<Line label="Franja" value={solicitud.franja} />
{solicitud.motivo && <Line label="Motivo" value={solicitud.motivo} />}
<Line label="Estado" value={solicitud.estado} />
</div>
<div className="min-w-[280px]">{children}</div>
</div>
</div>
);
};

export default SolicitudCard;