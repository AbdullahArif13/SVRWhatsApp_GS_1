/**
 * Dropdown filter bergaya pill hijau, dipakai di halaman Template dan
 * Riwayat Pengiriman.
 *
 * `options` boleh berupa:
 *   - array string, contoh: ["Aktif", "Nonaktif"]
 *   - array object { value, label }, contoh:
 *     [{ value: "all", label: "Semua Status" }]
 *
 * (Sebelumnya ada 2 komponen terpisah dengan nama sama persis di
 * Templates.jsx dan MessageHistory.jsx yang cuma beda di bentuk
 * `options` ini -- sekarang digabung jadi satu di sini.)
 */
export default function FilterSelect({ options, value, onChange }) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg bg-brand px-5 py-2.5 pr-10 text-sm font-semibold text-white outline-none hover:bg-brand-hover"
      >
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-900">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white">
        ▾
      </span>
    </div>
  );
}
