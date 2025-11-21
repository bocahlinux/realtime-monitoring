// public/js/dashboard.js
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Ambil konfigurasi Supabase dari server
    const config = await fetch("/config/supabase.json").then((r) => r.json());
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Konfigurasi Supabase tidak ditemukan!");
      return;
    }

    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // === Helper tanggal (pakai timezone browser, harusnya sudah WIB di klien Samsat) ===
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfMonthStr = firstOfMonth.toISOString().slice(0, 10);

    // Label tanggal di header
    const labelHariIni = document.getElementById("label-hari-ini");
    const labelKemarin = document.getElementById("label-kemarin");
    const lastUpdateEl = document.getElementById("last-update");

    labelHariIni.textContent = now.toLocaleDateString("id-ID");
    labelKemarin.textContent = yesterdayDate.toLocaleDateString("id-ID");
    lastUpdateEl.textContent = new Date().toLocaleTimeString("id-ID");

    // === Struktur summary ===
    function makeEmptySummary() {
      return {
        total: 0,
        pokok: 0,
        denda: 0,
        total_pkb: 0,
        total_bbnkb: 0,
        jumlah_transaksi: 0,
        total_unit: 0,
      };
    }

    // Hitung komponen nilai dari satu baris transaksi
    function calcComponents(r) {
      const pj_pkb = r.pj_pkb || 0;
      const pt_pkb = r.pt_pkb || 0;
      const dj_pkb = r.dj_pkb || 0;
      const dt_pkb = r.dt_pkb || 0;

      const pokok_bbnkb = r.pokok_bbnkb || 0;
      const denda_bbnkb = r.denda_bbnkb || 0;

      const pj_swdkllj = r.pj_swdkllj || 0;
      const dj_swdkllj = r.dj_swdkllj || 0;
      const pt_swdkllj = r.pt_swdkllj || 0;
      const dt_swdkllj = r.dt_swdkllj || 0;

      const pokok_stnk = r.pokok_stnk || 0;
      const pokok_tnkb = r.pokok_tnkb || 0;
      const pokok_sp3 = r.pokok_sp3 || 0;

      const pkbPokok = pj_pkb + pt_pkb;
      const pkbDenda = dj_pkb + dt_pkb;

      const bbnPokok = pokok_bbnkb;
      const bbnDenda = denda_bbnkb;

      const swPokok = pj_swdkllj + pt_swdkllj;
      const swDenda = dj_swdkllj + dt_swdkllj;

      const stnk = pokok_stnk;
      const tnkb = pokok_tnkb;
      const sp3 = pokok_sp3;

      const total =
        pkbPokok +
        pkbDenda +
        bbnPokok +
        bbnDenda +
        // swPokok +
        // swDenda +
        stnk +
        tnkb +
        sp3;

      return {
        pkbPokok,
        pkbDenda,
        bbnPokok,
        bbnDenda,
        // swPokok,
        // swDenda,
        stnk,
        tnkb,
        sp3,
        total,
      };
    }

    // Tambah satu baris ke summary harian
    function applyRowToSummary(sum, comp) {
      sum.total += comp.total;
      // Pokok = PKB pokok + BBN pokok + SW pokok + STNK + TNKB + SP3
      sum.pokok +=
        comp.pkbPokok +
        comp.bbnPokok +
        comp.swPokok +
        comp.stnk +
        comp.tnkb +
        comp.sp3;
      // Denda = semua denda
      // sum.denda += comp.pkbDenda + comp.bbnDenda + comp.swDenda;
      sum.total_pkb += comp.pkbPokok + comp.pkbDenda;
      sum.total_bbnkb += comp.bbnPokok + comp.bbnDenda;
      sum.jumlah_transaksi += 1;
      if (comp.total > 0) {
        sum.total_unit += 1;
      }
    }

    function formatIDR(n) {
      return (n || 0).toLocaleString("id-ID");
    }

    // === Query data dari Supabase ===
    async function loadData() {
      try {
        // === STEP 1: Ambil tabel UPT + kabupaten (join manual) ===
        const { data: uptList, error: uptError } = await sb
          .from("esamsat_upt")
          .select(`
            nama,
            kabupaten_id,
            kabupaten:kabupaten_id (
              id,
              name
            )
          `)
          .neq("is_other", "True");

        if (uptError) {
          console.error("Gagal load tabel UPT:", uptError);
          return;
        }

        // === STEP 2: Filter UPT yang kabupatennya 'KOTA PALANGKA RAYA' ===
        // Format uptList.x.kabupaten.name
        const targetKabupaten = "KOTA PALANGKA RAYA";

        const uptPalangka = uptList
          .filter((u) => u.kabupaten && u.kabupaten.name === targetKabupaten)
          .map((u) => u.nama);

        console.log("UPT yang termasuk Palangka Raya:", uptPalangka);

        if (uptPalangka.length === 0) {
          console.warn("Tidak ditemukan UPT dengan kabupaten Kota Palangka Raya");
          return;
        }

        // === STEP 3: Query transaksi dengan kondisi upt_bayar berada dalam list uptPalangka ===
        const { data, error } = await sb
          .from("esamsat_tx_harian")
          .select(
            [
              "tanggal",
              "upt_bayar",
              "pj_pkb",
              "pt_pkb",
              "dj_pkb",
              "dt_pkb",
              "pokok_bbnkb",
              "denda_bbnkb",
              "pokok_stnk",
              "pokok_tnkb",
              "pokok_sp3",
            ].join(",")
          )
          .in("upt_bayar", uptPalangka)     // <-- FILTER DISINI
          .gte("tanggal", firstOfMonthStr)
          .lte("tanggal", todayStr);

        if (error) {
          console.error("Gagal load data dashboard:", error);
          const tbody = document.getElementById("unit-table-body");
          if (tbody) {
            tbody.innerHTML =
              '<tr><td colspan="5" class="px-3 py-6 text-center text-red-500 text-xs">Gagal memuat data dashboard.</td></tr>';
          }
          return;
        }

        const todaySum = makeEmptySummary();
        const yesterdaySum = makeEmptySummary();
        const unitMap = {}; // key: upt_bayar

        (data || []).forEach((row) => {
          const tgl = row.tanggal;
          const comp = calcComponents(row);

          const upt = row.upt_bayar || "TIDAK TERISI";
          if (!unitMap[upt]) {
            unitMap[upt] = {
              nama_upt: upt,
              kode_upt: upt,
              total_hari_ini: 0,
              total_kemarin: 0,
              total_bulan_ini: 0,
            };
          }

          // Akumulasi bulan ini untuk UPT
          unitMap[upt].total_bulan_ini += comp.total;

          if (tgl === todayStr) {
            applyRowToSummary(todaySum, comp);
            unitMap[upt].total_hari_ini += comp.total;
          } else if (tgl === yesterdayStr) {
            applyRowToSummary(yesterdaySum, comp);
            unitMap[upt].total_kemarin += comp.total;
          }
        });

        renderTopCards(todaySum, yesterdaySum);
        renderUnitTable(Object.values(unitMap));
        lastUpdateEl.textContent = new Date().toLocaleTimeString("id-ID");

        lucide.createIcons();
      } catch (e) {
        console.error("Error fatal loadData():", e);
      }
    }


    // === Render bagian atas (kartu ringkasan) ===
    function renderTopCards(todaySum, yesterdaySum) {
      const todayTotalEl = document.getElementById("today-total");
      const todayPokokEl = document.getElementById("today-pokok");
      const todayDendaEl = document.getElementById("today-denda");
      const todayUnitEl = document.getElementById("today-unit");
      const todayPKBEl = document.getElementById("today-pkb");
      const todayBBNEl = document.getElementById("today-bbnkb");
      const todayTxEl = document.getElementById("today-transaksi");

      const yTotalEl = document.getElementById("yesterday-total");
      const yPokokEl = document.getElementById("yesterday-pokok");
      const yDendaEl = document.getElementById("yesterday-denda");

      const diffEl = document.getElementById("compare-diff");
      const percentEl = document.getElementById("compare-percent");
      const badge = document.getElementById("compare-badge");
      const badgeText = document.getElementById("compare-badge-text");
      const icon = document.getElementById("compare-icon");

      const todayTotal = todaySum.total || 0;
      const yesterdayTotal = yesterdaySum.total || 0;
      const selisih = todayTotal - yesterdayTotal;
      const persen =
        yesterdayTotal > 0 ? ((selisih / yesterdayTotal) * 100).toFixed(1) : 0;

      const trenNaik = selisih > 0;
      const trenTurun = selisih < 0;

      // Isi angka
      todayTotalEl.textContent = formatIDR(todayTotal);
      todayPokokEl.textContent = formatIDR(todaySum.pokok);
      todayDendaEl.textContent = formatIDR(todaySum.denda);
      todayUnitEl.textContent = todaySum.total_unit || 0;

      todayPKBEl.textContent = "Rp " + formatIDR(todaySum.total_pkb);
      todayBBNEl.textContent = "Rp " + formatIDR(todaySum.total_bbnkb);
      todayTxEl.textContent = `${todaySum.jumlah_transaksi || 0} transaksi`;

      yTotalEl.textContent = formatIDR(yesterdayTotal);
      yPokokEl.textContent = formatIDR(yesterdaySum.pokok);
      yDendaEl.textContent = formatIDR(yesterdaySum.denda);

      diffEl.textContent =
        (selisih >= 0 ? "+" : "") + formatIDR(Math.round(selisih));
      percentEl.textContent = persen;

      // Styling badge
      badge.classList.remove(
        "bg-emerald-50",
        "text-emerald-700",
        "bg-red-50",
        "text-red-700",
        "bg-gray-100",
        "text-gray-700"
      );

      if (trenNaik) {
        badge.classList.add("bg-emerald-50", "text-emerald-700");
        badgeText.textContent = "Naik";
        icon.setAttribute("data-lucide", "arrow-up-right");
      } else if (trenTurun) {
        badge.classList.add("bg-red-50", "text-red-700");
        badgeText.textContent = "Turun";
        icon.setAttribute("data-lucide", "arrow-down-right");
      } else {
        badge.classList.add("bg-blue-100", "text-blue-700");
        badgeText.textContent = "Stabil";
        icon.setAttribute("data-lucide", "minus");
      }
    }

    // === Render tabel per UPT ===
    function renderUnitTable(units) {
      const tbody = document.getElementById("unit-table-body");
      if (!tbody) return;

      if (!units || units.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="px-3 py-6 text-center text-gray-400 text-xs">Belum ada data ringkasan unit.</td></tr>';
        return;
      }

      // Urutkan berdasarkan total_hari_ini desc
      units.sort((a, b) => (b.total_hari_ini || 0) - (a.total_hari_ini || 0));

      const rowsHtml = units
        .map((u) => {
          const tToday = u.total_hari_ini || 0;
          const tYesterday = u.total_kemarin || 0;
          const tMonth = u.total_bulan_ini || 0;
          const diff = tToday - tYesterday;
          const naik = diff >= 0;

          const badgeClass = naik
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700";
          const iconName = naik ? "trending-up" : "trending-down";

          return `
          <tr>
            <td class="px-3 py-2">
              <p class="font-medium text-gray-800">${u.nama_upt}</p>
              <p class="text-[11px] text-gray-500">${u.kode_upt || ""}</p>
            </td>
            <td class="px-3 py-2 text-right text-gray-800">
              Rp ${formatIDR(Math.round(tToday))}
            </td>
            <td class="px-3 py-2 text-right text-gray-500">
              Rp ${formatIDR(Math.round(tYesterday))}
            </td>
            <td class="px-3 py-2 text-right text-gray-800">
              Rp ${formatIDR(Math.round(tMonth))}
            </td>
            <td class="px-3 py-2 text-right">
              <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${badgeClass}">
                <i data-lucide="${iconName}" class="w-3 h-3"></i>
                ${(diff >= 0 ? "+" : "") + formatIDR(Math.round(diff))}
              </span>
            </td>
          </tr>
        `;
        })
        .join("");

      tbody.innerHTML = rowsHtml;
    }

    await loadData();
  } catch (err) {
    console.error("Error in dashboard.js:", err);
  }
});
