// NEXUS Application Logic - Enhanced with Centralized Configuration
"use strict";

// DOM Helpers
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Escape function for safe HTML
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// Application State
const state = {
  image: null,
  audio: null,
  caseId: sessionStorage.getItem("nexus-case") || "",
  stream: null,
  recorder: null,
  chunks: [],
  previewUrl: null,
  isDemoActive: false,
  demoData: null
};

// Toast timer
let toastTimer;

// Initialize from config
const config = window.NEXUS_CONFIG || {
  limits: { imageMaxSize: 12 * 1024 * 1024, audioMaxSize: 24 * 1024 * 1024 },
  features: { demoMode: true }
};

// Theme management
function loadTheme() {
  const saved = localStorage.getItem("nexus-theme");
  if (saved === "light") {
    document.body.classList.add("theme-light");
  } else if (saved === "dark") {
    document.body.classList.remove("theme-light");
  }
  return saved;
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("theme-light");
  localStorage.setItem("nexus-theme", isLight ? "light" : "dark");
  $("#theme-toggle").setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
}

// Toast notification
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.toggle("is-error", error);
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3600);
}

// Case management
function setCase(id) {
  state.caseId = id;
  sessionStorage.setItem("nexus-case", id);
  $("#case-id-label").textContent = "ACTIVE  " + id;
  $("#fusion-button").disabled = false;
  $("#export-button").disabled = false;
}

// Scroll helper
function reveal() {
  $("#investigate").scrollIntoView({behavior:"smooth",block:"start"});
}

// API helper
async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed (" + response.status + ")");
  return data;
}

// Status helper
function humanStatus(status) {
  return ({
    "complete":"COMPLETE",
    "partial":"PARTIAL  MODEL UNAVAILABLE",
    "unavailable":"NOT CONFIGURED",
    "error":"REQUEST FAILED",
    "failed":"FAILED"
  })[status] || String(status || "UNKNOWN").toUpperCase();
}

// Render result cards for analysis
function taskCard(title, task) {
  const status = task?.status || "unavailable";
  let content = "";
  if (status === "complete") {
    const val = task.result ?? task.text ?? task.caption;
    if (Array.isArray(val)) {
      content = "<ul>" + val.map((x) => "<li>" + esc(x.label) + " <span>" + Math.round((Number(x.score)||0)*100) + "%</span></li>").join("") + "</ul>";
    } else if (typeof val === "string") {
      content = "<p>" + esc(val) + "</p>";
    } else if (val && typeof val === "object") {
      content = "<pre>" + esc(JSON.stringify(val,null,2)) + "</pre>";
    } else {
      content = "<p>Task completed.</p>";
    }
  } else {
    content = "<p>" + esc(task?.message || "No result is available.") + "</p>";
  }
  return "<article class=\"result-card\"><div class=\"result-card-head\"><strong>" + esc(title) + "</strong><span class=\"result-status " + esc(status) + "\">" + esc(humanStatus(status)) + "</span></div>" + content + (task?.model ? "<small>Model: " + esc(task.model) + "</small>" : "") + "</article>";
}

