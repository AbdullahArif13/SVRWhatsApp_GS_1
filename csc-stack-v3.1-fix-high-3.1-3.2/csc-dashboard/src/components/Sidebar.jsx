import { CirclePlus, History, MessageCircle } from "lucide-react";
import SidebarButton from "./SidebarButton.jsx";

/** Left navigation. Always shows all 4 actions. */
export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r border-gray-100 p-4">
      <SidebarButton icon={CirclePlus} label="Tambah Kontak" to="/contacts" />
      <SidebarButton icon={CirclePlus} label="Tambah Template" to="/templates" />
      <SidebarButton icon={MessageCircle} label="Chat" to="/chat" />
      <SidebarButton icon={History} label="Riwayat Pengiriman" to="/history" />
    </aside>
  );
}
