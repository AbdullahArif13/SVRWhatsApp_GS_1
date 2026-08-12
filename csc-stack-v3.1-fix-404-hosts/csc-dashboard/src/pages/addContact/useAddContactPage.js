import { useEffect, useMemo, useState } from "react";
import { useContacts } from "../../context/ContactsContext.jsx";
import { usePagination } from "../../hooks/usePagination.js";

export function useAddContactPage() {
  const { contacts, addContact, loading } = useContacts();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      `${contact.name} ${contact.phone}`.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const pagination = usePagination(filteredContacts.length);
  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery, pagination]);

  const pagedContacts = filteredContacts.slice(pagination.startIndex, pagination.endIndexExclusive);

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
      setFormError(err.message || "Gagal menyimpan kontak.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
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
    filteredContacts,
    pagedContacts,
    pagination,
  };
}
