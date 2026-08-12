import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";


export default function RequireRole({ allow, children }) {
  const { role } = useAuth();

  if (!allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
