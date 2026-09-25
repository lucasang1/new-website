const PORTFOLIO_RECORDS = new Set(["experiences", "projects", "articles"]);

export function createPortfolioReveal({ root }) {
  const card = root.querySelector("[data-portfolio-reveal-card]");
  const inner = root.querySelector("[data-portfolio-reveal-inner]");
  const front = root.querySelector("[data-portfolio-reveal-front]");
  const panels = [...root.querySelectorAll("[data-portfolio-panel]")];
  const backButtons = [...root.querySelectorAll("[data-portfolio-back]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let revealId = 0;
  let activeSource = null;

  const setSourceVisibility = (source, visible) => {
    if (source) source.style.visibility = visible ? "" : "hidden";
  };

  const close = () => {
    revealId += 1;
    card.getAnimations().forEach((animation) => animation.cancel());
    inner.getAnimations().forEach((animation) => animation.cancel());
    setSourceVisibility(activeSource, true);
    activeSource = null;
    root.classList.remove("is-active", "is-expanded", "is-flipped", "is-closing");
    root.setAttribute("aria-hidden", "true");
    front.replaceChildren();
  };

  const show = async (recordId, source) => {
    if (!PORTFOLIO_RECORDS.has(recordId) || !source) return;

    close();
    const token = revealId;
    const sourceRect = source.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const headerHeight = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--header-height")) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const finalSize = Math.min(
      viewportWidth - 32,
      (viewportHeight - headerHeight) * 0.84,
      800,
    );
    const finalLeft = (viewportWidth - finalSize) / 2;
    const finalTop = headerHeight + Math.max(16, (viewportHeight - headerHeight - finalSize) / 2);
    const startScale = sourceRect.width / finalSize;
    const startX = sourceRect.left - finalLeft;
    const startY = sourceRect.top - finalTop;

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.portfolioPanel !== recordId;
    });

    const vinyl = source.cloneNode();
    vinyl.removeAttribute("class");
    vinyl.removeAttribute("style");
    vinyl.setAttribute("aria-hidden", "true");
    front.replaceChildren(vinyl);
    Object.assign(card.style, {
      left: `${finalLeft}px`,
      top: `${finalTop}px`,
      width: `${finalSize}px`,
      height: `${finalSize}px`,
    });

    activeSource = source;
    setSourceVisibility(source, false);
    root.classList.add("is-active");
    root.setAttribute("aria-hidden", "false");

    if (reducedMotion.matches || typeof card.animate !== "function") {
      root.classList.add("is-expanded", "is-flipped");
      return;
    }

    const expansion = card.animate([
      {
        transform: `translate(${startX}px, ${startY}px) scale(${startScale})`,
      },
      {
        transform: "translate(0, 0) scale(1)",
      },
    ], {
      duration: 900,
      easing: "cubic-bezier(0.2, 0.72, 0.2, 1)",
      fill: "forwards",
    });

    const flip = inner.animate([
      { transform: "rotateY(0deg)" },
      { transform: "rotateY(180deg)" },
    ], {
      duration: 900,
      easing: "cubic-bezier(0.65, 0, 0.2, 1)",
      fill: "forwards",
    });

    await Promise.all([
      expansion.finished.catch(() => {}),
      flip.finished.catch(() => {}),
    ]);
    if (token !== revealId) return;
    root.classList.add("is-expanded", "is-flipped");
    expansion.cancel();
    flip.cancel();
  };

  const hide = async () => {
    const source = activeSource;
    if (!source || root.classList.contains("is-closing")) return;

    if (reducedMotion.matches || typeof card.animate !== "function") {
      close();
      source.focus();
      return;
    }

    const token = ++revealId;
    const sourceRect = source.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const endScale = sourceRect.width / cardRect.width;
    const endX = sourceRect.left - cardRect.left;
    const endY = sourceRect.top - cardRect.top;

    root.classList.add("is-closing");

    const contraction = card.animate([
      { transform: "translate(0, 0) scale(1)" },
      { transform: `translate(${endX}px, ${endY}px) scale(${endScale})` },
    ], {
      duration: 900,
      easing: "cubic-bezier(0.2, 0.72, 0.2, 1)",
      fill: "forwards",
    });

    const flip = inner.animate([
      { transform: "rotateY(180deg)" },
      { transform: "rotateY(0deg)" },
    ], {
      duration: 900,
      easing: "cubic-bezier(0.65, 0, 0.2, 1)",
      fill: "forwards",
    });

    await Promise.all([
      contraction.finished.catch(() => {}),
      flip.finished.catch(() => {}),
    ]);
    if (token !== revealId) return;

    close();
    source.focus();
  };

  backButtons.forEach((button) => {
    button.addEventListener("click", hide);
  });

  return { close, show };
}
