const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-nav#primary-nav");
const themeToggle = document.querySelector("#theme-toggle");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const root = document.documentElement;

function currentTheme() {
  return root.dataset.theme || (systemTheme.matches ? "dark" : "light");
}

function updateThemeControl() {
  if (!themeToggle) return;
  const dark = currentTheme() === "dark";
  const japanese = root.lang.toLowerCase().startsWith("ja");
  const label = dark ? (japanese ? "ライト" : "Light") : (japanese ? "ダーク" : "Dark");
  const action = dark
    ? (japanese ? "ライトテーマに切り替え" : "Switch to light mode")
    : (japanese ? "ダークテーマに切り替え" : "Switch to dark mode");
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.setAttribute("aria-label", action);
  themeToggle.querySelector("[data-theme-label]").textContent = label;
  themeToggle.querySelector("[data-theme-icon]").textContent = dark ? "☀" : "☾";
  if (themeMeta) themeMeta.content = dark ? "#171719" : "#fafafa";
}

if (themeToggle) {
  updateThemeControl();
  themeToggle.hidden = false;
  themeToggle.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    try {
      localStorage.setItem("sumire-theme", nextTheme);
    } catch {
      // The selected theme still applies for this page view.
    }
    updateThemeControl();
  });
  systemTheme.addEventListener("change", () => {
    if (!root.dataset.theme) updateThemeControl();
  });
}

if (menuButton && navigation) {
  menuButton.closest(".site-header").classList.add("nav-ready");
  const japanese = root.lang.toLowerCase().startsWith("ja");
  const menuLabel = (open) => japanese
    ? (open ? "メニューを閉じる" : "メニューを開く")
    : (open ? "Close menu" : "Open menu");
  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", menuLabel(false));
    navigation.classList.remove("is-open");
  };
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", menuLabel(open));
    navigation.classList.toggle("is-open", open);
  });
  navigation.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.classList.contains("is-open")) {
      closeMenu();
      menuButton.focus();
    }
  });
}

// Progressive enhancement: content is visible even without observer support.
(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const marketing = document.querySelector(".marketing-page");
  if (!marketing) return;

  const sections = [...marketing.querySelectorAll(".benefit, .install-heading, .content-title, .edition-panel")];
  const seen = new WeakSet();
  let observer;

  function configureMotion() {
    observer?.disconnect();
    if (reducedMotion.matches) {
      sections.forEach(section => section.classList.remove("reveal-enter"));
      return;
    }
    if (!("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen.add(entry.target);
        entry.target.classList.add("reveal-enter");
        entry.target.addEventListener("animationend", () => entry.target.classList.remove("reveal-enter"), { once: true });
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });
    sections.forEach(section => { if (!seen.has(section)) observer.observe(section); });
  }

  reducedMotion.addEventListener("change", configureMotion);
  configureMotion();
})();

// Real app screenshots, progressively enhanced with user-controlled previews.
(() => {
  const showcase = document.querySelector("[data-keyboard-preview]");
  if (!showcase) return;
  const controls = showcase.querySelector(".preview-controls");
  const buttons = [...controls.querySelectorAll("[data-preview]")];
  const frames = [...showcase.querySelectorAll(".preview-frame")];
  const caption = showcase.querySelector(".preview-caption");
  const japanese = root.lang.toLowerCase().startsWith("ja");
  const loads = new WeakMap();
  let selection = 0;

  function loadImage(image) {
    if (loads.has(image)) return loads.get(image);
    const promise = new Promise((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("preview_unavailable")); };
      image.addEventListener("load", loaded);
      image.addEventListener("error", failed);
      if (image.dataset.src) image.src = image.dataset.src;
      else if (image.complete && !image.naturalWidth) image.src = image.getAttribute("src");
      if (image.complete && image.naturalWidth > 0) loaded();
    });
    loads.set(image, promise);
    promise.catch(() => loads.delete(image));
    return promise;
  }

  async function select(button) {
    const request = ++selection;
    const target = showcase.querySelector(`#preview-${button.dataset.preview}`);
    showcase.setAttribute("aria-busy", "true");
    try {
      await loadImage(target.querySelector("img"));
      // Slow image loads must never overwrite a more recent choice.
      if (request !== selection) return;
      frames.forEach(frame => {
        const active = frame === target;
        frame.classList.toggle("is-active", active);
        frame.setAttribute("aria-hidden", String(!active));
      });
      buttons.forEach(option => option.setAttribute("aria-pressed", String(option === button)));
      caption.textContent = button.dataset.caption;
    } catch {
      if (request !== selection) return;
      caption.textContent = japanese
        ? "画面を読み込めませんでした。もう一度選択してください。"
        : "Couldn't load this preview. Select it again to retry.";
    } finally {
      if (request === selection) showcase.setAttribute("aria-busy", "false");
    }
  }

  buttons.forEach(button => button.addEventListener("click", () => select(button)));
  controls.addEventListener("keydown", event => {
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    let next;
    if (event.key === "ArrowRight") next = (current + 1) % buttons.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
    select(buttons[next]);
  });
  controls.hidden = false;
  // Alternate screens load after the initial page and never block the hero.
  const preload = () => requestAnimationFrame(() => {
    frames.slice(1).forEach(frame => loadImage(frame.querySelector("img")).catch(() => {}));
  });
  if (document.readyState === "complete") preload();
  else window.addEventListener("load", preload, { once: true });
})();
