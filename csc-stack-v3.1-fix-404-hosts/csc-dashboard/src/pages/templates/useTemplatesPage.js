import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplates } from "../../context/TemplatesContext.jsx";
import { usePagination } from "../../hooks/usePagination.js";

const APPROVAL_OPTIONS = ["Semua Respons", "Respons Aktif", "Respons Nonaktif"];
const STATUS_OPTIONS = ["Aktif", "Nonaktif", "Semua Status"];

export function useTemplatesPage() {
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
  }, [statusFilter, approvalFilter, searchQuery, pagination]);

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
      setRowError(err?.message || "Gagal mengubah status template.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteRow(template) {
    const confirmed = window.confirm(
      `Hapus template "${template.name}"? Template ini tidak akan dihapus permanen -- cuma dipindah ke panel Database.`
    );
    if (!confirmed) return;

    setDeletingId(template.id);
    setRowError(null);
    try {
      await softDeleteTemplate(template.id);
    } catch (err) {
      setRowError(err?.message || "Gagal menghapus template.");
    } finally {
      setDeletingId(null);
    }
  }

  return {
    navigate,
    approvalFilter,
    deletedCount,
    filteredTemplates,
    handleDeleteRow,
    handleToggleActive,
    pagedTemplates,
    pagination,
    rowError,
    searchQuery,
    setApprovalFilter,
    setSearchQuery,
    setShowTrashPanel,
    setStatusFilter,
    setViewingTemplate,
    showTrashPanel,
    statusFilter,
    statusOptions: STATUS_OPTIONS,
    approvalOptions: APPROVAL_OPTIONS,
    togglingId,
    deletingId,
    viewingTemplate,
  };
}
