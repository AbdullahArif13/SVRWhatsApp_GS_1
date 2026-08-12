import CreateTemplateView from "./createTemplate/CreateTemplateView.jsx";
import { useCreateTemplatePage } from "./createTemplate/useCreateTemplatePage.js";

export default function CreateTemplate() {
  const props = useCreateTemplatePage();
  return <CreateTemplateView {...props} />;
}
