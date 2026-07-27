import { useEffect, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function usePagination(totalItems, { defaultPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [showAll, setShowAllState] = useState(false);

  const effectivePageSize = showAll ? Math.max(totalItems, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  useEffect(() => {
    setPageState((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const startIndex = showAll ? 0 : (page - 1) * pageSize;
  const endIndexExclusive = showAll ? totalItems : Math.min(startIndex + pageSize, totalItems);

  function setPage(next) {
    setPageState(Math.min(Math.max(1, next), totalPages));
  }

  function setPageSize(value) {
    const clean = Math.max(1, Math.floor(Number(value) || 1));
    setPageSizeState(clean);
    setPageState(1);
  }

  function setShowAll(next) {
    setShowAllState(next);
    setPageState(1);
  }

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
