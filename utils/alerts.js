import Swal from "sweetalert2";
export const ok = (t,m) => Swal.fire(t,m,"success");
export const error = (t,m) => Swal.fire(t,m||"Ocurrió un error","error");
