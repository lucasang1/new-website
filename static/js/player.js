export function createRecordCarousel(root) {
  const cards = [...root.querySelectorAll("[data-record-id]")];
  root.querySelectorAll("img").forEach((image) => {
    image.draggable = false;
  });
  root.addEventListener("dragstart", (event) => event.preventDefault());
  const previousButton = document.querySelector("[data-carousel-previous]");
  const nextButton = document.querySelector("[data-carousel-next]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = Math.max(0, cards.findIndex((card) => card.classList.contains("is-active")));
  const bendAngle = 10;
  const scrollEase = 0.05;
  const scrollSpeed = 0.0025;
  let current = activeIndex;
  let target = activeIndex;
  let dragStartX = 0;
  let dragStartTarget = 0;
  let dragDistance = 0;
  let isDragging = false;
  let suppressClickUntil = 0;
  let raf;
  let settleTimer;
  let settleResolvers = [];

  const wrap = (value, length) => ((value % length) + length) % length;
  const shortestDistance = (from, to) => {
    let distance = wrap(to - from, cards.length);
    if (distance > cards.length / 2) distance -= cards.length;
    return distance;
  };

  const getMetrics = () => {
    const styles = getComputedStyle(root);
    const cardSize = cards[0]?.offsetWidth || Number.parseFloat(styles.getPropertyValue("--record-card-size")) || 198;
    const gapValue = styles.getPropertyValue("--record-gap").trim();
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = gapValue.endsWith("rem")
      ? Number.parseFloat(gapValue) * rootFontSize
      : Number.parseFloat(gapValue) || 32;
    return { cardSize, spacing: cardSize + gap };
  };

  const applyCurve = () => {
    const { spacing } = getMetrics();
    const angleStep = bendAngle * Math.PI / 180;
    const radius = spacing / Math.sin(angleStep);

    cards.forEach((card, index) => {
      let slot = index - current;
      while (slot > cards.length / 2) slot -= cards.length;
      while (slot < -cards.length / 2) slot += cards.length;

      const angle = slot * angleStep;
      const x = radius * Math.sin(angle);
      const y = radius * (1 - Math.cos(angle));
      const angleDegrees = slot * bendAngle;

      card.style.setProperty("--carousel-card-angle", `${angleDegrees}deg`);
      card.style.setProperty("--carousel-card-x", `${x}px`);
      card.style.setProperty("--carousel-arc-offset", `${y}px`);
      card.style.zIndex = String(100 - Math.round(Math.abs(slot) * 10));
    });
  };

  const resolveSettled = () => {
    const resolvers = settleResolvers;
    settleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  };

  const waitUntilSettled = () => new Promise((resolve) => {
    settleResolvers.push(resolve);
  });

  const render = () => {
    const difference = target - current;
    current = reducedMotion.matches ? target : current + difference * scrollEase;

    if (Math.abs(target - current) < 0.001) {
      current = target;
      resolveSettled();
    }

    applyCurve();
    raf = window.requestAnimationFrame(render);
  };

  const updateActiveCard = (nextIndex) => {
    activeIndex = wrap(nextIndex, cards.length);
    cards.forEach((card, index) => {
      const isActive = index === activeIndex;
      card.classList.toggle("is-active", isActive);
      isActive ? card.setAttribute("aria-current", "true") : card.removeAttribute("aria-current");
    });
  };

  const setActive = (nextIndex, {
    scroll = true,
    behavior = "smooth",
    animate = true,
    cue = false,
  } = {}) => {
    const normalizedIndex = wrap(nextIndex, cards.length);
    const distance = shortestDistance(wrap(Math.round(target), cards.length), normalizedIndex);
    target = scroll ? Math.round(target) + distance : target;
    updateActiveCard(normalizedIndex);

    if (!animate || behavior === "auto" || reducedMotion.matches) {
      current = target;
      applyCurve();
      resolveSettled();
    }

    const settled = Math.abs(target - current) < 0.001
      ? Promise.resolve()
      : waitUntilSettled();

    root.dispatchEvent(new CustomEvent("recordchange", {
      bubbles: true,
      detail: { id: cards[activeIndex].dataset.recordId, cue, settled },
    }));
  };

  const setActiveById = (recordId, options) => {
    const nextIndex = cards.findIndex((card) => card.dataset.recordId === recordId);

    if (nextIndex >= 0) {
      setActive(nextIndex, options);
    }
  };

  const snapToNearest = ({ cue = false } = {}) => {
    const nextTarget = Math.round(target);
    const nextIndex = wrap(nextTarget, cards.length);
    const changed = nextIndex !== activeIndex;
    target = nextTarget;
    updateActiveCard(nextIndex);
    const settled = Math.abs(target - current) < 0.001 ? Promise.resolve() : waitUntilSettled();

    if (changed) {
      root.dispatchEvent(new CustomEvent("recordchange", {
        bubbles: true,
        detail: { id: cards[nextIndex].dataset.recordId, cue, settled },
      }));
    }
  };

  root.addEventListener("click", (event) => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }

    const card = event.target.closest?.("[data-record-id]");
    if (!card || !root.contains(card)) return;

    root.dispatchEvent(new CustomEvent("recordrequest", {
      bubbles: true,
      detail: { id: card.dataset.recordId },
    }));
  });
  previousButton?.addEventListener("click", () => setActive(activeIndex - 1));
  nextButton?.addEventListener("click", () => setActive(activeIndex + 1));
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive(activeIndex + 1);
    }
  });

  root.addEventListener("wheel", (event) => {
    event.preventDefault();
    target += (event.deltaY || event.deltaX) * scrollSpeed;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(snapToNearest, 180);
  }, { passive: false });

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    isDragging = true;
    dragStartX = event.clientX;
    dragStartTarget = target;
    dragDistance = 0;
    root.classList.add("is-dragging");
  });

  window.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const { spacing } = getMetrics();
    dragDistance = Math.max(dragDistance, Math.abs(event.clientX - dragStartX));
    target = dragStartTarget + (dragStartX - event.clientX) / spacing;
  });

  const finishDrag = (event) => {
    if (!isDragging) return;
    isDragging = false;
    suppressClickUntil = dragDistance > 5 ? performance.now() + 250 : 0;
    root.classList.remove("is-dragging");
    snapToNearest();
  };

  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  window.addEventListener("resize", applyCurve);
  reducedMotion.addEventListener("change", applyCurve);

  applyCurve();
  render();

  return {
    get activeId() {
      return cards[activeIndex]?.dataset.recordId;
    },
    setActive,
    setActiveById,
    destroy() {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      resolveSettled();
    },
  };
}

