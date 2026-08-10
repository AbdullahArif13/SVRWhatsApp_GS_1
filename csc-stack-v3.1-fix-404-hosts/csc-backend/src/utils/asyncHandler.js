/**
 * Express 4 TIDAK otomatis nangkep error dari `async function` handler --
 * kalau ada Promise yang reject (mis. query MySQL gagal karena DB down)
 * dan tidak di-try/catch manual, errornya jadi "unhandled rejection" dan
 * BIKIN SELURUH PROSES NODE CRASH (bukan cuma request itu yang gagal).
 *
 * Wrapper ini nangkep error apapun dari handler async, lalu lempar ke
 * error-handling middleware di server.js (yang balikin 500 JSON biasa),
 * bukan bikin server mati.
 */
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
