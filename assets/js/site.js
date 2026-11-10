/* Afik Kaniel — portfolio. One frame loop drives the scroll scenes; light.js adds the liquid light. */
(() => {
  "use strict";

  const root = document.documentElement;
  const motion = root.classList.contains("js-motion");
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Nav: translucent material once the page scrolls ---------- */

  const nav = $("#nav");
  const setNavState = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  setNavState();
  window.addEventListener("scroll", setNavState, { passive: true });

  /* ---------- Video posters: fetched only as a video comes near the screen ---------- */

  // A poster in the HTML would download with the page; these wait until they are needed.
  const showPoster = (video) => {
    video.poster = video.dataset.poster;
    video.removeAttribute("data-poster");
  };
  const lazyPosters = $$("video[data-poster]");
  if ("IntersectionObserver" in window) {
    const posterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        showPoster(target);
        observer.unobserve(target);
      });
    }, { rootMargin: "800px 0px" });
    lazyPosters.forEach((video) => posterObserver.observe(video));
  } else {
    lazyPosters.forEach(showPoster);
  }

  /* ---------- Videos: play only while at least half visible ---------- */

  // The phone's screen videos are run by the apps scene below, one at a time.
  const videos = $$("video:not(.scr)");
  if (!motion || !("IntersectionObserver" in window)) {
    // Reduced motion: nothing autoplays; native controls let people play a clip.
    videos.forEach((video) => { video.controls = true; });
  } else {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) {
          const playing = target.play();
          if (playing) playing.catch(() => { target.controls = true; });
        } else {
          target.pause();
        }
      });
    }, { threshold: 0.5 });
    videos.forEach((video) => videoObserver.observe(video));
  }

  if (!motion) return;

  /* ---------- Shared state (light.js reads it) ---------- */

  const Site = (window.Site = {
    onFrame: [],
    vw: window.innerWidth,
    vh: window.innerHeight,
    box: {},
    pointer: { x: window.innerWidth * 0.6, y: window.innerHeight * 0.4, moved: false },
    apps: { index: 0 },
  });
  // Only a real mouse steers the effects; on touch screens they run on their own.
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    Site.pointer.x = e.clientX;
    Site.pointer.y = e.clientY;
    Site.pointer.moved = true;
  }, { passive: true });

  // Style writes only when a value changes, so idle frames cost nothing.
  const last = new Map();
  const put = (el, key, value) => {
    let m = last.get(el);
    if (!m) { m = {}; last.set(el, m); }
    if (m[key] === value) return;
    m[key] = value;
    if (key.startsWith("--")) el.style.setProperty(key, value);
    else el.style[key] = value;
  };

  /* ---------- Elements ---------- */

  const hero = $(".hero");
  const heroTitle = $(".hero-title");
  const heroSub = $(".hero-sub");
  const about = $(".about");
  const aboutScene = $(".about-scene");
  const apps = $(".apps");
  const appItems = $$(".app", apps);
  const ticks = $$(".tick", apps);
  const phone = $(".phone", apps);
  const glare = $(".glare", apps);
  const phoneShadow = $(".phone-shadow", apps);
  const screens = $$(".scr", apps);
  const backIcons = $$(".back-icon", apps);
  const reach = $(".reach");
  const pp = $(".pp");
  const ppNum = $(".pp-num", pp);
  const ppLabel = $(".pp-label", pp);
  const ppDays = $$(".pp-days li", pp);
  const ppGlass = $(".pp-glass", pp);
  const time = $(".time");
  const bars = $(".bars", time);
  const career = $(".career");
  const chapters = $(".chapters");
  const chapterNav = $(".chapter-nav", chapters);
  const chapterLinks = $$(".chapter-links a", chapters);
  const jobs = $$(".job", chapters);
  const contact = $(".contact");
  const scrubbed = $$("[data-scrub]");

  // About: split the text into words so they can light up one by one.
  const manifesto = $("[data-words]");
  const words = manifesto.textContent.trim().split(/\s+/);
  manifesto.textContent = "";
  const wordEls = words.map((word, i) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = word;
    manifesto.append(span);
    if (i < words.length - 1) manifesto.append(" ");
    return span;
  });
  let litCount = -1;

  // Pin-Point: 100 dots; a fixed shuffle decides who stays, so the players who stay are spread out.
  const dotsEl = $(".dots", pp);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const order = [...Array(100).keys()].sort(() => rand() - 0.5);
  const rank = new Array(100);
  order.forEach((dot, r) => { rank[dot] = r; });
  const dotEls = Array.from({ length: 100 }, () => {
    const dot = document.createElement("i");
    dot.className = "dot";
    dotsEl.append(dot);
    return dot;
  });

  /* ---------- Layout cache: measured once per layout change ---------- */

  const box = Site.box;
  let chapterOffset = 0;
  let jobTops = [];
  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  function measure() {
    Site.vw = window.innerWidth;
    Site.vh = window.innerHeight;
    [["hero", hero], ["aboutAll", about], ["about", aboutScene], ["apps", apps], ["reach", reach], ["pp", pp], ["time", time],
      ["bars", bars], ["career", career], ["chapters", chapters], ["contact", contact]].forEach(([key, el]) => {
      box[key] = { top: pageTop(el), height: el.offsetHeight };
    });
    box.scrub = scrubbed.map(pageTop);
    const css = getComputedStyle(root);
    chapterOffset = parseFloat(css.getPropertyValue("--nav-h")) + parseFloat(css.getPropertyValue("--chap-h"));
    jobTops = jobs.map(pageTop);
    placeSnaps();
  }

  // 0 when the scene's top reaches the top of the screen, 1 when its pinned part ends.
  const progress = ({ top, height }) => {
    const range = height - Site.vh;
    return range > 0 ? clamp((window.scrollY - top) / range) : (window.scrollY >= top ? 1 : 0);
  };
  const inView = ({ top, height }, y, vh) => y + vh > top && y < top + height;

  /* ---------- Apps ---------- */

  const count = appItems.length;
  let activeApp = -1;
  function setActiveApp(index) {
    if (index === activeApp) return;
    activeApp = index;
    Site.apps.index = index;
    appItems.forEach((item, i) => {
      item.classList.toggle("is-active", i === index);
      item.classList.toggle("is-past", i < index);
    });
    apps.style.setProperty("--accent", appItems[index].dataset.accent);
  }

  // Scroll picks the app; the turn itself runs on time, so the phone never stops halfway.
  const TURN_TIME = 1.05; // seconds for one full turn
  const turnState = { active: false, start: 0, dir: 1, swapped: false };
  const tilt = { x: 0, y: 0 };
  let shownScreen = 0;
  let shownBack = 0;
  // Screen videos: only the one on the phone plays, only while the scene is on screen,
  // and not at all when the person saves data (the poster stays).
  const connection = navigator.connection;
  const saveData = !!(connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || "")));
  let appsOnScreen = false;
  const syncScreenVideos = () => {
    screens.forEach((el, i) => {
      if (el.tagName !== "VIDEO") return;
      if (!saveData && appsOnScreen && i === shownScreen) {
        el.preload = "auto";
        const playing = el.play();
        if (playing) playing.catch(() => {});
      } else if (!el.paused) {
        el.pause();
      }
    });
  };
  const setScreen = (i) => {
    if (i === shownScreen) return;
    screens[shownScreen].classList.remove("is-on");
    screens[i].classList.add("is-on");
    shownScreen = i;
    syncScreenVideos();
  };
  const setBack = (i) => {
    if (i === shownBack) return;
    backIcons[shownBack].classList.remove("is-on");
    backIcons[i].classList.add("is-on");
    shownBack = i;
  };

  function updatePhone(raw, enter, dt, now) {
    const want = Math.min(count - 1, Math.max(0, Math.floor(raw)));
    // A new app on stage starts a full turn. If the app changes again during the turn,
    // the turn still finishes, and a new one starts after it if the screen is still out of date.
    if (!turnState.active && want !== shownScreen) {
      turnState.active = true;
      turnState.start = now;
      turnState.dir = want > shownScreen ? 1 : -1;
      turnState.swapped = false;
    }
    let turn = 0;
    let pull = 0;
    if (turnState.active) {
      const t = clamp((now - turnState.start) / TURN_TIME);
      turn = ease(t) * 360 * turnState.dir;
      pull = Math.sin(Math.PI * t);
      // The back shows the app that is coming; the screen changes at the half turn, while the back faces you.
      setBack(want);
      if (!turnState.swapped && t >= 0.5) { setScreen(want); turnState.swapped = true; }
      if (t >= 1) { turnState.active = false; turn = 0; pull = 0; }
    }

    // A slow swing, centered while you read each app; the cursor tilts the phone with a soft lag.
    const swing = -11 * Math.sin(Math.PI * (raw - 0.5));
    const k = 1 - Math.exp(-dt * 5);
    tilt.y += ((Site.pointer.x / Site.vw - 0.5) * 22 - tilt.y) * k;
    tilt.x += ((Site.pointer.y / Site.vh - 0.5) * -14 - tilt.x) * k;

    // Even when nothing moves, the phone drifts slowly from side to side and floats a little, so it feels alive.
    const e = ease(enter);
    const sway = 7 * Math.sin(now * 0.55) * e;
    const nod = 2.2 * Math.sin(now * 0.41 + 1.3) * e;
    const float = 7 * Math.sin(now * 0.78 + 0.6) * e;
    const ry = turn + swing + tilt.y + sway;
    const rx = (1 - e) * 58 + 4 + tilt.x + nod;
    put(phone, "transform", `translate3d(0, ${((1 - e) * Site.vh * 0.42 + float).toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${(1 - pull * 0.07).toFixed(4)})`);
    const rad = (ry * Math.PI) / 180;
    put(glare, "--gx", (Math.sin(rad) * 46).toFixed(1));
    put(phoneShadow, "transform", `scaleX(${(0.35 + 0.65 * Math.abs(Math.cos(rad))).toFixed(3)})`);
    put(phoneShadow, "opacity", (0.8 * e).toFixed(3));
  }

  const scrollToApp = (i, behavior = "smooth") => {
    const range = box.apps.height - Site.vh;
    window.scrollTo({ top: box.apps.top + ((i + 0.5) / count) * range, behavior });
  };
  ticks.forEach((tick, i) => tick.addEventListener("click", () => scrollToApp(i)));
  // Keyboard: focusing a link inside a hidden app brings that app on stage.
  appItems.forEach((item, i) => {
    item.addEventListener("focusin", () => { if (i !== activeApp) scrollToApp(i, "instant"); });
  });

  /* ---------- One swipe, one app ---------- */

  // Stops, as page scroll positions: an exit above the scene, each app centred, an exit below.
  const snapEls = $$(".app-snaps i", apps);
  let stops = [];
  let snapOn = false;
  function placeSnaps() {
    const range = box.apps.height - Site.vh;
    // Snapping lines a stop up with the top of the page less its scroll padding.
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    stops = [box.apps.top - Site.vh * 0.5,
      ...appItems.map((_, i) => box.apps.top + ((i + 0.5) / count) * range),
      box.reach.top];
    snapEls.forEach((el, i) => { el.style.top = `${(stops[i] - box.apps.top + pad).toFixed(1)}px`; });
  }
  // Snapping runs only inside the scene, so the rest of the page scrolls as usual. Touch flicks
  // are handled by the browser's own snapping: each app stop is one a fling can't pass.
  function updateSnap(y) {
    const on = stops.length > 0 && y > stops[0] + 1 && y < stops[stops.length - 1] - 1;
    if (on !== snapOn) {
      snapOn = on;
      root.classList.toggle("snap-apps", on);
    }
  }
  // A mouse wheel or trackpad sends many small scrolls per gesture, which the browser's snapping
  // counts as many moves. Inside the scene one gesture moves one stop. The rest of that gesture
  // (a trackpad's glide, up to a few seconds) is swallowed, also after an exit, so the glide can't
  // carry the page on. A new push during the glide, or a push the other way, is a new gesture.
  let wheelBusy = false;
  let wheelSum = 0;
  let lastWheel = 0;
  let busySince = 0;
  let busyDir = 0;
  let wheelTarget = 0;
  let moveId = 0;
  let recent = []; // [time, size] of the last wheel events, to spot a new push
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = performance.now();
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? Site.vh : 1);
    const size = Math.abs(px);
    recent = recent.filter(([t]) => now - t < 200);
    const low = recent.reduce((min, [, s]) => Math.min(min, s), Infinity);
    recent.push([now, size]);
    let from = window.scrollY;
    let push = false;
    if (wheelBusy) {
      // A glide only fades; a scroll that grows well past the recent low is a new push.
      const newPush = (now - busySince > 300 && size > low * 2.2 + 6) || (size > 4 && Math.sign(px) !== busyDir);
      if (!newPush) {
        e.preventDefault();
        lastWheel = now;
        return;
      }
      wheelBusy = false;
      wheelSum = 0;
      from = wheelTarget; // count on from the stop the last move was heading to
      push = true;
    }
    if (!snapOn) return;
    e.preventDefault();
    lastWheel = now;
    wheelSum += px;
    if (!push && Math.abs(wheelSum) < 12) return;
    const down = wheelSum > 0;
    wheelSum = 0;
    const target = down ? stops.find((s) => s > from + 2) : [...stops].reverse().find((s) => s < from - 2);
    if (target === undefined) return;
    wheelBusy = true;
    busySince = now;
    busyDir = down ? 1 : -1;
    wheelTarget = target;
    const move = ++moveId;
    window.scrollTo({ top: target, behavior: "smooth" });
    const settle = () => {
      if (move !== moveId) return; // a newer move took over
      const t = performance.now();
      const arrived = Math.abs(window.scrollY - target) < 2 || !snapOn;
      if ((arrived && t - lastWheel > 180) || t - busySince > 4000) wheelBusy = false;
      else setTimeout(settle, 60);
    };
    setTimeout(settle, 250);
  }, { passive: false });

  /* ---------- Pin-Point: each day's number is always reached in full ---------- */

  // Scroll picks the day; the count itself runs on time, so it never stops between values.
  const STAGES = [
    { n: 100, label: "new players open Pin-Point for the first time." },
    { n: 32, label: "come back the next day." },
    { n: 18, label: "are still playing a week later." },
    { n: 8, label: "are still playing a month later." },
  ];
  const stageAt = (p) => (p < 0.12 ? 0 : p < 0.4 ? 1 : p < 0.68 ? 2 : 3);
  const pin = { stage: 0, from: 100, to: 100, start: 0, dur: 1, shown: 100, printed: 100 };

  function updatePinPoint(now) {
    const stage = stageAt(progress(box.pp));
    if (stage !== pin.stage) {
      pin.stage = stage;
      pin.from = pin.shown;
      pin.to = STAGES[stage].n;
      pin.start = now;
      pin.dur = 0.7 + (Math.abs(pin.to - pin.from) / 100) * 0.6;
      ppLabel.textContent = STAGES[stage].label;
      ppDays.forEach((li, i) => li.classList.toggle("is-on", i < stage));
    }
    const t = clamp((now - pin.start) / pin.dur);
    pin.shown = pin.from + (pin.to - pin.from) * easeOut(t);
    const n = Math.round(pin.shown);
    if (n !== pin.printed) {
      pin.printed = n;
      ppNum.textContent = n;
      dotEls.forEach((dot, i) => dot.classList.toggle("is-out", rank[i] >= n));
    }
  }

  /* ---------- The frame ---------- */

  function update(dt, now) {
    const y = window.scrollY;
    const vh = Site.vh;
    updateSnap(y);

    // Scene 1: the hook rises and fades.
    if (y < box.hero.top + box.hero.height) {
      const h = progress(box.hero);
      put(heroTitle, "transform", `translate3d(0, ${(-h * 120).toFixed(1)}px, 0)`);
      put(heroTitle, "opacity", Math.max(0, 1 - h * 1.5).toFixed(3));
      put(heroSub, "transform", `translate3d(0, ${(-h * 160).toFixed(1)}px, 0)`);
      put(heroSub, "opacity", Math.max(0, 1 - h * 2.4).toFixed(3));
    }

    // Scene 2: the photo settles in, then the words light up.
    const pa = progress(box.about);
    put(aboutScene, "--pa", pa.toFixed(4));
    const lit = Math.round(clamp((pa - 0.14) / 0.7) * wordEls.length);
    if (lit !== litCount) {
      wordEls.forEach((el, i) => el.classList.toggle("is-lit", i < lit));
      litCount = lit;
    }

    // Scene 3: one app at a time, on one phone.
    const raw = progress(box.apps) * count;
    const index = Math.min(count - 1, Math.floor(raw));
    const local = clamp(raw - index);
    setActiveApp(index);
    ticks.forEach((tick, i) => {
      put(tick, "--fill", (i < index ? 1 : i === index ? local : 0).toFixed(4));
      if (i === index) tick.setAttribute("aria-current", "true");
      else tick.removeAttribute("aria-current");
    });
    const appsVisible = inView(box.apps, y, vh);
    if (appsVisible !== appsOnScreen) { appsOnScreen = appsVisible; syncScreenVideos(); }
    if (appsVisible) {
      updatePhone(raw, clamp((y - (box.apps.top - vh)) / vh), dt, now);
    }

    // Scene 4: Pin-Point players.
    updatePinPoint(now);
    if (inView(box.pp, y, vh)) {
      const r = ppGlass.getBoundingClientRect();
      put(ppGlass, "--sx", `${(Site.pointer.x - r.left).toFixed(0)}px`);
      put(ppGlass, "--sy", `${(Site.pointer.y - r.top).toFixed(0)}px`);
    }

    // Time bars grow as they come into view.
    put(bars, "--g", ease(clamp((y + vh - box.bars.top) / (vh * 0.75))).toFixed(4));

    // Scene 5: the chapter bar fills, and marks the chapter on screen.
    const line = y + chapterOffset + 1;
    const cp = clamp((line - jobTops[0]) / (box.chapters.top + box.chapters.height - jobTops[0] - vh + chapterOffset));
    put(chapters, "--cp", cp.toFixed(4));
    // At the end of the page the last chapter's bottom space can't scroll away,
    // so the bar steps aside once that chapter is mostly gone.
    const chaptersBottom = box.chapters.top + box.chapters.height - y;
    chapterNav.classList.toggle("is-gone", chaptersBottom < chapterOffset + vh * 0.35);
    let current = -1;
    jobTops.forEach((top, i) => { if (line + vh * 0.25 >= top) current = i; });
    chapterLinks.forEach((link, i) => {
      link.classList.toggle("is-active", i === current);
      if (i === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });

    // Contact: the heading grows into place as it enters.
    scrubbed.forEach((el, i) => {
      const v = clamp((y + vh - box.scrub[i]) / (vh * 0.6));
      put(el, "transform", `scale(${(0.88 + v * 0.12).toFixed(4)})`);
      put(el, "opacity", (0.2 + v * 0.8).toFixed(3));
    });
  }

  let lastTime = performance.now() / 1000;
  function frame(ms) {
    const now = ms / 1000;
    const dt = Math.min(0.05, Math.max(0, now - lastTime));
    lastTime = now;
    update(dt, now);
    Site.onFrame.forEach((f) => f(dt, now));
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  measure();
  requestAnimationFrame(frame);

  /* ---------- One-time effects as elements enter ---------- */

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.add("is-in");
      observer.unobserve(target);
    });
  }, { rootMargin: "0px 0px -12% 0px" });
  $$("[data-reveal]").forEach((el) => revealObserver.observe(el));

  // Numbers count up from zero the first time they are seen.
  // "$2.5M" counts with one decimal; "47,000+" counts with thousands separators.
  const NUMBER = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/;
  const parseCount = (text) => {
    const [, prefix, digits, suffix] = text.match(NUMBER);
    return {
      prefix,
      suffix,
      end: Number(digits.replace(/,/g, "")),
      places: (digits.split(".")[1] || "").length,
      grouped: digits.includes(","),
    };
  };
  const showCount = (n, c) =>
    c.prefix + (c.grouped ? Math.round(n).toLocaleString("en-US") : n.toFixed(c.places)) + c.suffix;
  const countObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      const c = parseCount(target.dataset.final);
      const start = performance.now();
      const duration = 1100;
      const step = (ms) => {
        const t = clamp((ms - start) / duration);
        target.textContent = t < 1 ? showCount(c.end * easeOut(t), c) : target.dataset.final;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => {
    el.dataset.final = el.textContent.trim();
    // Only numbers still below the screen start from zero; anything already visible stays as is.
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.textContent = showCount(0, parseCount(el.dataset.final));
      countObserver.observe(el);
    }
  });
})();
