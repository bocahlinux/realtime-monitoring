import express from "express";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// const supabase = createClient(
//   "https://YOUR_SUPABASE_URL.supabase.co",
//   "YOUR_SUPABASE_ANON_KEY"
// );

// 🔹 GET Login Page
router.get("/login", (req, res) => {
  if (!req.session.user) {
    return res.render("login", { error: null });
  }else{
    return res.redirect("/");
  }
//   res.render("login", { error: null });
});

// 🔹 POST Login Process
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("login", { error: "Username dan password wajib diisi" });
    }

    // Cari user di Supabase
    const { data: userData, error } = await supabase
      .from("esamsat_users")
      .select("*")
      .eq("username", username)
      .single();
    // console.log("🔍 Query result:", { userData, error, username, password });
    if (error || !userData) {
      return res.render("login", { error: "Username atau password salah" });
    }

    // Bandingkan password dengan hash bcrypt
    const isValid = await bcrypt.compare(password, userData.password_hash);
    if (!isValid) {
      return res.render("login", { error: "Username atau password salah" });
    }

    // Simpan session
    req.session.user = {
      id: userData.id,
      username: userData.username,
      nama: userData.nama,
      level: userData.level,
      upt: userData.upt,
    };

    // console.log("✅ LOGIN SUCCESS:", req.session.user);
    res.redirect("/");
  } catch (err) {
    console.error("Login Error:", err);
    res.render("login", { error: "Terjadi kesalahan pada server" });
  }
});

// 🔹 GET Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/auth/login");
  });
});

export default router;
