async function initPapPab(type) {
    const tableName = `esamsat_${type}`;
    const color = type === "pap" ? "blue" : "green";
    const title = type.toUpperCase();

    const formContainer = document.getElementById("form-container");
    const tableContainer = document.getElementById("table-container");
    const modalContainer = document.getElementById("modal-container");

    // === TOAST WRAPPER GLOBAL ===
    const toastWrapper = document.getElementById("toast-wrapper") || (() => {
        const div = document.createElement("div");
        div.id = "toast-wrapper";
        div.className = "fixed bottom-5 right-5 z-50 space-y-2 flex flex-col items-end";
        document.body.appendChild(div);
        return div;
    })();

    // === AUDIO FEEDBACK (Pling Sound) ===
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        function playSound(type = "info") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === "success") osc.frequency.value = 750;
        else if (type === "error") osc.frequency.value = 220;
        else osc.frequency.value = 440;

        osc.type = "sine";
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    }

    // === SHOW TOAST (sukses/gagal/info) ===
    const showToast = (message, type = "success") => {
        const toast = document.createElement("div");
        const colorClass =
            type === "success"
            ? "bg-green-100 text-green-800 border border-green-400"
            : type === "error"
            ? "bg-red-100 text-red-800 border border-red-400"
            : "bg-blue-100 text-blue-800 border border-blue-400";

        toast.className = `${colorClass} px-4 py-2 rounded-lg shadow-md text-sm w-64 animate-fade-in`;
        toast.textContent = message;
        toastWrapper.appendChild(toast);

        playSound(type);

        setTimeout(() => {
            toast.classList.add("opacity-0", "translate-y-2", "transition-all", "duration-500");
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    };

    // === KONFIRMASI HAPUS (ELEGAN) ===
    const showConfirmToast = (message, onConfirm) => {
        const toast = document.createElement("div");
        toast.className =
            "bg-white border border-red-200 shadow-lg rounded-xl px-4 py-3 w-80 animate-fade-in flex flex-col gap-2";

        toast.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0 text-red-500 text-xl">⚠️</div>
                <div>
                    <p class="text-sm text-gray-800 font-semibold mb-1">Konfirmasi Hapus</p>
                    <p class="text-xs text-gray-600">${message}</p>
                </div>
                </div>
                <div class="flex justify-end gap-2 mt-3">
                    <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition">Batal</button>
                    <button class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition">Hapus</button>
                </div>
        `;

        toastWrapper.appendChild(toast);
        playSound("info");

        const [btnCancel, btnYes] = toast.querySelectorAll("button");

        const removeToast = () => {
            toast.classList.add("opacity-0", "translate-y-2", "transition-all", "duration-300");
            setTimeout(() => toast.remove(), 300);
        };

        btnCancel.onclick = removeToast;
        btnYes.onclick = () => {
            removeToast();
            onConfirm();
        };
    };

    // === ANIMASI FADE-IN (CSS) ===
    const style = document.createElement("style");
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.25s ease-out;
        }
        `;
    document.head.appendChild(style);

    // --- FORM INPUT ---
    formContainer.innerHTML = `
        <form id="formInput" class="bg-white p-5 shadow rounded-lg max-w-lg mb-12">
            <label class="block text-sm font-medium mb-1">Tanggal</label>
            <input type="date" id="tgl" class="border p-2 w-full mb-3 rounded" required>

            <label class="block text-sm font-medium mb-1">UPT Bayar</label>
            <input type="text" id="upt" class="border p-2 w-full mb-3 rounded bg-gray-100" value="PALANGKA RAYA" disabled>

            <label class="block text-sm font-medium mb-1">Jumlah (Rp)</label>
            <input type="text" id="jumlahDisplay" class="border p-2 w-full mb-3 rounded text-right" placeholder="Masukkan nominal..." required>
            <input type="hidden" id="jumlah">

            <label class="block text-sm font-medium mb-1">Keterangan</label>
            <textarea id="ket" class="border p-2 w-full mb-3 rounded" placeholder="Opsional..."></textarea>

            <button type="submit" class="bg-${color}-600 hover:bg-${color}-700 text-white px-4 py-2 rounded">
                💾 Simpan ${title}
            </button>
        </form>
    `;

    // --- Auto isi tanggal hari ini ---
    document.getElementById("tgl").value = new Date().toISOString().split("T")[0];

    // --- Format angka dengan separator ribuan ---
    const jumlahInput = document.getElementById("jumlahDisplay");
    const jumlahHidden = document.getElementById("jumlah");

    jumlahInput.addEventListener("input", e => {
        let raw = e.target.value.replace(/\D/g, "");
        if (!raw) {
        jumlahHidden.value = 0;
        e.target.value = "";
        return;
        }
        jumlahHidden.value = parseInt(raw);
        e.target.value = new Intl.NumberFormat("id-ID").format(parseInt(raw));
    });

    jumlahInput.addEventListener("blur", () => {
        let val = jumlahHidden.value ? parseInt(jumlahHidden.value) : 0;
        jumlahInput.value = val ? new Intl.NumberFormat("id-ID").format(val) : "";
    });

    // --- MODAL EDIT ---
    modalContainer.innerHTML = `
        <div id="editModal" class="hidden fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded shadow-lg w-96 relative">
                <h2 class="text-lg font-semibold mb-3">✏️ Edit Data ${title}</h2>
                <form id="formEdit">
                    <input type="hidden" id="editId">
                    <label class="block text-sm mb-1">Tanggal</label>
                    <input type="date" id="editTanggal" class="border p-2 w-full mb-3 rounded" required>
                    <label class="block text-sm mb-1">UPT Bayar</label>
                    <input type="text" id="editUpt" class="border p-2 w-full mb-3 rounded bg-gray-100" value="PALANGKA RAYA" disabled>
                    <label class="block text-sm mb-1">Jumlah (Rp)</label>
                    <input type="text" id="editJumlahDisplay" class="border p-2 w-full mb-3 rounded text-right" required>
                    <input type="hidden" id="editJumlah">
                    <label class="block text-sm mb-1">Keterangan</label>
                    <textarea id="editKet" style="color: #111827 !important" class="border p-2 w-full mb-3 rounded"></textarea>
                    <div class="flex justify-end gap-2 mt-3">
                        <button type="button" id="cancelEdit" style="color: #111827 !important" class="bg-gray-300 px-3 py-1 rounded">Batal</button>
                        <button type="submit" class="bg-${color}-600 text-white px-3 py-1 rounded">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // --- TABEL DATA ---
    tableContainer.innerHTML = `
        <div class="overflow-x-auto bg-white dark:bg-govgray shadow rounded-lg p-4">
            <div class="p-4 flex flex-wrap gap-2 items-center justify-between">
                <div class="flex gap-2 items-center">
                <input type="date" id="filterTanggal" class="border p-2 rounded text-sm">
                <input type="text" id="filterUpt" placeholder="Cari UPT..." class="border p-2 rounded text-sm">
                <button id="btnFilter" class="bg-${color}-600 hover:bg-${color}-700 text-white px-3 py-1 rounded text-sm">🔍 Filter</button>
                </div>
                <div id="paginationInfo" class="text-sm text-gray-600"></div>
            </div>

            <table class="min-w-full text-xs sm:text-sm text-slate-700 dark:text-slate-100">
                <thead class="bg-${color}-100 dark:bg-slate-900/70 text-${color}-800 dark:text-${color}-100 text-[11px] sm:text-xs uppercase">
                <tr>
                    <th class="border p-2 text-left">Tanggal</th>
                    <th class="border p-2 text-left">UPT</th>
                    <th class="border p-2 text-right">Jumlah (Rp)</th>
                    <th class="border p-2 text-left">Keterangan</th>
                    <th class="border p-2 text-center w-32">Aksi</th>
                </tr>
                </thead>
                <tbody id="dataTableBody" class="
              divide-y divide-gray-100 dark:divide-slate-700
              [&>tr:nth-child(even)]:bg-slate-50/60 dark:[&>tr:nth-child(even)]:bg-slate-800/40
              [&>tr:hover]:bg-blue-50/80 dark:[&>tr:hover]:bg-slate-700/70
            "></tbody>
            </table>

            <div class="flex justify-between items-center p-3 text-sm">
                <button id="prevPage" class="bg-gray-600 hover:bg-gray-800 px-3 py-1 rounded">⬅️ Sebelumnya</button>
                <span id="pageInfo" class="text-gray-600"></span>
                <button id="nextPage" class="bg-gray-600 hover:bg-gray-800 px-3 py-1 rounded">Berikutnya ➡️</button>
            </div>
        </div>
    `;

    const tbody = document.getElementById("dataTableBody");
    const modal = document.getElementById("editModal");
    const paginationInfo = document.getElementById("pageInfo");

    const cfg = await fetch("/config/supabase.json").then(r => r.json());
    const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_KEY);

    let currentPage = 1;
    const perPage = 10;
    let filterTanggal = "";
    let filterUpt = "";

    // --- LOAD DATA ---
    async function loadData() {
        tbody.innerHTML = `<tr><td colspan="5" class="p-2 text-center text-gray-400">⏳ Memuat...</td></tr>`;

        let query = sb.from(tableName).select("*").order("created_at", { ascending: false });
        if (filterTanggal) query = query.eq("tanggal", filterTanggal);
        if (filterUpt) query = query.ilike("upt_bayar", `%${filterUpt}%`);

        const { data, error } = await query.range((currentPage - 1) * perPage, currentPage * perPage - 1);

        if (error) return (tbody.innerHTML = `<tr><td colspan='5' class='p-2 text-center text-red-600'>${error.message}</td></tr>`);
        if (!data.length) return (tbody.innerHTML = "<tr><td colspan='5' class='p-2 text-center text-gray-400'>Belum ada data.</td></tr>");

        tbody.innerHTML = data
        .map(
            d => `
            <tr class="hover:bg-gray-50">
                <td class="border p-2">${new Date(d.tanggal).toLocaleDateString("id-ID")}</td>
                <td class="border p-2">${d.upt_bayar}</td>
                <td class="border p-2 text-right">${new Intl.NumberFormat("id-ID").format(d.jumlah)}</td>
                <td class="border p-2">${d.keterangan || "-"}</td>
                <td class="border p-2 text-center">
                    <button class="text-${color}-600 hover:underline" onclick="editData('${d.id}','${d.tanggal}','${d.jumlah}','${d.keterangan || ""}')">✏️</button>
                    <button class="text-red-600 hover:underline ml-2" onclick="hapusData('${d.id}')">🗑️</button>
                </td>
            </tr>`
        )
        .join("");

        paginationInfo.textContent = `Halaman ${currentPage}`;
    }

    // --- FILTER ---
    document.getElementById("btnFilter").onclick = () => {
        filterTanggal = document.getElementById("filterTanggal").value;
        filterUpt = document.getElementById("filterUpt").value;
        currentPage = 1;
        loadData();
    };

    document.getElementById("nextPage").onclick = () => {
        currentPage++;
        loadData();
    };
    document.getElementById("prevPage").onclick = () => {
        if (currentPage > 1) {
        currentPage--;
        loadData();
        }
    };

    // === FORM TAMBAH DATA ===
    document.getElementById("formInput").addEventListener("submit", async e => {
        e.preventDefault();
        const data = {
            tanggal: document.getElementById("tgl").value,
            upt_bayar: document.getElementById("upt").value,
            jumlah: parseFloat(document.getElementById("jumlah").value),
            keterangan: document.getElementById("ket").value || null,
        };
        const { error } = await sb.from(tableName).insert([data]);
        if (error) {
            showToast("❌ Gagal menyimpan data!", "error");
        } else {
            showToast("✅ Data berhasil disimpan!", "success");
            e.target.reset();
            document.getElementById("tgl").value = new Date().toISOString().split("T")[0];
            loadData();
        }
    });
    // === HAPUS DATA (DENGAN KONFIRMASI TAILWIND) ===
    window.hapusData = async id => {
        showConfirmToast("Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.", async () => {
            const { error } = await sb.from(tableName).delete().eq("id", id);
            if (error) {
                showToast("❌ Gagal menghapus data!", "error");
            } else {
                showToast("🗑️ Data berhasil dihapus", "success");
                loadData();
            }
        });
    };

    // === EDIT DATA ===
    document.getElementById("formEdit").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("editId").value;
        const update = {
            tanggal: document.getElementById("editTanggal").value,
            jumlah: parseFloat(document.getElementById("editJumlah").value),
            keterangan: document.getElementById("editKet").value || null,
        };
        const { error } = await sb.from(tableName).update(update).eq("id", id);
        if (error) {
            showToast("❌ Gagal memperbarui data!", "error");
        } else {
            showToast("✏️ Data berhasil diperbarui", "success");
            modal.classList.add("hidden");
            loadData();
        }
    });


    // --- EDIT DATA ---
    window.editData = (id, tanggal, jumlah, ket) => {
        document.getElementById("editId").value = id;
        document.getElementById("editTanggal").value = tanggal;
        document.getElementById("editJumlahDisplay").value = new Intl.NumberFormat("id-ID").format(jumlah);
        document.getElementById("editJumlah").value = jumlah;
        document.getElementById("editKet").value = ket;
        modal.classList.remove("hidden");
    };

    document.getElementById("cancelEdit").onclick = () => modal.classList.add("hidden");

    // --- FORMAT JUMLAH DI MODAL EDIT ---
    const editJumlahDisplay = document.getElementById("editJumlahDisplay");
    const editJumlahHidden = document.getElementById("editJumlah");

    editJumlahDisplay.addEventListener("input", e => {
        let raw = e.target.value.replace(/\D/g, "");
        if (!raw) {
        editJumlahHidden.value = 0;
        e.target.value = "";
        return;
        }
        editJumlahHidden.value = parseInt(raw);
        e.target.value = new Intl.NumberFormat("id-ID").format(parseInt(raw));
    });

    

        loadData();
    }
