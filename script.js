(() => {
  const tokens = Array.from(document.querySelectorAll(".token"));
  const tick = document.getElementById("tick");
  const glitchNoise = document.getElementById("glitchNoise");
  const revealPanel = document.getElementById("revealPanel");
  const subliminal = document.getElementById("subliminal");

  const REQUIRED = ["m", "i", "d", "a"];
  const found = new Set();
  let takeoverTriggered = false;

  function safePlay(audioEl, { loop = false, volume = 1 } = {}) {
    if (!audioEl) return;
    audioEl.loop = loop;
    audioEl.volume = volume;
    try { audioEl.currentTime = 0; } catch {}
    const p = audioEl.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function safeStop(audioEl) {
    if (!audioEl) return;
    try {
      audioEl.pause();
      audioEl.currentTime = 0;
    } catch {}
  }

  function markStartTime() {
    if (!localStorage.getItem("mida_start_ms")) {
      localStorage.setItem("mida_start_ms", String(Date.now()));
    }
  }

  function pulse(el) {
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  }

  function applyProgressEffects() {
    const progress = found.size;

    // click 3: subtle distortion
    if (progress >= 3) document.body.classList.add("glitch");
    else document.body.classList.remove("glitch");

    // click 4: reveal + subliminal + takeover
    if (progress === 4 && !takeoverTriggered) {
      takeoverTriggered = true;

      const start = Number(localStorage.getItem("mida_start_ms") || Date.now());
      const end = Date.now();
      localStorage.setItem("mida_duration_ms", String(Math.max(0, end - start)));

      runSubliminalReveal()
        .then(() => {
          revealPanel?.classList.add("show");
          revealPanel?.setAttribute("aria-hidden", "false");

          setTimeout(() => {
            deimosTakeover();
          }, 450);
        })
        .catch(() => {
          setTimeout(() => deimosTakeover(), 200);
        });
    }
  }

  function runSubliminalReveal() {
    if (!subliminal) return Promise.resolve();

    const layers = Array.from(subliminal.querySelectorAll(".subliminal-layer"));
    subliminal.classList.add("show");
    subliminal.setAttribute("aria-hidden", "false");

    // glitch noise while subliminals run
    safePlay(glitchNoise, { loop: true, volume: 0.55 });

    const seq = [
      { t: 0,   a: [1,0,0], shake: 2 },
      { t: 70,  a: [0,1,0], shake: 3 },
      { t: 140, a: [0,0,1], shake: 4 },
      { t: 220, a: [1,0,1], shake: 6 },
      { t: 300, a: [0,0,0], shake: 1 },
      { t: 380, a: [0,1,1], shake: 5 },
      { t: 470, a: [1,0,0], shake: 7 },
      { t: 560, a: [0,0,1], shake: 4 },
      { t: 650, a: [0,0,0], shake: 0 }
    ];

    seq.forEach(step => {
      setTimeout(() => {
        layers.forEach((layer, idx) => {
          const on = step.a[idx] === 1;
          layer.style.opacity = on ? "0.88" : "0";
          if (on) {
            const s = step.shake;
            layer.style.transform =
              `translate(${(Math.random() * (s*2) - s).toFixed(2)}px, ${(Math.random() * (s*2) - s).toFixed(2)}px)`;
          } else {
            layer.style.transform = "translate(0,0)";
          }
        });
      }, step.t);
    });

    return new Promise(resolve => {
      setTimeout(() => {
        subliminal.classList.remove("show");
        subliminal.setAttribute("aria-hidden", "true");
        layers.forEach(l => {
          l.style.opacity = "0";
          l.style.transform = "translate(0,0)";
        });

        setTimeout(() => safeStop(glitchNoise), 900);

        resolve();
      }, 900);
    });
  }

  function deimosTakeover() {
    document.body.classList.add("deimos");

    const root = document.getElementById("pageRoot") || document.body;
    const PHRASE = "DEIMOS IS MISSING";

    // Replace text nodes but skip protected blocks.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        if (parent.closest("[data-protect='true']")) return NodeFilter.FILTER_REJECT;

        const tag = parent.tagName ? parent.tagName.toLowerCase() : "";
        if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(n => {
      const len = n.nodeValue.length;
      if (len < 3) return;

      const fill = (PHRASE + " ").repeat(Math.ceil(len / (PHRASE.length + 1))).slice(0, len);
      n.nodeValue = fill;
    });

    // Lock tokens 
    tokens.forEach(t => {
      t.tabIndex = -1;
      t.classList.remove("pulse");
    });
  }

  function handleTokenActivate(el) {
    // during takeover to ignore interactions
    if (document.body.classList.contains("deimos")) return;

    markStartTime();
    safePlay(tick, { loop: false, volume: 0.9 });
    pulse(el);

    const letter = (el.getAttribute("data-letter") || "").toLowerCase();
    if (!REQUIRED.includes(letter)) return;

    // Toggle support
    if (found.has(letter)) {
      found.delete(letter);
      el.classList.remove("is-found");

      if (found.size < 4) {
        revealPanel?.classList.remove("show");
        revealPanel?.setAttribute("aria-hidden", "true");
      }
      applyProgressEffects();
      return;
    }

    found.add(letter);
    el.classList.add("is-found");
    applyProgressEffects();
  }

  // Event
  tokens.forEach(el => {
    el.addEventListener("click", () => handleTokenActivate(el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleTokenActivate(el);
      }
    });
  });

  // Debug help
  if (tokens.length === 0) {
    console.warn("[MIDA NODE] No .token elements found. Check index.html figcaption spans.");
  }
})();
