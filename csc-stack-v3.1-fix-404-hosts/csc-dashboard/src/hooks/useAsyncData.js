import { useCallback, useState } from "react";

export function useAsyncData(initialValue = null) {
  const [data, setData] = useState(initialValue);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const load = useCallback(async (loader) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await loader();
      setData(result);
      setStatus("ready");
      return result;
    } catch (err) {
      setError(err?.message || "Terjadi kesalahan saat memuat data.");
      setStatus("error");
      throw err;
    }
  }, []);

  return { data, status, error, setData, setStatus, setError, load };
}
