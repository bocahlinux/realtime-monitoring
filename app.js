import express from "express";
import session from "express-session";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "skjlkjIOJLKJL@J!!JLK<>???*(*()*098908908098",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 6 }, // 6 jam
  })
);

// Set EJS sebagai template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
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

app.use("/auth", authRoutes);

// app.get("/", (req, res) => {
//   // res.render("laporan", {
//   //   tanggal: new Date().toLocaleDateString("id-ID"),
//   //   data,
//   //   activePage: "dashboard",
//   // });
//   res.render("laporan/laporan_realtime", {
//     //     title: "Laporan Transaksi Harian (Realtime)",
//     activePage: "dashboard",
//   });
// });

app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("laporan/laporan_realtime", {
    title: "Laporan Transaksi Harian (Realtime)",
    user: req.session.user,
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
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("laporan/laporan_realtime", {
    title: "Laporan Transaksi Harian (Realtime)",
    activePage: "realtime",
  });
});

app.get("/laporan/rekap", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  const bulanNama = new Date().toLocaleString("id-ID", { month: "long" });
  const tahun = new Date().getFullYear();
  res.render("laporan/laporan_rekap", { 
    bulanNama, tahun 
  });
});

app.get("/laporan/rekap-bulanan", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("laporan/laporan_rekap_bulanan", {
    title: "Laporan Rekap Bulanan e-Samsat",
    activePage: "rekap-bulanan",
  });
});

app.get("/transaksi/input-pap", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("transaksi/transaksi_pap", {
    title: "Transaksi PAP",
    activePage: "transaksi-pap",
  });
});

app.get("/transaksi/input-pab", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("transaksi/transaksi_pab", {
    title: "Transaksi PAB",
    activePage: "transaksi-pab",
  });
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${process.env.PORT || port}`);
});