// Render image analysis results
function renderImage(data) {
  const r = data.result;
  $("#image-result").hidden = false;
  let metadataHTML = "";
  if (r.image_metadata?.result) {
    const m = r.image_metadata.result;
    metadataHTML = "<ul>";
    metadataHTML += "<li>Format: " + esc(m.format || "unknown") + "</li>";
    metadataHTML += "<li>Dimensions: " + (m.width || "?") + "x" + (m.height || "?") + " pixels</li>";
    metadataHTML += "<li>Mode: " + (m.mode || "unknown") + "</li>";
    if (m.exif) {
      Object.keys(m.exif).forEach(function(k) {
        metadataHTML += "<li>" + esc(k) + ": " + esc(m.exif[k]) + "</li>";
      });
    }
    metadataHTML += "</ul>";
  }
  $("#image-result").innerHTML =
    "<div class=\"result-heading\"><div><span class=\"section-kicker\">IMAGE ANALYSIS  " + esc(data.status) + "</span><h3>" + esc(r.file.name) + "</h3></div><span class=\"risk-badge\">" + esc((r.keyword_risk?.level||"unknown").toUpperCase()) + " RULE INDICATOR</span></div>" +
    "<div class=\"result-grid\">" +
      taskCard("AI-generated image classification", r.ai_generated_detection) +
      taskCard("Image understanding", {status:r.image_understanding.status, text:r.image_understanding.caption, message:r.image_understanding.message, model:r.image_understanding.model}) +
      "<article class=\"result-card wide\"><div class=\"result-card-head\"><strong>Image metadata</strong><span class=\"result-status complete\">COMPLETE</span></div><p>EXIF and technical information extracted locally.</p>" + metadataHTML + "</article>" +
    "</div>" +
    "<p class=\"risk-note\">" + esc(r.keyword_risk?.rule||"") + "</p>" +
    "<p class=\"risk-note\">" + r.limitations.map(esc).join(" ") + "</p>";
}

// Render audio analysis results
function renderAudio(data) {
  const r = data.result;
  $("#audio-result").hidden = false;
  let metadataHTML = "";
  if (r.technical_metadata?.result) {
    const m = r.technical_metadata.result;
    metadataHTML = "<ul>" +
      "<li>Duration: " + (m.duration_seconds || "?") + " seconds</li>" +
      "<li>Sample rate: " + (m.sample_rate_hz || "?") + " Hz</li>" +
      "<li>Channels: " + (m.channels || "?") + "</li>" +
      "<li>Container: " + (m.container || "unknown") + "</li>" +
      "</ul>";
  }
  $("#audio-result").innerHTML =
    "<div class=\"result-heading\"><div><span class=\"section-kicker\">AUDIO ANALYSIS  " + esc(data.status) + "</span><h3>" + esc(r.file.name) + "</h3></div><span class=\"risk-badge\">" + (r.crisis_keywords.length ? "KEYWORDS  " + r.crisis_keywords.map(esc).join(", ") : "NO MATCHED KEYWORDS") + "</span></div>" +
    "<div class=\"result-grid\">" +
      taskCard("Synthetic voice classification", r.synthetic_voice_detection) +
      taskCard("Speech transcription", r.speech_to_text) +
      "<article class=\"result-card wide\"><div class=\"result-card-head\"><strong>Audio metadata</strong><span class=\"result-status complete\">COMPLETE</span></div><p>Technical information extracted locally.</p>" + metadataHTML + "</article>" +
    "</div>" +
    "<p class=\"risk-note\">" + r.limitations.map(esc).join(" ") + "</p>";
}

// Refresh system health
async function refreshHealth() {
  try {
    const health = await api("/api/health");
    const rows = [
      {name:"FastAPI backend", available:health.backend.available},
      {name:"Local SQLite database", available:health.database.available}
    ];
    Object.entries(health.models).forEach(function([key, value]) {
      rows.push({
        name: key.replace(/_/g, " "),
        available:value.configured,
        message:value.message
      });
    });

    $("#health-list").innerHTML = rows.map(function(x) {
      return "<div class=\"health-row\"><span class=\"health-led " + (x.available?"is-up":"is-down") + "\"></span><strong>" + esc(x.name) + "</strong><span>" + (x.available?"READY":"NOT CONFIGURED") + "</span>" + (x.message?"<small>" + esc(x.message) + "</small>":"") + "</div>";
    }).join("");

    $("#system-status").classList.toggle("is-online", health.backend.available && health.database.available);
    $("#status-label").textContent = (health.backend.available && health.database.available) ? "SYSTEM ONLINE" : "DEGRADED";
  } catch(error) {
    $("#health-list").innerHTML = "<div class=\"empty-state\">" + esc(error.message) + ". Start the local server and reload.</div>";
    $("#status-label").textContent = "OFFLINE";
  }
}

