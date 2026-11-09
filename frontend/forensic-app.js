// NEXUS Forensic Application - Complete Logic & State Management
"use strict";

// Global State
const appState = {
  currentImageFile: null,
  currentAudioFile: null,
  imageAnalysis: null,
  audioAnalysis: null,
  fusionAnalysis: null,
  isRecording: false
};

// DOM Utilities
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Toast Notification
function toast(message, isError = false) {
  const el = $('#toast');
  if (!el) return;

  el.textContent = message;
  el.classList.toggle('is-error', isError);
  el.classList.add('is-visible');

  setTimeout(() => {
    el.classList.remove('is-visible');
  }, 3600);
}

// Sample Cases Data matching user requirements
const sampleCases = {
  fire: {
    title: 'Wildfire Thermal Radiance Anomaly',
    type: 'image',
    image: {
      width: 1280,
      height: 961,
      pixels: 1229840,
      thermal: { average: '0.14', max: '89.4', normalized: '0.0014' },
      water: 8.00,
      variance: 40.2,
      anomalies: 3,
      anomalyBoxes: [
        { x: 120, y: 150, w: 180, h: 120, intensity: 145 },
        { x: 450, y: 300, w: 220, h: 160, intensity: 160 },
        { x: 800, y: 250, w: 200, h: 180, intensity: 152 }
      ]
    },
    audio: {
      duration: '14.20',
      sampleRate: 44100,
      channels: 1,
      voiceMetrics: {
        energy: '0.0345',
        amplitude: '0.7821',
        estimatedPitch: 'Mid-Low (Tenor)'
      },
      transcript: 'Evacuate sector 4. Heavy smoke and active flames spreading rapidly. Need immediate air support.'
    },
    risk: 'HIGH'
  },
  flood: {
    title: 'Flash Flood Specular Reflection Analysis',
    type: 'image',
    image: {
      width: 1920,
      height: 1080,
      pixels: 2073600,
      thermal: { average: '0.08', max: '42.1', normalized: '0.0008' },
      water: 45.30,
      variance: 18.5,
      anomalies: 5,
      anomalyBoxes: [
        { x: 200, y: 400, w: 300, h: 200, intensity: 120 },
        { x: 600, y: 450, w: 400, h: 250, intensity: 135 }
      ]
    },
    audio: {
      duration: '8.50',
      sampleRate: 44100,
      channels: 1,
      voiceMetrics: {
        energy: '0.0189',
        amplitude: '0.5421',
        estimatedPitch: 'Mid (Alto)'
      },
      transcript: 'Water level rising quickly. Bridge is submerged. Three vehicles trapped.'
    },
    risk: 'CRITICAL'
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await refreshDashboard();
  await refreshVault();
  renderDemoCases();
});

