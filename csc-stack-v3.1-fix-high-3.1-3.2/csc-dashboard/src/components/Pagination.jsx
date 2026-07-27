import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";


export default function Pagination({
  page,
  pageSize,
  showAll,
  totalPages,
  totalItems,
  startIndex,
  endIndexExclusive,
  onPageChange,
  onPageSizeChange,
  onToggleShowAll,
}) {
  const [draft, setDraft] = useState(String(pageSize));
  useEffect(() => {
    setDraft(String(pageSize));
  }, [pageSize]);

  function commitDraft() {
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed) || parsed < 1) {
      setDraft(String(pageSize)); // input tidak valid -- balikin ke nilai terakhir yang valid
      return;
    }
    onPageSizeChange(parsed);
  }

  if (totalItems === 0) return null;

  const rangeLabel = showAll
    ? `Menampilkan semua ${totalItems} data`
    : `Menampilkan ${startIndex + 1}-${endIndexExclusive} dari ${totalItems} data`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500">
      <span>{rangeLabel}</span>

      <div className="flex flex-wrap items-center gap-3">
        {/* Mode 1: custom page size */}
        <label className={`flex items-center gap-2 ${showAll ? "opacity-40" : ""}`}>
          <span>Data per halaman</span>
          <input
            type="number"
            min={1}
            value={draft}
            disabled={showAll}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
                e.currentTarget.blur();
              }
            }}
            className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-center outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </label>

        {/* Mode 2: tampilkan semua */}
        <button
          type="button"
          onClick={() => onToggleShowAll(!showAll)}
          className={`rounded-lg border px-3 py-1.5 font-semibold transition-colors ${
            showAll
              ? "border-brand bg-brand text-white"
              : "border-gray-200 text-gray-700 hover:border-brand hover:text-brand"
          }`}
        >
          Tampilkan Semua
        </button>

        {/* Navigasi halaman -- disembunyikan/dimatikan pas mode "Tampilkan Semua" */}
        <div className={`flex items-center gap-1 ${showAll ? "opacity-40" : ""}`}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={showAll || page <= 1}
            aria-label="Halaman sebelumnya"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-inherit"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[70px] text-center">
            Hal. {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={showAll || page >= totalPages}
            aria-label="Halaman berikutnya"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-inherit"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