// Draw activity chart
function drawChart(activity) {
  const box = $("#activity-chart");
  const max = Math.max(1, ...activity.map(function(x) { return x.count; }));

  if (!activity.length || max === 0) {
    box.innerHTML = "<div class=\"empty-state\">No analysis activity recorded yet.</div>";
    return;
  }

  box.innerHTML = "<div class=\"activity-bars\">" +
    activity.map(function(x) {
      return "<div class=\"activity-day\"><span class=\"activity-count\">" + x.count + "</span><div class=\"activity-bar\" style=\"height:" + Math.max(4, Math.round(x.count/max*100)) + "%\"></div><small>" + esc(x.date.slice(5)) + "</small></div>";
    }).join("") +
  "</div>";
}

// Refresh dashboard data
async function refreshDashboard() {
  try {
    const d = await api("/api/dashboard");
    const t = d.totals;
    [ ["#stat-total", t.total], ["#stat-images", t.images], ["#stat-audio", t.audio], ["#stat-errors", t.errors] ].forEach(function(pair) {
      $(pair[0]).textContent = pair[1];
    });

    drawChart(d.activity);

    for (const key of ["low","medium","high","unknown"]) {
      const el = $("#risk-" + key);
      if (el) el.textContent = d.risk_distribution[key] || 0;
    }

    if ($("#risk-rule-note")) {
      $("#risk-rule-note").textContent = d.risk_rule_note;
    }
  } catch(error) {
    toast(error.message, true);
  }
}

// Format file size
function formatSize(bytes) {
  return bytes < 1048576 ? (bytes/1024).toFixed(0) + " KB" : (bytes/1048576).toFixed(2) + " MB";
}

// Set file for analysis
function setFile(kind, file) {
  if (!file) return;

  const max = kind === "image" ? 12 : 24;
  if (file.size > max * 1048576) {
    toast("File exceeds the " + max + " MB limit.", true);
    return;
  }

  state[kind] = file;
  const base = kind === "image" ? "image" : "audio";

  $("#" + base + "-file-name").textContent = file.name;
  $("#" + base + "-file-info").textContent = formatSize(file.size) + "  " + (file.type || "unknown type");
  $("#" + base + "-selected").hidden = false;
  $("#" + base + "-analyze").disabled = false;
  $("#" + base + "-result").hidden = true;

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }
  state.previewUrl = URL.createObjectURL(file);

  if (kind === "image") {
    $("#image-preview").src = state.previewUrl;
  } else {
    $("#audio-preview").src = state.previewUrl;
  }

  reveal();
}

// Clear file
function clearFile(kind) {
  state[kind] = null;
  const base = kind;

  $("#" + base + "-selected").hidden = true;
  $("#" + base + "-input").value = "";
  $("#" + base + "-analyze").disabled = true;
  $("#" + base + "-result").hidden = true;

  if (kind === "image") {
    $("#image-preview").removeAttribute("src");
  } else {
    $("#audio-preview").removeAttribute("src");
  }

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
}

// Run analysis
async function analyze(kind) {
  const file = state[kind];
  if (!file) return;

  const button = $("#" + kind + "-analyze");
  const progress = $("#" + kind + "-progress");

  button.disabled = true;
  progress.textContent = "Inspecting locally and checking configured models...";

  const form = new FormData();
  form.append("file", file);
  form.append("data_consent", $("#" + kind + "-consent").checked);
  form.append("investigation_id", state.caseId);
  form.append("location", $("#location-input").value);
  form.append("caller_notes", $("#notes-input").value);

  try {
    const result = await api("/api/analyze/" + kind, {method:"POST", body:form});
    setCase(result.investigation_id);

    if (kind === "image") {
      renderImage(result);
    } else {
      renderAudio(result);
    }

    progress.textContent = result.status === "complete" ? "Analysis finished." : "Metadata saved. Some configured model tasks are unavailable.";

    toast("Saved analysis " + result.analysis_id + ".");
    await refreshDashboard();
    await refreshVault();
  } catch(error) {
    progress.textContent = error.message;
    toast(error.message, true);
  } finally {
    button.disabled = !state[kind];
  }
}