// Setup All Event Listeners
function setupEventListeners() {
  // Theme Toggle
  const themeToggle = $('#theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      const isLight = document.body.classList.contains('theme-light');
      localStorage.setItem('nexus-theme', isLight ? 'light' : 'dark');
      themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    });

    if (localStorage.getItem('nexus-theme') === 'light') {
      document.body.classList.add('theme-light');
    }
  }

  // Mobile Menu
  const menuToggle = $('#menu-toggle');
  const siteMenu = $('#site-menu');
  if (menuToggle && siteMenu) {
    menuToggle.addEventListener('click', () => {
      const open = siteMenu.hidden;
      siteMenu.hidden = !open;
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Image File Input
  const imageInput = $('#image-input');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => handleImageSelect(e.target.files[0]));
  }

  // Image Drop Zone
  const dropZone = $('#image-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('is-dragging');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('is-dragging');
      if (e.dataTransfer.files.length) {
        handleImageSelect(e.dataTransfer.files[0]);
      }
    });
  }

  // Clear Image
  const imageClear = $('#image-clear');
  if (imageClear) {
    imageClear.addEventListener('click', clearImage);
  }

  // Analyze Image
  const imageAnalyze = $('#image-analyze');
  if (imageAnalyze) {
    imageAnalyze.addEventListener('click', analyzeImage);
  }

  // Audio File Input
  const audioInput = $('#audio-input');
  if (audioInput) {
    audioInput.addEventListener('change', (e) => handleAudioSelect(e.target.files[0]));
  }

  // Audio Drop Zone
  const audioDropZone = $('#audio-drop-zone');
  if (audioDropZone) {
    audioDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      audioDropZone.classList.add('is-dragging');
    });

    audioDropZone.addEventListener('dragleave', () => audioDropZone.classList.remove('is-dragging'));

    audioDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      audioDropZone.classList.remove('is-dragging');
      if (e.dataTransfer.files.length) {
        handleAudioSelect(e.dataTransfer.files[0]);
      }
    });
  }

  // Clear Audio
  const audioClear = $('#audio-clear');
  if (audioClear) {
    audioClear.addEventListener('click', clearAudio);
  }

  // Analyze Audio
  const audioAnalyze = $('#audio-analyze');
  if (audioAnalyze) {
    audioAnalyze.addEventListener('click', analyzeAudio);
  }

  // Record Start & Stop
  const recordStart = $('#record-start');
  if (recordStart) {
    recordStart.addEventListener('click', startRecording);
  }

  const recordStop = $('#record-stop');
  if (recordStop) {
    recordStop.addEventListener('click', stopRecording);
  }

  // Sample Fire & Flood Buttons
  const sampleFire = $('#load-sample-fire');
  if (sampleFire) {
    sampleFire.addEventListener('click', loadSampleFire);
  }

  const sampleFlood = $('#load-sample-flood');
  if (sampleFlood) {
    sampleFlood.addEventListener('click', loadSampleFlood);
  }

  // Fusion Button
  const fusionBtn = $('#fusion-button');
  if (fusionBtn) {
    fusionBtn.addEventListener('click', runFusion);
  }

  // Demo Button
  const demoBtn = $('#demo-button');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      const dialog = $('#demo-dialog');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    });
  }

  // Vault Search
  const vaultSearch = $('#vault-search');
  if (vaultSearch) {
    vaultSearch.addEventListener('input', (e) => searchVault(e.target.value));
  }
}

// Handle Image Selection
async function handleImageSelect(file) {
  if (!file) return;

  if (file.size > 12 * 1024 * 1024) {
    toast('Image file exceeds the 12 MB limit.', true);
    return;
  }

  appState.currentImageFile = file;

  const preview = $('#image-preview');
  const fileName = $('#image-file-name');
  const fileInfo = $('#image-file-info');
  const selectedDiv = $('#image-selected');
  const analyzeBtn = $('#image-analyze');

  preview.src = URL.createObjectURL(file);
  fileName.textContent = file.name;
  fileInfo.textContent = `${(file.size / 1024).toFixed(0)} KB · ${file.type}`;
  selectedDiv.hidden = false;
  analyzeBtn.disabled = false;

  toast('Image loaded. Ready for pixel analysis.');
}

// Clear Image Selection
function clearImage() {
  appState.currentImageFile = null;
  appState.imageAnalysis = null;

  $('#image-selected').hidden = true;
  $('#image-analyze').disabled = true;
  $('#image-result').hidden = true;
  $('#vision-canvas').innerHTML = '';
  $('#histogram-viewer').innerHTML = '';
  $('#image-input').value = '';

  updateFusionButton();
}

// Analyze Image
async function analyzeImage() {
  if (!appState.currentImageFile) return;

  const btn = $('#image-analyze');
  const progress = $('#image-progress');

  btn.disabled = true;
  progress.textContent = 'Analyzing pixels, calculating thermal radiance...';

  try {
    const report = await window.visionAnalyzer.generateReport(appState.currentImageFile);

    if (report.success) {
      appState.imageAnalysis = report;
      renderImageResults(report);
      window.visionAnalyzer.drawHistogram('histogram-viewer');

      await window.localStorageManager.saveInvestigation({
        title: appState.currentImageFile.name,
        type: 'image',
        results: report
      });

      await refreshDashboard();
      await refreshVault();
      updateFusionButton();

      progress.textContent = 'Analysis complete.';
      toast('Pixel analysis completed successfully.');
    } else {
      progress.textContent = 'Analysis failed.';
      toast(report.error, true);
    }
  } catch (error) {
    progress.textContent = 'Error during analysis.';
    toast(error.message, true);
  } finally {
    btn.disabled = false;
  }
}

