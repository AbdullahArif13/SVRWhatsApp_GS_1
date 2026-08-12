import LoginView from "./login/LoginView.jsx";
import { useLoginPage } from "./login/useLoginPage.js";

export default function Login() {
  const props = useLoginPage();
  return <LoginView {...props} />;
}
