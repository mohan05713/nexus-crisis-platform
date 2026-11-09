# NEXUS AI — Crisis Intelligence Platform

An independent, fully editable, responsive, and locally deployable crisis intelligence website reconstructed from the Gemini reference concept into this VS Code workspace.

The platform retains the original cyber-intelligence dark visual language (cyan, purple, and green on deep navy) while connecting the forensic investigation workspace directly to a local FastAPI backend, SQLite database, and optional Hugging Face model inference endpoints.

---

## Architecture Overview

```
nexus-crisis-platform/
├── backend/
│   ├── __init__.py
│   ├── config.py              # Environment configuration & limits
│   ├── database.py            # SQLite database schema, queries & analytics
│   ├── inference.py           # Hugging Face Inference API integrations
│   ├── main.py                # FastAPI routes, rate limiter & static files mount
│   └── risk.py                # Transparent keyword-based risk scoring rules
├── frontend/
│   ├── config.js              # Centralized configuration architecture
│   ├── index.html             # Reconstructed semantic HTML5 markup
│   ├── styles.css             # Responsive cyber-intelligence CSS design system
│   ├── app.js                 # Complete client-side state machine & API client
│   └── favicon.svg            # Custom SVG vector brand favicon
├── data/
│   └── nexus.sqlite3          # Local persistent database (created automatically)
├── .env.example               # Configuration & secrets template
├── package.json               # Development and launch scripts
└── requirements.txt           # Python backend dependencies
```

---

## Key Features & Capabilities

### 1. Visual Forensics & Scene Understanding
- **Image Inspection:** Drag-and-drop or file selection for JPG, PNG, and WebP (up to 12 MB).
- **Local Metadata Extraction:** In-memory extraction of image dimensions, color mode, format, and camera EXIF without uploading.
- **AI-Generated Image Detection:** Probabilistic scoring via configured vision models.
- **Scene Captioning:** Descriptive scene summary generation via BLIP/vision models.

### 2. Audio Authenticity & Speech Intelligence
- **Voice Forensics:** Support for WAV, MP3, M4A, AAC, OGG, FLAC, and WebM (up to 24 MB).
- **Direct Microphone Recording:** Browser-based live audio capture with in-memory WAV encoding.
- **Synthetic Voice Classification:** Deepfake voice detection scoring via Wav2Vec2 models.
- **Automated Speech-to-Text (ASR):** Full audio transcription via Whisper models.
- **Crisis Keyword Spotting:** Automated keyword extraction for high/medium priority crisis terms.

### 3. Cross-Modal Fusion Review
- **Combined Intelligence:** Cross-analysis combining image scene descriptions and audio transcripts.
- **Rule-Based Risk Scoring:** Real-time risk categorization (Low, Medium, High, Unknown).
- **Automated Verification Steps:** Actionable checklist for human-in-the-loop validation.
- **AI Summary Generation:** Combined executive summary via conversational LLM models.

### 4. Command Dashboard & Live Analytics
- **Summary Metrics:** Total investigations, image count, audio count, and error tracking.
- **7-Day Activity Chart:** Dynamic activity histogram based on local SQLite records.
- **System Health Monitor:** Real-time status for FastAPI backend, SQLite database, and 5 model endpoints.
- **Risk Distribution:** Rule-based breakdown of observed threats.

### 5. Evidence Vault & Case Reporting
- **Local SQLite Persistence:** Complete audit trail of investigation cases.
- **Real-Time Search:** Instant filtering across case IDs, locations, and filenames.
- **Detailed Case Inspection:** Full JSON inspection modal for forensic review.
- **PDF Report Generation:** One-click forensic case dossier generation via ReportLab.
- **Case Deletion:** Safe deletion of investigation records with confirmation.

---

## Centralized Configuration Architecture (`frontend/config.js`)

All website settings, visual tokens, and functional parameters are centrally configurable in `frontend/config.js`:

- **Site Identity:** Name, subtitle, version, and meta descriptions.
- **Design Tokens:** Primary, secondary, accent, danger, and warning colors for both dark and light modes.
- **Typography:** Font families for display, body, and monospace code.
- **Navigation:** Navigation routes and labels.
- **Engines & Capabilities:** Definitions, icons, metrics, and descriptions for all core modules.
- **Limits & Constraints:** Upload size ceilings and allowed file extensions.
- **API Endpoints:** Route mapping for all backend resources.
- **Feature Toggles:** Enable/disable recording, demo mode, theme toggles, search, and PDF exports.
- **Demo Presets:** Simulated data sets for testing without active Hugging Face model credentials.

---

## Getting Started

### Prerequisites
- Python 3.10+ (Python 3.11, 3.12, or 3.13 supported)
- Modern web browser (Chrome, Edge, Firefox, or Safari)

### 1. Installation

Open a terminal in the project directory:

```powershell
# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run the Local Development Server

```powershell
# Start the FastAPI server with live reload:
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Or use npm script:
npm run dev
```

Open your browser to: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## Optional: Configuring Real Hugging Face AI Models

The application is fully operational locally without any external credentials. To enable real cloud AI models:

1. Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
2. Set your Hugging Face User Access Token:
   ```env
   HF_TOKEN=hf_your_token_here
   ```
3. Set your custom deployed Inference Endpoint URLs:
   ```env
   HF_IMAGE_AI_ENDPOINT=https://your-endpoint.endpoints.huggingface.cloud
   HF_IMAGE_CAPTION_ENDPOINT=https://your-endpoint.endpoints.huggingface.cloud
   HF_AUDIO_DEEPFAKE_ENDPOINT=https://your-endpoint.endpoints.huggingface.cloud
   HF_ASR_ENDPOINT=https://your-endpoint.endpoints.huggingface.cloud
   HF_SUMMARY_MODEL=your-chat-or-instruct-model
   ```
4. Restart the server and click **Recheck** in the System Health dashboard card.

---

## Running Verification Tests

Run the full automated end-to-end test suite:

```powershell
.venv\Scripts\python.exe -c "
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)
assert client.get('/').status_code == 200
assert client.get('/api/health').status_code == 200
assert client.get('/api/dashboard').status_code == 200
assert client.get('/api/investigations').status_code == 200
print('All test checks passed successfully!')
"
```

---

## Privacy & Ethical Guardrails

- **Zero Media Retention:** Uploaded image and audio bytes are processed in memory and never persisted to disk. Only extracted metadata and model output summaries are stored in SQLite.
- **Explicit Consent Model:** Media payloads are never transmitted to external APIs without explicit user consent via the checkbox.
- **Responsible AI Disclaimer:** All outputs are marked as preliminary indicators. They are never to be used as the sole basis for emergency dispatch or legal determinations.
