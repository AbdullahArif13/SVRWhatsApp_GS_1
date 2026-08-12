import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getActiveSessionsApi, deleteSessionApi } from "../../services/api.js";

export function useLoginSessionsPage() {
  const { role } = useAuth();
  const canForceLogout = role === "super_admin";
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [revokingId, setRevokingId] = useState(null);

  async function loadSessions() {
    setStatus("loading");
    try {
      const data = await getActiveSessionsApi();
      setSessions(data);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message || "Gagal mengambil daftar sesi login.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleRevoke(sid) {
    setRevokingId(sid);
    try {
      await deleteSessionApi(sid);
      setSessions((prev) => prev.filter((s) => s.sid !== sid));
    } catch (error) {
      setErrorMessage(error.message || "Gagal paksa-logout sesi ini.");
    } finally {
      setRevokingId(null);
    }
  }

  return {
    canForceLogout,
    sessions,
    status,
    errorMessage,
    revokingId,
    loadSessions,
    handleRevoke,
  };
}
