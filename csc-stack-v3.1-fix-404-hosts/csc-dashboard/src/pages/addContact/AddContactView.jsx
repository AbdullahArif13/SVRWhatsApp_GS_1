import Layout from "../../components/Layout.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import SearchBox from "../../components/SearchBox.jsx";
import Pagination from "../../components/Pagination.jsx";

export default function AddContactView({
  contacts,
  loading,
  showForm,
  setShowForm,
  name,
  setName,
  phone,
  setPhone,
  submitting,
  formError,
  searchQuery,
  setSearchQuery,
  handleSubmit,
  pagedContacts,
  pagination,
}) {
  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="shrink-0">
          <PageHeader
            title="Tambah Kontak"
            actionLabel={!showForm ? "Tambah Nomor" : null}
            onAction={() => setShowForm(true)}
          />
        </div>

        <div className="flex flex-1 gap-10 overflow-hidden px-8 pb-8">
          {showForm && (
            <form onSubmit={handleSubmit} className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Nomor WhatsApp</h2>
                <p className="text-sm text-gray-400">
                  Nomor yang sudah didaftarkan. Kontak juga otomatis kesimpen
                  tiap ada pesan dikirim lewat sistem (no_wa & nama_wa),
                  jadi form ini cuma perlu dipakai kalau mau siapkan kontak
                  duluan sebelum ada pesan terkirim.
                </p>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-base font-medium text-gray-900">Nama</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg bg-gray-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nama kontak"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-base font-medium text-gray-900">Nomor Telepon</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-lg bg-gray-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  placeholder="62..."
                  inputMode="numeric"
                />
              </label>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Menyimpan..." : "Tambah Nomor"}
              </button>
            </form>
          )}

          <ContactsTable
            contacts={pagedContacts}
            totalCount={contacts.length}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            pagination={pagination}
          />
        </div>
      </div>
    </Layout>
  );
}

function ContactsTable({ contacts, totalCount, loading, searchQuery, onSearchChange, pagination }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mb-4 shrink-0">
        <SearchBox
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Cari nama atau nomor kontak..."
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-10 bg-gray-200 text-left">
              <th className="w-12 px-5 py-3 font-semibold text-gray-900">No</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Nama</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Nomor</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Asal</th>
              <th className="px-5 py-3 font-semibold text-gray-900">Dibuat Pada</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-gray-400">
                  Memuat kontak...
                </td>
              </tr>
            )}
            {!loading && totalCount === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-gray-400">
                  Belum ada kontak yang ditambahkan/pesan yang dikirim.
                </td>
              </tr>
            )}
            {!loading && totalCount > 0 && contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-gray-400">
                  Tidak ada kontak yang cocok dengan pencarian ini.
                </td>
              </tr>
            )}
            {!loading &&
              contacts.map((contact, index) => (
                <tr key={contact.id} className="border-b border-gray-100">
                  <td className="px-5 py-3 text-gray-500">{pagination.startIndex + index + 1}</td>
                  <td className="px-5 py-3 text-gray-700">{contact.name}</td>
                  <td className="px-5 py-3 text-gray-500">{contact.phone}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {contact.source === "send_message" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        GOWA
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{contact.createdAt}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && totalCount > 0 && (
        <div className="shrink-0 border-t border-gray-100 pt-4">
          <Pagination
            {...pagination}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            onToggleShowAll={pagination.setShowAll}
          />
        </div>
      )}
    </div>
  );
}
