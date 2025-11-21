// === LOADING OVERLAY HANDLER with progress bar + multi-phase text ===
function showLoading() {
  const overlay = document.getElementById("loading-overlay");
  const text = document.getElementById("loading-text");
  const time = document.getElementById("loading-time");

  // 🔵 Progress bar setup
  let progressBar = document.getElementById("progress-bar");
  if (!progressBar) {
    const bar = document.createElement("div");
    bar.id = "progress-bar";
    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      height: "4px",
      width: "0%",
      backgroundColor: "#3b82f6", // Tailwind blue-500
      transition: "width 0.2s ease",
      zIndex: "100",
    });
    document.body.appendChild(bar);
    progressBar = bar;
  }

  overlay.classList.remove("hidden");

  let dots = 0;
  let phase = 0; // 0=memuat, 1=memproses, 2=datanya banyak
  const startTime = performance.now();
  let progress = 0;

  // 🔹 Animasi titik-titik
  const dotAnim = setInterval(() => {
    dots = (dots + 1) % 4;
    const baseText =
      phase === 0
        ? "Mohon tunggu, data sedang diproses"
        : phase === 1
        ? "Masih memuat data, mohon tunggu ya"
        : phase === 2
        ? "Datanya cukup banyak, harap bersabar"
        : "Wah lama ya, datanya hampir selesai kok";
    text.textContent = baseText + ".".repeat(dots);
  }, 400);

  // 🔹 Perubahan otomatis teks (multi fase)
  const phaseTimers = [
    setTimeout(() => (phase = 1), 7000),
    setTimeout(() => (phase = 2), 13000),
    setTimeout(() => (phase = 3), 20000),
  ];

  // 🔹 Waktu berjalan & progress bar bergerak
  const timeAnim = setInterval(() => {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    if (time) time.textContent = `⏱ ${elapsed}s`;

    // Simulasi progress 0-90% selama proses berjalan
    if (progress < 90) {
      progress += Math.random() * 2;
      progressBar.style.width = `${Math.min(progress, 90)}%`;
    }
  }, 120);

  // 🔹 Fungsi untuk hentikan semua animasi
  return {
    stop: () => {
      clearInterval(dotAnim);
      clearInterval(timeAnim);
      phaseTimers.forEach(clearTimeout);

      // Akhiri progress bar ke 100% dan fade out
      progressBar.style.width = "100%";
      setTimeout(() => {
        progressBar.style.transition = "opacity 0.4s";
        progressBar.style.opacity = "0";
        setTimeout(() => progressBar.remove(), 400);
      }, 300);

      overlay.classList.add("hidden");
    },
  };
}



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

  function animateDots(element) {
    let dots = 0;
    return setInterval(() => {
      dots = (dots + 1) % 4;
      element.textContent = element.textContent.replace(/\.*$/, ".".repeat(dots));
    }, 400);
  }


  btnLoad.addEventListener("click", async () => {
    const overlay = document.getElementById("loading-overlay");
    overlay.classList.remove("hidden"); // tampilkan loading
    const overlayText = overlay.querySelector("p");

    const loader = showLoading(); // ⬅️ panggil di awal
    try {
      const bulan = bulanSelect.value.padStart(2, "0");
      const tahun = tahunSelect.value;
      const upt = "PALANGKA RAYA";
      const upt2 = "KOTA PALANGKA RAYA";
      const tw = getTriwulan(bulan);

      const awal = `${tahun}-01-01`;
      // const akhir = new Date(tahun, bulan, 0).toISOString().slice(0, 10);
      // const akhir = new Date(tahun, parseInt(bulan), 0).toISOString().slice(0, 10);
      // const akhir = new Date(parseInt(tahun), parseInt(bulan), 0).toISOString().slice(0, 10);

      function formatDateLocal(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      const akhir = formatDateLocal(new Date(parseInt(tahun), parseInt(bulan), 0));
      const { data: targetData } = await sb
        .from("esamsat_target")
        .select("*")
        .eq("upt_bayar", upt)
        .eq("tahun", parseInt(tahun));
      const target = targetData?.[0] || {};

      const { data, error } = await sb
        .from("esamsat_tx_harian")
        .select("tanggal, upt_bayar, warna_plat, roda, is_online, is_pusat, pj_pkb, pt_pkb, dj_pkb, dt_pkb, pokok_bbnkb, denda_bbnkb")
        .gte("tanggal", awal)
        .lte("tanggal", akhir)
        .eq("upt_bayar", upt)
        .order("tanggal", { ascending: true });
      // 🔹 Ubah teks setelah selesai
      
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
      // Dapatkan bulan terpilih (misal "02" untuk Februari)
      const bulanDipilih = parseInt(bulan);

      // Filter tanggal yang hanya di bulan tersebut
      // const allDatesFiltered = allDates.filter(tgl => {
      //   const d = new Date(tgl);
      //   return d.getMonth() + 1 === bulanDipilih;
      // });
      const allDatesFiltered = allDates.filter(tgl => {
        const [y, m] = tgl.split("-").map(Number);
        return m === bulanDipilih;
      });

      // Pre-group data berdasarkan tanggal lebih dulu
      const groupedData = data.reduce((acc, row) => {
        const t = row.tanggal.slice(0, 10);
        if (!acc[t]) acc[t] = [];
        acc[t].push(row);
        return acc;
      }, {});

      // 🔸 render laporan
      // const endTime = performance.now();
      // const duration = ((endTime - startTime) / 1000).toFixed(2);
      // overlayText.textContent = `Merender laporan bulanan...`;
      // await new Promise((r) => setTimeout(r, 300)); // simulasi loading singkat

      allDatesFiltered.forEach((tgl, idx) => {
        // const rows = data.filter(r => r.tanggal.slice(0, 10) === tgl);
        const rows = groupedData[tgl] || [];
        const papRows = papData?.filter(p => p.tanggal === tgl) || [];
        const pabRows = pabData?.filter(p => p.tanggal === tgl) || [];
        // const prevDates = allDatesFiltered.slice(0, idx);
        // const sdLaluRows = data.filter(r => r.tanggal.slice(0, 10) === tgl);
        // const sdLaluRows = data.filter(r => prevDates.includes(r.tanggal.slice(0, 10)));
        const prevDates = allDates.filter(t => new Date(t) < new Date(tgl));
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
            let persenValue = (total / targetU) * 100;
            let sisaValue = 100 - persenValue;

            // 🔹 kalau hasil sangat mendekati 100 (misal 99.9999) → bulatkan jadi 100
            // if (persenValue > 100.00){
            //   persenValue = 100;
            // }
            // else if (persenValue < 0.01) {
            //   persenValue = 0;
            // }

            // if (sisaValue > 100.00) sisaValue = 100;
            // if (sisaValue < 0) sisaValue = 0;

            // 🔹 Hapus ".00" kalau hasilnya bilangan bulat
            const persenClean = (Number.isInteger(persenValue)
              ? persenValue.toFixed(0)
              : parseFloat(persenValue.toFixed(2))) + "%";
            // console.log({ persenValue, persenClean, sisaValue });

            const sisaClean = (Number.isInteger(sisaValue)
              ? sisaValue.toFixed(0)
              : parseFloat(sisaValue.toFixed(2))) + "%";
            persen = persenClean
            sisa = sisaClean
            sisaColor = getSisaTwColor(parseFloat(sisaValue));
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
          ? parseFloat(((totalSemua.total / totalSemua.target) * 100).toFixed(2))
          : "-";
      
        const sisaTotal =
          persenTotal === "-"
              ? "-"
              : parseFloat((100 - parseFloat(persenTotal)).toFixed(2));

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
              <td class="p-2 text-right border">${persenTotal === "-" ? "-" : persenTotal + "%"}</td>
              <td class="p-2 text-right border ${sisaColor}">${sisaTotal === "-" ? "-" : sisaTotal + "%"}</td>
              ${renderWarnaCols(summary.unit.sdLalu) + renderWarnaCols(summary.unit.hariIni) + renderWarnaCols(summary.unit.sdHariIni)}
          </tr>`;

        const tableHTML = `
          <div class="space-y-2">
            <h2 class="text-base font-semibold text-gray-700">
              Laporan Tanggal ${fmtTanggal(tgl)}
            </h2>
            <div class="overflow-x-auto bg-white dark:bg-govgray shadow rounded-lg p-4">
              <table class="min-w-full text-xs sm:text-sm text-slate-700 dark:text-slate-100">
                <thead class="bg-gray-100 dark:bg-slate-900/70 text-gray-600 dark:text-slate-100 text-[11px] sm:text-xs uppercase">
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
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700
              [&>tr:nth-child(even)]:bg-slate-50/60 dark:[&>tr:nth-child(even)]:bg-slate-800/40
              [&>tr:hover]:bg-blue-50/80 dark:[&>tr:hover]:bg-slate-700/70">
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
    } catch (err) {
      // overlayText.textContent = "Gagal memuat data Supabase!";
      wrapper.innerHTML = `<p class="text-red-600 text-sm">Terjadi kesalahan saat memuat data.</p>`;
      console.error("❌ Gagal memuat:", err);
    } finally {
      loader.stop(); // ⬅️ hentikan loading di akhir
      // clearInterval(timer); // hentikan animasi saat selesai
      setTimeout(() => overlay.classList.add("hidden"), 500); // beri jeda biar smooth
    }
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
  (function setupPdfMakeExporter() {
    const BTN_ID = "btnExportPDF";
    const blnselect = document.getElementById("bulan");
    const blnPdf = blnselect.value.padStart(2, "0");
    const tahun = tahunSelect.value;
    const upt = "PALANGKA RAYA";
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;

    // Base64 logo kecil Pemprov Kalteng (dari user)
    const LOGO_BASE64 =
      "data:image/jpeg;base64,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";

    // ===== Helpers =====
    const warn = (...a) => console.warn("[rekap-bulanan]", ...a);
    const info = (...a) => console.log("[rekap-bulanan]", ...a);

    // Bangun tiga baris header statis (total 27 kolom)
    function buildHeaderRows() {
      const base = (text, opt = {}) => ({
        text,
        alignment: "center",
        style: "tableHeader",
        valign: "middle",  
        bold: true,
        fillColor: "#dbeafe",
        ...opt,
      });

      const blnPdf = document.getElementById("bulan").value.padStart(2, "0");
      const tw = getTriwulan(blnPdf);
      // 🟦 Baris 1
      const r1 = [
        base("URAIAN", { rowSpan: 3, margin: [0, 16, 0, 0] }),
        base("TARGET", { rowSpan: 3, margin: [0, 16, 0, 0] }),
        base("PENERIMAAN S/D HARI LALU", { rowSpan: 3, margin: [0, 16, 0, 0] }),
        base("PENERIMAAN HARI INI", { colSpan: 2 }),
        {},
        base("REALISASI S/D HARI INI", { rowSpan: 3, margin: [0, 16, 0, 0] }),
        base("100%", { rowSpan: 3, margin: [0, 16, 0, 0] }),
        base(`SISA TW ${tw}`, { rowSpan: 3, margin: [0, 16, 0, 0] }),

        base("JUMLAH UNIT S/D HARI LALU", { colSpan: 9, margin: [0, 5, 0, 0] }),{},{},{},{},{},{},{},{},
        base("JUMLAH UNIT HARI INI", { colSpan: 9, margin: [0, 5, 0, 0] }),{},{},{},{},{},{},{},{},
        base("JUMLAH UNIT S/D HARI INI", { colSpan: 9, margin: [0, 5, 0, 0] }),{},{},{},{},{},{},{},{},
      ];

      // 🟩 Baris 2
      const r2 = [
        {}, {}, {}, // skip 3 dari atas
        base("INDUK", { rowSpan: 2 , margin: [0, 5, 0, 0]}),
        // {}, {}, {}, // skip 3 dari atas
        base("SAMKEL", { rowSpan: 2 , margin: [0, 5, 0, 0]}),
        {}, {}, {},  // REALISASI, %, SISA
        base("RODA 2", { colSpan: 3 }), {}, {},
        base("RODA 3", { colSpan: 3 }), {}, {},
        base("RODA 4", { colSpan: 3 }), {}, {},

        base("RODA 2", { colSpan: 3 }), {}, {},
        base("RODA 3", { colSpan: 3 }), {}, {},
        base("RODA 4", { colSpan: 3 }), {}, {},

        base("RODA 2", { colSpan: 3 }), {}, {},
        base("RODA 3", { colSpan: 3 }), {}, {},
        base("RODA 4", { colSpan: 3 }), {}, {},
      ];

      // 🟨 Baris 3 (warna P, M, K)
      const pmk = (c) => ({
        text: c,
        alignment: "center",
        fillColor:
          c === "P"
            ? "#f3f4f6"
            : c === "M"
            ? "#fee2e2"
            : "#fef08a",
      });

      const r3 = [
        {}, {}, {}, // skip 3
        {}, {}, {}, // skip 3
        {}, {}, // skip 3
        pmk("P"), pmk("M"), pmk("K"),
        // {}, {}, {}, // REALISASI, %, SISA
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
        pmk("P"), pmk("M"), pmk("K"),
      ];

      // pastikan semua baris punya panjang sama (27 kolom)
      const fit = (row) => {
        const copy = [...row];
        while (copy.length < 35)
          copy.push({ text: "", alignment: "center" });
        return copy.slice(0, 35);
      };

      return [fit(r1), fit(r2), fit(r3)];
    }


    function normalizeRowTo27(cells) {
      const row = [...cells];
      while (row.length < 35) row.push({ text: "", alignment: "center" });
      if (row.length > 35) row.length = 35;
      return row;
    }

    function parseHtmlRow(tr) {
      const tds = Array.from(tr.querySelectorAll("th,td"));
      return tds.map((td) => {
        const text = (td.innerText || "").trim();
        const align = td.classList.contains("text-right")
          ? "right"
          : td.classList.contains("text-center")
          ? "center"
          : "left";
        const bold = td.tagName === "TH" || td.classList.contains("font-bold");
        return { text, alignment: align, bold, style: "tableBody" };
      });
    }

    function buildPageHeader(tanggalLabel) {
      return [
        {
          columns: [
            { image: LOGO_BASE64, width: 100},
            {
              stack: [
                { text: "LAPORAN REALISASI PAJAK DAERAH", bold: true, alignment: "center", fontSize: 11 },
                { text: "PROVINSI KALIMANTAN TENGAH", bold: true, alignment: "center", fontSize: 11 },
                { text: "UPT PPD BAPENDA DI PALANGKA RAYA", bold: true, alignment: "center", fontSize: 11 },
                { text: `SAMPAI DENGAN TANGGAL ${tanggalLabel}`, bold: true, alignment: "center",  fontSize: 11 },
              ],
              width: "*",
            },
            { text: "", width: 40 },
          ],
          margin: [0, 0, 0, 10],
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 0.5 }] },
      ];
    }

    function buildDocDefinition() {
      const sections = Array.from(document.querySelectorAll("#rekap-wrapper > div.space-y-2"));
      if (!sections.length) {
        alert("Tidak ada data untuk diekspor.");
        return null;
      }

      const docDefinition = {
        styles: {
          tableHeader: { fontSize: 7, bold: true },
          tableBody: { fontSize: 6 },
        },
        pageOrientation: "landscape",
        pageSize: "FOLIO",
        pageMargins: [20, 50, 20, 40],
        content: [],
        footer: (currentPage, pageCount) => ({
          columns: [
            { text: `Dicetak: ${new Date().toLocaleString("id-ID")}`, alignment: "left", fontSize: 8, margin: [20, 0] },
            { text: `Halaman ${currentPage} / ${pageCount}`, alignment: "right", fontSize: 8, margin: [0, 0, 20, 0] },
          ],
        }),
        defaultStyle: { fontSize: 8 },
      };

      sections.forEach((sec, idx) => {
        const title = sec.querySelector("h2")?.textContent?.trim() || "-";
        const tanggalLabel = title.replace("Laporan Tanggal", "").trim().toUpperCase();
        const table = sec.querySelector("table");
        if (!table) return;

        const headerRows = buildHeaderRows(); // 3 baris, masing2 27 kolom

        const body = [];
        body.push(...headerRows);

        const trs = Array.from(table.querySelectorAll("tr"));
        trs.forEach((tr, i) => {
          if (i < 3) return;
          const rowCells = parseHtmlRow(tr);
          body.push(normalizeRowTo27(rowCells));
        });

        const tableObj = {
          table: { 
            headerRows: 3,
            widths: [
              28, // URAIAN
              50, // TARGET
              50, // PENERIMAAN S/D HARI LALU
              50, // INDUK
              40, // SAMKEL
              50, // REALISASI S/D HARI INI
              24, // 100%
              24, // SISA TW
              "auto", "auto", "auto",  // Roda 2 P/M/K
              "auto", "auto", "auto",  // Roda 3
              "auto", "auto", "auto",  // Roda 4
              "auto", "auto", "auto",  // Jumlah Unit Hari Ini Roda 2
              "auto", "auto", "auto",  // Jumlah Unit Hari Ini Roda 3
              "auto", "auto", "auto",  // Jumlah Unit Hari Ini Roda 4
              "auto", "auto", "auto",  // Jumlah Unit S/D Hari Ini Roda 2
              "auto", "auto", "auto",  // Jumlah Unit S/D Hari Ini Roda 3
              "auto", "auto", "auto",  // Jumlah Unit S/D Hari Ini Roda 4
            ],
            body
          },
          layout: {
            fillColor: (rowIndex, node, columnIndex) => {
              const cellText = node.table.body[rowIndex]?.[0]?.text?.toString().toUpperCase() || "";
              const val = node.table.body[rowIndex]?.[columnIndex]?.text || "";
              if (["P", "M", "K"].includes(val)) {
                return val === "P" ? "#f3f4f6" : val === "M" ? "#fee2e2" : "#fef08a";
              }
              // 🌿 Jika kolom pertama berisi TOTAL → beri hijau muda
              if (cellText.includes("TOTAL")) {
                return "#d1fae5"; // Tailwind green-100
              }
              return null;
            },
          // hLineColor: () => "#e5e7eb",
          // vLineColor: () => "#e5e7eb",
          },
        };

        // === Blok tanda tangan ===
        const tandaTangan = {
          margin: [0, 30, 0, 0],
          columns: [
            { width: 550, text: "" }, // kolom kosong (kiri)
            {
              width: 'auto',
              alignment: 'center',
              stack: [
                { text: "KEPALA UNIT PELAKSANA TEKNIS PELAYANAN PENDAPATAN DAERAH", bold: true },
                { text: "PROVINSI KALIMANTAN TENGAH DI PALANGKA RAYA", bold: true, margin: [0, 0, 0, 5] },

                // QR Code TTD
                {
                  qr: "MAYA MUSTIKA, SP., M.A.P.|NIP. 19730526 200312 2 001",
                  fit: 70,
                  margin: [0, 0, 0, 10]
                },

                { text: "MAYA MUSTIKA, SP., M.A.P.", bold: true },
                { text: "NIP. 19730526 200312 2 001" }
              ]
            }
          ]
        };



        if (idx > 0) docDefinition.content.push({ text: "", pageBreak: "before" });
        // docDefinition.content.push(...buildPageHeader(tanggalLabel), tableObj);
        docDefinition.content.push(
          ...buildPageHeader(tanggalLabel),
          tableObj,tandaTangan
        );

      });

      return docDefinition;
    }

    // ====== Event export ======
    if (typeof pdfMake === "undefined") {
      alert("⚠️ pdfmake belum dimuat. Tambahkan library pdfmake.min.js dan vfs_fonts.js di HTML.");
      return;
    }

    btn.addEventListener("click", () => {
      const docDefinition = buildDocDefinition();
      const blnPdf = document.getElementById("bulan").value.padStart(2, "0");
      if (!docDefinition) return;
      pdfMake.createPdf(docDefinition).download(`Laporan_Realisasi_Bulan_${blnPdf}.pdf`);
    });
  })();
});