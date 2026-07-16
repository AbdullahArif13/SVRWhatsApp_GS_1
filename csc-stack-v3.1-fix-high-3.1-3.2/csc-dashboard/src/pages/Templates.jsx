import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchBox from "../components/SearchBox.jsx";
import { useTemplates } from "../context/TemplatesContext.jsx";
import { extractVariableNames } from "../utils/templateEngine.js";
import { API_BASE_URL } from "../config.js";

const TYPE_OPTIONS = ["All types"];
// Dropdown ini sebelumnya "All categories" tanpa fungsi apa-apa -- sekarang
// dipakai untuk filter berdasarkan status wajib-balas (Approve/Reject) tiap
// template, konsisten dengan kolom "Approve/Reject" di tabel & badge
// RequireReplyBadge di bawah.
const APPROVAL_OPTIONS = ["All Approval", "Wajib Balas", "Tidak Wajib"];
const STATUS_OPTIONS = ["All status", "Active", "NonActive"];

export default function Templates() {
  const navigate = useNavigate();
  const { templates, deactivateTemplate } = useTemplates();
  const [statusFilter, setStatusFilter] = useState("All status");
  const [approvalFilter, setApprovalFilter] = useState("All Approval");
  const [searchQuery, setSearchQuery] = useState("");
  // Template yang sedang dibuka di popup detail (dashboard_popup_tamplate).
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState(null);
  const [rowError, setRowError] = useState(null);

  // Filter status berdasarkan is_active (Active/NonActive), filter Approval
  // berdasarkan requireReply (Wajib Balas/Tidak Wajib), dan search bebas
  // berdasarkan nama atau isi body template -- ketiganya bisa dipakai
  // bersamaan.
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (statusFilter !== "All status") {
        const wantActive = statusFilter === "Active";
        if (template.isActive !== wantActive) return false;
      }
      if (approvalFilter !== "All Approval") {
        const wantRequireReply = approvalFilter === "Wajib Balas";
        if (Boolean(template.requireReply) !== wantRequireReply) return false;
      }
      if (query) {
        const haystack = `${template.name} ${template.body}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [templates, statusFilter, approvalFilter, searchQuery]);

  // Klik icon trash di tabel: HANYA non-aktifkan (soft delete), baris tetap
  // ada. Untuk benar-benar menghapus, user harus masuk ke popup detail
  // (buka lewat icon folder/edit) dan pakai tombol "Delete" di sana.
  async function handleRowDeactivate(template) {
    const confirmed = window.confirm(
      `Non-aktifkan template "${template.name}"? Template ini tidak akan hilang -- masih bisa diaktifkan lagi atau dihapus permanen lewat popup edit.`
    );
    if (!confirmed) return;

    setPendingDeactivateId(template.id);
    setRowError(null);
    try {
      await deactivateTemplate(template.id);
    } catch (err) {
      setRowError(err.message || "Gagal menon-aktifkan template.");
    } finally {
      setPendingDeactivateId(null);
    }
  }

  return (
    <Layout showWatermark={filteredTemplates.length === 0}>
      <PageHeader
        title="Tamplates"
        actionLabel="Create Template"
        onAction={() => navigate("/templates/create")}
      />

      <div className="px-8 pb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">WhatsApp Templates</h2>
          <p className="text-sm text-gray-400">Make Your Template to send any message</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari nama atau isi template..."
          />
          <FilterSelect options={TYPE_OPTIONS} value={TYPE_OPTIONS[0]} onChange={() => {}} />
          <FilterSelect options={APPROVAL_OPTIONS} value={approvalFilter} onChange={setApprovalFilter} />
          <FilterSelect options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {rowError && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{rowError}</p>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="px-5 py-3 font-semibold text-gray-900">Template name</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Status</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Approve/Reject</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Create at</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Edit And Delete</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-gray-400">
                  Belum ada template untuk filter ini.
                </td>
              </tr>
            )}
            {filteredTemplates.map((template) => (
              <tr
                key={template.id}
                className={`border-b border-gray-100 ${template.isActive ? "" : "bg-gray-50 opacity-70"}`}
              >
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
                  <StatusBadge isActive={template.isActive} />
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
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand transition-colors hover:bg-brand-hover"
                    >
                      <img src="/icon-edit-folder.png" alt="" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRowDeactivate(template)}
                      disabled={pendingDeactivateId === template.id}
                      title="Non-aktifkan template"
                      aria-label="Non-aktifkan template"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-400 transition-colors hover:bg-red-500 disabled:opacity-50"
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

      {viewingTemplate && (
        <TemplateDetailModal template={viewingTemplate} onClose={() => setViewingTemplate(null)} />
      )}
    </Layout>
  );
}

function FilterSelect({ options, value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg bg-brand px-5 py-2.5 pr-10 text-sm font-semibold text-white outline-none hover:bg-brand-hover"
      >
        {options.map((option) => (
          <option key={option} value={option} className="text-gray-900">
            {option}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white">▾</span>
    </div>
  );
}

function StatusBadge({ isActive = true }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isActive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
      }`}
    >
      {isActive ? "Active" : "NonActive"}
    </span>
  );
}

function RequireReplyBadge({ requireReply }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        requireReply ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {requireReply ? "Wajib Balas" : "Tidak Wajib"}
    </span>
  );
}

/**
 * Popup detail template -- dashboard_popup_tamplate.
 *
 * v3: sekarang bisa dipakai untuk EDIT nama/isi template (bukan cuma
 * lihat-lihat), menampilkan contoh perintah `curl` yang bisa langsung
 * di-copy, dan berisi dua aksi di bagian bawah:
 *   - "Continuous" : simpan perubahan (kalau ada) & aktifkan lagi template
 *                    ini kalau sebelumnya sempat di-non-aktifkan, lalu
 *                    tutup popup.
 *   - "Delete"     : hapus template ini PERMANEN dari database. Ini satu-
 *                    satunya jalan untuk benar-benar menghapus data --
 *                    tombol trash di tabel cuma non-aktifkan.
 */
