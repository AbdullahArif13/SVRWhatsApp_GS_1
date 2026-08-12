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

  async function addTemplate({ name, body, requireReply, usePhoto }) {
    const newTemplate = await createTemplateApi({ name, body, requireReply, usePhoto });
    setTemplates((prev) => [newTemplate, ...prev]);
    return newTemplate;
  }

  
  async function editTemplate(id, { name, body, requireReply, usePhoto }) {
    const updated = await updateTemplateApi(id, { name, body, requireReply, usePhoto });
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  
  async function deactivateTemplate(id) {
    const updated = await deactivateTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  
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

  
  async function restoreTemplate(id) {
    const updated = await restoreTemplateApi(id);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    return updated;
  }

  
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
