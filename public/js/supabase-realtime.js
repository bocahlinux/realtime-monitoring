// === File: public/js/supabase-realtime.js (versi aman untuk publik) ===

document.addEventListener("DOMContentLoaded", async () => {
  // Ambil konfigurasi dari server tanpa membocorkan key di frontend
  const config = await fetch("/config/supabase.json").then((r) => r.json());
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Konfigurasi Supabase tidak ditemukan!");
    return;
  }

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const tbody = document.querySelector("#data-table tbody");
  const elPBBN = document.getElementById("pokok-bbnkb");
  const elDBBN = document.getElementById("denda-bbnkb");
  const elPKBBerjalan = document.getElementById("pokok-pkb-berjalan");
  const elDendaPKBBerjalan = document.getElementById("denda-pkb-berjalan");
  const elPKBTunggak = document.getElementById("pokok-pkb-tertunggak");
  const elDendaPKBTunggak = document.getElementById("denda-pkb-tertunggak");
  const elUnitBBN = document.getElementById("unit-bbnkb");
  const elUnitPKB = document.getElementById("unit-pkb");
  const elRange = document.getElementById("range");
  const rtStatus = document.getElementById("rt-status");

  const fmtNum = (n) => new Intl.NumberFormat("id-ID").format(n || 0);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const yestISO = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
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
  

  function keyOf(r) {
    let tgl = "";
    if (r.tanggal) tgl = String(r.tanggal).split("T")[0];
    else if (r.paid_on) tgl = String(r.paid_on).split("T")[0];
    return `${(r.nomor_polisi || "").trim()}|${tgl}`;
  }

  function trId(key) {
    return `row-${btoa(key).replace(/=+/g, "")}`;
  }

  const rows = new Map();

  function renderRow(row) {
    const key = keyOf(row);
    const id = trId(key);
    let tr = document.getElementById(id);

    if (!inRange(row.tanggal)) {
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
      <td class="p-2 text-center">${row.is_online ? "✅" : "❌"}</td>`;

    if (!tr) {
      tr = document.createElement("tr");
      tr.id = id;
      tr.className = "border-b hover:bg-blue-50 transition";
      tr.innerHTML = html;
      tbody.prepend(tr);
    } else {
      tr.innerHTML = html;
    }
  }

  function removeRow(row) {
    const key = keyOf(row);
    const tr = document.getElementById(trId(key));
    if (tr) tr.remove();
  }

  function refreshSummary() {
    let pokokBBN = 0,
      dendaBBN = 0,
      unitBBN = 0,
      pkbBrjlnPokok = 0,
      pkbBrjlnDenda = 0,
      pkbTunggakPokok = 0,
      pkbTunggakDenda = 0,
      unitPKB = 0;

    rows.forEach((r) => {
      if (inRange(r.tanggal)) {
        const bbnPokok = r.pokok_bbnkb || 0;
        const bbnDenda = r.denda_bbnkb || 0;
        pokokBBN += bbnPokok;
        dendaBBN += bbnDenda;
        if (bbnPokok > 0) unitBBN++;

        const pkbBrjPokok = r.pj_pkb || 0;
        const pkbBrjDenda = r.dj_pkb || 0;
        const pkbTunggakPokokVal = r.pt_pkb || 0;
        const pkbTunggakDendaVal = r.dt_pkb || 0;

        pkbBrjlnPokok += pkbBrjPokok;
        pkbBrjlnDenda += pkbBrjDenda;
        pkbTunggakPokok += pkbTunggakPokokVal;
        pkbTunggakDenda += pkbTunggakDendaVal;
        if (pkbBrjPokok > 0 || pkbTunggakPokokVal > 0) unitPKB++;
      }
    });

    elPBBN.textContent = fmtNum(pokokBBN);
    elDBBN.textContent = fmtNum(dendaBBN);
    elPKBBerjalan.textContent = fmtNum(pkbBrjlnPokok);
    elDendaPKBBerjalan.textContent = fmtNum(pkbBrjlnDenda);
    elPKBTunggak.textContent = fmtNum(pkbTunggakPokok);
    elDendaPKBTunggak.textContent = fmtNum(pkbTunggakDenda);
    elUnitBBN.textContent = fmtNum(unitBBN);
    elUnitPKB.textContent = fmtNum(unitPKB);
  }

  function showStatus(msg = "", mode = "ok") {
    if (!rtStatus) return;
    if (mode === "ok") {
      rtStatus.classList.add("hidden");
      return;
    }

    rtStatus.classList.remove("hidden");
    rtStatus.textContent = msg;
    rtStatus.className = "ml-3 text-sm font-normal px-2 py-1 rounded-md border transition";

    if (mode === "warn") rtStatus.classList.add("bg-yellow-50", "text-yellow-700", "border-yellow-300");
    if (mode === "error") rtStatus.classList.add("bg-red-50", "text-red-700", "border-red-300");
  }

  let channel;
  let statusTimer;
  let isConnected = false;

  async function subscribeRealtime() {
    if (isConnected) return;
    isConnected = true;

    if (channel) {
      try {
        await channel.unsubscribe();
        channel = null;
      } catch {}
    }

    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      showStatus("Memeriksa koneksi realtime...", "warn");
    }, 700);

    // channel = sb
    //   .channel("realtime:esamsat_tx_harian")
    //   .on(
    //     "postgres_changes",
    //     { event: "*", schema: "public", table: "esamsat_tx_harian" },
    //     // (payload) => applyDelta(payload)
    //     (payload) => {
    //       const row = payload.new ?? payload.old;
    //       const upt = normalize(row?.upt_bayar);

    //       if (upt !== "KOTAWARINGIN TIMUR") return;

    //       applyDelta(payload);
    //     }
    //   );

    channel = sb
    .channel("realtime:esamsat_tx_harian")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "esamsat_tx_harian" },
      // (payload) => applyDelta(payload)
      (payload) => {
        const row = payload.new ?? payload.old;

        // Filter HANYA upt PALANGKA RAYA
        if (!row || row.upt_bayar?.trim() !== "PALANGKA RAYA") return;

        // Lanjutkan proses
        applyDelta(payload);
      }
    );


    const status = await channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        clearTimeout(statusTimer);
        showStatus("", "ok");
      } else if (state === "CLOSED" || state === "CHANNEL_ERROR") {
        clearTimeout(statusTimer);
        showStatus("Koneksi realtime terputus, mencoba ulang...", "warn");
        isConnected = false;
        scheduleReconnect();

      }
    });

    if (status !== "SUBSCRIBED") {
      clearTimeout(statusTimer);
      showStatus("Gagal terhubung, mencoba ulang...", "warn");
      isConnected = false;
      scheduleReconnect();

    }
  }

  function applyDelta(payload) {
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

  async function initialLoad() {
    const mode = elRange?.value || "today";
    const today = todayISO();
    let fromDate = today;
    if (mode === "yesterday") fromDate = yestISO();
    if (mode === "last3") {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      fromDate = d.toISOString().slice(0, 10);
    }

    const { data, error } = await sb
      .from("esamsat_tx_harian")
      .select("*")
      .gte("tanggal", fromDate)
      .lte("tanggal", today)
      .eq("upt_bayar", "PALANGKA RAYA")
      .order("paid_on", { ascending: false });

    if (error) {
      showStatus("Gagal memuat data awal: " + error.message, "error");
      console.error(error);
      return;
    }

    rows.clear();
    (data || []).forEach((r) => rows.set(keyOf(r), r));
    tbody.innerHTML = "";
    rows.forEach(renderRow);
    refreshSummary();
  }

  const RETRY_DELAY = 8000;
  let reconnectTimer = null;

  function scheduleReconnect() {
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        subscribeRealtime();
      }, RETRY_DELAY);
    }
  }

  elRange?.addEventListener("change", async () => {
    await initialLoad();
  });

  window.addEventListener("online", () => {
    showStatus("Koneksi online", "ok");
    subscribeRealtime();
  });
  window.addEventListener("offline", () => {
    showStatus("Koneksi offline", "warn");
  });

  await initialLoad();
  await subscribeRealtime();
});