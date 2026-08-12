import ChatView from "./chat/ChatView.jsx";
import { useChatPage } from "./chat/useChatPage.js";

export default function Chat() {
  const props = useChatPage();
  return <ChatView {...props} />;
}