// Risk tag generator
function riskTag(level) {
  return "<span class=\"risk-badge risk-" + esc(level) + "\">" + esc((level||"unknown").toUpperCase()) + "</span>";
}

// Refresh vault list
async function refreshVault(query) {
  if (query === undefined) query = "";
  try {
    const data = await api("/api/investigations?q=" + encodeURIComponent(query));
    const list = $("#investigation-list");

    if (!data.items.length) {
      list.innerHTML = "<div class=\"empty-state\">No saved investigations yet. Analyze evidence to create a local record.</div>";
      return;
    }

    list.innerHTML = data.items.map(function(x) {
      return "<article class=\"vault-item\"><div class=\"vault-item-main\"><strong>" + esc(x.id) + "</strong><span>" + esc(x.location || "No location provided") + "</span><small>" + esc(new Date(x.updated_at).toLocaleString()) + "  " + x.analysis_count + " evidence item(s)</small></div><div class=\"vault-item-actions\">" + riskTag(x.risk_level) + "<button class=\"button button-quiet\" data-open=\"" + esc(x.id) + "\">Details</button><button class=\"button button-quiet\" data-delete=\"" + esc(x.id) + "\">Delete</button><a class=\"button button-quiet\" href=\"/api/investigations/" + encodeURIComponent(x.id) + "/report\">PDF</a></div></article>";
    }).join("");
  } catch(error) {
    $("#investigation-list").innerHTML = "<div class=\"empty-state\">" + esc(error.message) + "</div>";
  }
}

// Open case details
async function openDetail(id) {
  try {
    const x = await api("/api/investigations/" + encodeURIComponent(id));
    const panel = $("#investigation-detail");
    panel.hidden = false;

    let fusionHTML = "";
    if (x.fusion) {
      const ai = x.fusion.ai_summary || {};
      fusionHTML = "<article class=\"detail-analysis\"><strong>Combined summary</strong><small>" + (ai.status === "complete" ? "AI-generated" : ai.status) + "</small>" +
        "<pre>" + esc(JSON.stringify(x.fusion, null, 2)) + "</pre></article>";
    }

    panel.innerHTML =
      "<div class=\"detail-head\"><div><span class=\"section-kicker\">INVESTIGATION RECORD</span><h3>" + esc(x.id) + " " + riskTag(x.keyword_risk.level) + "</h3><p>" + esc(x.location || "No location supplied") + "  Updated " + esc(new Date(x.updated_at).toLocaleString()) + "</p></div><button class=\"button button-quiet\" id=\"detail-close\">Close</button></div>" +
      x.analyses.map(function(a) {
        return "<article class=\"detail-analysis\"><strong>" + esc(a.modality.toUpperCase()) + "  " + esc(a.file_name) + "</strong><small>" + esc(a.status) + "  " + esc(new Date(a.created_at).toLocaleString()) + "  " + formatSize(a.size_bytes) + "</small><pre>" + esc(JSON.stringify(a.result, null, 2)) + "</pre></article>";
      }).join("") +
      fusionHTML;

    panel.scrollIntoView({behavior:"smooth",block:"center"});
    document.getElementById("detail-close").addEventListener("click", function() { panel.hidden = true; });
  } catch(error) {
    toast(error.message, true);
  }
}

