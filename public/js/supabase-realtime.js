document.addEventListener("DOMContentLoaded", () => {
  // === Konfigurasi Supabase lokal ===
  const SUPABASE_URL = "http://192.168.168.100:8000";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3MzUwODAwLCJleHAiOjE5MTUxMTcyMDB9.vm2ReUSR1JWieI5iQuGyQYVpNjEdzS8eeZ_cBWZbers";

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // === State in-memory ===
  // Key: `${nomor_polisi}|${tanggal}`  -> row object
  const rows = new Map();

  // === Elemen DOM ===
  const tbody = document.querySelector("#data-table tbody");
  const elPKB = document.getElementById("total-pkb");
  const elSWD = document.getElementById("total-swdkllj");
  const elCount = document.getElementById("total-transaksi");
  const elRange = document.getElementById("range");
  const rtStatus = document.getElementById("rt-status");

  // === Helpers tanggal ===
  const fmtNum = (n) => new Intl.NumberFormat("id-ID").format(n || 0);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const yestISO = () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const dayDiff = (a, b) => Math.floor((new Date(a) - new Date(b)) / 86400000);

  function inRange(tanggal) {
    const mode = elRange?.value || "today";
    const today = todayISO();
    if (mode === "today") return tanggal === today;
    if (mode === "yesterday") return tanggal === yestISO();
    if (mode === "last3") return Math.abs(dayDiff(tanggal, today)) <= 2;
    return true;
  }

  // === Renderers ===
  //   function keyOf(r) { return `${r.nomor_polisi || ""}|${r.tanggal || ""}`; }
  function keyOf(r) {
        let tgl = "";
        if (r.tanggal) {
            tgl = String(r.tanggal).split("T")[0]; // ambil yyyy-mm-dd
        } else if (r.paid_on) {
            tgl = String(r.paid_on).split("T")[0];
        }
        return `${(r.nomor_polisi || "").trim()}|${tgl}`;
    }

  function trId(key) { return `row-${btoa(key).replace(/=+/g, "")}`; }

  function renderRow(row) {
    // bikin atau update <tr> spesifik
    const key = keyOf(row);
    const id = trId(key);
    let tr = document.getElementById(id);

    if (!inRange(row.tanggal)) {
      // kalau di luar range, pastikan tidak tampil
      if (tr) tr.remove();
      return;
    }

    const html = `
        <td class="p-2">${row.nomor_polisi || "-"}</td>
        <td class="p-2">${row.nama_wp || "-"}</td>
        <td class="p-2">${row.tanggal || "-"}</td>
        <td class="p-2 text-right">${fmtNum(row.pokok_bbnkb || 0)}</td>
        <td class="p-2 text-right">${fmtNum(row.denda_bbnkb || 0)}</td>

        <td class="p-2 text-right">${fmtNum(row.pj_pkb || 0)}</td>
        <td class="p-2 text-right">${fmtNum(row.dj_pkb || 0)}</td>

        <td class="p-2 text-right">${fmtNum(row.pt_pkb || 0)}</td>
        <td class="p-2 text-right">${fmtNum(row.dt_pkb || 0)}</td>
        <td class="p-2 text-center">
        ${row.is_online ? '<input type="checkbox" checked disabled />' : '<input type="checkbox" disabled />'}
        </td>
    `;

    if (!tr) {
      tr = document.createElement("tr");
      tr.id = id;
      tr.className = "border-b hover:bg-blue-50 transition";
      tr.innerHTML = html;
      // sisipkan di atas (terbaru di atas berdasarkan paid_on)
      tbody.prepend(tr);
    } else {
      tr.innerHTML = html;
    }
  }

  function removeRow(row) {
    const key = keyOf(row);
    const id = trId(key);
    const tr = document.getElementById(id);
    if (tr) tr.remove();
  }

  function refreshSummary() {
  const elPKBBerjalan = document.getElementById("pkb-berjalan");
  const elPKBTunggak = document.getElementById("pkb-tertunggak");
  const elBBN = document.getElementById("total-bbnkb");

  let totalBBN = 0;
  let pkbBrjlnPokok = 0, pkbBrjlnDenda = 0;
  let pkbTunggakPokok = 0, pkbTunggakDenda = 0;

  rows.forEach((r) => {
    if (inRange(r.tanggal)) {
      totalBBN += (r.pokok_bbnkb || 0) + (r.denda_bbnkb || 0);
      pkbBrjlnPokok += r.pj_pkb || 0;
      pkbBrjlnDenda += r.dj_pkb || 0;
      pkbTunggakPokok += r.pt_pkb || 0;
      pkbTunggakDenda += r.dt_pkb || 0;
    }
  });

  if (elBBN) elBBN.textContent = fmtNum(totalBBN);
  if (elPKBBerjalan) elPKBBerjalan.textContent = fmtNum(pkbBrjlnPokok + pkbBrjlnDenda);
  if (elPKBTunggak) elPKBTunggak.textContent = fmtNum(pkbTunggakPokok + pkbTunggakDenda);
}


  function renderAll() {
    tbody.innerHTML = "";
    // urutkan terbaru berdasarkan paid_on kalau ada
    const list = Array.from(rows.values())
      .filter((r) => inRange(r.tanggal))
      .sort((a, b) => {
        const da = a.paid_on ? new Date(a.paid_on) : new Date(a.tanggal);
        const db = b.paid_on ? new Date(b.paid_on) : new Date(b.tanggal);
        return db - da;
      });
    list.forEach(renderRow);
    refreshSummary();
  }

  // === Load awal ===
  async function initialLoad() {
    const mode = elRange?.value || "today";
    const today = todayISO();
    let fromDate = today;
    if (mode === "yesterday") fromDate = yestISO();
    if (mode === "last3") {
      const d = new Date(); d.setDate(d.getDate() - 2);
      fromDate = d.toISOString().slice(0, 10);
    }

    const { data, error } = await sb
      .from("esamsat_tx_harian")
      .select("*")
      .gte("tanggal", fromDate)   // ambil sesuai rentang
      .lte("tanggal", today)      // sampai hari ini
      .order("paid_on", { ascending: false });

    if (error) {
      showStatus("Gagal memuat data awal: " + error.message, "error");
      console.error(error);
      return;
    }

    rows.clear();
    (data || []).forEach((r) => rows.set(keyOf(r), r));
    renderAll();
  }

  // === Apply delta event ===
  function applyDelta(payload) {
    // payload.new / payload.old
    const type = payload.eventType;
    if (type === "INSERT" || type === "UPDATE") {
        const r = payload.new || payload.record || {};
        rows.set(keyOf(r), r);
        renderRow(r);
        refreshSummary();
    } else if (type === "DELETE") {
        const r = payload.old || payload.record || {};
        rows.delete(keyOf(r));
        removeRow(r);
        refreshSummary();
    }
  }

  // === Realtime subscribe ===
  let channel;
  async function subscribeRealtime() {
    if (channel) {
      try { await channel.unsubscribe(); } catch {}
    }
    channel = sb
      .channel("realtime:esamsat_tx_harian")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "esamsat_tx_harian" },
        applyDelta
      );

    const status = await channel.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        showStatus("Realtime terhubung", "ok");
      } else if (s === "CLOSED" || s === "CHANNEL_ERROR") {
        showStatus("Realtime terputus, mencoba ulang…", "warn");
      }
    });

    if (status !== "SUBSCRIBED") {
      showStatus("Realtime gagal tersubscribe, retry sebentar lagi…", "warn");
      // backoff ringan
      setTimeout(subscribeRealtime, 1500);
    }
  }

  // === Status UI ===
  function showStatus(msg, mode = "ok") {
    if (!rtStatus) return;
    rtStatus.classList.remove("hidden");
    rtStatus.textContent = msg;
    rtStatus.className = "px-4 py-2 rounded text-sm";
    if (mode === "ok") rtStatus.classList.add("bg-green-50", "text-green-700", "border", "border-green-200");
    if (mode === "warn") rtStatus.classList.add("bg-yellow-50", "text-yellow-700", "border", "border-yellow-200");
    if (mode === "error") rtStatus.classList.add("bg-red-50", "text-red-700", "border", "border-red-200");
    // auto-hide setelah 3 detik untuk mode ok
    if (mode === "ok") setTimeout(() => rtStatus.classList.add("hidden"), 3000);
  }

  // === Event filter rentang ===
  elRange?.addEventListener("change", async () => {
    await initialLoad();
  });

  // === Network awareness ===
  window.addEventListener("online", () => { showStatus("Koneksi online", "ok"); subscribeRealtime(); });
  window.addEventListener("offline", () => { showStatus("Koneksi offline", "warn"); });

  // === Boot ===
  (async () => {
    await initialLoad();
    await subscribeRealtime();
  })();
});