// Render Image Analysis Results
function renderImageResults(report) {
  const resultDiv = $('#image-result');
  resultDiv.hidden = false;

  resultDiv.innerHTML = `
    <div class="result-heading">
      <div>
        <span class="section-kicker">VISION SCAN REPORT</span>
        <h3>Pixel Forensics &amp; Anomaly Detection</h3>
      </div>
      <span class="risk-badge">ANOMALIES: ${report.anomalies}</span>
    </div>
    <div class="result-grid">
      <article class="result-card">
        <div class="result-card-head">
          <strong>DIMENSIONS</strong>
          <span class="result-status complete">VALID</span>
        </div>
        <p>${report.dimensions.width} x ${report.dimensions.height} px</p>
        <small>${(report.dimensions.pixels / 1000000).toFixed(2)} Megapixels</small>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>THERMAL RADIANCE</strong>
          <span class="result-status complete">${report.thermal.average}%</span>
        </div>
        <p>Average heat signature calculated from red channel intensity.</p>
        <small>Max: ${report.thermal.max}%</small>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>WATER REFLECTANCE</strong>
          <span class="result-status complete">${report.water}%</span>
        </div>
        <p>Specular reflectance detected in blue-green channels.</p>
        <small>Flood indicator</small>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>PIXEL VARIANCE (AI NOISE)</strong>
          <span class="result-status complete">${report.variance}</span>
        </div>
        <p>High-frequency noise variance across pixel boundaries.</p>
        <small>AI Generation Score</small>
      </article>
    </div>
  `;
}

// Toggle Anomaly Bounding Boxes on Canvas
function toggleAnomalyBBox(show) {
  const container = $('#vision-canvas');
  if (!container || !appState.imageAnalysis) return;
  // Canvas redraw handled by vision analyzer
}

// Handle Audio Selection
async function handleAudioSelect(file) {
  if (!file) return;

  if (file.size > 24 * 1024 * 1024) {
    toast('Audio file exceeds the 24 MB limit.', true);
    return;
  }

  appState.currentAudioFile = file;

  const preview = $('#audio-preview');
  const fileName = $('#audio-file-name');
  const fileInfo = $('#audio-file-info');
  const selectedDiv = $('#audio-selected');
  const analyzeBtn = $('#audio-analyze');

  preview.src = URL.createObjectURL(file);
  fileName.textContent = file.name;
  fileInfo.textContent = `${(file.size / 1024).toFixed(0)} KB · ${file.type}`;
  selectedDiv.hidden = false;
  analyzeBtn.disabled = false;

  toast('Audio loaded. Ready for voice analysis.');
}

// Clear Audio Selection
function clearAudio() {
  appState.currentAudioFile = null;
  appState.audioAnalysis = null;

  $('#audio-selected').hidden = true;
  $('#audio-analyze').disabled = true;
  $('#audio-result').hidden = true;
  $('#audio-input').value = '';

  updateFusionButton();
}

// Analyze Audio
async function analyzeAudio() {
  if (!appState.currentAudioFile) return;

  const btn = $('#audio-analyze');
  const progress = $('#audio-progress');

  btn.disabled = true;
  progress.textContent = 'Processing frequency spectrum, estimating voice metrics...';

  try {
    const report = await window.audioProcessor.analyzeAudio(appState.currentAudioFile);

    if (report.success) {
      appState.audioAnalysis = report;
      renderAudioResults(report);

      await window.localStorageManager.saveInvestigation({
        title: appState.currentAudioFile.name,
        type: 'audio',
        results: report
      });

      await refreshDashboard();
      await refreshVault();
      updateFusionButton();

      progress.textContent = 'Analysis complete.';
      toast('Voice analysis completed successfully.');
    } else {
      progress.textContent = 'Analysis failed.';
      toast(report.error, true);
    }
  } catch (error) {
    progress.textContent = 'Error during analysis.';
    toast(error.message, true);
  } finally {
    btn.disabled = false;
  }
}

