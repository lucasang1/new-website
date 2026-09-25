import { initConnectMenu, initSectionNavigation } from "./navigation.js";
import {
  createNowPlayingPlayer,
  createPlayerState,
  createRecordCarousel,
  createTurntablePlayer,
} from "./player.js";
import { createPortfolioReveal } from "./portfolio-reveal.js";

const tracks = [
  {
    id: "sade-your-love-is-king",
    recordId: "sade",
    title: "Your Love Is King",
    artist: "Sade",
    album: "Diamond Life",
    artwork: "/img/album-sade-cover.svg",
    src: "/mp3/sade-your-love-is-king.mp3",
  },
];

const introView = document.querySelector("[data-intro-view]");
const collectionView = document.querySelector("[data-collection-view]");
const crateButton = document.querySelector("[data-crate-button]");
const carouselElement = document.querySelector("[data-record-carousel]");
const turntableElement = document.querySelector("[data-turntable]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let viewTransitionId = 0;
let recordRequestId = 0;
let transitionArtifacts = [];
let transitionAnimations = [];
let collectionReady = Promise.resolve();
let crateTransitionPromise = null;
let sectionNavigationId = 0;
let crateIdleTimer = null;
let activeIdleRecord = null;
let lastIdleRecord = null;
let previousIdleRecord = null;

const viewTransitionDuration = 1920;
const introTitleExitDuration = viewTransitionDuration / 2;
const crateIdleLiftDuration = 2340;

const randomBetween = (minimum, maximum) => (
  Math.round(minimum + Math.random() * (maximum - minimum))
);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const waitForImage = async (image) => {
  if (!image.complete) {
    await new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }

  if (image.naturalWidth && typeof image.decode === "function") {
    await image.decode().catch(() => {});
  }
};

const revealWhenImagesReady = async (root, { eager = false } = {}) => {
  const images = [...root.querySelectorAll("img")];

  if (eager) {
    images.forEach((image) => {
      image.loading = "eager";
    });
  }

  await Promise.all(images.map(waitForImage));
  await nextFrame();
  root.classList.add("is-media-ready");
  root.removeAttribute("aria-busy");
};

const crateRecords = [...crateButton.querySelectorAll("[data-crate-record-id]")];

const stopCrateIdleLift = () => {
  window.clearTimeout(crateIdleTimer);
  crateIdleTimer = null;
  activeIdleRecord?.classList.remove("is-idle-lifted");
  activeIdleRecord = null;
};

const canAnimateCrateIdle = () => (
  !reducedMotion.matches
  && document.body.dataset.view === "intro"
  && crateButton.classList.contains("is-media-ready")
  && !crateButton.matches(":hover")
);

const scheduleCrateIdleLift = (delay = randomBetween(1170, 2860)) => {
  window.clearTimeout(crateIdleTimer);
  crateIdleTimer = null;
  if (!canAnimateCrateIdle()) return;

  const liftNextRecord = () => {
    if (!canAnimateCrateIdle()) return;

    const previousRecord = activeIdleRecord;
    const candidates = crateRecords.filter(
      (record) => record !== lastIdleRecord && record !== previousIdleRecord,
    );
    const nextRecord = candidates[Math.floor(Math.random() * candidates.length)] ?? crateRecords[0];

    previousRecord?.classList.remove("is-idle-lifted");
    nextRecord?.classList.add("is-idle-lifted");
    activeIdleRecord = nextRecord;
    previousIdleRecord = lastIdleRecord;
    lastIdleRecord = nextRecord;
    crateIdleTimer = window.setTimeout(liftNextRecord, crateIdleLiftDuration);
  };

  crateIdleTimer = window.setTimeout(liftNextRecord, delay);
};

const carousel = createRecordCarousel(carouselElement);
const player = createPlayerState();
const mediaPlayer = createNowPlayingPlayer({
  root: document.querySelector("[data-now-playing]"),
  tracks,
});
const portfolioReveal = createPortfolioReveal({
  root: document.querySelector("[data-portfolio-reveal]"),
});
const turntablePlayer = createTurntablePlayer({
  carouselRoot: carouselElement,
  turntable: turntableElement,
  dropZone: document.querySelector("[data-turntable-drop-zone]"),
  offBase: turntableElement.querySelector("[data-turntable-off]"),
  needle: turntableElement.querySelector(".turntable-needle"),
  playerState: player,
  hasMediaForRecord: (recordId) => mediaPlayer.hasRecord(recordId),
  isPlaybackActive: () => mediaPlayer.isPlaying,
  onRecordStarted: (recordId) => mediaPlayer.startPreparedRecord(recordId),
  onSequenceComplete: (recordId, record) => portfolioReveal.show(recordId, record),
});

const removeTransitionArtifacts = () => {
  transitionAnimations.forEach((animation) => animation.cancel());
  transitionAnimations = [];
  transitionArtifacts.forEach((artifact) => {
    artifact.getAnimations().forEach((animation) => animation.cancel());
    artifact.remove();
  });
  transitionArtifacts = [];
  collectionView.classList.remove("is-crate-transitioning", "has-crate-transitioned");
  carouselElement.classList.remove("is-revealing-vinyls");
  crateButton.disabled = !crateButton.classList.contains("is-media-ready");
};

const showIntro = () => {
  sectionNavigationId += 1;
  viewTransitionId += 1;
  recordRequestId += 1;
  removeTransitionArtifacts();
  portfolioReveal.close();
  mediaPlayer.eject();
  turntablePlayer.eject({ immediate: true });
  document.body.dataset.view = "intro";
  collectionView.hidden = true;
  introView.hidden = false;
  scheduleCrateIdleLift();
};

const showCollection = async ({ recordId, focus = false } = {}) => {
  stopCrateIdleLift();
  const token = ++viewTransitionId;
  recordRequestId += 1;
  removeTransitionArtifacts();
  await collectionReady;
  if (token !== viewTransitionId) return;

  document.body.dataset.view = "collection";
  introView.hidden = true;
  collectionView.hidden = false;

  await nextFrame();
  if (token !== viewTransitionId) return false;

  if (recordId) {
    carousel.setActiveById(recordId);
  }

  if (focus) {
    carouselElement.focus({ preventScroll: true });
  }

  return true;
};

const cloneAtRect = (source, rect, className, { deep = false } = {}) => {
  const clone = source.cloneNode(deep);
  clone.removeAttribute("class");
  clone.removeAttribute("id");
  clone.removeAttribute("loading");
  clone.removeAttribute("data-crate-record-id");
  clone.setAttribute("aria-hidden", "true");
  clone.className = className;
  Object.assign(clone.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  document.body.append(clone);
  transitionArtifacts.push(clone);
  return clone;
};

const transitionToCollection = async () => {
  stopCrateIdleLift();
  if (reducedMotion.matches) {
    await showCollection({ recordId: "experiences", focus: true });
    return true;
  }

  const token = ++viewTransitionId;
  crateButton.disabled = true;
  await collectionReady;
  if (token !== viewTransitionId) return;

  const crateRecords = [...crateButton.querySelectorAll("[data-crate-record-id]")];
  const sources = crateRecords.map((record) => ({
    id: record.dataset.crateRecordId,
    rect: record.getBoundingClientRect(),
    clone: null,
    source: record,
  }));
  const crateLayers = [...crateButton.querySelectorAll(".crate-back, .crate-front")].map((layer) => ({
    source: layer,
    rect: layer.getBoundingClientRect(),
    clone: null,
  }));
  const introCopy = introView.querySelector(".intro-copy");
  const introCopyRect = introCopy.getBoundingClientRect();

  crateLayers.forEach((item, index) => {
    item.clone = cloneAtRect(item.source, item.rect, "crate-transition-layer");
    item.clone.style.zIndex = index === crateLayers.length - 1 ? "220" : "200";
  });
  sources.forEach((item, index) => {
    item.clone = cloneAtRect(item.source, item.rect, "crate-transition-cover");
    item.clone.style.zIndex = String(205 + index);
  });
  const introCopyClone = cloneAtRect(
    introCopy,
    introCopyRect,
    "intro-copy intro-transition-copy",
    { deep: true },
  );

  document.body.dataset.view = "collection";
  collectionView.classList.add("is-crate-transitioning");
  carouselElement.classList.add("is-revealing-vinyls");
  introView.hidden = true;
  collectionView.hidden = false;
  carousel.setActiveById("experiences", { behavior: "auto", animate: false });

  await nextFrame();
  await nextFrame();
  if (token !== viewTransitionId) return;

  const destinations = new Map(
    [...carouselElement.querySelectorAll("[data-record-id]")].map((card) => {
      const cover = card.querySelector("img:last-child");
      const rect = cover.getBoundingClientRect();

      return [card.dataset.recordId, {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        size: cover.offsetWidth,
        angle: Number.parseFloat(card.style.getPropertyValue("--carousel-card-angle")) || 0,
      }];
    }),
  );

  const turntableAnimation = turntableElement.animate([
    { opacity: 0 },
    { opacity: 1 },
  ], {
    duration: viewTransitionDuration,
    easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    fill: "forwards",
  });
  transitionAnimations.push(turntableAnimation);

  const coverAnimations = sources.map((item, index) => {
    const destination = destinations.get(item.id);
    if (!destination || !item.rect.width || typeof item.clone.animate !== "function") {
      return Promise.resolve();
    }

    const sourceCenterX = item.rect.left + item.rect.width / 2;
    const sourceCenterY = item.rect.top + item.rect.height / 2;
    const translateX = destination.centerX - sourceCenterX;
    const translateY = destination.centerY - sourceCenterY;
    const scale = destination.size / item.rect.width;
    const lift = Math.min(-34, translateY * 0.12);
    const turn = destination.angle * 0.35;
    const animation = item.clone.animate([
      { transform: "translate(0, 0) scale(1) rotate(0deg)", offset: 0 },
      {
        transform: `translate(${translateX * 0.18}px, ${lift}px) scale(${1 + (scale - 1) * 0.12}) rotate(${turn}deg)`,
        offset: 0.22,
      },
      {
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${destination.angle}deg)`,
        offset: 1,
      },
    ], {
      duration: 760,
      delay: index * 45,
      easing: "cubic-bezier(0.35, 0, 0.2, 1)",
      fill: "forwards",
    });

    return animation.finished.catch(() => {});
  });

  const exitAnimationOptions = {
    duration: viewTransitionDuration,
    easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    fill: "forwards",
  };

  const exitAnimations = crateLayers.map(({ clone, rect }) => {
    const exitDistance = window.innerHeight - rect.top + rect.height;
    const animation = clone.animate([
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: `translateY(${exitDistance}px)` },
    ], exitAnimationOptions);
    transitionAnimations.push(animation);
    return animation.finished.catch(() => {});
  });

  const introExitAnimation = introCopyClone.animate([
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: "translateY(0.75rem)" },
  ], {
    ...exitAnimationOptions,
    duration: introTitleExitDuration,
  });
  transitionAnimations.push(introExitAnimation);
  exitAnimations.push(introExitAnimation.finished.catch(() => {}));
  exitAnimations.push(turntableAnimation.finished.catch(() => {}));

  await Promise.all([...coverAnimations, ...exitAnimations]);
  if (token !== viewTransitionId) return;

  // Reveal the real cards and remove their pixel-aligned stand-ins before the
  // browser paints again, making the handoff visually seamless.
  collectionView.classList.add("has-crate-transitioned");
  collectionView.classList.remove("is-crate-transitioning");
  transitionArtifacts.forEach((artifact) => artifact.remove());
  transitionArtifacts = [];
  transitionAnimations.forEach((animation) => animation.cancel());
  transitionAnimations = [];
  crateButton.disabled = false;

  // Let the aligned sleeves paint once with their vinyls fully tucked inside,
  // then raise every vinyl into its normal resting position together.
  await nextFrame();
  await nextFrame();
  if (token !== viewTransitionId) return;
  carouselElement.classList.remove("is-revealing-vinyls");
  carouselElement.focus({ preventScroll: true });
  return true;
};

const startCrateTransition = () => {
  if (!crateTransitionPromise) {
    crateTransitionPromise = transitionToCollection().finally(() => {
      crateTransitionPromise = null;
    });
  }

  return crateTransitionPromise;
};

const requestRecord = async (recordId) => {
  const token = ++recordRequestId;
  const requestedCard = [...carouselElement.querySelectorAll("[data-record-id]")]
    .find((card) => card.dataset.recordId === recordId);

  portfolioReveal.close();
  mediaPlayer.prepareRecord(recordId);
  const ejection = turntablePlayer.eject();

  // Keep the vinyl at its hovered position while the asynchronous eject and
  // carousel handoff run. The loading sequence takes over on the next frame.
  requestedCard?.classList.add("is-requested");
  await ejection;
  if (token !== recordRequestId) {
    requestedCard?.classList.remove("is-requested");
    return;
  }

  carousel.setActiveById(recordId, { cue: true });
  requestAnimationFrame(() => requestedCard?.classList.remove("is-requested"));
};

crateButton.addEventListener("click", () => {
  sectionNavigationId += 1;
  startCrateTransition();
});

crateButton.addEventListener("pointerenter", stopCrateIdleLift);
crateButton.addEventListener("pointerleave", () => scheduleCrateIdleLift(650));

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    stopCrateIdleLift();
  } else {
    scheduleCrateIdleLift();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopCrateIdleLift();
  } else {
    scheduleCrateIdleLift();
  }
});

carouselElement.addEventListener("recordrequest", async (event) => {
  await requestRecord(event.detail.id);
});

carouselElement.addEventListener("recordchange", async (event) => {
  document.body.dataset.activeRecord = event.detail.id;

  if (event.detail.cue) {
    const token = recordRequestId;
    await event.detail.settled;
    if (token !== recordRequestId || carousel.activeId !== event.detail.id) return;
    turntablePlayer.play(event.detail.id);
  } else {
    recordRequestId += 1;
    portfolioReveal.close();
    mediaPlayer.eject();
    turntablePlayer.eject();
  }
});

document.addEventListener("playbackchange", (event) => {
  turntablePlayer.setPlayback(event.detail.playing);
});

document.addEventListener("mediatrackchange", (event) => {
  if (event.detail.reason !== "navigation") return;
  if (event.detail.track.recordId === player.snapshot.activeRecordId) return;

  recordRequestId += 1;
  carousel.setActiveById(event.detail.track.recordId, { cue: true });
});

document.addEventListener("ejectrequest", () => {
  recordRequestId += 1;
  portfolioReveal.close();
  mediaPlayer.eject();
  turntablePlayer.eject();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.repeat) {
    recordRequestId += 1;
    portfolioReveal.close();
    mediaPlayer.eject();
    turntablePlayer.eject();
  }
});

initConnectMenu();
initSectionNavigation({
  onHome: showIntro,
  onSection: async (sectionId) => {
    const token = ++sectionNavigationId;
    const enteringFromIntro = document.body.dataset.view === "intro" || crateTransitionPromise;

    if (enteringFromIntro) {
      await startCrateTransition();
    }

    if (token !== sectionNavigationId || document.body.dataset.view !== "collection") return;
    await requestRecord(sectionId);
  },
});

// Give the browser a clean first paint for the header and intro copy before
// starting the image decode/reveal work.
const initialPaint = nextFrame().then(() => nextFrame());
const crateReady = initialPaint
  .then(() => revealWhenImagesReady(crateButton))
  .then(() => {
    crateButton.disabled = false;
    scheduleCrateIdleLift();
  });
collectionReady = crateReady.then(() => revealWhenImagesReady(collectionView, { eager: true }));

document.documentElement.classList.add("js-ready");
