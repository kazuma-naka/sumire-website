(() => {
  const root = document.documentElement;
  try {
    const savedTheme = localStorage.getItem("sumire-theme");
    if (savedTheme === "light" || savedTheme === "dark") root.dataset.theme = savedTheme;
  } catch {
    // The system theme still works if storage is unavailable.
  }
})();
