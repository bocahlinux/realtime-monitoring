import express from "express";
import session from "express-session";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import profilRoutes from "./routes/profil.js";
import authRoutes from "./routes/auth.js";
import superadminUserRoutes from "./routes/superadmin_users.js";
import adminUsersRoute from "./routes/admin_users.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "skjlkjIOJLKJL@J!!JLK<>???*(*()*098908908098",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 6 }, // 6 jam
  })
);

// middleware keamanan ringan
app.use(async (req, res, next) => {
  if (!req.session.user) {
    res.locals.authUser = null;
    return next();
  }

  // ambil nama kabupaten berdasarkan UPT FK
  let kabupatenName = null;

  if (req.session.user.upt) {
    const { data } = await sb
      .from("esamsat_upt")
      .select(`
        id,
        nama,
        kabupaten_id,
        kabupaten:esamsat_kabupaten!inner (
          id,
          name
        )
      `)
      .eq("nama", req.session.user.upt)
      .single();

    kabupatenName = data?.kabupaten?.name || null;
  }


  res.locals.authUser = {
    ...req.session.user,
    kabupatenName
  };

  next();
});
// app.use((req, res, next) => {
//   res.setHeader("X-Frame-Options", "DENY");
//   res.setHeader("X-Content-Type-Options", "nosniff");
//   res.setHeader("X-XSS-Protection", "1; mode=block");
//   res.locals.authUser = req.session.user || null;
//   next();
// });



// Set EJS sebagai template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// app.use(express.static(path.join(__dirname, "public")));

app.use("/auth", authRoutes); //routing untuk autentikasi
app.use("/profil", profilRoutes); //routing untuk profil
app.use("/superadmin", superadminUserRoutes); //routing untuk manajemen user superadmin
app.use("/admin/users", adminUsersRoute); //routing untuk manajemen user admin

// Halaman Dashboard
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("dashboard", {
    title: "Dashboard",
    subtitle: "DASHBOARD",
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
  if (!req.session.user) return res.redirect("/auth/login");
  res.set("Cache-Control", "public, max-age=60");
  res.json({
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      PORT: process.env.PORT || 3000,
      NODE_ENV: process.env.NODE_ENV || "development",
      SESSION_SECRET: process.env.SESSION_SECRET || "skjlkjIOJLKJL@J!!JLK<>???",
  });
});

app.get("/laporan/realtime", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("laporan/laporan_realtime", {
    title: "Laporan Realtime",
    subtitle: "REALTIME",
    user: req.session.user,
    activePage: "realtime",
  });
});

app.get("/laporan/rekap-bulanan", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("laporan/laporan_rekap_bulanan", {
    title: "Laporan Rekap",
    subtitle: "REKAP BULANAN",
    user: req.session.user,
    activePage: "rekap-bulanan",
  });
});

app.get("/transaksi/input-pap", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("transaksi/transaksi_pap", {
    title: "Transaksi PAP",
    subtitle: "TRANSAKSI PAP",
    user: req.session.user,
    activePage: "transaksi-pap",
  });
});

app.get("/transaksi/input-pab", (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.render("transaksi/transaksi_pab", {
    title: "Transaksi PAB",
    subtitle: "TRANSAKSI PAB",
    user: req.session.user,
    activePage: "transaksi-pab",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(process.env.PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${process.env.PORT || PORT}`);
});
