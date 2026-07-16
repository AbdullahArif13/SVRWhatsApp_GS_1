import { Navigate, Route, Routes } from "react-router-dom";
import { TemplatesProvider } from "./context/TemplatesContext.jsx";
import { ContactsProvider } from "./context/ContactsContext.jsx";
import AddContact from "./pages/AddContact.jsx";
import Templates from "./pages/Templates.jsx";
import CreateTemplate from "./pages/CreateTemplate.jsx";
import MessageHistory from "./pages/MessageHistory.jsx";
import Chat from "./pages/Chat.jsx";

export default function App() {
  return (
    <ContactsProvider>
      <TemplatesProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<AddContact />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/create" element={<CreateTemplate />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<MessageHistory />} />
          <Route path="*" element={<Navigate to="/contacts" replace />} />
        </Routes>
      </TemplatesProvider>
    </ContactsProvider>
  );
}
