import { useMemo, useState } from "react";
import { useTemplates } from "../../context/TemplatesContext.jsx";
import { extractVariableNames } from "../../utils/templateEngine.js";
import { API_BASE_URL } from "../../config.js";
import ActiveToggle from "./ActiveToggle.jsx";

/**
 * Popup detail template.
 *
 * Bisa dipakai untuk EDIT nama/isi template, menampilkan contoh perintah
 * `curl` yang bisa langsung di-copy, dan berisi beberapa aksi:
 *   - Switch Aktif/Nonaktif di header : sama seperti di tabel, langsung
 *                           toggle status begitu diklik.
 *   - "Simpan Perubahan"   : simpan perubahan nama/body/require_reply
 *                           (kalau ada), lalu tutup popup. TIDAK lagi
 *                           otomatis mengaktifkan template -- pakai
 *                           switch di atas untuk itu.
 *   - Icon tong sampah     : HAPUS template ini (SOFT DELETE -- tidak
 *                           ada yang dihapus permanen dari database).
 *                           Setelah ini, template pindah ke panel
 *                           Database dan cuma bisa dilihat/dipulihkan
 *                           lagi dari sana.
 */
export default function TemplateDetailModal({ template, onClose }) {
  const { templates, editTemplate, activateTemplate, deactivateTemplate, softDeleteTemplate } =
    useTemplates();

  // `template` (prop) adalah snapshot pas modal ini dibuka. Ambil versi
  // TERBARU dari context supaya switch Aktif/Nonaktif di header modal ini
  // langsung ke-update begitu diklik (tidak nunggu modal ditutup-buka lagi).
  const liveTemplate = templates.find((t) => t.id === template.id) ?? template;

  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body ?? "");
  const [requireReply, setRequireReply] = useState(Boolean(template.requireReply));
  // v3.7: parameter True/False "Aktifkan Penggunaan Foto" -- lihat
  // CreateTemplate.jsx untuk penjelasan lengkap perilakunya.
  const [usePhoto, setUsePhoto] = useState(Boolean(template.usePhoto));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
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
  // tidak lagi membaca/menyimpan key asli sama sekali.
  const buildCurl = useMemo(() => {
    const exampleValues = {};
    for (const varName of variableNames) {
      exampleValues[varName] =
        varName.toLowerCase() === "nama" ? "<isi_dengan_nama>" : `<isi ${varName}>`;
    }
    // v3.7: kalau "Aktifkan Penggunaan Foto" nyala, values.foto WAJIB diisi
    // saat template ini dipakai -- tambahkan ke contoh curl supaya jelas.
    if (usePhoto) {
      exampleValues.foto = "<url_gambar_jpg_atau_png>";
      exampleValues.keterangan = "<isi keterangan (opsional, jadi caption foto)>";
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
  }, [name, variableNames, template.name, usePhoto]);

  const curlDisplay = useMemo(() => buildCurl("*****************"), [buildCurl]);

  async function handleCopyCurl() {
    const text = buildCurl("$CSC_API_KEY");

    // navigator.clipboard.writeText cuma tersedia di "secure context"
    // (HTTPS, atau localhost) -- kalau dashboard diakses lewat HTTP biasa
    // via IP LAN (bukan localhost/HTTPS), navigator.clipboard bisa
    // undefined sama sekali. Fallback ke cara lama (textarea tersembunyi +
    // document.execCommand) yang TIDAK butuh secure context, biar tetap
    // bisa copy walau di HTTP.
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      } catch {
        // lanjut ke fallback di bawah, jangan langsung nyerah
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("execCommand copy gagal");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Gagal menyalin ke clipboard. Coba select manual teksnya lalu Ctrl+C.");
    }
  }

  // Tombol "Simpan Perubahan": simpan perubahan nama/body/require_reply
  // kalau ada. TIDAK lagi otomatis mengaktifkan template -- status
  // Aktif/Nonaktif sekarang diatur lewat switch di header (lihat
  // handleToggleActive di bawah), independen dari simpan-edit ini.
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (
        name.trim() !== template.name ||
        body !== template.body ||
        requireReply !== Boolean(template.requireReply) ||
        usePhoto !== Boolean(template.usePhoto)
      ) {
        await editTemplate(template.id, { name: name.trim(), body, requireReply, usePhoto });
      }
      onClose();
    } catch (err) {
      setError(err.message || "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  }

  // Switch Aktif/Nonaktif di header modal -- sama seperti di tabel,
  // langsung toggle status begitu diklik, TIDAK menutup modal.
  async function handleToggleActive() {
    setToggling(true);
    setError(null);
    try {
      if (liveTemplate.isActive) {
        await deactivateTemplate(template.id);
      } else {
        await activateTemplate(template.id);
      }
    } catch (err) {
      setError(err.message || "Gagal mengubah status template.");
    } finally {
      setToggling(false);
    }
  }

  // Icon tong sampah -- HAPUS (soft delete). Template TIDAK dihapus dari
  // database, cuma is_deleted jadi true dan berpindah dari tabel utama ke
  // panel Database, dari mana template ini bisa dipulihkan lagi kapan saja.
  async function handleSoftDelete() {
    const confirmed = window.confirm(
      `Hapus template "${template.name}"? Template ini TIDAK akan dihapus permanen dari database -- cuma dipindah ke panel "Database" dan masih bisa dipulihkan lagi kapan saja.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await softDeleteTemplate(template.id);
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
            <p className="text-sm text-gray-400">Dibuat pada : {template.createdAt}</p>
          </div>
          <ActiveToggle isActive={liveTemplate.isActive} onClick={handleToggleActive} disabled={toggling} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Aktifkan Respons Penerima</p>
            <p className="text-xs text-gray-400">
              {requireReply ? (
                <>
                  penerima harus balas dengan ketik <span className="font-bold">Approve</span> atau{" "}
                  <span className="font-bold">Reject</span>.
                </>
              ) : (
                "penerima tidak harus membalas."
              )}
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

        {/* v3.7: toggle "Aktifkan Penggunaan Foto" -- lihat CreateTemplate.jsx
            untuk penjelasan lengkap perilakunya (values.foto/keterangan). */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Aktifkan Penggunaan Foto</p>
            <p className="text-xs text-gray-400">
              {usePhoto ? (
                <>
                  pengirim wajib menyertakan <span className="font-bold">values.foto</span> (URL gambar).
                </>
              ) : (
                "Jika ingin menggunakan foto aktifkan."
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={usePhoto}
            onClick={() => setUsePhoto((prev) => !prev)}
            className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
              usePhoto ? "bg-brand" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                usePhoto ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Isi Pesan</p>
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
                {copied ? "Tersalin!" : "Salin"}
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
            onClick={handleSoftDelete}
            disabled={saving || deleting || toggling}
            title="Hapus (soft delete -- template dipindah ke Database, bukan dihapus permanen)"
            aria-label="Hapus template"
            className="flex h-10 items-center gap-2 rounded-full bg-red-100 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
          >
            <img src="/icon-delete-trash.png" alt="" className="h-4 w-4" />
            {deleting ? "Menghapus..." : "Hapus"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting || toggling}
            className="rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}