// Run multimodal fusion
async function runFusion() {
  if (!state.caseId) return;

  const btn = $("#fusion-button");
  btn.disabled = true;
  $("#fusion-result").hidden = false;
  $("#fusion-result").innerHTML = "<div class=\"empty-state\">Preparing evidence comparison...</div>";

  try {
    const data = await api("/api/analyze/multimodal", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        investigation_id: state.caseId,
        caller_notes: $("#notes-input").value,
        data_consent: $("#fusion-consent").checked
      })
    });

    const ai = data.ai_summary;

    let summaryHTML = "";
    if (ai.status === "complete") {
      summaryHTML = "<p>" + esc(ai.text) + "</p>";
    } else {
      summaryHTML = "<p class=\"empty-state\">" + esc(ai.message || "Summary unavailable.") + "</p>";
    }

    $("#fusion-result").innerHTML =
      "<div class=\"result-heading\"><div><span class=\"section-kicker\">COMBINED REVIEW</span><h3>" + esc(data.investigation_id) + "  " + esc(data.keyword_risk.level.toUpperCase()) + " RULE INDICATOR</h3></div>" + riskTag(data.keyword_risk.level) + "</div>" +
      "<article class=\"result-card wide\"><div class=\"result-card-head\"><strong>AI-generated summary</strong><span class=\"result-status " + esc(ai.status) + "\">" + esc(humanStatus(ai.status)) + "</span></div>" +
      summaryHTML +
      "<small>Model: " + esc(ai.model || "N/A") + "</small></article>" +
      "<article class=\"result-card wide\"><strong>Evidence comparison</strong><p>" + esc(data.comparison.relationship_conclusion) + "</p>" +
      "<p>Available modalities: " + data.comparison.available_modalities.map(esc).join(", ") + "</p>" +
      "<ul>" + data.comparison.verification_steps.map(function(x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></article>" +
      "<p class=\"risk-note\">" + esc(data.keyword_risk.rule) + "</p>";

    await refreshDashboard();
    await refreshVault();
  } catch(error) {
    $("#fusion-result").innerHTML = "<div class=\"empty-state\">" + esc(error.message) + "</div>";
    toast(error.message, true);
  } finally {
    btn.disabled = false;
  }
}

// Show demo dialog
function showDemo() {
  const dialog = $("#demo-dialog");
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    toast("Demo sample is already labeled in the dialog.");
  }
}

