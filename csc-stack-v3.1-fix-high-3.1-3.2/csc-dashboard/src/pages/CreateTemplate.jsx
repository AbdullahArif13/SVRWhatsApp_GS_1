import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useTemplates } from "../context/TemplatesContext.jsx";
import { extractVariableNames, buildFinalMessage, REQUIRE_REPLY_INSTRUCTION } from "../utils/templateEngine.js";

export default function CreateTemplate() {
  const navigate = useNavigate();
  const { addTemplate } = useTemplates();
  const [templateName, setTemplateName] = useState("");
  const [bodyMessage, setBodyMessage] = useState("");
  // v3.2: parameter True/False fitur Approve/Reject.
  //   true  -> penerima WAJIB membalas pesan ini dengan ketik "Approve"/"Reject".
  //   false -> penerima tidak wajib membalas apa-apa (default).
  const [requireReply, setRequireReply] = useState(false);
  // Keyed by the variable's own name, e.g. { barang: "...", nama: "..." } --
  // NOT converted into positional {{1}}, {{2}}, {{3}} placeholders.
  const [variableValues, setVariableValues] = useState({});

  const createdAt = useMemo(
    () =>
      new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  // Every unique {{variabel}} found in the body message, in the order they
  // first appear. Adding a new {{xxx}} in the text automatically adds a new
  // input field below; removing it removes the field again.
  const variableNames = useMemo(() => extractVariableNames(bodyMessage), [bodyMessage]);

  // Keep the values object in sync with whatever variables currently exist
  // in the body message: preserve values the user already typed, drop
  // variables that were removed from the text, add new ones as empty.
  useEffect(() => {
    setVariableValues((prev) => {
      const next = {};
      for (const name of variableNames) {
        next[name] = prev[name] ?? "";
      }
      return next;
    });
  }, [variableNames]);

  // Preview ini sekarang otomatis ikut menampilkan kalimat instruksi
  // Approve/Reject begitu toggle di bawah dinyalakan -- user tidak perlu
  // mengetik kalimat itu sendiri di Body Message.
  const preview = useMemo(
    () => buildFinalMessage(bodyMessage, variableValues, requireReply),
    [bodyMessage, variableValues, requireReply]
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function handleCreate() {
    if (!templateName.trim() || !bodyMessage.trim()) return;

    setSaving(true);
    setSaveError(null);
    try {
      // Saved into the shared TemplatesContext (yang manggil backend ->
      // database MySQL di Docker), jadi begitu berhasil, template langsung
      // muncul di Templates list page DAN di Chat page's "Use Template" picker.
      await addTemplate({ name: templateName.trim(), body: bodyMessage, requireReply });
      navigate("/templates");
    } catch (err) {
      setSaveError(err.message || "Gagal menyimpan template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout showWatermark={false}>
      <PageHeader
        title="Create Tamplates"
        actionLabel={saving ? "Menyimpan..." : "Create Template"}
        onAction={saving ? () => {} : handleCreate}
      />

      {saveError && (
        <p className="mx-8 mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{saveError}</p>
      )}

      <div className="flex gap-8 px-8 pb-8">
        {/* Left: template editor */}
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-2xl font-semibold text-gray-900">Tamplates Information</h2>

          <label className="flex items-center gap-2 text-base text-gray-900">
            <span className="font-medium">Tamplate Name :</span>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Create Name Template"
              className="flex-1 border-b border-gray-300 bg-transparent px-1 py-1 text-gray-500 outline-none placeholder:text-gray-400 focus:border-brand"
            />
          </label>

          <span className="text-base font-medium text-gray-900">Body Message</span>
          <textarea
            value={bodyMessage}
            onChange={(e) => setBodyMessage(e.target.value)}
            placeholder={"Ketik disini dengan format Value\n{{contoh}}"}
            className="h-96 w-full resize-none rounded-lg border border-gray-200 p-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand"
          />

          {/* v3.2: parameter True/False fitur Approve/Reject. */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-base font-medium text-gray-900">Wajib Balas Approve / Reject?</p>
              <p className="text-sm text-gray-400">
                {requireReply
                  ? "penerima harus balas pesan ini dengan ketik \"Approve\" atau \"Reject\"."
                  : "penerima tidak harus membalas pesan ini."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requireReply}
              onClick={() => setRequireReply((prev) => !prev)}
              className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${
                requireReply ? "bg-brand" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  requireReply ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {requireReply && (
            <p className="-mt-2 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Kalimat <span className="font-semibold">"{REQUIRE_REPLY_INSTRUCTION}"</span> akan otomatis
              ditambahkan di akhir pesan saat dikirim -- tidak perlu diketik manual di Body Message.
            </p>
          )}
        </div>

        {/* Right: dynamic input data + preview */}
        <div className="flex w-96 shrink-0 flex-col gap-4 rounded-lg bg-gray-100 p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-gray-900">Input Data</h3>
            <span className="text-sm text-gray-400">Tambah sesuai {"{{?}}"}</span>
          </div>

          {variableNames.length === 0 ? (
            <p className="text-sm text-gray-400">
              Ketik variabel seperti <span className="font-mono">{"{{barang}}"}</span> di Body Message untuk
              menambahkan form input di sini.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {variableNames.map((name) => (
                <div key={name}>
                  <p className="mb-2 text-lg font-bold capitalize text-gray-900">{name}</p>
                  <input
                    value={variableValues[name] ?? ""}
                    onChange={(e) =>
                      setVariableValues((prev) => ({ ...prev, [name]: e.target.value }))
                    }
                    placeholder={`Isi nilai untuk {{${name}}}`}
                    className="w-full rounded-md bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-base font-semibold text-gray-900">Create at : {createdAt}</p>

          <div>
            <p className="mb-2 text-lg font-bold text-gray-900">Preview</p>
            <div className="h-72 w-full overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-4 text-sm text-gray-700">
              {preview || <span className="text-gray-400">Preview pesan akan muncul di sini.</span>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}