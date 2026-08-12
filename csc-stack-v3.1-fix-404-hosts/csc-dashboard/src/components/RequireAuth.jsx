import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";


export default function RequireAuth({ children }) {
  const { status } = useAuth();

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center text-sm text-gray-400">Memuat...</div>;
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
