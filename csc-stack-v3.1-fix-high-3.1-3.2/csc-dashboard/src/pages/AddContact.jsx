import { useMemo, useState } from "react";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchBox from "../components/SearchBox.jsx";
import { useContacts } from "../context/ContactsContext.jsx";

export default function AddContact() {
  const { contacts, addContact, loading } = useContacts();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Search bebas berdasarkan nama atau nomor kontak.
  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      `${contact.name} ${contact.phone}`.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await addContact({ name: name.trim(), phone: phone.trim() });
      setName("");
      setPhone("");
      setShowForm(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Tambah Kontak"
        actionLabel={!showForm ? "Tambah Nomor" : null}
        onAction={() => setShowForm(true)}
      />

      <div className="flex gap-10 px-8 pb-8">
        {showForm && (
          <form onSubmit={handleSubmit} className="flex w-80 shrink-0 flex-col gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Nomor WhatsApp</h2>
              <p className="text-sm text-gray-400">
                Nomor yang sudah didaftarkan. Kontak juga otomatis kesimpen
                tiap ada pesan dikirim lewat sistem (no_wa &amp; nama_wa),
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
          contacts={filteredContacts}
          totalCount={contacts.length}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </Layout>
  );
}

function ContactsTable({ contacts, totalCount, loading, searchQuery, onSearchChange }) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="mb-4">
        <SearchBox
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Cari nama atau nomor kontak..."
        />
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="px-5 py-3 font-semibold text-gray-900">Nama</th>
            <th className="px-5 py-3 font-semibold text-gray-900">Nomor</th>
            <th className="px-5 py-3 font-semibold text-gray-900">Asal</th>
            <th className="px-5 py-3 font-semibold text-gray-900">Dibuat Pada</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className="px-5 py-6 text-center text-gray-400">
                Memuat kontak...
              </td>
            </tr>
          )}
          {!loading && totalCount === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-6 text-center text-gray-400">
                Belum ada kontak yang ditambahkan/pesan yang dikirim.
              </td>
            </tr>
          )}
          {!loading && totalCount > 0 && contacts.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-6 text-center text-gray-400">
                Tidak ada kontak yang cocok dengan pencarian ini.
              </td>
            </tr>
          )}
          {!loading &&
            contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-gray-100">
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
  );
}
