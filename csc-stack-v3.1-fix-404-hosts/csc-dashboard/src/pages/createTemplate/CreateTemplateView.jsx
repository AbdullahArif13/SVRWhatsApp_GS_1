import Layout from "../../components/Layout.jsx";
import PageHeader from "../../components/PageHeader.jsx";

export default function CreateTemplateView({
  templateName,
  setTemplateName,
  bodyMessage,
  setBodyMessage,
  requireReply,
  setRequireReply,
  usePhoto,
  setUsePhoto,
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
}) {
  return (
    <Layout>
      <PageHeader
        title="Buat Template"
        actionLabel={saving ? "Menyimpan..." : "Buat Template"}
        onAction={saving ? () => {} : handleCreate}
      />

      {saveError && (
        <p className="mx-8 mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{saveError}</p>
      )}

      <div className="flex gap-8 px-8 pb-8">
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-2xl font-semibold text-gray-900">Informasi Template</h2>

          <label className="flex items-center gap-2 text-base text-gray-900">
            <span className="font-medium">Nama Template :</span>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Buat Nama Template"
              className="flex-1 border-b border-gray-300 bg-transparent px-1 py-1 text-gray-500 outline-none placeholder:text-gray-400 focus:border-brand"
            />
          </label>

          <span className="text-base font-medium text-gray-900">Isi Pesan</span>
          <textarea
            value={bodyMessage}
            onChange={(e) => setBodyMessage(e.target.value)}
            placeholder={"Ketik disini dengan format Value\n{{contoh}}"}
            className="h-96 w-full resize-none rounded-lg border border-gray-200 p-4 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand"
          />

          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-base font-medium text-gray-900">Aktifkan Respons Penerima</p>
              <p className="text-sm text-gray-400">
                {requireReply ? (
                  <>
                    penerima harus balas pesan ini dengan ketik <span className="font-bold">Approve</span> atau <span className="font-bold">Reject</span>.
                  </>
                ) : (
                  "penerima tidak harus membalas pesan ini."
                )}
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
              Kalimat <span className="font-semibold">"Approve atau Reject"</span> akan otomatis ditambahkan di akhir pesan saat dikirim.
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-base font-medium text-gray-900">Aktifkan Penggunaan Foto</p>
              <p className="text-sm text-gray-400">
                {usePhoto ? (
                  <>
                    pengirim wajib menyertakan <span className="font-bold">values.foto</span> (URL gambar) -- foto akan dikirim sebagai pesan terpisah setelah teks ini.
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
              className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${
                usePhoto ? "bg-brand" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  usePhoto ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {usePhoto && (
            <div className="-mt-2 flex flex-col gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <p>
                Sistem pemanggil (mis. CCTV AI) wajib mengisi <span className="font-semibold">values.foto</span> dengan URL gambar (JPG/PNG) saat memakai template ini, boleh ditambah <span className="font-semibold">values.keterangan</span> sebagai caption foto.
              </p>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-amber-800">
                  Contoh foto (JPG/PNG) -- hanya untuk pratinjau di bawah, tidak diupload/disimpan
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => handlePhotoFileChange(e.target.files?.[0] ?? null)}
                  className="text-xs text-amber-700 file:mr-3 file:rounded-md file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-700 hover:file:bg-amber-200"
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex w-96 shrink-0 flex-col gap-4 rounded-lg bg-gray-100 p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-gray-900">Data Input</h3>
            <span className="text-sm text-gray-400">Tambah sesuai {'{{?}}'}</span>
          </div>

          {variableNames.length === 0 ? (
            <p className="text-sm text-gray-400">
              Ketik variabel seperti <span className="font-mono">{{barang}}</span> di Isi Pesan untuk menambahkan form input di sini.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {variableNames.map((name) => (
                <div key={name}>
                  <p className="mb-2 text-lg font-bold capitalize text-gray-900">{name}</p>
                  <input
                    value={variableValues[name] ?? ""}
                    onChange={(e) => setVariableValue(name, e.target.value)}
                    placeholder={`Isi nilai untuk {{${name}}}`}
                    className="w-full rounded-md bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-base font-semibold text-gray-900">Dibuat pada : {createdAt}</p>

          <div>
            <p className="mb-2 text-lg font-bold text-gray-900">Pratinjau</p>
            <div className="h-72 w-full overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-4 text-sm text-gray-700">
              {preview || <span className="text-gray-400">Pratinjau pesan akan muncul di sini.</span>}
              {usePhoto && photoPreviewUrl && (
                <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3">
                  <img
                    src={photoPreviewUrl}
                    alt="Contoh pratinjau foto"
                    className="max-h-48 w-full rounded-md object-cover"
                  />
                  <span className="text-xs text-gray-400">
                    Pesan foto terpisah -- caption dari values.keterangan (kalau diisi pengirim).
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
