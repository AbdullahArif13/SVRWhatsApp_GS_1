import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getContacts, createContactApi } from "../services/api.js";

const ContactsContext = createContext(null);

export function ContactsProvider({ children }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getContacts()
      .then((data) => {
        if (!cancelled) setContacts(data);
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

  /**
   * Add Contact SECARA MANUAL. Kalau nomornya sudah pernah tersimpan
   * (baik dari sini maupun otomatis dari send-message), backend menolak
   * dengan pesan yang jelas -- dilempar ke pemanggil (AddContact.jsx)
   * supaya bisa ditampilkan ke user, bukan diam-diam gagal.
   */
  async function addContact({ name, phone }) {
    const newContact = await createContactApi({ name, phone });
    setContacts((prev) => [newContact, ...prev]);
    return newContact;
  }

  function getContactById(id) {
    return contacts.find((contact) => contact.id === id) ?? null;
  }

  /** Dipanggil Chat.jsx / halaman lain kalau perlu data kontak paling baru
   * (mis. abis kirim WA baru lewat backend, biar kontak yang baru otomatis
   * kesimpen ikut muncul tanpa refresh manual halaman). */
  async function refreshContacts() {
    const data = await getContacts();
    setContacts(data);
    return data;
  }

  const value = useMemo(
    () => ({ contacts, addContact, getContactById, refreshContacts, loading, error }),
    [contacts, loading, error]
  );

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error("useContacts must be used within a ContactsProvider");
  }
  return context;
}