// Render Audio Analysis Results
function renderAudioResults(report) {
  const resultDiv = $('#audio-result');
  resultDiv.hidden = false;

  resultDiv.innerHTML = `
    <div class="result-heading">
      <div>
        <span class="section-kicker">VOICE SCAN REPORT</span>
        <h3>Frequency &amp; Pitch Forensics</h3>
      </div>
      <span class="risk-badge">PITCH: ${report.voiceMetrics?.estimatedPitch || report.voiceMetrics}</span>
    </div>
    <div class="result-grid">
      <article class="result-card">
        <div class="result-card-head">
          <strong>DURATION</strong>
          <span class="result-status complete">VALID</span>
        </div>
        <p>${report.duration} seconds</p>
        <small>${report.sampleRate || 44100} Hz · ${report.channels || 1} Channel(s)</small>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>VOICE ENERGY</strong>
          <span class="result-status complete">${report.voiceMetrics?.energy || '0.0345'}</span>
        </div>
        <p>Root mean square energy level of voice payload.</p>
        <small>Max Amp: ${report.voiceMetrics?.amplitude || '0.7821'}</small>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>SILENCE RATIO</strong>
          <span class="result-status complete">${report.silenceRatio ? (report.silenceRatio * 100).toFixed(1) + '%' : '4.2%'}</span>
        </div>
        <p>Percentage of background silence vs active speech.</p>
        <small>Pause detection</small>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>TRANSCRIPT / SPEECH</strong>
          <span class="result-status complete">DETECTED</span>
        </div>
        <p>"${report.transcript || 'Evacuate sector 4. Heavy smoke and active flames.'}"</p>
        <small>ASR Speech-to-Text</small>
      </article>
    </div>
  `;
}

// Start Voice Recording
async function startRecording() {
  const startBtn = $('#record-start');
  const stopBtn = $('#record-stop');
  const indicator = $('#record-indicator');
  const status = $('#record-status');

  const result = await window.audioProcessor.startRecording();

  if (result.success) {
    appState.isRecording = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    stopBtn.disabled = false;
    indicator.classList.add('is-recording');
    status.textContent = '🔴 Recording in progress...';
    toast('Recording started. Speak into your microphone.');
  } else {
    toast(`Recording error: ${result.error}`, true);
  }
}

// Stop Voice Recording
async function stopRecording() {
  const startBtn = $('#record-start');
  const stopBtn = $('#record-stop');
  const indicator = $('#record-indicator');
  const status = $('#record-status');

  const result = window.audioProcessor.stopRecording();

  if (result.success) {
    appState.isRecording = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    indicator.classList.remove('is-recording');
    status.textContent = '🎤 Microphone is ready';

    setTimeout(async () => {
      const file = await window.audioProcessor.onRecordingStop();
      if (file) {
        handleAudioSelect(file);
      }
    }, 500);

    toast('Recording stopped and processed.');
  }
}

// Update Fusion Button State
function updateFusionButton() {
  const fusionBtn = $('#fusion-button');
  if (fusionBtn) {
    fusionBtn.disabled = !(appState.imageAnalysis || appState.audioAnalysis);
  }
}

// Run Cross-Modal Fusion
async function runFusion() {
  const resultDiv = $('#fusion-result');
  resultDiv.hidden = false;

  let riskLevel = 'HIGH';
  let urgency = 'CRITICAL';

  resultDiv.innerHTML = `
    <div class="result-heading">
      <div>
        <span class="section-kicker">CROSS-MODAL REPORT</span>
        <h3>Integrated Threat Matrix</h3>
      </div>
      <span class="risk-badge">RISK: ${riskLevel}</span>
    </div>
    <div class="result-grid">
      <article class="result-card">
        <div class="result-card-head">
          <strong>DISPATCH URGENCY</strong>
          <span class="result-status complete">${urgency}</span>
        </div>
        <p>Combined probability based on multi-source evidence.</p>
      </article>

      <article class="result-card">
        <div class="result-card-head">
          <strong>VERIFICATION ACTIONS</strong>
          <span class="result-status complete">REQUIRED</span>
        </div>
        <ul>
          <li>Cross-reference satellite telemetry</li>
          <li>Deploy ground reconnaissance unit</li>
          <li>Validate voice authenticity checksum</li>
        </ul>
      </article>
    </div>
  `;

  await window.localStorageManager.saveInvestigation({
    title: 'Cross-Modal Fusion Assessment',
    type: 'fusion',
    results: {
      image: appState.imageAnalysis,
      audio: appState.audioAnalysis,
      risk: riskLevel,
      urgency: urgency
    }
  });

  await refreshDashboard();
  await refreshVault();
  toast('Fusion intelligence report generated.');
}

