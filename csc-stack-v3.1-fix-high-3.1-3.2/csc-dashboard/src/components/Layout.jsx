import { useState } from "react";
import TopBar from "./TopBar.jsx";
import Sidebar from "./Sidebar.jsx";
import Watermark from "./Watermark.jsx";

/**
 * Shared page shell used by every route.
 *
 * @param {React.ReactNode} children - main page content
 * @param {boolean} [showWatermark] - whether to show the faint GS watermark
 *   behind the content (used for empty/placeholder states)
 */
export default function Layout({ children, showWatermark = true }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen flex-col">
      <TopBar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`overflow-hidden transition-[width] duration-200 ease-in-out ${
            sidebarOpen ? "w-64" : "w-0"
          }`}
        >
          <Sidebar />
        </div>
        <main className="relative flex-1 overflow-y-auto">
          {showWatermark && <Watermark />}
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