function TemplateDetailModal({ template, onClose }) {
  const { editTemplate, activateTemplate, deleteTemplateForever } = useTemplates();

  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body ?? "");
  const [requireReply, setRequireReply] = useState(Boolean(template.requireReply));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const variableNames = useMemo(() => extractVariableNames(body), [body]);

  // Contoh curl dibuat otomatis dari nama template + variabel yang
  // ditemukan di body-nya, sesuai kontrak JSON v3:
  //  - "nama_wa" : field terpisah, nama kontak WA tujuan.
  //  - "values"  : isi tiap {{variabel}}, termasuk {{nama}} kalau dipakai
  //                di body (isinya boleh sama dengan "nama_wa", tapi
  //                fungsinya beda -- "nama_wa" bukan buat isi body).
  //
  // Header X-API-Key WAJIB ada karena endpoint /api/send-message
  // diproteksi (lihat BACKEND_API_KEY di csc-backend). Contoh curl di
  // popup ini SELALU pakai referensi env var "$CSC_API_KEY", baik yang
  // tampil di layar maupun yang di-copy ke clipboard -- komponen ini
  // tidak lagi membaca/menyimpan key asli sama sekali, jadi tidak ada
  // risiko ke-screenshot, nyangkut di clipboard history, atau kelihatan
  // pas screen-share. User tinggal `export CSC_API_KEY=...` sekali di
  // shell-nya sendiri sebelum paste curl-nya.
  //
  // CATATAN KEAMANAN: ini menghindari key nampang di UI/clipboard, tapi
  // BUKAN pengganti pembatasan akses sungguhan -- lihat catatan di
  // README soal rotasi key & pembatasan siapa yang boleh buka dashboard
  // ini dan siapa yang tahu nilai CSC_API_KEY.
  const buildCurl = useMemo(() => {
    const exampleValues = {};
    for (const varName of variableNames) {
      exampleValues[varName] =
        varName.toLowerCase() === "nama" ? "<isi_dengan_nama>" : `<isi ${varName}>`;
    }
    const payload = {
      template_wa: name || template.name,
      no_wa: "<isi_dengan_nomor>",
      nama_wa: "<isi_dengan_nama>",
      values: exampleValues,
    };
    const endpoint = `${API_BASE_URL.replace(/\/+$/, "")}/send-message`;
    const body = JSON.stringify(payload, null, 2);

    return (apiKeyPart) =>
      `curl -X POST ${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${apiKeyPart}" \\\n  -d '${body}'`;
  }, [name, variableNames, template.name]);

  // Versi yang TAMPIL di layar -- key-nya disamarkan jadi titik-titik.
  const curlDisplay = useMemo(() => buildCurl("••••••••••••••••••••••••"), [buildCurl]);

  // Versi yang DI-COPY ke clipboard -- key aslinya TIDAK PERNAH ikut
  // disalin. Yang disalin adalah referensi environment variable
  // "$CSC_API_KEY", jadi curl-nya langsung jalan begitu di-paste ke
  // terminal SELAMA user sudah `export CSC_API_KEY=...` di shell-nya
  // sendiri. Ini mencegah key asli nyangkut di clipboard history,
  // shell history, atau kelihatan pas screen-share -- teks yang
  // disalin sama sekali tidak mengandung key.
  async function handleCopyCurl() {
    try {
      await navigator.clipboard.writeText(buildCurl("$CSC_API_KEY"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Gagal menyalin ke clipboard.");
    }
  }

  // Tombol "Continuous": simpan perubahan nama/body (kalau berubah), dan
  // kalau template ini lagi non-aktif, aktifkan lagi.
  async function handleContinuous() {
    setSaving(true);
    setError(null);
    try {
      if (
        name.trim() !== template.name ||
        body !== template.body ||
        requireReply !== Boolean(template.requireReply)
      ) {
        await editTemplate(template.id, { name: name.trim(), body, requireReply });
      }
      if (!template.isActive) {
        await activateTemplate(template.id);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  }

  // Tombol "Delete" DI DALAM popup -- hapus permanen dari database.
  async function handleHardDelete() {
    const confirmed = window.confirm(
      `Hapus PERMANEN template "${template.name}"? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteTemplateForever(template.id);
      onClose();
    } catch (err) {
      setError(err.message || "Gagal menghapus template.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col gap-4 rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-transparent px-1 text-lg font-semibold text-gray-900 outline-none hover:border-gray-200 focus:border-brand"
            />
            <p className="text-sm text-gray-400">Create at : {template.createdAt}</p>
          </div>
          <StatusBadge isActive={template.isActive} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Wajib Balas Approve / Reject?</p>
            <p className="text-xs text-gray-400">
              {requireReply
                ? "penerima harus balas dengan ketik \"Approve\" atau \"Reject\"."
                : "penerima tidak harus membalas."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={requireReply}
            onClick={() => setRequireReply((prev) => !prev)}
            className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
              requireReply ? "bg-brand" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                requireReply ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Body Message</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="h-64 w-full resize-none overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Curl</p>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="rounded-md bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-200"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="h-64 w-full overflow-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-xs text-gray-700">
              {curlDisplay}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleContinuous}
            disabled={saving || deleting}
            className="rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "◀ Continuous"}
          </button>
          <button
            type="button"
            onClick={handleHardDelete}
            disabled={saving || deleting}
            className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? "Menghapus..." : "🗑 Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
