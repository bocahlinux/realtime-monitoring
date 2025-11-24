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

// Helper snackbar
function setSnackbar(req, message, type = "success") {
  req.session.snackbar = message;
  req.session.snackbarType = type;
}

router.get("/", requireLevel(["admin"]), async (req, res) => {
    const adminUpt = req.session.user.upt;

    const { data: users } = await supabase
        .from("esamsat_users")
        .select("*")
        .eq("upt", adminUpt)
        .eq("level", "operator")
        .order("created_at", { ascending: false });

    const snackbar = req.session.snackbar;
    const snackbarType = req.session.snackbarType;
    delete req.session.snackbar;
    delete req.session.snackbarType;

    // ambil nama kabupaten berdasarkan UPT FK
    let kabupatenName = null;

    if (req.session.user.upt) {
        const { data } = await supabase
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
    res.render("user_manager/admin", {
        title: "Manajemen Users",
        subtitle: "Manajemen Users",
        snackbar,
        snackbarType,
        users: users || [],
        adminUpt,
        activePage : "admin_users",
    });
});

/**
 * POST Tambah user operator
 */
router.post("/create", requireLevel(["admin"]), async (req, res) => {
    try {
        const { username, nama, password } = req.body;
        const adminUpt = req.session.user.upt;

        // Cek username sudah dipakai belum
        const { data: existing } = await supabase
        .from("esamsat_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

        if (existing) {
            setSnackbar(req, "Username sudah digunakan.", "error");
            return res.redirect("/admin/users");
        }

        const password_hash = await bcrypt.hash(password, 10);

        const { error: insertErr } = await supabase.from("esamsat_users").insert([
            {
                username,
                nama,
                password_hash,
                level: "operator",
                upt: adminUpt,
                status: true,
            },
        ]);

        if (insertErr) {
            console.error("Insert user error:", insertErr);
            setSnackbar(req, "Gagal membuat user baru.", "error");
        } else {
            setSnackbar(req, "User baru berhasil dibuat.");
        }

        res.redirect("/admin/users");
    } catch (err) {
        console.error("POST /users/create error:", err);
        setSnackbar(req, "Terjadi kesalahan saat membuat user.", "error");
        res.redirect("/admin/users");
    }
});

/**
 * POST Update nama user
 */
router.post("/:id/update", requireLevel(["admin"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { nama } = req.body;
        const adminUpt = req.session.user.upt;

        const { error: updateErr } = await supabase
            .from("esamsat_users")
            .update({nama})
            .eq("id", id)
            .eq("upt", adminUpt)
            .eq("level", "operator");

        if (updateErr) {
            console.error("Update user error:", updateErr);
            setSnackbar(req, "Gagal menyimpan perubahan user.", "error");
        } else {
            setSnackbar(req, "Perubahan user berhasil disimpan.");
        }

        res.redirect("/admin/users");
    } catch (err) {
        console.error("POST /users/:id/update error:", err);
        setSnackbar(req, "Terjadi kesalahan saat update user.", "error");
        res.redirect("/admin/users");
    }
});

/**
 * POST Toggle status
 */
router.post("/:id/toggle-status", requireLevel(["admin"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;   
        const adminUpt = req.session.user.upt;

        const { error: toggleErr } = await supabase
            .from("esamsat_users")
            .update({ status })
            .eq("id", id)
            .eq("upt", adminUpt)
            .eq("level", "operator");

        if (toggleErr) {
            console.error("Toggle status error:", toggleErr);
            setSnackbar(req, "Gagal mengubah status user.", "error");
        } else {
            setSnackbar(
            req,
            status === "true" ? "User diaktifkan." : "User dinonaktifkan."
            );
        }
        res.redirect("/admin/users");
    } catch (err) {
        console.error("POST /users/:id/toggle-status error:", err);
        setSnackbar(req, "Terjadi kesalahan saat mengubah status user.", "error");
        res.redirect("/admin/users");
    }
});

/**
 * POST Reset password user
 */
router.post(
    "/:id/reset-password",
    requireLevel(["admin"]), 
    async (req, res) => {
        const { id } = req.params;
        const adminUpt = req.session.user.upt;
    
        const newPass = "123456";
        const password_hash = await bcrypt.hash(newPass, 10);

        try {
            const { error: resetErr } = await supabase
                .from("esamsat_users")
                .update({ password_hash })
                .eq("id", id)
                .eq("upt", adminUpt)
                .eq("level", "operator");

            if (resetErr) {
                console.error("Reset password error:", resetErr);
                setSnackbar(req, "Gagal mereset password.", "error");
            } else {
                setSnackbar(req, "Password berhasil direset (operator123).");
            }

            res.redirect("/admin/users");
        } catch (err) {
            console.error("POST /users/:id/reset-password error:", err);
            setSnackbar(req, "Terjadi kesalahan saat reset password.", "error");
            res.redirect("/admin/users");
        }
    }
);

export default router;
