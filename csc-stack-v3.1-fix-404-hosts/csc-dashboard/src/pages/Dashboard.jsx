import DashboardView from "./dashboard/DashboardView.jsx";
import { useDashboardPage } from "./dashboard/useDashboardPage.js";

export default function Dashboard() {
  const props = useDashboardPage();
  return <DashboardView {...props} />;
}
