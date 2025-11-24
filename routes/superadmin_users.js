import express from "express";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { requireLevel } from "../middleware/authMiddleware.js";

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Helper: bersihkan nama kabupaten (hapus prefix KABUPATEN / KOTA)
function cleanKabupatenName(name) {
  if (!name) return "";
  return name
    .replace(/^KABUPATEN\s+/i, "")   // hapus "KABUPATEN "
    .replace(/^KOTA\s+/i, "")        // hapus "KOTA "
    .trim();
}


// Helper snackbar
function setSnackbar(req, message, type = "success") {
    req.session.snackbar = message;
    req.session.snackbarType = type;
}

// 🔹 GET: Halaman Manajemen User (Superadmin)
router.get("/users", requireLevel(["superadmin"]), async (req, res) => {
  try {
    // Ambil semua user
    const { data: users, error: userErr } = await supabase
        .from("esamsat_users")
        .select("id, username, nama, level, upt, status, created_at, updated_at")
        .order("id", { ascending: true });

    if (userErr) {
        console.error("Supabase users error:", userErr);
    }

    // Ambil daftar UPT (join ke kabupaten untuk ambil name)
    // const { data: uptRows, error: uptErr } = await supabase
    //     .from("esamsat_upt")
    //     .select(`
    //         id,
    //         nama,
    //         kabupaten:esamsat_kabupaten!inner (
    //             id,
    //             name
    //         )
    //     `)
    //     .order("kabupaten.id", { ascending: true });
    
    const { data: uptRows, error: uptErr } = await supabase
        .from("esamsat_kabupaten")
        .select(`
            id,
            name
        `)
        .order("id", { ascending: true });

    if (uptErr) {
        console.error("Supabase UPT error:", uptErr);
    }

    // Normalisasi list UPT: pakai name kabupaten sebagai label & value UPT
    const uptList = (uptRows || []).map((row) => ({
        id: row.id,
        nama: cleanKabupatenName(row.name), // biasanya sama dengan nama kabupaten
        //   kabupatenName: row.kabupaten?.name || row.nama,
        kabupatenName: cleanKabupatenName(row.name),
    }));

    const snackbar = req.session.snackbar;
    const snackbarType = req.session.snackbarType;
    delete req.session.snackbar;
    delete req.session.snackbarType;

    // Hilangkan duplicate berdasarkan kabupatenName
    const seen = new Set();
    const uniqueUptList = uptList.filter(u => {
        if (seen.has(u.kabupatenName)) return false;
            seen.add(u.kabupatenName);
        return true;
    });

    res.render("user_manager/superadmin", {
      title: "Manajemen Users",
      subtitle: "Manajemen Users",
      users: users || [],
      uptList: uniqueUptList,
      snackbar,
      snackbarType,
      authUser: req.session.user,
    });
  } catch (err) {
    console.error("GET /superadmin/users error:", err);
    res.status(500).send("Gagal memuat data user.");
  }
});

