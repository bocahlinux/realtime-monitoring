(function () {
  const STORAGE_KEY = "theme";

  function applyTheme(mode) {
    const html = document.documentElement;
    if (mode === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }

    // Ganti icon di tombol
    const btn = document.getElementById("darkToggle");
    if (btn) {
      const moon = btn.querySelector(".icon-moon");
      const sun = btn.querySelector(".icon-sun");
      if (mode === "dark") {
        if (moon) moon.classList.add("hidden");
        if (sun) sun.classList.remove("hidden");
      } else {
        if (sun) sun.classList.add("hidden");
        if (moon) moon.classList.remove("hidden");
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;

    // Fallback ke sistem
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  function setTheme(mode) {
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  }

  function toggleTheme() {
    const current = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
  }

  // Inisialisasi
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getPreferredTheme());

    const btn = document.getElementById("darkToggle");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleTheme();
      });
    }
  });

  // Kalau user ganti theme OS, dan kita tidak override di localStorage
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
})();
