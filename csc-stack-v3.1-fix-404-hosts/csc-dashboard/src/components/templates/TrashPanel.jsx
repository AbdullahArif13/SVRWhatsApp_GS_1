import { useMemo, useState } from "react";
import { useTemplates } from "../../context/TemplatesContext.jsx";


export default function TrashPanel({ onClose }) {
  const { templates, restoreTemplate } = useTemplates();
  const [restoringId, setRestoringId] = useState(null);
  const [error, setError] = useState(null);

  const deletedTemplates = useMemo(() => templates.filter((t) => t.isDeleted), [templates]);

  async function handleRestore(template) {
    setRestoringId(template.id);
    setError(null);
    try {
      await restoreTemplate(template.id);
    } catch (err) {
      setError(err.message || "Gagal memulihkan template.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col gap-4 rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/database-light.svg" alt="" className="h-6 w-6" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Database Template Terhapus</h3>
              <p className="text-sm text-gray-400">
                Template yang sudah dihapus tetap tersimpan di sini -- tidak ada yang dihapus
                permanen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <img src="/icons/close-ring-fill.svg" alt="" className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="max-h-96 overflow-y-auto">
          {deletedTemplates.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Belum ada template yang dihapus.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {deletedTemplates.map((template) => (
                <div key={template.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate text-sm font-semibold text-gray-900">{template.name}</p>
                    <p className="truncate text-xs text-gray-400">{template.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(template)}
                    disabled={restoringId === template.id}
                    className="shrink-0 rounded-full bg-green-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                  >
                    {restoringId === template.id ? "Memulihkan..." : "Gunakan Kembali"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
