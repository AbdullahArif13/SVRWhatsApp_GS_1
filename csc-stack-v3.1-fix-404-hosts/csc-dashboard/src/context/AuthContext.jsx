import { createContext, useContext, useEffect, useState } from "react";
import { getMeApi, loginApi, logoutApi } from "../services/api.js";

const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [username, setUsername] = useState(null);
  
  
  const [role, setRole] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getMeApi()
      .then((data) => {
        if (cancelled) return;
        if (data?.loggedIn) {
          setUsername(data.username);
          setRole(data.role);
          setStatus("authenticated");
        } else {
          setStatus("guest");
        }
      })
      .catch(() => {
        
        
        if (!cancelled) setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(usernameInput, password) {
    const data = await loginApi({ username: usernameInput, password });
    setUsername(data.username);
    setRole(data.role);
    setStatus("authenticated");
  }

  async function logout() {
    try {
      await logoutApi();
    } finally {
      
      
      
      setUsername(null);
      setRole(null);
      setStatus("guest");
    }
  }

  return (
    <AuthContext.Provider value={{ status, username, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() harus dipakai di dalam <AuthProvider>.");
  return ctx;
}
