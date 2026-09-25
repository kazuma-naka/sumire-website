const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-nav#primary-nav");

if (menuButton && navigation) {
  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "メニューを開く");
    navigation.classList.remove("is-open");
  };
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
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