// Show demo simulation
function showDemoSimulation() {
  const dialog = $("#demo-dialog");
  if (typeof dialog.showModal !== "function") return;

  const simType = state.demoData ? state.demoData.type : null;
  const demo = config.demo;

  if (simType === "image") {
    const d = demo.image.simulatedResults;
    dialog.innerHTML = "<div class=\"demo-dialog-head\"><div><span class=\"section-kicker\">SIMULATION ONLY</span><h2>Training case - Image</h2></div><button class=\"button button-quiet\" id=\"demo-close\" type=\"button\">Close</button></div>" +
      "<p>This is simulated data for testing without HF model access.</p>" +
      "<div class=\"demo-columns\"><article><span class=\"section-kicker\">IMAGE ANALYSIS</span><strong>" + esc(demo.image.name) + "</strong><span>Size: " + esc(demo.image.size) + "</span></article><article><span class=\"section-kicker\">AI CLASSIFICATION</span><strong>" + esc(d.aiGenerated[0].label) + "</strong><span>" + Math.round(d.aiGenerated[0].score * 100) + "% confidence</span></article><article><span class=\"section-kicker\">CAPTION</span><strong>Scene Understanding</strong><span>" + esc(d.caption) + "</span></article><article><span class=\"section-kicker\">RISK LEVEL</span><strong>" + (d.riskLevel || "unknown").toUpperCase() + "</strong><span>Matched terms: " + (d.matchedTerms || []).join(", ") + "</span></article></div>" +
      "<button class=\"button button-primary\" id=\"demo-load\">Load into Workspace</button>";

    const loadBtn = $("#demo-load");
    if (loadBtn) {
      loadBtn.addEventListener("click", function() {
        dialog.close();
        // Simulate file upload
        const file = new File([""], demo.image.name, {type: demo.image.type});
        file.size = parseInt(demo.image.size) * 1024 * 1024;
        setFile("image", file);

        // Show simulated results
        setTimeout(function() {
          renderImage({status: "complete", result: {
            file: {name: demo.image.name, mime_type: demo.image.type, size_bytes: file.size},
            image_metadata: {status: "complete", ...d.metadata},
            ai_generated_detection: {status: "complete", model: "simulated", result: d.aiGenerated},
            image_understanding: {status: "complete", model: "simulated", caption: d.caption},
            keyword_risk: {level: d.riskLevel, rule: "Keyword match in caption", rule: ""},
            limitations: d.limitations || []
          }});
        }, 800);
      });
    }

    dialog.showModal();
  } else if (simType === "audio") {
    const d = demo.audio.simulatedResults;
    dialog.innerHTML = "<div class=\"demo-dialog-head\"><div><span class=\"section-kicker\">SIMULATION ONLY</span><h2>Training case - Audio</h2></div><button class=\"button button-quiet\" id=\"demo-close\" type=\"button\">Close</button></div>" +
      "<p>This is simulated data for testing without HF model access.</p>" +
      "<div class=\"demo-columns\"><article><span class=\"section-kicker\">AUDIO ANALYSIS</span><strong>" + esc(demo.audio.name) + "</strong><span>Size: " + esc(demo.audio.size) + "</span></article><article><span class=\"section-kicker\">VOICE CLASSIFICATION</span><strong>" + esc(d.syntheticVoice[0].label) + "</strong><span>" + Math.round(d.syntheticVoice[0].score * 100) + "% confidence</span></article><article><span class=\"section-kicker\">TRANSCRIPT</span><strong>Speech to Text</strong><span>" + esc(d.transcript) + "</span></article><article><span class=\"section-kicker\">CRISIS KEYWORDS</span><strong>" + (d.keywords && d.keywords.length ? d.keywords.join(", ") : "None") + "</strong><span>Risk: " + (d.riskLevel || "unknown").toUpperCase() + "</span></article></div>" +
      "<button class=\"button button-primary\" id=\"demo-load\">Load into Workspace</button>";

    const loadBtn = $("#demo-load");
    if (loadBtn) {
      loadBtn.addEventListener("click", function() {
        dialog.close();
        // Simulate file upload
        const file = new File([""], demo.audio.name, {type: demo.audio.type});
        file.size = parseInt(demo.audio.size) * 1024 * 1024;
        setFile("audio", file);

        // Show simulated results
        setTimeout(function() {
          renderAudio({status: "complete", result: {
            file: {name: demo.audio.name, mime_type: demo.audio.type, size_bytes: file.size},
            technical_metadata: {status: "complete", ...d.metadata},
            synthetic_voice_detection: {status: "complete", model: "simulated", result: d.syntheticVoice},
            speech_to_text: {status: "complete", model: "simulated", text: d.transcript},
            crisis_keywords: d.keywords || [],
            limitations: d.limitations || []
          }});
        }, 800);
      });
    }

    dialog.showModal();
  } else {
    // Default demo
    if (typeof dialog.showModal === "function") dialog.showModal();
  }
}

// WAV encoder for microphone recording
function encodeWav(buffer) {
  const channels = buffer.numberOfChannels, rate = buffer.sampleRate, length = buffer.length * channels * 2;
  const out = new ArrayBuffer(44 + length), view = new DataView(out);
  const write = function(offset, text) { [...text].forEach(function(c, i) { view.setUint8(offset + i, c.charCodeAt(0)); }); };

  write(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }
  return new Blob([out], {type: "audio/wav"});
}

