import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getTemplates,
  createTemplateApi,
  updateTemplateApi,
  deactivateTemplateApi,
  activateTemplateApi,
  softDeleteTemplateApi,
  restoreTemplateApi,
  deleteTemplateApi,
} from "../services/api.js";

const TemplatesContext = createContext(null);

export function TemplatesProvider({ children }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function addTemplate({ name, body, requireReply }) {
    const newTemplate = await createTemplateApi({ name, body, requireReply });
    setTemplates((prev) => [newTemplate, ...prev]);
    return newTemplate;
  }

  /** Icon "Edit" (folder) di popup detail -- ubah nama/isi/parameter Approve-Reject template. */
  async function editTemplate(id, { name, body, requireReply }) {
    const updated = await updateTemplateApi(id, { name, body, requireReply });
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  /**
   * Switch Aktif/Nonaktif di TABEL -- toggle ringan, baris TETAP tampil
   * di tabel utama, tidak pindah kemana-mana.
   */
  async function deactivateTemplate(id) {
    const updated = await deactivateTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  /** Switch Nonaktif -> Aktif di TABEL. */
  async function activateTemplate(id) {
    const updated = await activateTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  async function softDeleteTemplate(id) {
    const updated = await softDeleteTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  /** Tombol "Gunakan Kembali" di panel Database -- keluarkan lagi dari Database. */
  async function restoreTemplate(id) {
    const updated = await restoreTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  /** Hapus permanen dari database. TIDAK dipakai dari UI manapun saat ini. */
  async function deleteTemplateForever(id) {
    await deleteTemplateApi(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const value = useMemo(
    () => ({
      templates,
      addTemplate,
      editTemplate,
      deactivateTemplate,
      activateTemplate,
      softDeleteTemplate,
      restoreTemplate,
      deleteTemplateForever,
      loading,
      error,
    }),
    [templates, loading, error]
  );

  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
}

export function useTemplates() {
  const context = useContext(TemplatesContext);
  if (!context) {
    throw new Error("useTemplates must be used within a TemplatesProvider");
  }
  return context;
}
