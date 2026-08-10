import { useState } from "react";
import { CirclePlus, History, LayoutDashboard, MessageCircle, ShieldCheck, Users } from "lucide-react";
import SidebarButton from "./SidebarButton.jsx";
import ManageUsersModal from "./ManageUsersModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * v3.12: menu PER-ROLE (4 role total) --
 *   - 'read_only'  : CUMA "Dashboard", tidak ada menu lain sama sekali.
 *   - 'pengguna'    : Dashboard + Tambah Kontak/Template, Chat, Riwayat
 *                     Pengiriman (operator biasa -- TIDAK bisa Manage
 *                     User/Sesi Login).
 *   - 'admin' & 'super_admin' : semua menu 'pengguna' DITAMBAH "Sesi
 *     Login" & "Manage User" (buka POPUP, bukan halaman baru -- lihat
 *     ManageUsersModal.jsx).
 */
export default function Sidebar() {
  const { role } = useAuth();
  const [showManageUsers, setShowManageUsers] = useState(false);
  const canUseContent = role === "super_admin" || role === "admin" || role === "pengguna";
  const canManage = role === "super_admin" || role === "admin";

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r border-gray-100 p-4">
      <SidebarButton icon={LayoutDashboard} label="Dashboard" to="/dashboard" />

      {canUseContent && (
        <>
          <SidebarButton icon={CirclePlus} label="Tambah Kontak" to="/contacts" />
          <SidebarButton icon={CirclePlus} label="Tambah Template" to="/templates" />
          <SidebarButton icon={MessageCircle} label="Chat" to="/chat" />
          <SidebarButton icon={History} label="Riwayat Pengiriman" to="/history" />
        </>
      )}

      {canManage && (
        <>
          <SidebarButton icon={ShieldCheck} label="Sesi Login" to="/sessions" />
          <button
            type="button"
            onClick={() => setShowManageUsers(true)}
            className="flex w-full items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-active"
          >
            <Users size={18} />
            <span>Manage User</span>
          </button>
        </>
      )}

      {showManageUsers && <ManageUsersModal onClose={() => setShowManageUsers(false)} />}
    </aside>
  );
}
