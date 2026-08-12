import MessageHistoryView from "./messageHistory/MessageHistoryView.jsx";
import { useMessageHistoryPage } from "./messageHistory/useMessageHistoryPage.js";

export default function MessageHistory() {
  const props = useMessageHistoryPage();
  return <MessageHistoryView {...props} />;
}
