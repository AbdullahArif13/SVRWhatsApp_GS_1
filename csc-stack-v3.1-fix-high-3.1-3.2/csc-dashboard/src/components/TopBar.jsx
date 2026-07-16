import { Menu } from "lucide-react";

export default function TopBar({ onToggleSidebar }) {
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
    </header>
  );
}
