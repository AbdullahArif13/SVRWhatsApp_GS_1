// Centralized mock/sample data.
// Replace these with real API calls once the backend is ready.

export const contacts = [
  { id: 1, name: "Abdullah", phone: "081298689701", createdAt: "9 Apr 2026 at 14.34" },
];

export const templates = [
  {
    id: 1,
    name: "Shortage_epicking",
    status: "Approve",
    createdAt: "9 Apr 2026 at 14.34",
    body: "Halo Bapak/Ibu {{nama}},\n\nKami informasikan terdapat Request Part pada Web E-Picking SPCT dengan rincian berikut:\n\nNomor Request : {{nomor_request}}\nRequester : {{requester}}\n\nDetail Item Request:\n{{detail_item}}\n\nSilakan melakukan pengecekan atas request tersebut sesuai kebutuhan.\n\nTerima kasih atas perhatian Anda.",
  },
  {
    id: 2,
    name: "Reminder_Swicth_Alert",
    status: "Reject",
    createdAt: "14 Feb 2026 at 13.30",
    body: "Halo {{nama}}, ini pengingat bahwa switch di lokasi {{lokasi}} memerlukan pengecekan segera.",
  },
  {
    id: 3,
    name: "Reminder_Swicth_Alert",
    status: "Approve",
    createdAt: "13 Mar 2026 at 15.30",
    body: "Selamat pagi {{nama}}, mohon konfirmasi status switch {{lokasi}} sebelum pukul {{jam}}.",
  },
];
