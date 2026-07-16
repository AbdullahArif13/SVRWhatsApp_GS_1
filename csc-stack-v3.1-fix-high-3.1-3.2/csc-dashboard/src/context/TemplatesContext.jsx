import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getTemplates,
  createTemplateApi,
  updateTemplateApi,
  deactivateTemplateApi,
  activateTemplateApi,
  deleteTemplateApi,
} from "../services/api.js";

const TemplatesContext = createContext(null);

/**
 * Holds the list of WhatsApp templates in one place so:
 * - `CreateTemplate.jsx` can add a new template
 * - `Templates.jsx` (the list page) shows it
 * - `Chat.jsx` can offer it in the "Tamplate Name" picker
 * all stay in sync, since templates created on one page must be usable
 * from the Chat page's "Use Template" picker.
 *
 * Template sekarang disimpan di database (MySQL, jalan di Docker) lewat
 * backend, BUKAN cuma di React state lagi -- jadi tidak hilang tiap
 * refresh halaman / restart backend.
 */
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
   * Icon trash di TABEL -- "hapus" ringan / non-aktifkan. Baris tetap ada
   * (bisa di-restore atau dihapus permanen lewat popup detail-nya).
   */
  async function deactivateTemplate(id) {
    const updated = await deactivateTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  /** Tombol "Continuous" di popup detail -- aktifkan lagi. */
  async function activateTemplate(id) {
    const updated = await activateTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  /** Tombol "Delete" DI DALAM popup detail -- hapus permanen dari database. */
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
