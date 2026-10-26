// Loaded in <head> so the saved theme applies before the first paint.
(function () {
  const KEY = "subpipe:theme";
  const MODES = ["auto", "light", "dark"];
  const LABELS = { auto: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };
  const root = document.documentElement;

  function read() {
    try {
      const mode = localStorage.getItem(KEY);
      return MODES.includes(mode) ? mode : "auto";
    } catch {
      return "auto";
    }
  }

  function apply(mode) {
    if (mode === "auto") root.removeAttribute("data-theme");
    else root.dataset.theme = mode;
  }

  let mode = read();
  apply(mode);

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeBtn");
    btn.textContent = LABELS[mode];
    btn.addEventListener("click", () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      apply(mode);
      btn.textContent = LABELS[mode];
      try {
        if (mode === "auto") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch {}
    });
  });
})();
