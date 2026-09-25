const SELECTOR = {
  button: "[data-connect-button]",
  menu: "[data-connect-menu]",
};

export function initConnectMenu(root = document) {
  const button = root.querySelector(SELECTOR.button);
  const menu = root.querySelector(SELECTOR.menu);

  if (!button || !menu) {
    return () => {};
  }

  const close = ({ restoreFocus = false } = {}) => {
    button.setAttribute("aria-expanded", "false");
    menu.hidden = true;

    if (restoreFocus) {
      button.focus();
    }
  };

  const open = () => {
    button.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    menu.querySelector("a")?.focus();
  };

  const onButtonClick = () => {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    isOpen ? close() : open();
  };

  const onDocumentClick = (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) {
      close();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      close({ restoreFocus: true });
    }
  };

  button.addEventListener("click", onButtonClick);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);

  return () => {
    button.removeEventListener("click", onButtonClick);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeyDown);
  };
}

export function initSectionNavigation({ onHome, onSection }) {
  const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
  const homeLinks = [...document.querySelectorAll('a[href="#home"]')];

  const setCurrentSection = (sectionId = "") => {
    sectionLinks.forEach((link) => {
      if (link.dataset.sectionLink === sectionId) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const sectionId = link.dataset.sectionLink;
      history.pushState({ sectionId }, "", `#${sectionId}`);
      setCurrentSection(sectionId);
      onSection(sectionId);
    });
  });

  homeLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      history.pushState({}, "", "#home");
      setCurrentSection();
      onHome();
    });
  });

  const syncFromLocation = () => {
    const sectionId = window.location.hash.slice(1);

    if (sectionLinks.some((link) => link.dataset.sectionLink === sectionId)) {
      setCurrentSection(sectionId);
      onSection(sectionId);
      return;
    }

    setCurrentSection();
    onHome();
  };

  window.addEventListener("popstate", syncFromLocation);
  syncFromLocation();

  return () => window.removeEventListener("popstate", syncFromLocation);
}
