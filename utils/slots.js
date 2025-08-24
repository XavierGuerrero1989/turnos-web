// Genera array de tiempos (HH:mm) entre [start, end) cada "stepMin" minutos.
export function generateTimeSlots(start, end, stepMin = 30) {
const [sh, sm] = start.split(":").map(Number);
const [eh, em] = end.split(":").map(Number);
const slots = [];
let current = sh * 60 + sm;
const limit = eh * 60 + em;
while (current + stepMin <= limit + 0.0001) {
const h = Math.floor(current / 60).toString().padStart(2, "0");
const m = (current % 60).toString().padStart(2, "0");
slots.push(`${h}:${m}`);
current += stepMin;
}
return slots;
}

// Filtra slots ocupados (occupiedTimes: ["HH:mm", ...])
export function availableSlots(allSlots, occupiedTimes) {
const set = new Set(occupiedTimes || []);
return allSlots.filter((t) => !set.has(t));
}

// Normaliza fecha a YYYY-MM-DD (sin TZ) desde Date o ISO
export function ymd(dateish) {
const d = typeof dateish === "string" ? new Date(dateish) : dateish;
const y = d.getFullYear();
const m = (d.getMonth() + 1).toString().padStart(2, "0");
const day = d.getDate().toString().padStart(2, "0");
return `${y}-${m}-${day}`;
}