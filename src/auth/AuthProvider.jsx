// auth/AuthProvider.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onIdTokenChanged, getIdTokenResult } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Ctx = createContext({ user: null, role: null, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setL] = useState(true);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setL(false);
        return;
      }

      // Intentar claims frescos
      let r = null;
      try {
        const token = await getIdTokenResult(u, true); // true → forzar refresh
        r = token.claims.role ?? null;
      } catch (_) {}

      // Fallback Firestore si no hay claim
      if (!r) {
        try {
          const snap = await getDoc(doc(db, "usuarios", u.uid));
          r = (snap.exists() && snap.data()?.role) || null;
        } catch (_) {}
      }

      setRole(r || "paciente");
      setL(false);
    });

    return () => unsub();
  }, []);

  return (
    <Ctx.Provider value={{ user, role, loading }}>
      {children}
    </Ctx.Provider>
  );
}
