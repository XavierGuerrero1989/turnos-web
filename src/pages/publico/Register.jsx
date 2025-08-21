import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import Swal from "sweetalert2";

export default function Register() {
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      Swal.fire("Error", "La contraseña debe tener al menos 8 caracteres", "error");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        telefono: formData.telefono,
        email: formData.email,
      });

      Swal.fire("¡Éxito!", "Usuario registrado correctamente", "success");
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "60px" }}>
      <div style={{
        background: "white",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "400px"
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
          <div style={{
            background: "#a225ebff",
            color: "white",
            fontWeight: "bold",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "10px"
          }}>
            Tx
          </div>
          <h2 style={{ margin: 0 }}>Turnos</h2>
        </div>

        <h3 style={{ marginBottom: "10px", textAlign: "center" }}>Crear cuenta</h3>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="nombre"
            placeholder="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="apellido"
            placeholder="Apellido"
            value={formData.apellido}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="dni"
            placeholder="DNI"
            value={formData.dni}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="tel"
            name="telefono"
            placeholder="Teléfono"
            value={formData.telefono}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="email"
            name="email"
            placeholder="Correo electrónico"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="password"
            name="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={formData.password}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <button
            type="submit"
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "10px",
              border: "none",
              borderRadius: "8px",
              background: "#9f25ebff",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Registrarse
          </button>
        </form>
      </div>
    </div>
  );
}

// estilo reutilizable para inputs
const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  outline: "none",
};
