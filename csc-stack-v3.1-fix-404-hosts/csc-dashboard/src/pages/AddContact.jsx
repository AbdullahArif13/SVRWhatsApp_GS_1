import AddContactView from "./addContact/AddContactView.jsx";
import { useAddContactPage } from "./addContact/useAddContactPage.js";

export default function AddContact() {
  const props = useAddContactPage();
  return <AddContactView {...props} />;
}
