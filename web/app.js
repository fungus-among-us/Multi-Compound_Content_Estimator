(() => {
  const DEFAULT_LIB =
    "https://raw.githubusercontent.com/fungus-among-us/Mushroom_Math/refs/heads/main/profiles.json";

  const VISUALIZERS = [
    "shooter/index.html",
    "sparkling-boxes.html",
    "particle-supernova.html",
    "magma.html",
    "reflecting.html",
    "motion-blur.html",
  ];

  const state = {
    profiles: [],
    profIdx: -1,
    massMode: "dry",
    localAudio: new Audio(),
    localList: [],
    localIdx: 0,
    visIdx: 0,
    visTimer: null,
    uiVisible: true,
    settings: { speed: 1.0, autoCycle: 0 },
    audioCtx: null,
    analyser: null,
  };

  state.localAudio.volume = 0.5;

  const els = {
    ui: document.getElementById("mainUi"),
    hint: document.getElementById("uiHint"),
    vis: document.getElementById("visFrame"),
    // Nav
    visPrev: document.getElementById("visPrevBtn"),
    visNext: document.getElementById("visNextBtn"),
    hide: document.getElementById("hideUiBtn"),
    set: document.getElementById("settingsBtn"),
    // Input
    url: document.getElementById("libraryUrl"),
    load: document.getElementById("loadUrlBtn"),
    stat: document.getElementById("statusText"),
    file: document.getElementById("libraryFile"),
    prof: document.getElementById("profileSelect"),
    massTog: document.getElementById("massModeToggle"),
    mass: document.getElementById("massInput"),
    dryRow: document.getElementById("dryFractionRow"),
    drySlide: document.getElementById("dryFraction"),
    dryVal: document.getElementById("dryFractionVal"),
    bw: document.getElementById("bodyWeight"),
    bwUnit: document.getElementById("weightUnit"),
    target: document.getElementById("targetDose"),
    calc: document.getElementById("calculateBtn"),
    clear: document.getElementById("clearBtn"),
    out: document.getElementById("outputContainer"),
    // Audio
    track: document.getElementById("trackTitle"),
    cur: document.getElementById("currTime"),
    dur: document.getElementById("durTime"),
    prev: document.getElementById("prevBtn"),
    play: document.getElementById("playBtn"),
    next: document.getElementById("nextBtn"),
    mute: document.getElementById("muteBtn"),
    vol: document.getElementById("volSlider"),
    loadMus: document.getElementById("loadMusicBtn"),
    musFile: document.getElementById("musicFileInput"),
    plTog: document.getElementById("playlistToggleBtn"),
    plPan: document.getElementById("playlistPanel"),
    plUl: document.getElementById("playlistUl"),
    plClose: document.getElementById("closePlaylist"),
    // Config
    modal: document.getElementById("settingsModal"),
    save: document.getElementById("saveSettingsBtn"),
    spd: document.getElementById("animSpeed"),
    cyc: document.getElementById("autoCycleTime"),
  };

  // --- UTILS ---
  const safe = (v) => {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  };
  const fmt = (n, d = 2) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: d,
    });
  const fmtTime = (s) => {
    if (isNaN(s) || !isFinite(s)) return "00:00";
    const m = Math.floor(s / 60);
    const sc = Math.floor(s % 60);
    return `${m}:${sc < 10 ? "0" + sc : sc}`;
  };

  // --- VISUALIZER ---
  function loadVis(i) {
    const len = VISUALIZERS.length;
    state.visIdx = ((i % len) + len) % len;

    if (VISUALIZERS[state.visIdx].includes("motion-blur") && !navigator.gpu) {
      state.visIdx = (state.visIdx + 1) % len;
    }

    const url = `${VISUALIZERS[state.visIdx]}?speed=${state.settings.speed}`;
    els.vis.src = url;
  }

  function cycleVis(n) {
    clearInterval(state.visTimer);
    loadVis(state.visIdx + n);
    if (state.settings.autoCycle > 0) {
      state.visTimer = setInterval(
        () => loadVis(state.visIdx + 1),
        state.settings.autoCycle * 1000
      );
    }
  }

  // --- AUDIO + BEAT DETECTION (LOCAL ONLY) ---
  let analyserData = null;
  let beatLoopStarted = false;

  function initAudioAnalyser() {
    if (state.audioCtx || !window.AudioContext) return;
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const srcNode = state.audioCtx.createMediaElementSource(state.localAudio);
      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 1024;
      state.analyser.minDecibels = -90;
      state.analyser.maxDecibels = -10;
      state.analyser.smoothingTimeConstant = 0.85;
      srcNode.connect(state.analyser);
      state.analyser.connect(state.audioCtx.destination);
      analyserData = new Uint8Array(state.analyser.frequencyBinCount);
      startBeatLoop();
    } catch (err) {
      console.warn("Audio analyser init failed", err);
    }
  }

  function startBeatLoop() {
    if (beatLoopStarted || !state.analyser) return;
    beatLoopStarted = true;

    const energyHistory = [];
    const HISTORY_SIZE = 43;
    let lastBeatTime = 0;
    const MIN_BEAT_INTERVAL = 120; // ms

    function loop() {
      if (
        state.analyser &&
        !state.localAudio.paused &&
        !state.localAudio.muted
      ) {
        state.analyser.getByteFrequencyData(analyserData);
        let sum = 0;
        for (let i = 0; i < analyserData.length; i++) sum += analyserData[i];
        const energy = sum / analyserData.length;

        energyHistory.push(energy);
        if (energyHistory.length > HISTORY_SIZE) energyHistory.shift();

        const avg =
          energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length || 0;
        let variance = 0;
        for (let i = 0; i < energyHistory.length; i++) {
          const d = energyHistory[i] - avg;
          variance += d * d;
        }
        variance /= energyHistory.length || 1;
        const std = Math.sqrt(variance) || 1;

        const z = (energy - avg) / std;
        const now = performance.now();

        if (
          z > 2.0 &&
          energy > avg * 1.15 &&
          now - lastBeatTime > MIN_BEAT_INTERVAL
        ) {
          lastBeatTime = now;
          const visWin = els.vis && els.vis.contentWindow;
          if (visWin && visWin.postMessage) {
            visWin.postMessage({ type: "audio-beat", energy }, "*");
          }
        }
      }
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  function togglePlay() {
    if (!state.localList.length) {
      els.musFile.click();
      return;
    }
    if (state.localAudio.paused) {
      state.localAudio.play();
      els.play.textContent = "⏸";
      if (state.audioCtx) {
        state.audioCtx.resume();
      } else {
        initAudioAnalyser();
      }
    } else {
      state.localAudio.pause();
      els.play.textContent = "▶";
    }
  }

  // Local file loading
  els.loadMus.onclick = () => els.musFile.click();
  els.musFile.onchange = (e) => {
    const f = Array.from(e.target.files).filter((x) =>
      x.type.startsWith("audio/")
    );
    if (!f.length) return;

    state.localList = f;
    state.localIdx = 0;
    els.track.textContent = "LOCAL PLAYLIST";
    playLocal(0);
    renderPlaylist();
    els.plPan.classList.remove("hidden");
  };

  function playLocal(i) {
    if (!state.localList.length) return;
    if (i < 0) i = state.localList.length - 1;
    if (i >= state.localList.length) i = 0;

    state.localIdx = i;
    const file = state.localList[i];

    state.localAudio.src = URL.createObjectURL(file);
    state.localAudio.play().then(() => {
      if (!state.audioCtx) initAudioAnalyser();
      else if (state.audioCtx.state === "suspended") state.audioCtx.resume();
    });
    els.track.textContent = file.name;
    els.play.textContent = "⏸";

    renderPlaylist();
  }

  function renderPlaylist() {
    els.plUl.innerHTML = "";
    state.localList.forEach((f, i) => {
      const li = document.createElement("li");
      li.textContent = f.name;
      if (i === state.localIdx) li.classList.add("active");
      li.onclick = () => playLocal(i);
      els.plUl.appendChild(li);
    });
  }

  state.localAudio.onended = () => playLocal(state.localIdx + 1);
  state.localAudio.ontimeupdate = () => {
    els.cur.textContent = fmtTime(state.localAudio.currentTime);
    els.dur.textContent = fmtTime(state.localAudio.duration);
  };

  els.play.onclick = togglePlay;
  els.next.onclick = () => playLocal(state.localIdx + 1);
  els.prev.onclick = () => playLocal(state.localIdx - 1);
  els.vol.oninput = (e) => {
    const v = e.target.value;
    state.localAudio.volume = v / 100;
  };
  els.mute.onclick = () => {
    state.localAudio.muted = !state.localAudio.muted;
  };
  els.plTog.onclick = () => els.plPan.classList.toggle("hidden");
  els.plClose.onclick = () => els.plPan.classList.add("hidden");

  // --- CALC LOGIC ---
  function parseLib(d) {
    const raw = Array.isArray(d) ? d : d.profiles || [];
    return raw.map((p) => ({
      label: p.label || "Unknown",
      compounds: (p.compounds || [])
        .map((c) => ({
          name: c.name,
          mg: safe(c.mg_per_g || c.concentration_mg_per_g || c.mg_per_g_dry),
        }))
        .filter((c) => c.name && c.mg > 0),
    }));
  }
  function renderProf() {
    els.prof.innerHTML = "";
    state.profiles.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = p.label.toUpperCase();
      els.prof.appendChild(o);
    });
    els.prof.disabled = false;
    els.prof.value = 0;
  }
  function compute() {
    const prof = state.profiles[parseInt(els.prof.value)];
    if (!prof) return;
    const mass = safe(els.mass.value),
      dryPct = safe(els.drySlide.value),
      bw = safe(els.bw.value),
      target = safe(els.target.value);
    const bwKg = els.bwUnit.value === "kg" ? bw : bw * 0.453592;
    const isTarget = target > 0 && bw > 0;
    const totalP = prof.compounds.reduce((a, b) => a + b.mg, 0);

    let dm = 0,
      wm = 0;
    if (isTarget) {
      if (totalP === 0) return alert("Err: 0 Potency");
      dm = (target * bwKg) / totalP;
      wm = dryPct > 0 ? dm / (dryPct / 100) : 0;
    } else {
      if (state.massMode === "dry") {
        dm = mass;
        wm = dryPct > 0 ? dm / (dryPct / 100) : 0;
      } else {
        wm = mass;
        dm = wm * (dryPct / 100);
      }
    }
    const totalAct = dm * totalP;
    const rows = prof.compounds
      .map((c) => {
        const tot = c.mg * dm;
        const dose = bwKg > 0 ? tot / bwKg : 0;
        return `<tr><td>${c.name}</td><td>${fmt(
          c.mg
        )}</td><td class="val-hl">${fmt(tot, 1)} mg</td><td>${
          bwKg > 0 ? fmt(dose, 2) + " mg/kg" : "--"
        }</td></tr>`;
      })
      .join("");

    els.out.innerHTML = `
      <div class="report-frame">
        <div class="kpi-row">
          <div class="kpi"><span>MODE</span><strong>${
            isTarget ? "TARGET" : "ANALYSIS"
          }</strong></div>
          <div class="kpi"><span>DRY MASS</span><strong>${fmt(
            dm,
            2
          )} g</strong></div>
          <div class="kpi"><span>ACTIVES</span><strong style="color:var(--highlight)">${fmt(
            totalAct,
            1
          )} mg</strong></div>
          ${
            wm > 0
              ? `<div class="kpi"><span>WET MASS</span><strong>${fmt(
                  wm,
                  2
                )} g</strong></div>`
              : ""
          }
        </div>
        <table class="data-grid"><thead><tr><th>COMPOUND</th><th>POTENCY (mg/g)</th><th>TOTAL</th><th>DOSE</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  // --- UI EVENTS ---
  function toggleUi() {
    state.uiVisible = !state.uiVisible;
    if (state.uiVisible) {
      els.ui.classList.remove("hidden");
      els.hint.classList.add("hidden");
    } else {
      els.ui.classList.add("hidden");
      els.hint.classList.remove("hidden");
      els.vis.focus();
    }
  }
  els.hide.onclick = toggleUi;
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        toggleUi();
      }
    },
    true
  );

  // Nav
  els.visPrev.onclick = () => cycleVis(-1);
  els.visNext.onclick = () => cycleVis(1);

  // Inputs
  els.load.onclick = async () => {
    try {
      els.stat.textContent = "LOADING...";
      const r = await fetch(els.url.value);
      state.profiles = parseLib(await r.json());
      renderProf();
      els.stat.textContent = "LINK ESTABLISHED";
      els.stat.classList.add("active");
    } catch {
      els.stat.textContent = "CONNECTION FAILED";
    }
  };

  els.file.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        state.profiles = parseLib(JSON.parse(ev.target.result));
        renderProf();
        els.stat.textContent = "FILE LOADED";
        els.stat.classList.add("active");
      } catch {
        alert("Bad JSON");
      }
    };
    r.readAsText(f);
  };

  els.calc.onclick = compute;
  els.clear.onclick = () => {
    els.out.innerHTML =
      '<div class="empty-state">> SYSTEM_READY<br>> WAITING_FOR_INPUT_<span class="blink">_</span></div>';
  };

  els.massTog.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        state.massMode = b.dataset.mode;
        els.massTog
          .querySelectorAll("button")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        els.dryRow.style.display = state.massMode === "wet" ? "block" : "none";
      })
  );
  els.drySlide.oninput = (e) => (els.dryVal.textContent = e.target.value);

  // Settings
  els.set.onclick = () => els.modal.classList.remove("hidden");
  els.save.onclick = () => {
    state.settings.speed = parseFloat(els.spd.value);
    state.settings.autoCycle = parseInt(els.cyc.value, 10) || 0;
    els.modal.classList.add("hidden");
    loadVis(state.visIdx);
  };

  // Cross-Window Comms
  window.addEventListener("message", (e) => {
    if (e.data === "vis-next") els.visNext.click();
    if (e.data === "vis-prev") els.visPrev.click();
    if (e.data === "audio-toggle") togglePlay();
    if (e.data === "toggle-ui") toggleUi();
  });

  // Init
  els.url.value = DEFAULT_LIB;
  els.track.textContent = "LOCAL AUDIO: NO TRACK";
  loadVis(0);
})();