export function createTurntablePlayer({
  carouselRoot,
  turntable,
  dropZone,
  offBase,
  needle,
  playerState,
  hasMediaForRecord = () => true,
  isPlaybackActive = () => true,
  onRecordStarted = () => {},
  onSequenceComplete = () => {},
}) {
  const cards = [...carouselRoot.querySelectorAll("[data-record-id]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let sequenceId = 0;
  let flyingRecord;
  let platterRecord;
  let ejectionPromise;

  const delay = (duration) => new Promise((resolve) => {
    window.setTimeout(resolve, reducedMotion.matches ? 0 : duration);
  });

  const pause = (duration) => new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

  const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));

  const currentRecordRotation = (record) => {
    if (!record) return 0;

    const transform = window.getComputedStyle(record).transform;
    if (!transform || transform === "none") return 0;

    try {
      const matrix = new DOMMatrixReadOnly(transform);
      return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    } catch {
      return 0;
    }
  };

  const createFlyingRecord = (source, sourceRect, rotation = 0, initialStyle = {}) => {
    const recordImage = source.cloneNode();
    recordImage.removeAttribute("loading");
    recordImage.setAttribute("aria-hidden", "true");
    recordImage.style.transform = `rotate(${rotation}deg)`;

    const record = document.createElement("div");
    record.setAttribute("aria-hidden", "true");
    record.className = "flying-record";
    Object.assign(record.style, {
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      ...initialStyle,
    });
    record.append(recordImage);
    document.body.append(record);
    return { record, recordImage };
  };

  const waitForNeedleRotation = () => new Promise((resolve) => {
    if (reducedMotion.matches) {
      resolve();
      return;
    }

    const finish = (event) => {
      if (event && event.propertyName !== "transform") return;

      needle.removeEventListener("transitionend", finish);
      needle.removeEventListener("transitioncancel", finish);
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    const fallbackTimer = window.setTimeout(finish, 1200);

    needle.addEventListener("transitionend", finish);
    needle.addEventListener("transitioncancel", finish);
  });

  const resetVisuals = () => {
    cards.forEach((card) => card.classList.remove(
      "is-sequencing",
      "is-cueing",
      "is-loading",
      "is-ejecting",
    ));
    carouselRoot.classList.remove("is-loading-record");
    offBase.hidden = false;
    needle.classList.remove("is-on-record");
    turntable.classList.remove("is-playing");
    flyingRecord?.remove();
    platterRecord?.remove();
    flyingRecord = null;
    platterRecord = null;
  };

  const returnRecordToSleeve = async () => {
    const recordId = playerState.snapshot.activeRecordId;
    const card = cards.find((candidate) => candidate.dataset.recordId === recordId);
    const source = card?.querySelector("img:first-child");

    turntable.classList.remove("is-playing");
    needle.classList.remove("is-on-record");
    await waitForNeedleRotation();

    if (!platterRecord || !card || !source) {
      resetVisuals();
      return;
    }

    const sourceRect = source.getBoundingClientRect();
    const coverRect = source.nextElementSibling?.getBoundingClientRect();
    const platterRect = platterRecord.getBoundingClientRect();
    const translateX = platterRect.left - sourceRect.left;
    const translateY = platterRect.top - sourceRect.top;
    const scale = sourceRect.width ? platterRect.width / sourceRect.width : 1;
    const rotation = currentRecordRotation(platterRecord);
    const sleeveOverlap = coverRect
      ? Math.max(0, Math.min(sourceRect.height, sourceRect.bottom - coverRect.top))
      : 0;
    const sleeveClip = sourceRect.height ? sleeveOverlap / sourceRect.height * 100 : 0;

    const initialTransform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    const flying = createFlyingRecord(source, sourceRect, rotation, {
      clipPath: "inset(0 0 0 0)",
      transform: initialTransform,
    });
    flyingRecord = flying.record;
    platterRecord.remove();
    platterRecord = null;

    if (!reducedMotion.matches && typeof flyingRecord.animate === "function") {
      const animation = flyingRecord.animate([
        {
          clipPath: "inset(0 0 0 0)",
          transform: initialTransform,
          offset: 0,
        },
        {
          clipPath: "inset(0 0 0 0)",
          transform: `translate(0, ${-sleeveOverlap}px) scale(1)`,
          offset: 0.68,
        },
        {
          clipPath: `inset(0 0 ${sleeveClip}% 0)`,
          transform: "translate(0, 0) scale(1)",
          offset: 1,
        },
      ], {
        duration: 720,
        easing: "cubic-bezier(0.45, 0, 0.2, 1)",
        fill: "forwards",
      });

      await animation.finished.catch(() => {});
    }

    card.classList.add("is-ejecting");
    card.classList.remove("is-loading");
    await nextFrame();
    // The record keeps its paused angle for the entire return trip. Reset the
    // artwork only once it is back in the sleeve, immediately before removing
    // the moving copy so the zero-angle frame is never painted in the open.
    flying.recordImage.style.transform = "rotate(0deg)";
    flyingRecord?.remove();
    flyingRecord = null;
    await nextFrame();
    card.classList.remove("is-sequencing", "is-cueing", "is-ejecting");
    await delay(280);
  };

  const finishEjection = async ({ immediate = false } = {}) => {
    if (immediate || !platterRecord) {
      resetVisuals();
    } else {
      await returnRecordToSleeve();
    }

    playerState.eject();
    offBase.hidden = false;
    carouselRoot.classList.remove("is-loading-record");
  };

  const ejectLoadedRecord = (options) => {
    if (!ejectionPromise) {
      ejectionPromise = finishEjection(options).finally(() => {
        ejectionPromise = null;
      });
    }

    return ejectionPromise;
  };

  const eject = async (options) => {
    const token = ++sequenceId;
    await ejectLoadedRecord(options);

    return token === sequenceId;
  };

  const flyRecordToTurntable = async (source, token) => {
    const sourceRect = source.getBoundingClientRect();
    const coverRect = source.nextElementSibling?.getBoundingClientRect();
    const destinationRect = dropZone.getBoundingClientRect();
    const translateX = destinationRect.left - sourceRect.left;
    const translateY = destinationRect.top - sourceRect.top;
    const scale = destinationRect.width / sourceRect.width;
    const sleeveOverlap = coverRect
      ? Math.max(0, Math.min(sourceRect.height, sourceRect.bottom - coverRect.top))
      : 0;
    const sleeveClip = sourceRect.height ? sleeveOverlap / sourceRect.height * 100 : 0;

    flyingRecord = createFlyingRecord(source, sourceRect).record;

    if (!reducedMotion.matches && typeof flyingRecord.animate === "function") {
      const revealOffset = 0.3;
      const revealTransform = `translate(${translateX * revealOffset}px, ${translateY * revealOffset}px) scale(${1 + (scale - 1) * revealOffset})`;
      const travel = flyingRecord.animate([
        {
          clipPath: `inset(0 0 ${sleeveClip}% 0)`,
          transform: "translate(0, 0) scale(1)",
          offset: 0,
        },
        {
          clipPath: "inset(0 0 0 0)",
          transform: revealTransform,
          offset: revealOffset,
        },
        {
          clipPath: "inset(0 0 0 0)",
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          offset: 1,
        },
      ], {
        duration: 720,
        easing: "cubic-bezier(0.45, 0, 0.2, 1)",
        fill: "forwards",
      });

      await travel.finished.catch(() => {});
    }

    if (token !== sequenceId) return false;

    platterRecord = source.cloneNode();
    platterRecord.removeAttribute("loading");
    platterRecord.setAttribute("aria-hidden", "true");
    platterRecord.className = "turntable-record";
    dropZone.append(platterRecord);
    flyingRecord?.remove();
    flyingRecord = null;
    return true;
  };

  const play = async (recordId) => {
    const token = ++sequenceId;
    await ejectLoadedRecord();
    if (token !== sequenceId) return;

    resetVisuals();

    const card = cards.find((candidate) => candidate.dataset.recordId === recordId);
    const source = card?.querySelector("img:first-child");

    if (!card || !source) return;

    carouselRoot.classList.add("is-loading-record");
    card.classList.add("is-sequencing");

    await delay(380);
    if (token !== sequenceId) return;

    card.classList.add("is-cueing");
    await delay(300);
    if (token !== sequenceId) return;

    card.classList.add("is-loading");
    const reachedTurntable = await flyRecordToTurntable(source, token);
    if (!reachedTurntable) return;

    playerState.load(recordId);
    offBase.hidden = true;
    await delay(10);
    if (token !== sequenceId) return;

    needle.classList.add("is-on-record");
    await waitForNeedleRotation();
    await delay(50);
    if (token !== sequenceId) return;

    const recordStarted = await onRecordStarted(recordId);
    if (token !== sequenceId) return;

    // Portfolio records do not all have an audio track, but they still behave
    // as playable records on the turntable. Audio-backed records follow the
    // media element's state; visual-only records start spinning once cued.
    const shouldPlay = hasMediaForRecord(recordId)
      ? recordStarted !== false && isPlaybackActive()
      : true;
    turntable.classList.toggle("is-playing", shouldPlay);
    if (shouldPlay) playerState.play();

    await pause(1000);
    if (token !== sequenceId) return;

    carouselRoot.classList.remove("is-loading-record");
    onSequenceComplete(recordId, card.querySelector("img:last-child"));
  };

  const setPlayback = (isPlaying) => {
    if (!playerState.snapshot.activeRecordId) return;

    turntable.classList.toggle("is-playing", isPlaying);
    isPlaying ? playerState.play() : playerState.pause();
  };

  return { eject, play, setPlayback };
}

export function createNowPlayingPlayer({ root, tracks }) {
  const audio = root.querySelector("[data-player-audio]");
  const title = root.querySelector("[data-player-title]");
  const artist = root.querySelector("[data-player-artist]");
  const currentTime = root.querySelector("[data-player-current-time]");
  const remainingTime = root.querySelector("[data-player-remaining-time]");
  const progress = root.querySelector("[data-player-progress]");
  const toggle = root.querySelector("[data-player-toggle]");
  const previous = root.querySelector("[data-player-previous]");
  const next = root.querySelector("[data-player-next]");
  const ejectButton = root.querySelector("[data-player-eject]");
  const announcement = root.querySelector("[data-player-announcement]");
  let activeIndex = -1;
  let preparedIndex = -1;
  let preparationPromise = Promise.resolve(false);

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  };

  const emitPlaybackChange = () => {
    root.dispatchEvent(new CustomEvent("playbackchange", {
      bubbles: true,
      detail: { playing: !audio.paused, track: tracks[activeIndex] || null },
    }));
  };

  const replayTrackFade = () => {
    root.classList.remove("is-track-resetting");
    void root.offsetWidth;
    root.classList.add("is-track-resetting");
  };

  const updateTimeline = ({ force = false } = {}) => {
    if (!force && preparedIndex >= 0) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const elapsed = Math.min(audio.currentTime || 0, duration || 0);
    const value = duration ? Math.round(elapsed / duration * 1000) : 0;

    progress.value = String(value);
    progress.style.setProperty("--progress", `${value / 10}%`);
    currentTime.textContent = formatTime(elapsed);
    remainingTime.textContent = `-${formatTime(Math.max(0, duration - elapsed))}`;
  };

  const renderEmpty = () => {
    root.classList.remove("is-track-resetting");
    root.dataset.state = "empty";
    title.textContent = "please load a track";
    artist.textContent = "-";
    progress.disabled = true;
    toggle.disabled = true;
    previous.disabled = true;
    next.disabled = true;
    ejectButton.disabled = true;
    toggle.setAttribute("aria-label", "Play");
    currentTime.textContent = "0:00";
    remainingTime.textContent = "-0:00";
    progress.value = "0";
    progress.style.setProperty("--progress", "0%");
  };

  const renderTrack = (track) => {
    title.textContent = track.title;
    artist.textContent = track.artist;
    progress.disabled = false;
    toggle.disabled = false;
    previous.disabled = false;
    next.disabled = false;
    ejectButton.disabled = false;
    root.dataset.state = "playing";
    toggle.setAttribute("aria-label", "Pause");
    announcement.textContent = `${track.title} by ${track.artist}`;
    updateTimeline({ force: true });
    replayTrackFade();
  };

  const prepareTrack = (index, { reason = "selection" } = {}) => {
    if (!tracks.length) return Promise.resolve(false);

    preparedIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    const track = tracks[preparedIndex];
    const sourceChanged = audio.getAttribute("src") !== track.src;

    if (sourceChanged) {
      audio.src = track.src;
      audio.load();
    } else {
      audio.currentTime = 0;
    }

    // Start the media element inside the user's click gesture so browsers keep
    // the playback permission while the record-loading animation runs. Prefer
    // a zero-volume pre-roll because some browsers suspend muted media when it
    // is unmuted later; iOS ignores programmatic volume, so retain `muted` there.
    audio.volume = 0;
    audio.muted = audio.volume !== 0;

    root.dispatchEvent(new CustomEvent("mediatrackchange", {
      bubbles: true,
      detail: { track, reason },
    }));

    preparationPromise = audio.play().then(() => true).catch(() => false);
    return preparationPromise;
  };

  const prepareRecord = (recordId) => {
    const index = tracks.findIndex((track) => track.recordId === recordId);

    if (index < 0) {
      eject();
      return Promise.resolve(false);
    }

    return prepareTrack(index);
  };

  const startPreparedRecord = async (recordId) => {
    const track = tracks[preparedIndex];
    if (!track || track.recordId !== recordId) return false;

    const prepared = await preparationPromise;
    if (!prepared || tracks[preparedIndex] !== track) return false;

    activeIndex = preparedIndex;
    preparedIndex = -1;
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 1;
    renderTrack(track);

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        root.dataset.state = "paused";
        toggle.setAttribute("aria-label", "Play");
        emitPlaybackChange();
        return false;
      }
    } else {
      emitPlaybackChange();
    }

    return true;
  };

  const changeTrack = (offset) => {
    if (activeIndex < 0) return;

    const index = (activeIndex + offset + tracks.length) % tracks.length;
    const nextTrack = tracks[index];
    const currentTrack = tracks[activeIndex];
    prepareTrack(index, { reason: "navigation" });

    if (nextTrack.recordId === currentTrack.recordId) {
      startPreparedRecord(nextTrack.recordId);
    }
  };

  const eject = () => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio.muted = false;
    audio.volume = 1;
    activeIndex = -1;
    preparedIndex = -1;
    preparationPromise = Promise.resolve(false);
    announcement.textContent = "Track ejected";
    renderEmpty();
    emitPlaybackChange();
  };

  toggle.addEventListener("click", () => {
    if (activeIndex < 0) return;

    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });
  previous.addEventListener("click", () => changeTrack(-1));
  next.addEventListener("click", () => changeTrack(1));
  ejectButton.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("ejectrequest", { bubbles: true }));
  });
  progress.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(progress.value) / 1000 * audio.duration;
      updateTimeline();
    }
  });
  root.addEventListener("animationend", (event) => {
    if (event.animationName === "now-playing-reset-in") {
      root.classList.remove("is-track-resetting");
    }
  });

  audio.addEventListener("loadedmetadata", updateTimeline);
  audio.addEventListener("timeupdate", updateTimeline);
  audio.addEventListener("play", () => {
    if (preparedIndex >= 0 || activeIndex < 0) return;
    root.dataset.state = "playing";
    toggle.setAttribute("aria-label", "Pause");
    emitPlaybackChange();
  });
  audio.addEventListener("pause", () => {
    if (activeIndex < 0) return;
    root.dataset.state = "paused";
    toggle.setAttribute("aria-label", "Play");
    emitPlaybackChange();
  });
  audio.addEventListener("ended", () => {
    if (tracks.length > 1) {
      changeTrack(1);
      return;
    }

    root.dataset.state = "paused";
    toggle.setAttribute("aria-label", "Play");
    emitPlaybackChange();
  });

  renderEmpty();

  return {
    eject,
    prepareRecord,
    startPreparedRecord,
    hasRecord(recordId) {
      return tracks.some((track) => track.recordId === recordId);
    },
    get isPlaying() {
      return activeIndex >= 0 && !audio.paused;
    },
    get activeTrack() {
      return tracks[activeIndex] || null;
    },
  };
}

export function createPlayerState() {
  let status = "idle";
  let activeRecordId = null;

  return {
    get snapshot() {
      return Object.freeze({ status, activeRecordId });
    },
    load(recordId) {
      activeRecordId = recordId;
      status = "loaded";
    },
    play() {
      if (activeRecordId) status = "playing";
    },
    pause() {
      if (activeRecordId) status = "paused";
    },
    eject() {
      status = "idle";
      activeRecordId = null;
    },
  };
}
