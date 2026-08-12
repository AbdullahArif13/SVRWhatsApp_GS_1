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








const CONTENT_ROLES = ["super_admin", "admin", "pengguna"];
const MANAGE_ROLES = ["super_admin", "admin"];

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        
        <Route path="/login" element={<Login />} />

        <Route
          path="*"
          element={
            <RequireAuth>
              <ContactsProvider>
                <TemplatesProvider>
                  <Routes>
                    
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
