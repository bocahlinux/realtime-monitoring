document.addEventListener("DOMContentLoaded", async () => {
  const cfg = await fetch("/config/supabase.json").then(r => r.json());
  const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const bulanSelect = document.getElementById("bulan");
  const tahunSelect = document.getElementById("tahun");
  const btnLoad = document.getElementById("btn-load");
  const wrapper = document.getElementById("rekap-wrapper");

  const fmt = n => new Intl.NumberFormat("id-ID").format(n || 0);
  const fmtTanggal = t => new Date(t).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const warnaCell = {
    P: "bg-gray-100 text-gray-700",
    M: "bg-red-100 text-red-700",
    K: "bg-yellow-100 text-yellow-800",
  };

  const mapWarna = w => {
    const s = (w || "").toString().trim().toUpperCase();
    if (s.startsWith("P")) return "P";
    if (s.startsWith("M")) return "M";
    if (s.startsWith("K")) return "K";
    return null;
  };
  const mapRoda = r => (r == 2 ? "r2" : r == 3 ? "r3" : r >= 4 ? "r4" : null);

  const getSisaTwColor = s => s <= 25 ? "bg-green-100 text-green-800 font-semibold"
        : s <= 50 ? "bg-yellow-100 text-yellow-800 font-semibold"
        : "bg-red-100 text-red-800 font-semibold";

  const getTriwulan = b => {
    const m = parseInt(b);
    if (m <= 3) return 1;
    if (m <= 6) return 2;
    if (m <= 9) return 3;
    return 4;
  };

  btnLoad.addEventListener("click", async () => {
    const bulan = bulanSelect.value.padStart(2, "0");
    const tahun = tahunSelect.value;
    const upt = "PALANGKA RAYA";
    const tw = getTriwulan(bulan);

    const awal = `${tahun}-${bulan}-01`;
    const akhir = new Date(tahun, bulan, 0).toISOString().slice(0, 10);

    const { data: targetData } = await sb
      .from("esamsat_target")
      .select("*")
      .eq("upt_bayar", upt)
      .eq("tahun", parseInt(tahun));
    const target = targetData?.[0] || {};

    const { data, error } = await sb
      .from("esamsat_tx_harian")
      .select("*")
      .gte("tanggal", awal)
      .lte("tanggal", akhir)
      .eq("upt_bayar", upt)
      .order("tanggal", { ascending: true });
    if (error) {
      wrapper.innerHTML = `<p class="text-red-600 text-sm">Gagal memuat data: ${error.message}</p>`;
      return;
    }

    const { data: papData } = await sb
      .from("esamsat_pap")
      .select("tanggal, jumlah")
      .gte("tanggal", awal)
      .lte("tanggal", akhir)
      .eq("upt_bayar", upt);

    const { data: pabData } = await sb
      .from("esamsat_pab")
      .select("tanggal, jumlah")
      .gte("tanggal", awal)
      .lte("tanggal", akhir)
      .eq("upt_bayar", upt);

    if (!data?.length && !papData?.length && !pabData?.length) {
      wrapper.innerHTML = `<p class="text-gray-500 text-sm">Tidak ada data transaksi untuk bulan ini.</p>`;
      return;
    }

    const allDates = [
      ...new Set([
        ...data.map(r => r.tanggal.slice(0, 10)),
        ...(papData || []).map(p => p.tanggal),
        ...(pabData || []).map(p => p.tanggal),
      ]),
    ].sort();

    wrapper.innerHTML = "";

    allDates.forEach((tgl, idx) => {
      const rows = data.filter(r => r.tanggal.slice(0, 10) === tgl);
      const papRows = papData?.filter(p => p.tanggal === tgl) || [];
      const pabRows = pabData?.filter(p => p.tanggal === tgl) || [];
      const prevDates = allDates.slice(0, idx);
      const sdLaluRows = data.filter(r => prevDates.includes(r.tanggal.slice(0, 10)));

      const summary = {
        pkb: { pokok: 0, induk: 0, samkel: 0 },
        bbnkb: { pokok: 0, induk: 0, samkel: 0 },
        pap: { pokok: 0 },
        pab: { pokok: 0 },
        pkb_online: { pokok: 0, denda: 0, induk: 0, samkel: 0 },
        denda_pkb_online: { induk: 0, samkel: 0 },
        denda_pkb: { induk: 0, samkel: 0 },
        denda_bbnkb: { induk: 0, samkel: 0 },
        unit: {
          sdLalu: { r2: { P: 0, M: 0, K: 0 }, r3: { P: 0, M: 0, K: 0 }, r4: { P: 0, M: 0, K: 0 } },
          hariIni: { r2: { P: 0, M: 0, K: 0 }, r3: { P: 0, M: 0, K: 0 }, r4: { P: 0, M: 0, K: 0 } },
          sdHariIni: { r2: { P: 0, M: 0, K: 0 }, r3: { P: 0, M: 0, K: 0 }, r4: { P: 0, M: 0, K: 0 } },
        },
      };

      const sdhLalu = (() => {
        const tglNow = new Date(tgl);

        // Filter semua transaksi sebelum tanggal ini
        const dataLalu = data.filter(r => new Date(r.tanggal) < tglNow);
        const papLalu = (papData || []).filter(p => new Date(p.tanggal) < tglNow);
        const pabLalu = (pabData || []).filter(p => new Date(p.tanggal) < tglNow);

        const sum = {
            pkb: 0,
            bbnkb: 0,
            pkb_online: 0,
            denda_pkb: 0,
            denda_bbnkb: 0,
            denda_pkb_online: 0,
            pap: 0,
            pab: 0,
        };

        // Hitung PKB/BBNKB dari esamsat_tx_harian
        dataLalu.forEach(r => {
            const isOnline = r.is_online === true || r.is_online === 1;
            if (isOnline) {
            sum.pkb_online += (r.pj_pkb || 0) + (r.pt_pkb || 0);
            sum.denda_pkb_online += (r.dj_pkb || 0) + (r.dt_pkb || 0);
            } else {
            sum.pkb += (r.pj_pkb || 0) + (r.pt_pkb || 0);
            sum.denda_pkb += (r.dj_pkb || 0) + (r.dt_pkb || 0);
            sum.bbnkb += r.pokok_bbnkb || 0;
            sum.denda_bbnkb += r.denda_bbnkb || 0;
            }
        });

        // ✅ Tambahkan PAP & PAB dari tabelnya masing-masing
        sum.pap = papLalu.reduce((a, b) => a + (b.jumlah || 0), 0);
        sum.pab = pabLalu.reduce((a, b) => a + (b.jumlah || 0), 0);
        return sum;
      })();

      summary.pap.pokok = papRows.reduce((a, b) => a + (b.jumlah || 0), 0);
      summary.pab.pokok = pabRows.reduce((a, b) => a + (b.jumlah || 0), 0);

      sdLaluRows.forEach(r => {
        const warna = mapWarna(r.warna_plat);
        const roda = mapRoda(r.roda);
        if (roda && warna) summary.unit.sdLalu[roda][warna]++;
      });

      rows.forEach(r => {
        const warna = mapWarna(r.warna_plat);
        const roda = mapRoda(r.roda);
        if (roda && warna) summary.unit.hariIni[roda][warna]++;
        const isOnline = r.is_online === true || r.is_online === 1;
        const isPusat = r.is_pusat === true || r.is_pusat === 1;
        const pkbPokok = (r.pj_pkb || 0) + (r.pt_pkb || 0);
        const pkbDenda = (r.dj_pkb || 0) + (r.dt_pkb || 0);
        const bbnPokok = r.pokok_bbnkb || 0;
        const bbnDenda = r.denda_bbnkb || 0;

        if (isOnline) {
          summary.pkb_online.pokok += pkbPokok;
          summary.pkb_online.denda += pkbDenda;
          if (isPusat) summary.pkb_online.induk += pkbPokok;
          else summary.pkb_online.samkel += pkbPokok;
          if (isPusat) summary.denda_pkb_online.induk += pkbDenda;
          else summary.denda_pkb_online.samkel += pkbDenda;
        } else {
          summary.pkb.pokok += pkbPokok;
          summary.bbnkb.pokok += bbnPokok;
          if (isPusat) {
            summary.pkb.induk += pkbPokok;
            summary.bbnkb.induk += bbnPokok;
            summary.denda_pkb.induk += pkbDenda;
            summary.denda_bbnkb.induk += bbnDenda;
          } else {
            summary.pkb.samkel += pkbPokok;
            summary.bbnkb.samkel += bbnPokok;
            summary.denda_pkb.samkel += pkbDenda;
            summary.denda_bbnkb.samkel += bbnDenda;
          }
        }
      });

      ["r2", "r3", "r4"].forEach(rk =>
        ["P", "M", "K"].forEach(w =>
          (summary.unit.sdHariIni[rk][w] =
            summary.unit.sdLalu[rk][w] + summary.unit.hariIni[rk][w])
        )
      );

      const renderWarnaCols = set =>
        ["r2", "r3", "r4"]
          .map(
            rk => `
              <td class="p-2 text-center ${warnaCell.P}">${fmt(set[rk].P)}</td>
              <td class="p-2 text-center ${warnaCell.M}">${fmt(set[rk].M)}</td>
              <td class="p-2 text-center ${warnaCell.K}">${fmt(set[rk].K)}</td>`
          )
          .join("");

      const makeRow = (u, sdLalu, induk, samkel, total, targetU = 0, withUnit = false, skipTarget = false) => {
        let persen = "-", sisa = "-", sisaColor = "";
        if (!skipTarget && targetU) {
          persen = ((total / targetU) * 100).toFixed(2) + "%";
          sisa = (100 - parseFloat((total / targetU) * 100)).toFixed(2) + "%";
          sisaColor = getSisaTwColor(parseFloat(sisa));
        }
        return `
        <tr>
          <td class="p-2 font-medium text-gray-700">${u}</td>
          <td class="p-2 text-right">${skipTarget ? "-" : fmt(targetU)}</td>
          <td class="p-2 text-right">${fmt(sdLalu)}</td>
          <td class="p-2 text-right">${fmt(induk)}</td>
          <td class="p-2 text-right">${fmt(samkel)}</td>
          <td class="p-2 text-right">${fmt(total)}</td>
          <td class="p-2 text-right">${persen}</td>
          <td class="p-2 text-right ${sisaColor}">${sisa}</td>
          ${withUnit ? renderWarnaCols(summary.unit.sdLalu) + renderWarnaCols(summary.unit.hariIni) + renderWarnaCols(summary.unit.sdHariIni) : "<td colspan='27'></td>"}
        </tr>`;
      };

      const totalSemua = {
        target:
            (target.target_pkb || 0) +
            (target.target_bbnkb || 0) +
            (target.target_pap || 0) +
            (target.target_pab || 0),
        sdLalu:
            (sdhLalu.pkb || 0) +
            (sdhLalu.bbnkb || 0) +
            (sdhLalu.pap || 0) +
            (sdhLalu.pab || 0),
        induk:
            (summary.pkb.induk || 0) +
            (summary.bbnkb.induk || 0),
        samkel:
            (summary.pkb.samkel || 0) +
            (summary.bbnkb.samkel || 0),
        total:
            ((sdhLalu.pkb || 0) + summary.pkb.pokok) +
            ((sdhLalu.bbnkb || 0) + summary.bbnkb.pokok) +
            ((sdhLalu.pap || 0) + summary.pap.pokok) +
            ((sdhLalu.pab || 0) + summary.pab.pokok),
     };

     // Hitung 100% dan Sisa TW total
     const persenTotal = totalSemua.target
        ? ((totalSemua.total / totalSemua.target) * 100).toFixed(2)
        : "-";
    
     const sisaTotal =
        persenTotal === "-"
            ? "-"
            : (100 - parseFloat(persenTotal)).toFixed(2);

     const sisaColor = sisaTotal === "-"
        ? ""
        : getSisaTwColor(parseFloat(sisaTotal));

     const totalRow = `
        <tr class="bg-blue-200 font-bold text-gray-900">
            <td class="p-2 text-center border">TOTAL</td>
            <td class="p-2 text-right border">${fmt(totalSemua.target)}</td>
            <td class="p-2 text-right border">${fmt(totalSemua.sdLalu)}</td>
            <td class="p-2 text-right border">${fmt(totalSemua.induk)}</td>
            <td class="p-2 text-right border">${fmt(totalSemua.samkel)}</td>
            <td class="p-2 text-right border">${fmt(totalSemua.total)}</td>
            <td class="p-2 text-center border">${persenTotal === "-" ? "-" : persenTotal + "%"}</td>
            <td class="p-2 text-right border ${sisaColor}">${sisaTotal === "-" ? "-" : sisaTotal + "%"}</td>
            <td colspan="27" class="border"></td>
        </tr>`;

      const tableHTML = `
      <div class="space-y-2">
        <h2 class="text-base font-semibold text-gray-700">
          Laporan Tanggal ${fmtTanggal(tgl)}
        </h2>
        <div class="overflow-x-auto bg-white shadow rounded-lg">
          <table class="min-w-full text-sm border-collapse border border-gray-200">
            <thead class="bg-blue-100 text-blue-800 font-semibold">
              <tr>
                <th rowspan="3" class="p-2 border">URAIAN</th>
                <th rowspan="3" class="p-2 border">TARGET</th>
                <th rowspan="3" class="p-2 border">PENERIMAAN S/D HARI LALU</th>
                <th colspan="2" class="p-2 border text-center">PENERIMAAN HARI INI</th>
                <th rowspan="3" class="p-2 border">PENERIMAAN S/D HARI INI</th>
                <th rowspan="3" class="p-2 border">100%</th>
                <th rowspan="3" class="p-2 border">SISA TW ${tw}</th>
                <th colspan="9" class="p-2 border text-center bg-blue-50">JUMLAH UNIT S/D HARI LALU</th>
                <th colspan="9" class="p-2 border text-center bg-blue-50">JUMLAH UNIT HARI INI</th>
                <th colspan="9" class="p-2 border text-center bg-blue-50">JUMLAH UNIT S/D HARI INI</th>
              </tr>
              <tr class="bg-blue-50">
                <th rowspan="2" class="p-1 border">INDUK</th>
                <th rowspan="2" class="p-1 border">SAMKEL</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 2</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 3</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 4</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 2</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 3</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 4</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 2</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 3</th>
                <th colspan="3" class="p-1 border text-center bg-blue-100">Roda 4</th>
              </tr>
              <tr class="bg-blue-50">
                ${[...Array(3)].map(() =>
                  ["r2","r3","r4"].map(() =>
                    `<th class="p-1 border ${warnaCell.P}">P</th>
                     <th class="p-1 border ${warnaCell.M}">M</th>
                     <th class="p-1 border ${warnaCell.K}">K</th>`
                  ).join("")
                ).join("")}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${makeRow("PKB", sdhLalu.pkb, summary.pkb.induk, summary.pkb.samkel, sdhLalu.pkb + summary.pkb.pokok, target.target_pkb, true)}
              ${makeRow("BBNKB", sdhLalu.bbnkb, summary.bbnkb.induk, summary.bbnkb.samkel, sdhLalu.bbnkb + summary.bbnkb.pokok, target.target_bbnkb)}
              ${makeRow("PAP", sdhLalu.pap, 0, 0, sdhLalu.pap + summary.pap.pokok, target.target_pap)}
              ${makeRow("PAB", sdhLalu.pab, 0, 0, sdhLalu.pab + summary.pab.pokok, target.target_pab)}
              ${totalRow}
              ${makeRow("Denda PKB", sdhLalu.denda_pkb, summary.denda_pkb.induk, summary.denda_pkb.samkel, sdhLalu.denda_pkb + summary.denda_pkb.induk + summary.denda_pkb.samkel, 0, false, true)}
              ${makeRow("Denda BBNKB", sdhLalu.denda_bbnkb, summary.denda_bbnkb.induk, summary.denda_bbnkb.samkel, sdhLalu.denda_bbnkb + summary.denda_bbnkb.induk + summary.denda_bbnkb.samkel, 0, false, true)}
              ${makeRow("PKB Online", sdhLalu.pkb_online, summary.pkb_online.induk, summary.pkb_online.samkel, sdhLalu.pkb_online + summary.pkb_online.pokok, 0, false, true)}
              ${makeRow("Denda PKB Online", sdhLalu.denda_pkb_online, summary.denda_pkb_online.induk, summary.denda_pkb_online.samkel, sdhLalu.denda_pkb_online + summary.pkb_online.denda, 0, false, true)}
            </tbody>
          </table>
        </div>
      </div>`;

      const ringkas = { summary, sdhLalu, target, tw };
      const rowsPdf = buildPdfRows(ringkas, { includeTotalRow: true });

      window.rekapData = rowsPdf;
      // contoh label tanggal yang rapi
      window.rekapTanggalLabel = fmtTanggal(tgl);
      wrapper.insertAdjacentHTML("beforeend", tableHTML);
    });
  });

// Kecil: util angka
const nfID = new Intl.NumberFormat("id-ID");
const fmtNum = v => (v === "-" || v == null ? "-" : nfID.format(+v || 0));

// Bangun array 9 kolom unit dari objek {r2:{P,M,K}, r3:{...}, r4:{...}}
function flattenUnits(u) {
  const safe = (rk, w) => (u?.[rk]?.[w] ?? 0);
  return [
    safe("r2","P"), safe("r2","M"), safe("r2","K"),
    safe("r3","P"), safe("r3","M"), safe("r3","K"),
    safe("r4","P"), safe("r4","M"), safe("r4","K"),
  ];
}

/**
 * Susun data baris PDF dari ringkasan satu tanggal
 * param:
 *  - ringkas: { summary, sdhLalu, target, tw }
 *  - options: { includeTotalRow: true }
 */
function buildPdfRows(ringkas, options = {}) {
  const { summary, sdhLalu, target, tw } = ringkas;
  const rows = [];

  // Helper baris
  const mk = (uraian, sdLalu, induk, samkel, total, targetU = 0, unitSets = null, hitungTarget = true) => {
    let persen = "-", sisa = "-";
    if (hitungTarget && targetU) {
      const p = (total / targetU) * 100;
      persen = p.toFixed(2);
      sisa = (100 - p).toFixed(2);
    }
    const unit_sd_lalu = flattenUnits(unitSets?.sdLalu || {r2:{P:0,M:0,K:0}, r3:{P:0,M:0,K:0}, r4:{P:0,M:0,K:0}});
    const unit_hari_ini = flattenUnits(unitSets?.hariIni || {r2:{P:0,M:0,K:0}, r3:{P:0,M:0,K:0}, r4:{P:0,M:0,K:0}});
    const unit_sd_hari_ini = flattenUnits(unitSets?.sdHariIni || {r2:{P:0,M:0,K:0}, r3:{P:0,M:0,K:0}, r4:{P:0,M:0,K:0}});

    return [
      uraian,
      targetU || "-",
      sdLalu, induk, samkel, total,
      persen, sisa,
      ...unit_sd_lalu, ...unit_hari_ini, ...unit_sd_hari_ini
    ];
  };

  // PKB
  const pkb_total = (sdhLalu.pkb || 0) + (summary.pkb.pokok || 0);
  rows.push(
    mk(
      "PKB",
      sdhLalu.pkb || 0,
      summary.pkb.induk || 0,
      summary.pkb.samkel || 0,
      pkb_total,
      (target?.target_pkb || 0),
      summary.unit, // unit lengkap
      true
    )
  );

  // BBNKB
  const bbn_total = (sdhLalu.bbnkb || 0) + (summary.bbnkb.pokok || 0);
  rows.push(
    mk(
      "BBNKB",
      sdhLalu.bbnkb || 0,
      summary.bbnkb.induk || 0,
      summary.bbnkb.samkel || 0,
      bbn_total,
      (target?.target_bbnkb || 0),
      null,
      true
    )
  );

  // PAP
  const pap_total = (sdhLalu.pap || 0) + (summary.pap.pokok || 0);
  rows.push(
    mk("PAP", sdhLalu.pap || 0, 0, 0, pap_total, (target?.target_pap || 0), null, true)
  );

  // PAB
  const pab_total = (sdhLalu.pab || 0) + (summary.pab.pokok || 0);
  rows.push(
    mk("PAB", sdhLalu.pab || 0, 0, 0, pab_total, (target?.target_pab || 0), null, true)
  );

  if (options.includeTotalRow) {
    const targetAll = (target?.target_pkb||0) + (target?.target_bbnkb||0) + (target?.target_pap||0) + (target?.target_pab||0);
    const sdLaluAll = (sdhLalu.pkb||0) + (sdhLalu.bbnkb||0) + (sdhLalu.pap||0) + (sdhLalu.pab||0);
    const indukAll = (summary.pkb.induk||0) + (summary.bbnkb.induk||0);
    const samkelAll = (summary.pkb.samkel||0) + (summary.bbnkb.samkel||0);
    const totalAll = pkb_total + bbn_total + pap_total + pab_total;
    const p = targetAll ? (totalAll/targetAll)*100 : null;
    // rows.push([
    //   "TOTAL",
    //   targetAll || "-",
    //   sdLaluAll, indukAll, samkelAll, totalAll,
    //   p == null ? "-" : p.toFixed(2),
    //   p == null ? "-" : (100 - p).toFixed(2),
    //   // isi 27 kolom unit kosong
    //   ...Array(27).fill("-")
    // ]);
    // Pastikan kolom lengkap (8 + 27)
    const totalRow = [
      "TOTAL",
      fmtNum(targetAll),
      fmtNum(sdLaluAll),
      fmtNum(indukAll),
      fmtNum(samkelAll),
      fmtNum(totalAll),
      p == null ? "-" : p.toFixed(2),
      p == null ? "-" : (100 - p).toFixed(2),
      ...Array(27).fill("-") // lengkap 27 kolom
    ];

    // Jika kurang dari 35 kolom → tambah padding
    while (totalRow.length < 35) totalRow.push("-");
    rows.push(totalRow);
  }

  // Bagian denda & online (tanpa target/%/sisa)
  const dpkb_total = (sdhLalu.denda_pkb||0) + (summary.denda_pkb.induk||0) + (summary.denda_pkb.samkel||0);
  rows.push(mk("Denda PKB", sdhLalu.denda_pkb||0, summary.denda_pkb.induk||0, summary.denda_pkb.samkel||0, dpkb_total, 0, null, false));

  const dbbn_total = (sdhLalu.denda_bbnkb||0) + (summary.denda_bbnkb.induk||0) + (summary.denda_bbnkb.samkel||0);
  rows.push(mk("Denda BBNKB", sdhLalu.denda_bbnkb||0, summary.denda_bbnkb.induk||0, summary.denda_bbnkb.samkel||0, dbbn_total, 0, null, false));

  const pkbo_total = (sdhLalu.pkb_online||0) + (summary.pkb_online.pokok||0);
  rows.push(mk("PKB Online", sdhLalu.pkb_online||0, summary.pkb_online.induk||0, summary.pkb_online.samkel||0, pkbo_total, 0, null, false));

  const dpkbo_total = (sdhLalu.denda_pkb_online||0) + (summary.pkb_online.denda||0);
  rows.push(mk("Denda PKB Online", sdhLalu.denda_pkb_online||0, summary.pkb_online.induk||0, summary.pkb_online.samkel||0, dpkbo_total, 0, null, false));

  return rows;
}

// ==== EXPORT PDF (Versi pdfmake, per hari satu halaman) ====
(async function setupPdfMakeExporter() {
  const btn = document.getElementById("btnExportPDF");
  if (!btn) return;

  // Base64 logo kecil Pemprov Kalteng
  const LOGO_BASE64 =
    "data:image/jpeg;base64,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";

  // Pastikan pdfmake sudah tersedia
  if (typeof pdfMake === "undefined") {
    alert("⚠️ pdfmake belum dimuat. Tambahkan library pdfmake.min.js dan vfs_fonts.js di HTML.");
    return;
  }

  btn.addEventListener("click", () => {
    const sections = Array.from(
      document.querySelectorAll("#rekap-wrapper > div.space-y-2")
    );

    if (!sections.length) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    // Konfigurasi dokumen
    const docDefinition = {
      pageOrientation: "landscape",
      pageSize: "FOLIO",
      pageMargins: [20, 50, 20, 40],
      content: [],
      footer: (currentPage, pageCount) => ({
        columns: [
          {
            text: `Dicetak: ${new Date().toLocaleString("id-ID")}`,
            alignment: "left",
            fontSize: 8,
            margin: [20, 0],
          },
          {
            text: `Halaman ${currentPage} / ${pageCount}`,
            alignment: "right",
            fontSize: 8,
            margin: [0, 0, 20, 0],
          },
        ],
      }),
      defaultStyle: {
        fontSize: 8,
      },
    };

    // === Loop per tanggal ===
    sections.forEach((sec, i) => {
      const title = sec.querySelector("h2")?.textContent.trim() || "-";
      const table = sec.querySelector("table");

      // Ambil tanggal dari judul
      const tanggalLabel = title.replace("Laporan Tanggal", "").trim().toUpperCase();

      // Tambahkan header halaman
      const headerContent = [
        {
          columns: [
            {
              image: LOGO_BASE64,
              width: 40,
            },
            {
              stack: [
                {
                  text: "LAPORAN REALISASI PAJAK DAERAH",
                  bold: true,
                  alignment: "center",
                  fontSize: 12,
                },
                {
                  text: "PROVINSI KALIMANTAN TENGAH",
                  bold: true,
                  alignment: "center",
                  fontSize: 12,
                },
                {
                  text: "UPT PPD BAPENDA DI PALANGKA RAYA",
                  alignment: "center",
                  fontSize: 11,
                },
                {
                  text: `SAMPAI DENGAN TANGGAL ${tanggalLabel}`,
                  alignment: "center",
                  margin: [0, 4, 0, 0],
                  bold: true,
                  fontSize: 10,
                },
              ],
              width: "*",
            },
            { text: "", width: 40 },
          ],
          margin: [0, 0, 0, 10],
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 0.5 }] },
      ];

      // Ambil data dari tabel HTML
      const body = [];
      const rows = table.querySelectorAll("tr");
      rows.forEach((tr, idx) => {
        const cells = Array.from(tr.querySelectorAll("th,td")).map(td => {
          const text = td.innerText.trim();
          const align = td.classList.contains("text-right")
            ? "right"
            : td.classList.contains("text-center")
            ? "center"
            : "left";
          const bold = td.tagName === "TH" || td.classList.contains("font-bold");
          const fillColor =
            text === "P"
              ? "#f3f4f6"
              : text === "M"
              ? "#fee2e2"
              : text === "K"
              ? "#fef08a"
              : idx === 0 && td.tagName === "TH"
              ? "#dbeafe"
              : null;

          return {
            text: text || "",
            alignment: align,
            bold,
            fillColor,
          };
        });
        // body.push(cells);
        const maxCols = 35;
        while (cells.length < maxCols) {
          cells.push({ text: "", alignment: "center" });
        }
        body.push(cells);
      });

      // Tambahkan tabel ke pdfmake
      const tableObj = {
        table: {
          headerRows: 3,
          body,
        },
        layout: {
          fillColor: (rowIndex, node, columnIndex) => {
            const val = node.table.body[rowIndex]?.[columnIndex]?.text || "";
            if (["P", "M", "K"].includes(val)) {
              return val === "P"
                ? "#f3f4f6"
                : val === "M"
                ? "#fee2e2"
                : "#fef08a";
            }
            return null;
          },
        },
      };

      if (i > 0) docDefinition.content.push({ text: "", pageBreak: "before" });
      docDefinition.content.push(...headerContent, tableObj);
    });

    pdfMake.createPdf(docDefinition).download("Laporan_Realisasi_Pajak_F4.pdf");
  });
})();


});
