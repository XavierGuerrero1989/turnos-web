import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";

const Ctx = createContext({ user: null, role: null, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setL] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await getIdTokenResult(u, true);
        setRole(token.claims.role || "paciente");
      } else {
        setRole(null);
      }
      setL(false);
    });
  }, []);

  return <Ctx.Provider value={{ user, role, loading }}>{children}</Ctx.Provider>;
}
