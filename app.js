import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Set EJS sebagai template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Simulasi data laporan pajak
let data = [
  {
    uraian: "PKB",
    target: 132193954500,
    sdLalu: 50922752000,
    hariIni: 87192400,
    unit: { roda2: 28622, roda4: 973, online: 54 }
  },
  {
    uraian: "BBN-KB",
    target: 69528372000,
    sdLalu: 57367100,
    hariIni: 0,
    unit: { roda2: 0, roda4: 0, online: 0 }
  },
];

// Route utama: tampilkan laporan
app.get("/", (req, res) => {
  res.render("laporan", {
    tanggal: new Date().toLocaleDateString("id-ID"),
    data,
    activePage: "dashboard",
  });
});

// API endpoint untuk update otomatis per hari
app.get("/api/data", (req, res) => {
  data = data.map((d) => ({
    ...d,
    hariIni: Math.floor(Math.random() * 2000000),
  }));
  res.json(data);
});

app.get("/config/supabase.json", (req, res) => {
    res.set("Cache-Control", "public, max-age=60");
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    });
});

app.get("/laporan/realtime", (req, res) => {
  res.render("laporan/laporan_realtime", {
    title: "Laporan Transaksi Harian (Realtime)",
    activePage: "realtime",
  });
});

app.get("/laporan/rekap", (req, res) => {
  const bulanNama = new Date().toLocaleString("id-ID", { month: "long" });
  const tahun = new Date().getFullYear();
  res.render("laporan/laporan_rekap", { bulanNama, tahun });
});

app.get("/laporan/rekap-bulanan", (req, res) => {
  res.render("laporan/laporan_rekap_bulanan", {
    title: "Laporan Rekap Bulanan e-Samsat",
    activePage: "rekap-bulanan",
  });
});

app.get("/transaksi/input-pap", (req, res) => {
  res.render("transaksi/transaksi_pap", {
    title: "Transaksi PAP",
    activePage: "transaksi-pap",
  });
});

app.get("/transaksi/input-pab", (req, res) => {
  res.render("transaksi/transaksi_pab", {
    title: "Transaksi PAB",
    activePage: "transaksi-pab",
  });
});




app.use(express.static("public"));

app.listen(process.env.PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${process.env.PORT || port}`);
});