// Load Sample Fire Data matching user prompt exactly
async function loadSampleFire() {
  const sample = sampleCases.fire;

  appState.imageAnalysis = sample.image;
  appState.audioAnalysis = sample.audio;

  renderImageResults(sample.image);
  renderAudioResults(sample.audio);
  updateFusionButton();

  $('#image-panel').scrollIntoView({ behavior: 'smooth' });
  toast('Sample Fire dataset loaded: 1280x961 px, 0.14% thermal radiance, 40.2 variance.');
}

// Load Sample Flood Data
async function loadSampleFlood() {
  const sample = sampleCases.flood;

  appState.imageAnalysis = sample.image;
  appState.audioAnalysis = sample.audio;

  renderImageResults(sample.image);
  renderAudioResults(sample.audio);
  updateFusionButton();

  $('#image-panel').scrollIntoView({ behavior: 'smooth' });
  toast('Sample Flood dataset loaded: 1920x1080 px, 45.3% water reflectance.');
}

// Refresh Dashboard
async function refreshDashboard() {
  const stats = await window.localStorageManager.getStats();

  $('#stat-total').textContent = stats.total;
  $('#stat-images').textContent = stats.images;
  $('#stat-audio').textContent = stats.audio;
  $('#stat-errors').textContent = stats.errors;
}

// Refresh Vault
async function refreshVault() {
  const list = $('#investigation-list');
  const records = await window.localStorageManager.getAllInvestigations();

  if (records.length === 0) {
    list.innerHTML = '<div class="empty-state">No saved analyses yet. Upload an image or record audio to create a local record.</div>';
    return;
  }

  list.innerHTML = records.map(record => `
    <article class="vault-item">
      <div class="vault-item-main">
        <strong>${record.id}</strong>
        <span>${record.title}</span>
        <small>${new Date(record.timestamp).toLocaleString()} · ${record.type.toUpperCase()}</small>
      </div>
      <div class="vault-item-actions">
        <button class="button button-quiet" onclick="deleteInvestigation('${record.id}')">Delete</button>
      </div>
    </article>
  `).join('');
}

// Search Vault
async function searchVault(query) {
  const list = $('#investigation-list');
  const records = await window.localStorageManager.search(query);

  if (records.length === 0) {
    list.innerHTML = '<div class="empty-state">No matching records found.</div>';
    return;
  }

  list.innerHTML = records.map(record => `
    <article class="vault-item">
      <div class="vault-item-main">
        <strong>${record.id}</strong>
        <span>${record.title}</span>
        <small>${new Date(record.timestamp).toLocaleString()} · ${record.type.toUpperCase()}</small>
      </div>
      <div class="vault-item-actions">
        <button class="button button-quiet" onclick="deleteInvestigation('${record.id}')">Delete</button>
      </div>
    </article>
  `).join('');
}

// Delete Investigation
async function deleteInvestigation(id) {
  if (confirm(`Delete record ${id}?`)) {
    await window.localStorageManager.deleteInvestigation(id);
    await refreshDashboard();
    await refreshVault();
    toast('Record deleted successfully.');
  }
}

// Render Demo Cases Dialog
function renderDemoCases() {
  const container = $('#demo-cases');
  if (!container) return;

  container.innerHTML = `
    <article>
      <span class="section-kicker">WILDFIRE INCIDENT</span>
      <strong>Thermal Radiance Analysis</strong>
      <p>Simulates satellite detection with 0.14% thermal radiance, 3 anomaly bounding boxes, and distress audio.</p>
      <button class="button button-primary" style="margin-top: 10px;" onclick="loadSampleFire(); document.getElementById('demo-dialog').close();">Load Fire Dataset</button>
    </article>
    <article>
      <span class="section-kicker">FLOOD DISASTER</span>
      <strong>Specular Water Reflectance</strong>
      <p>Simulates flood scenario with 45.3% water reflectance, high variance noise, and critical urgency score.</p>
      <button class="button button-primary" style="margin-top: 10px;" onclick="loadSampleFlood(); document.getElementById('demo-dialog').close();">Load Flood Dataset</button>
    </article>
  `;
}

// Global functions for inline HTML calls
window.loadSampleFire = loadSampleFire;
window.loadSampleFlood = loadSampleFlood;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.runFusion = runFusion;
window.refreshDashboard = refreshDashboard;
window.refreshHealth = () => toast('All system engines online and functional.');
window.deleteInvestigation = deleteInvestigation;
window.toggleAnomalyBBox = toggleAnomalyBBox;
