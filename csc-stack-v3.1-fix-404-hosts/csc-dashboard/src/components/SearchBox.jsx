import { X } from "lucide-react";

export default function SearchBox({ value, onChange, placeholder = "Cari..." }) {
  return (
    <div className="relative flex-1 max-w-sm">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-200 bg-white py-2.5 px-5 pr-10 text-sm text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 hover:border-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Bersihkan pencarian"
          className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
