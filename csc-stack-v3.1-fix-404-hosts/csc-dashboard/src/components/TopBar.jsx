import { useNavigate } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function TopBar({ onToggleSidebar }) {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-100 px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="rounded p-1 text-gray-700 hover:bg-gray-100"
        aria-label="Toggle sidebar"
      >
        <Menu size={22} />
      </button>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">
        GS
      </div>
      <span className="text-lg font-semibold tracking-wide text-gray-900">CSC_IT_GS</span>

      
      <div className="ml-auto flex items-center gap-3">
        {username && <span className="text-sm text-gray-500">{username}</span>}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
