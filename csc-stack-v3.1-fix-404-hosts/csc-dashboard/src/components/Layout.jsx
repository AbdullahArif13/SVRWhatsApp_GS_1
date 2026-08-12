import { useState } from "react";
import TopBar from "./TopBar.jsx";
import Sidebar from "./Sidebar.jsx";
import Watermark from "./Watermark.jsx";


export default function Layout({ children }) {
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
          <Watermark />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