// Start microphone recording
async function startRecording() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({audio: true});
    state.chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    state.recorder = new MediaRecorder(state.stream, mime ? {mimeType: mime} : {});

    state.recorder.ondataavailable = function(e) {
      if (e.data.size) state.chunks.push(e.data);
    };

    state.recorder.onstop = async function() {
      try {
        const raw = new Blob(state.chunks, {type: state.recorder.mimeType});
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await raw.arrayBuffer());
        const wav = encodeWav(decoded);
        await ctx.close();
        setFile("audio", new File([wav], "recording-" + Date.now() + ".wav", {type: "audio/wav"}));
        $("#record-status").textContent = "Recording ready  WAV";
      } catch(e) {
        toast("This browser could not convert the recording to WAV.", true);
      }
      if (state.stream) {
        state.stream.getTracks().forEach(function(t) { t.stop(); });
        state.stream = null;
      }
    };

    state.recorder.start();
    $("#record-start").disabled = true;
    $("#record-stop").disabled = false;
    $("#record-indicator").classList.add("is-recording");
    $("#record-status").textContent = "Recording...";
  } catch(error) {
    toast("Microphone unavailable: " + error.message, true);
  }
}

// Stop recording
function stopRecording() {
  if (state.recorder?.state === "recording") {
    state.recorder.stop();
    $("#record-start").disabled = false;
    $("#record-stop").disabled = true;
    $("#record-indicator").classList.remove("is-recording");
    $("#record-status").textContent = "Preparing recording...";
  }
}

// Delete case
async function deleteCase(id) {
  if (!confirm("Delete investigation " + id + " and its stored results?")) return;

  try {
    await api("/api/investigations/" + encodeURIComponent(id), {method: "DELETE"});
    if (state.caseId === id) {
      state.caseId = "";
      sessionStorage.removeItem("nexus-case");
      $("#case-id-label").textContent = "No active investigation";
      $("#fusion-button").disabled = true;
      $("#export-button").disabled = true;
    }
    $("#investigation-detail").hidden = true;
    toast("Investigation deleted from this device.");
    await refreshVault();
    await refreshDashboard();
  } catch(error) {
    toast(error.message, true);
  }
}

// Setup file drop zones
function setupDrop(kind) {
  const zone = $("#" + kind + "-drop-zone");
  zone.addEventListener("dragover", function(e) {
    e.preventDefault();
    zone.classList.add("is-dragging");
  });
  zone.addEventListener("dragleave", function() {
    zone.classList.remove("is-dragging");
  });
  zone.addEventListener("drop", function(e) {
    e.preventDefault();
    zone.classList.remove("is-dragging");
    setFile(kind, e.dataTransfer.files[0]);
  });
}

// Load demo data for simulation
function loadDemoData(type) {
  state.demoData = { type: type };
}

