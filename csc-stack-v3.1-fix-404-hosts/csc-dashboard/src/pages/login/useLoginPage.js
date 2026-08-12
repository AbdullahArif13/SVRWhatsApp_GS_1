import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export function useLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login(username.trim(), password);
      navigate("/contacts", { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Gagal login.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    errorMessage,
    handleSubmit,
  };
}
