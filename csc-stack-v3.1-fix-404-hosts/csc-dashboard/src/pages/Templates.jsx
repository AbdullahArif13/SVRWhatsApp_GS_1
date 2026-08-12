import TemplatesView from "./templates/TemplatesView.jsx";
import { useTemplatesPage } from "./templates/useTemplatesPage.js";

export default function Templates() {
  const props = useTemplatesPage();
  return <TemplatesView {...props} />;
}
