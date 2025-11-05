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
            <td class="p-2 text-center border">JUMLAH TOTAL</td>
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
              ${makeRow("Denda PKB Online", sdhLalu.denda_pkb_online, summary.pkb_online.induk, summary.pkb_online.samkel, sdhLalu.denda_pkb_online + summary.pkb_online.denda, 0, false, true)}
            </tbody>
          </table>
        </div>
      </div>`;
      wrapper.insertAdjacentHTML("beforeend", tableHTML);
    });
  });
});