// Event Listeners
(function init() {
  // Theme toggle
  const themeToggle = $("#theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function() {
      toggleTheme();
      themeToggle.setAttribute("aria-label", document.body.classList.contains("theme-light") ? "Switch to dark theme" : "Switch to light theme");
    });
  }

  // Load saved theme
  loadTheme();

  // File input handlers
  const imageInput = $("#image-input");
  const audioInput = $("#audio-input");

  if (imageInput) imageInput.addEventListener("change", function(e) { setFile("image", e.target.files[0]); });
  if (audioInput) audioInput.addEventListener("change", function(e) { setFile("audio", e.target.files[0]); });

  // Drop zones
  setupDrop("image");
  setupDrop("audio");

  // Clear buttons
  const imageClear = $("#image-clear");
  const audioClear = $("#audio-clear");

  if (imageClear) imageClear.addEventListener("click", function() { clearFile("image"); });
  if (audioClear) audioClear.addEventListener("click", function() { clearFile("audio"); });

  // Analyze buttons
  const imageAnalyze = $("#image-analyze");
  const audioAnalyze = $("#audio-analyze");

  if (imageAnalyze) imageAnalyze.addEventListener("click", function() { analyze("image"); });
  if (audioAnalyze) audioAnalyze.addEventListener("click", function() { analyze("audio"); });

  // Fusion button
  const fusionButton = $("#fusion-button");
  if (fusionButton) fusionButton.addEventListener("click", runFusion);

  // Demo button
  const demoButton = $("#demo-button");
  if (demoButton) demoButton.addEventListener("click", function() {
    // Show type selection for demo
    state.demoData = null;
    showDemoSimulation();
  });

  // Demo close
  const demoClose = $("#demo-close");
  if (demoClose) {
    demoClose.addEventListener("click", function() {
      $("#demo-dialog").close();
    });
    document.getElementById("demo-dialog").addEventListener("click", function(e) {
      if (e.target === document.getElementById("demo-dialog")) {
        $("#demo-dialog").close();
      }
    });
  }

  // Recording buttons
  const recordStart = $("#record-start");
  const recordStop = $("#record-stop");

  if (recordStart) recordStart.addEventListener("click", startRecording);
  if (recordStop) recordStop.addEventListener("click", stopRecording);

  // Health recheck
  const healthRecheck = $("#health-recheck");
  if (healthRecheck) healthRecheck.addEventListener("click", refreshHealth);

  // Dashboard refresh
  const refreshDashboardBtn = $("#refresh-dashboard");
  if (refreshDashboardBtn) refreshDashboardBtn.addEventListener("click", function() {
    refreshDashboard();
    refreshVault();
    refreshHealth();
  });

  // Vault search
  const vaultSearch = $("#vault-search");
  if (vaultSearch) {
    vaultSearch.addEventListener("input", function() {
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { refreshVault(vaultSearch.value); }, 220);
    });
  }

  // Vault item actions
  const investigationList = $("#investigation-list");
  if (investigationList) {
    investigationList.addEventListener("click", function(e) {
      const openBtn = e.target.closest("[data-open]");
      const delBtn = e.target.closest("[data-delete]");

      if (openBtn) openDetail(openBtn.dataset.open);
      if (delBtn) deleteCase(delBtn.dataset.delete);
    });
  }

  // Export button
  const exportButton = $("#export-button");
  if (exportButton) {
    exportButton.addEventListener("click", function() {
      if (state.caseId) {
        window.location.href = "/api/investigations/" + encodeURIComponent(state.caseId) + "/report";
      }
    });
  }

  // Tab switching
  $$("[data-tab]").forEach(function(tab) {
    tab.addEventListener("click", function() {
      $$("[data-tab]").forEach(function(x) {
        x.classList.toggle("is-active", x === tab);
        x.setAttribute("aria-selected", String(x === tab));
      });
      $$(".evidence-panel").forEach(function(panel) {
        panel.hidden = panel.id !== tab.dataset.tab;
        panel.classList.toggle("is-active", panel.id === tab.dataset.tab);
      });
    });
  });

  // Menu toggle
  const menu = document.getElementById("site-menu");
  const menuButton = document.getElementById("menu-toggle");

  if (menu && menuButton) {
    menuButton.addEventListener("click", function() {
      const open = menu.hidden;
      menu.hidden = !open;
      menuButton.setAttribute("aria-expanded", String(open));
    });

    menu.addEventListener("click", function(e) {
      if (e.target.closest("a")) {
        menu.hidden = true;
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Restore case state
  if (state.caseId) {
    document.getElementById("case-id-label").textContent = "ACTIVE  " + state.caseId;
    document.getElementById("fusion-button").disabled = false;
    document.getElementById("export-button").disabled = false;
  }

  // Initial data loads
  refreshHealth();
  refreshDashboard();
  refreshVault();
})();

// Make functions available globally for HTML event handlers
window.setFile = setFile;
window.clearFile = clearFile;
window.analyze = analyze;
window.runFusion = runFusion;
window.refreshHealth = refreshHealth;
window.refreshDashboard = refreshDashboard;
window.refreshVault = refreshVault;
window.deleteCase = deleteCase;
window.openDetail = openDetail;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.toggleTheme = toggleTheme;
window.loadDemoData = loadDemoData;
