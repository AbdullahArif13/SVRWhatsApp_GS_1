import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { TemplatesProvider } from "./context/TemplatesContext.jsx";
import { ContactsProvider } from "./context/ContactsContext.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireRole from "./components/RequireRole.jsx";
import Login from "./pages/Login.jsx";
import AddContact from "./pages/AddContact.jsx";
import Templates from "./pages/Templates.jsx";
import CreateTemplate from "./pages/CreateTemplate.jsx";
import MessageHistory from "./pages/MessageHistory.jsx";
import Chat from "./pages/Chat.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import LoginSessions from "./pages/LoginSessions.jsx";

// v3.12: 4 role -- super_admin, admin, pengguna (operator biasa), dan
// read_only (BENERAN read-only, cuma boleh /dashboard). Dua kelompok akses:
//   - CONTENT_ROLES : Tambah Kontak/Template, Chat, Riwayat Pengiriman --
//     'pengguna' TERMASUK (dia yang justru paling sering pakai halaman
//     ini, makanya aktivitasnya perlu dipantau Admin lewat Manage User).
//   - MANAGE_ROLES  : Sesi Login & Manage User -- CUMA super_admin/admin,
//     'pengguna' & 'read_only' berdua-duanya TIDAK boleh.
const CONTENT_ROLES = ["super_admin", "admin", "pengguna"];
const MANAGE_ROLES = ["super_admin", "admin"];

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* v3.10: SATU-SATUNYA route di luar gerbang RequireAuth -- halaman
            Login sendiri tidak boleh mensyaratkan sudah login. */}
        <Route path="/login" element={<Login />} />

        <Route
          path="*"
          element={
            <RequireAuth>
              <ContactsProvider>
                <TemplatesProvider>
                  <Routes>
                    {/* v3.11: landing page = /dashboard (BUKAN /contacts lagi) --
                        satu-satunya halaman yang bisa diakses SEMUA role. */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route
                      path="/contacts"
                      element={
                        <RequireRole allow={CONTENT_ROLES}>
                          <AddContact />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/templates"
                      element={
                        <RequireRole allow={CONTENT_ROLES}>
                          <Templates />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/templates/create"
                      element={
                        <RequireRole allow={CONTENT_ROLES}>
                          <CreateTemplate />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/chat"
                      element={
                        <RequireRole allow={CONTENT_ROLES}>
                          <Chat />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/history"
                      element={
                        <RequireRole allow={CONTENT_ROLES}>
                          <MessageHistory />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/sessions"
                      element={
                        <RequireRole allow={MANAGE_ROLES}>
                          <LoginSessions />
                        </RequireRole>
                      }
                    />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </TemplatesProvider>
              </ContactsProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
