import LoginSessionsView from "./loginSessions/LoginSessionsView.jsx";
import { useLoginSessionsPage } from "./loginSessions/useLoginSessionsPage.js";

export default function LoginSessions() {
  const props = useLoginSessionsPage();
  return <LoginSessionsView {...props} />;
}
