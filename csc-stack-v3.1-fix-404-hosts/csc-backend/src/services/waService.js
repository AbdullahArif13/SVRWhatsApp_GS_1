import axios from "axios";
export function normalizePhoneDigits(noWa) {
  const raw = String(noWa ?? "").trim();
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;

  let digits = beforeAt.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }

  return digits;
}

function toWhatsAppJid(noWa) {
  const raw = String(noWa ?? "").trim();

  if (raw.includes("@")) {
    return raw; 
  }

  return `${normalizePhoneDigits(raw)}@s.whatsapp.net`;
}

export async function sendWhatsAppMessage(noWa, message) {
  const baseUrl = process.env.GOWA_BASE_URL;
  const username = process.env.GOWA_BASIC_AUTH_USER;
  const password = process.env.GOWA_BASIC_AUTH_PASS;
  const deviceId = process.env.GOWA_DEVICE_ID;

  if (!baseUrl) {
    
    
    console.log("[waService] Simulasi kirim WA (GOWA_BASE_URL belum diisi):");
    console.log({ to: noWa, message });
    return { simulated: true, to: noWa, message };
  }

  const phone = toWhatsAppJid(noWa);

  const headers = { "Content-Type": "application/json" };
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  const axiosConfig = { headers };
  if (username && password) {
    axiosConfig.auth = { username, password };
  }

  const response = await axios.post(
    `${baseUrl.replace(/\/+$/, "")}/send/message`,
    { phone, message },
    axiosConfig
  );

  return response.data;
}

export async function sendWhatsAppImage(noWa, imageUrl, caption = "") {
  const baseUrl = process.env.GOWA_BASE_URL;
  const username = process.env.GOWA_BASIC_AUTH_USER;
  const password = process.env.GOWA_BASIC_AUTH_PASS;
  const deviceId = process.env.GOWA_DEVICE_ID;

  if (!baseUrl) {
    
    
    
    console.log("[waService] Simulasi kirim FOTO WA (GOWA_BASE_URL belum diisi):");
    console.log({ to: noWa, imageUrl, caption });
    return { simulated: true, to: noWa, imageUrl, caption };
  }

  const phone = toWhatsAppJid(noWa);

  const headers = { "Content-Type": "application/json" };
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  const axiosConfig = { headers };
  if (username && password) {
    axiosConfig.auth = { username, password };
  }

  const response = await axios.post(
    `${baseUrl.replace(/\/+$/, "")}/send/image`,
    { phone, image_url: imageUrl, caption },
    axiosConfig
  );

  return response.data;
}

export function extractProviderMessageId(providerResult) {
  return providerResult?.results?.message_id ?? null;
}
