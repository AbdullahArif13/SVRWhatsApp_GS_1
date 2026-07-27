import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchBox from "../components/SearchBox.jsx";
import FilterSelect from "../components/FilterSelect.jsx";
import Pagination from "../components/Pagination.jsx";
import ActiveToggle from "../components/templates/ActiveToggle.jsx";
import RequireReplyBadge from "../components/templates/RequireReplyBadge.jsx";
import TrashPanel from "../components/templates/TrashPanel.jsx";
import TemplateDetailModal from "../components/templates/TemplateDetailModal.jsx";
import { useTemplates } from "../context/TemplatesContext.jsx";
import { usePagination } from "../hooks/usePagination.js";

const APPROVAL_OPTIONS = ["Semua Respons", "Respons Aktif", "Respons Nonaktif"];
const STATUS_OPTIONS = ["Aktif", "Nonaktif", "Semua Status"];

export default function Templates() {
  const navigate = useNavigate();
  const { templates, activateTemplate, deactivateTemplate, softDeleteTemplate } = useTemplates();
  const [statusFilter, setStatusFilter] = useState("Aktif");
  const [approvalFilter, setApprovalFilter] = useState("Semua Respons");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [showTrashPanel, setShowTrashPanel] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rowError, setRowError] = useState(null);

  const deletedCount = useMemo(() => templates.filter((t) => t.isDeleted).length, [templates]);
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (template.isDeleted) return false;
      if (statusFilter === "Aktif" && !template.isActive) return false;
      if (statusFilter === "Nonaktif" && template.isActive) return false;
      if (approvalFilter !== "Semua Respons") {
        const wantRequireReply = approvalFilter === "Respons Aktif";
        if (Boolean(template.requireReply) !== wantRequireReply) return false;
      }
      if (query) {
        const haystack = `${template.name} ${template.body}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [templates, statusFilter, approvalFilter, searchQuery]);

  const pagination = usePagination(filteredTemplates.length);
  useEffect(() => {
    pagination.resetPage();
  }, [statusFilter, approvalFilter, searchQuery]);
  const pagedTemplates = filteredTemplates.slice(pagination.startIndex, pagination.endIndexExclusive);

  async function handleToggleActive(template) {
    setTogglingId(template.id);
    setRowError(null);
    try {
      if (template.isActive) {
        await deactivateTemplate(template.id);
      } else {
        await activateTemplate(template.id);
      }
    } catch (err) {
      setRowError(err.message || "Gagal mengubah status template.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteRow(template) {
    const confirmed = window.confirm(
      `Hapus template "${template.name}"? Template ini TIDAK akan dihapus permanen -- cuma dipindah ke panel "Sampah Tamplate" dan masih bisa dipulihkan lagi kapan saja.`
    );
    if (!confirmed) return;

    setDeletingId(template.id);
    setRowError(null);
    try {
      await softDeleteTemplate(template.id);
    } catch (err) {
      setRowError(err.message || "Gagal menghapus template.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header + search/filter -- STATIS, tidak ikut scroll. */}
        <div className="shrink-0">
          <PageHeader
            title="Template"
            actionLabel="Buat Template"
            onAction={() => navigate("/templates/create")}
          />

          <div className="px-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Template WhatsApp</h2>
                <p className="text-sm text-gray-400">Buat template untuk mengirim pesan</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTrashPanel(true)}
                title="Lihat template yang sudah dihapus (Sampah Tamplate)"
                className="relative flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:text-brand"
              >
                <img src="/public/icon-delete-trash.png" alt="" className="h-5 w-5" />
                Sampah Tamplate
                {deletedCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white">
                    {deletedCount}
                  </span>
                )}
              </button>
            </div>

            {rowError && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{rowError}</p>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-4">
              <SearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari nama atau isi template..."
              />
              <FilterSelect options={APPROVAL_OPTIONS} value={approvalFilter} onChange={setApprovalFilter} />
              <FilterSelect options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            </div>
          </div>
        </div>

        {/* HANYA area ini yang scroll -- isinya baris-baris tabel (yang ada nomornya). */}
        <div className="flex-1 overflow-y-auto px-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              {/* sticky: header kolom tetap kelihatan walau baris di bawahnya di-scroll. */}
              <tr className="sticky top-0 z-10 bg-gray-200 text-left">
                <th className="w-12 px-5 py-3 font-semibold text-gray-900">No</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Nama Template</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Respons Penerima</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Dibuat Pada</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-gray-400">
                    Belum ada template untuk filter ini.
                  </td>
                </tr>
              )}
              {pagedTemplates.map((template, index) => (
                <tr key={template.id} className="border-b border-gray-100">
                  <td className="px-5 py-3 text-gray-500">{pagination.startIndex + index + 1}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setViewingTemplate(template)}
                      className="text-gray-700 underline-offset-2 transition-colors hover:text-brand hover:underline"
                    >
                      {template.name}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <ActiveToggle
                      isActive={template.isActive}
                      onClick={() => handleToggleActive(template)}
                      disabled={togglingId === template.id}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <RequireReplyBadge requireReply={template.requireReply} />
                  </td>
                  <td className="px-5 py-3 text-gray-500">{template.createdAt}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingTemplate(template)}
                        title="Edit template"
                        aria-label="Edit template"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand transition-colors hover:bg-brand-hover-200 disable:opacity-50"
                      >
                        <img src="/icons/edit-duotone.svg" alt="" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(template)}
                        disabled={deletingId === template.id}
                        title="Hapus"
                        aria-label="Hapus template"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-400 transition-colors hover:bg-red-200 disabled:opacity-50"
                      >
                        <img src="/icon-delete-trash.png" alt="" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer pagination -- STATIS, tidak ikut scroll. */}
        {filteredTemplates.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 px-8 py-4">
            <Pagination
              {...pagination}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              onToggleShowAll={pagination.setShowAll}
            />
          </div>
        )}
      </div>

      {viewingTemplate && (
        <TemplateDetailModal template={viewingTemplate} onClose={() => setViewingTemplate(null)} />
      )}

      {showTrashPanel && <TrashPanel onClose={() => setShowTrashPanel(false)} />}
    </Layout>
  );
}