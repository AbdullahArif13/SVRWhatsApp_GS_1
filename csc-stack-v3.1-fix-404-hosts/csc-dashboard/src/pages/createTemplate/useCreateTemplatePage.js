import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplates } from "../../context/TemplatesContext.jsx";
import { extractVariableNames, buildFinalMessage } from "../../utils/templateEngine.js";
import { formatTimestamp } from "../../utils/formatDate.js";

export function useCreateTemplatePage() {
  const navigate = useNavigate();
  const { addTemplate } = useTemplates();

  const [templateName, setTemplateName] = useState("");
  const [bodyMessage, setBodyMessage] = useState("");
  const [requireReply, setRequireReply] = useState(false);
  const [usePhoto, setUsePhoto] = useState(false);
  const [photoPreviewFile, setPhotoPreviewFile] = useState(null);
  const [variableValues, setVariableValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const photoPreviewUrl = useMemo(
    () => (photoPreviewFile ? URL.createObjectURL(photoPreviewFile) : null),
    [photoPreviewFile]
  );

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!usePhoto) setPhotoPreviewFile(null);
  }, [usePhoto]);

  const createdAt = useMemo(() => formatTimestamp(new Date()), []);

  const variableNames = useMemo(() => extractVariableNames(bodyMessage), [bodyMessage]);

  useEffect(() => {
    setVariableValues((prev) => {
      const next = {};
      for (const name of variableNames) {
        next[name] = prev[name] ?? "";
      }
      return next;
    });
  }, [variableNames]);

  const preview = useMemo(
    () => buildFinalMessage(bodyMessage, variableValues, requireReply),
    [bodyMessage, variableValues, requireReply]
  );

  function handlePhotoFileChange(file) {
    setPhotoPreviewFile(file ?? null);
  }

  async function handleCreate() {
    if (!templateName.trim() || !bodyMessage.trim()) return;

    setSaving(true);
    setSaveError(null);
    try {
      await addTemplate({
        name: templateName.trim(),
        body: bodyMessage,
        requireReply,
        usePhoto,
      });
      navigate("/templates");
    } catch (err) {
      setSaveError(err.message || "Gagal menyimpan template.");
    } finally {
      setSaving(false);
    }
  }

  function setVariableValue(name, value) {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  }

  return {
    templateName,
    setTemplateName,
    bodyMessage,
    setBodyMessage,
    requireReply,
    setRequireReply,
    usePhoto,
    setUsePhoto,
    photoPreviewFile,
    photoPreviewUrl,
    variableNames,
    variableValues,
    setVariableValue,
    preview,
    saving,
    saveError,
    createdAt,
    handleCreate,
    handlePhotoFileChange,
  };
}