// 🔹 POST: Create User
router.post("/users/create", requireLevel(["superadmin"]), async (req, res) => {
    try {
        const { username, nama, password, level, upt } = req.body;

        if (!["admin", "operator"].includes(level)) {
            setSnackbar(req, "Level yang diizinkan hanya admin / operator.", "error");
            return res.redirect("/superadmin/users");
        }

        // Cek username sudah dipakai belum
        const { data: existing } = await supabase
        .from("esamsat_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

        if (existing) {
            setSnackbar(req, "Username sudah digunakan.", "error");
            return res.redirect("/superadmin/users");
        }

        const hash = await bcrypt.hash(password, 10);

        const { error: insertErr } = await supabase.from("esamsat_users").insert([
            {
                username,
                nama,
                password_hash: hash,
                level,           // superadmin, admin, operator
                upt,             // isi string, misal "PALANGKA RAYA" (dari name kabupaten)
                status: "true", // default true
            },
        ]);

        if (insertErr) {
            console.error("Insert user error:", insertErr);
            setSnackbar(req, "Gagal membuat user baru.", "error");
        } else {
            setSnackbar(req, "User baru berhasil dibuat.");
        }

        res.redirect("/superadmin/users");
    } catch (err) {
        console.error("POST /users/create error:", err);
        setSnackbar(req, "Terjadi kesalahan saat membuat user.", "error");
        res.redirect("/superadmin/users");
    }
});

// 🔹 POST: Update User (nama, level, upt)
router.post("/users/:id/update", requireLevel(["superadmin"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, level, upt } = req.body;

        if (!["admin", "operator", "superadmin"].includes(level)) {
            setSnackbar(req, "Level tidak valid.", "error");
            return res.redirect("/superadmin/users");
        }

        const { error: updateErr } = await supabase
            .from("esamsat_users")
            .update({
                nama,
                level,
                upt,
            })
            .eq("id", id);

        if (updateErr) {
            console.error("Update user error:", updateErr);
            setSnackbar(req, "Gagal menyimpan perubahan user.", "error");
        } else {
            setSnackbar(req, "Perubahan user berhasil disimpan.");
        }

        res.redirect("/superadmin/users");
    } catch (err) {
        console.error("POST /users/:id/update error:", err);
        setSnackbar(req, "Terjadi kesalahan saat update user.", "error");
        res.redirect("/superadmin/users");
    }
});

// 🔹 POST: Reset Password (set jadi 123456)
router.post(
    "/users/:id/reset-password",
    requireLevel(["superadmin"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const hash = await bcrypt.hash("123456", 10);

            const { error: resetErr } = await supabase
                .from("esamsat_users")
                .update({ password_hash: hash })
                .eq("id", id);

            if (resetErr) {
                console.error("Reset password error:", resetErr);
                setSnackbar(req, "Gagal mereset password.", "error");
            } else {
                setSnackbar(req, "Password berhasil direset (123456).");
            }

            res.redirect("/superadmin/users");
        } catch (err) {
            console.error("POST /users/:id/reset-password error:", err);
            setSnackbar(req, "Terjadi kesalahan saat reset password.", "error");
            res.redirect("/superadmin/users");
        }
    }
);

// 🔹 POST: Toggle Status (aktif / nonaktif)
router.post(
    "/users/:id/toggle-status",
    requireLevel(["superadmin"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body; // "aktif" atau "nonaktif"

            const { error: toggleErr } = await supabase
                .from("esamsat_users")
                .update({ status })
                .eq("id", id);

            if (toggleErr) {
                console.error("Toggle status error:", toggleErr);
                setSnackbar(req, "Gagal mengubah status user.", "error");
            } else {
                setSnackbar(
                req,
                status === "true" ? "User diaktifkan." : "User dinonaktifkan."
                );
            }

            res.redirect("/superadmin/users");
        } catch (err) {
            console.error("POST /users/:id/toggle-status error:", err);
            setSnackbar(req, "Terjadi kesalahan saat mengubah status user.", "error");
            res.redirect("/superadmin/users");
        }
    }
);

// 🔹 POST: Hapus User
router.post(
  "/users/:id/delete",
  requireLevel(["superadmin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Opsional: cegah superadmin menghapus dirinya sendiri
      if (String(req.session.user.id) === String(id)) {
        setSnackbar(req, "Tidak boleh menghapus akun sendiri.", "error");
        return res.redirect("/superadmin/users");
      }

      const { error: delErr } = await supabase
        .from("esamsat_users")
        .delete()
        .eq("id", id);

      if (delErr) {
        console.error("Delete user error:", delErr);
        setSnackbar(req, "Gagal menghapus user.", "error");
      } else {
        setSnackbar(req, "User berhasil dihapus.");
      }

      res.redirect("/superadmin/users");
    } catch (err) {
      console.error("POST /users/:id/delete error:", err);
      setSnackbar(req, "Terjadi kesalahan saat menghapus user.", "error");
      res.redirect("/superadmin/users");
    }
  }
);

export default router;
