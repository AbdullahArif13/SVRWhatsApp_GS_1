import { useEffect, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Hook pagination generik dipakai di semua tabel (Riwayat Pengiriman,
 * Template, Kontak). Dua mode sesuai permintaan:
 *   1. Custom page size -- user isi sendiri berapa baris per halaman
 *      lewat input angka (lihat komponen Pagination.jsx).
 *   2. "Tampilkan Semua" -- pagination dimatikan, semua baris data
 *      ditampilkan sekaligus tanpa navigasi halaman.
 *
 * Dipisah dari komponen UI-nya (Pagination.jsx) supaya logic index
 * slice-nya gampang dipakai ulang meskipun tampilan tabelnya beda-beda
 * per halaman.
 */
export function usePagination(totalItems, { defaultPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [showAll, setShowAllState] = useState(false);

  const effectivePageSize = showAll ? Math.max(totalItems, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  // Kalau data berubah (mis. hasil search/filter jadi lebih sedikit) dan
  // halaman yang lagi dibuka jadi kelebihan, otomatis mundur ke halaman
  // terakhir yang masih valid -- daripada nampilin tabel kosong.
  useEffect(() => {
    setPageState((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const startIndex = showAll ? 0 : (page - 1) * pageSize;
  const endIndexExclusive = showAll ? totalItems : Math.min(startIndex + pageSize, totalItems);

  function setPage(next) {
    setPageState(Math.min(Math.max(1, next), totalPages));
  }

  // Dipanggil dari input "Data per halaman" (mode 1). Selalu balik ke
  // halaman 1 supaya user tidak nyasar di halaman yang jadi tidak ada
  // isinya sesudah ukuran halaman berubah.
  function setPageSize(value) {
    const clean = Math.max(1, Math.floor(Number(value) || 1));
    setPageSizeState(clean);
    setPageState(1);
  }

  // Toggle mode 2 ("Tampilkan Semua").
  function setShowAll(next) {
    setShowAllState(next);
    setPageState(1);
  }

  // Dipanggil manual dari halaman pemanggil tiap kali search/filter
  // berubah, supaya user selalu mulai lagi dari halaman 1 tiap kali
  // hasil pencariannya berubah (bukan kejebak di halaman lama).
  function resetPage() {
    setPageState(1);
  }

  return {
    page,
    pageSize,
    showAll,
    totalPages,
    totalItems,
    startIndex,
    endIndexExclusive,
    setPage,
    setPageSize,
    setShowAll,
    resetPage,
  };
}
