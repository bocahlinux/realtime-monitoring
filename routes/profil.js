import express from "express";
import bcrypt from "bcrypt";
import pkg from "pg";
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool();
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);


// Middleware login
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

// =============================
// GET halaman profil
// =============================
router.get("/", requireLogin, async (req, res) => {
  const user = req.session.user;
  const snackbar = req.session.snackbar;
  const snackbarType = req.session.snackbarType;

  // hapus setelah ditampilkan
  delete req.session.snackbar;
  delete req.session.snackbarType;

  const { data, error } = await supabase
    .from("esamsat_users")
    .select("username, nama, created_at")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Supabase Fetch Error:", error);
  }

  res.render("profil", {
    title: "Profil Pengguna",
    // user: data,
    user: {
      ...data,
      created_at: data?.created_at ? new Date(data.created_at) : null,
    },
    subtitle: "PROFIL",
    // user: req.session.user,
    activePage: "profil",
    snackbar,
    snackbarType
  });
});

// =============================
// POST update nama
// =============================
router.post("/update", requireLogin, async (req, res) => {
  const { nama } = req.body;
  const user = req.session.user;

  const { error } = await supabase
    .from("esamsat_users")
    .update({ nama })
    .eq("id", user.id);

  if (error) {
    console.error("Supabase Update Error:", error);
  }

  req.session.user.nama = nama;
  req.session.snackbar = "Profil berhasil diperbarui";
  res.redirect("/profil");
});

// =============================
// POST update password
// =============================
router.post("/password", requireLogin, async (req, res) => {
  const { old_password, new_password } = req.body;
  const user = req.session.user;

  // 1. Ambil hash password lama dari Supabase
  const { data, error: fetchErr } = await supabase
    .from("esamsat_users")
    .select("password_hash")
    .eq("id", user.id)
    .single();

  if (fetchErr || !data) {
    return res.render("profil", {
      title: "Profil Pengguna",
      subtitle: "PROFIL",
      user,
      error: "Gagal mengambil data password!",
    });
  }

  const passwordHash = data.password_hash;

  // 2. Cek cocok atau tidak
  const match = await bcrypt.compare(old_password, passwordHash);
  if (!match) {
    req.session.snackbar = "Password lama salah!";
    req.session.snackbarType = "error";
    return res.render("profil", {
      title: "Profil Pengguna",
      subtitle: "PROFIL",
      user,
      error: "Password lama salah!",
    });
  }

  // 3. Hash password baru
  const encrypted = await bcrypt.hash(new_password, 10);

  // 4. Update password
  const { error: updateErr } = await supabase
    .from("esamsat_users")
    .update({ password_hash: encrypted })
    .eq("id", user.id);

  if (updateErr) {
    req.session.snackbar = "Password gagal diupdate!";
    req.session.snackbarType = "error";
    console.error("Update Password Error:", updateErr);
  }
  req.session.snackbar = "Password berhasil diubah";
  res.redirect("/profil");
});

export default router;
// module.exports = router;
