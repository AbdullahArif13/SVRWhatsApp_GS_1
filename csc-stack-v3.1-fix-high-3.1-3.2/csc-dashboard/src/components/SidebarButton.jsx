import { useNavigate } from "react-router-dom";

export default function SidebarButton({ icon: Icon, label, to }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="flex w-full items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-active"
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}
