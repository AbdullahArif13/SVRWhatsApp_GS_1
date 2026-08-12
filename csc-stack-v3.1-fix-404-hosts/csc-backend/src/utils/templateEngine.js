export function extractVariableNames(text) {
  const seen = new Set();
  const names = [];
  for (const match of String(text ?? "").matchAll(/{{\s*([\w]+)\s*}}/g)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function fillTemplate(text, values = {}) {
  const lowerCaseValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );

  return String(text ?? "").replace(/{{\s*([\w]+)\s*}}/g, (match, key) => {
    const value = lowerCaseValues[key.toLowerCase()];
    return value !== undefined && value !== null && value !== "" ? String(value) : match;
  });
}

export const REQUIRE_REPLY_INSTRUCTION =
  'Silahkan balas pesan ini dengan mereply kemudian ketik:\n' +
  '"y" untuk *Approve*\n'+
  '"n" untuk *Reject*\n'+
  'Untuk Reject mohon disertakan dengan alasannya sebagai contoh berikut:\n'+
  'n, berikan alasan anda....!!!';

export function buildFinalMessage(body, values = {}, requireReply = false) {
  const filled = fillTemplate(body, values);
  if (!requireReply) return filled;
  return `${filled}\n\n${REQUIRE_REPLY_INSTRUCTION}`;
}

export function findMissingVariables(templateBody, values = {}) {
  const required = extractVariableNames(templateBody);
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );

  return required.filter((name) => {
    const value = normalized[name.toLowerCase()];
    return value === undefined || value === null || value === "";
  });
}