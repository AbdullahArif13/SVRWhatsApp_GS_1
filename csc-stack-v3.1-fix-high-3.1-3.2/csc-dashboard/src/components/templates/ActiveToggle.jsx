import StatusIcon from "./StatusIcon.jsx";

/**
 * Switch Aktif/Nonaktif, gaya "knob besar nongol keluar track" -- ijo +
 * centang kalau Aktif, merah + silang kalau Nonaktif.
 *
 * Kalau `onClick` dikasih, ini jadi tombol beneran yang langsung nulis ke
 * database begitu diklik (dipakai di tabel & di header popup detail).
 * Kalau `onClick` tidak dikasih, fallback ke tampilan statis (read-only).
 */
export default function ActiveToggle({ isActive, onClick, disabled }) {
  const content = (
    <span className="inline-flex items-center gap-2">
      <span
        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors ${
          isActive ? "bg-green-500" : "bg-red-400"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-all ${
            isActive
              ? "-right-1 bg-white text-green-500"
              : "-left-1 bg-red-600 text-white ring-2 ring-white"
          }`}
        >
          <StatusIcon variant={isActive ? "check" : "close"} className="h-6 w-6" />
        </span>
      </span>
      <span className={`text-xs font-semibold ${isActive ? "text-green-600" : "text-red-500"}`}>
        {isActive ? "Aktif" : "Nonaktif"}
      </span>
    </span>
  );

  if (!onClick) {
    return (
      <span role="status" aria-label={isActive ? "Aktif" : "Nonaktif"}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      onClick={onClick}
      disabled={disabled}
      title={isActive ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
      className="cursor-pointer disabled:cursor-wait"
    >
      {content}
    </button>
  );
}
