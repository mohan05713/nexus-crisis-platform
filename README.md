# NEXUS AI — Crisis Intelligence Platform

<p align="center">
  <strong>A crisis intelligence workspace for incident mapping, media forensics, and evidence review.</strong>
</p>

<p align="center">
  <a href="https://github.com/mohan05713/nexus-crisis-platform">GitHub Repository</a>
  ·
  <a href="https://nexus-crisis-platform.vercel.app/">Vercel Project Domain</a>
  ·
  <a href="https://github.com/mohan05713/nexus-crisis-platform/issues">Report an Issue</a>
</p>

---

## Overview

**NEXUS AI** is a web-based crisis intelligence and digital-evidence review project. It brings together a crisis map, incident records, image and audio analysis, multimodal case review, operational analytics, and downloadable case reports in one interface.

The repository currently contains a browser-based frontend and a Python **FastAPI** backend. The backend provides REST endpoints, stores incident and investigation records in **SQLite**, and can call configured **Hugging Face Inference Endpoints** for selected media-analysis tasks.

> **Important:** NEXUS is an assistive analysis and demonstration platform. It is not an emergency-response service, an official alert authority, or a substitute for professional forensic assessment. Always verify incident information with trusted primary sources and contact local emergency services directly when necessary.

## Project at a glance

| Area | Implementation |
| --- | --- |
| Frontend | HTML5, CSS, JavaScript |
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite |
| Mapping | Leaflet, OpenStreetMap tiles |
| Charts | Chart.js |
| Styling and UI libraries | Tailwind CSS CDN, Font Awesome |
| Optional AI inference | Hugging Face Inference Endpoints |
| Image processing | Pillow |
| Audio metadata | Mutagen |
| PDF reports | ReportLab |
| Geocoding | OpenStreetMap Nominatim |
| Local development | VS Code, Python virtual environment |

## Application modules

### 1. Crisis map and incident intelligence
- Map-based display of incident records with location and severity information.
- Incident filtering and detail inspection through the API.
- Incident statistics and data-source health information.
- Nearby-incident lookup using geographic distance and bearing calculations.
- External incident synchronization currently implemented for **NASA EONET** and **GDACS**.
- Geocoding and reverse geocoding through OpenStreetMap Nominatim, with local caching and request throttling.

**Data-source transparency:** The current synchronization code actively fetches records from NASA EONET and GDACS. NDMA Sachet, India Meteorological Department (IMD), and NASA FIRMS appear as source-health entries, but this repository version does not implement live ingestion adapters for those three sources. Do not interpret a health label as proof that a feed is connected.

### 2. Image forensics
- JPG, JPEG, PNG, and WebP uploads, with a maximum file size of 12 MB.
- Image format, dimensions, colour mode, and selected camera/software EXIF metadata extraction.
- Optional AI-generated-image classification and image captioning through configured inference endpoints.
- Explicit consent is required before image bytes are sent to a configured external model endpoint.
- Results include limitations and should be independently verified.

### 3. Audio authenticity and speech analysis
- WAV, MP3, M4A, AAC, OGG, FLAC, WebM, and MP4 audio uploads, with a maximum file size of 24 MB.
- Browser microphone recording support in the frontend.
- Audio duration, sample rate, channel, and container metadata extraction.
- Optional synthetic-voice classification and speech-to-text through configured inference endpoints.
- Crisis-related keyword extraction from available transcripts.

### 4. Multimodal case review
- Combine available image and audio analysis results within an investigation.
- Rule-based keyword risk indicators: Low, Medium, High, or Unknown.
- Optional AI-generated case summary when a summary model is configured.
- Human verification reminders and transparent limitations.

### 5. Dashboard and analytics
- Investigation and analysis totals.
- Recent activity and risk distribution based on saved records.
- Backend, database, and configured model-endpoint health information.
- Incident statistics and data-source health reporting.

### 6. Evidence vault and reporting
- Persistent investigation and analysis metadata in SQLite.
- Search across case identifiers, locations, and filenames.
- Investigation detail retrieval and record deletion.
- PDF case-report generation through ReportLab.

## Screenshots

The following screenshots show the current NEXUS AI v4.2 interface.

### Homepage and forensic intelligence

The landing page presents the NEXUS Crisis Intelligence Platform, the global crisis-map and forensic-analysis entry points, and the vision, audio, and multimodal analysis engine cards.

### Global Crisis Map and location intelligence

The map workspace includes global location search, India state and district filters, hazard category and severity filters, marker/heatmap view controls, the incident inspector, and external data-feed health indicators.

**Live application:** https://nexus-crisis-platform.vercel.app/

**Backend API:** https://nexus-crisis-platform-api.onrender.com/

> Screenshot files were supplied in this conversation. They are not yet stored in the GitHub repository, so this section describes the verified captures without embedding broken image paths. When the image assets are committed under `docs/screenshots/`, embed them here with standard Markdown image links.


## Architecture

```text
Browser
  |
  | HTML / CSS / JavaScript
  | Leaflet map + Chart.js
  v
FastAPI application
  |
  +-- Investigation and incident API routes
  +-- Image metadata and optional vision inference
  +-- Audio metadata and optional speech/voice inference
  +-- Multimodal review and rule-based risk indicators
  +-- Geocoding and external-feed synchronization
  |
  +--> SQLite database
  |
  +--> Optional Hugging Face Inference Endpoints
  |
  +--> NASA EONET / GDACS / OpenStreetMap Nominatim
```

## Repository structure

```text
nexus-crisis-platform/
├── backend/
│   ├── __init__.py
│   ├── config.py              # Environment-based application settings
│   ├── database.py            # SQLite schema and data-access functions
│   ├── external_feeds.py      # NASA EONET and GDACS synchronization
│   ├── geocoding.py           # Nominatim geocoding and distance utilities
│   ├── inference.py           # Hugging Face inference integrations
│   ├── main.py                # FastAPI application and API routes
│   ├── report_generator.py    # PDF report generation
│   └── risk.py                # Transparent keyword risk rules
├── frontend/
│   ├── config.js              # Frontend configuration and demo data
│   ├── index.html             # Application interface
│   ├── styles.css             # Responsive styles
│   ├── app.js                 # Frontend state and API interactions
│   └── favicon.svg            # Application icon
├── data/
│   └── nexus.sqlite3          # Created locally at runtime; not committed
├── .env.example               # Environment-variable template
├── .gitignore
├── package.json               # Convenience start/dev scripts
├── requirements.txt           # Python dependencies
└── run_local.bat              # Windows setup and launch helper
```

## Technology stack

| Technology | Purpose |
| --- | --- |
| Python 3.10+ | Backend runtime |
| FastAPI | REST API and application server |
| Uvicorn | ASGI development server |
| SQLite | Local persistence for investigations, analyses, incidents, and geocoding cache |
| HTML5 / CSS / JavaScript | Browser application |
| Tailwind CSS | Utility styling loaded from CDN |
| Leaflet | Interactive maps |
| OpenStreetMap | Map tiles and Nominatim geocoding |
| Chart.js | Dashboard visualisations |
| Pillow | Image decoding and metadata extraction |
| Mutagen | Audio metadata extraction |
| Hugging Face Hub | Optional hosted model inference |
| ReportLab | PDF report generation |

## Optional AI models

The model identifiers below are the defaults in `.env.example`. They are **model names, not proof that a hosted endpoint is deployed or available**. You must configure the corresponding endpoint URL and token to enable remote inference.

| Task | Default model identifier |
| --- | --- |
| AI-generated image classification | `capcheck/ai-image-detection` |
| Image captioning | `Salesforce/blip-image-captioning-base` |
| Synthetic-audio classification | `Vansh180/deepfake-audio-wav2vec2` |
| Speech recognition | `openai/whisper-base` |
| Multimodal case summary | Configured through `HF_SUMMARY_MODEL` |

The core application can start without Hugging Face credentials. Model-backed features may report as unavailable until valid endpoint URLs, token permissions, and compatible deployed models are configured.

## Getting started (Windows and VS Code)

### Prerequisites
- Windows 10/11 or another supported operating system.
- Python 3.10 or newer (Python 3.11 or 3.12 recommended).
- VS Code.
- Internet access for installing dependencies and using configured external services.

### 1. Clone the repository

```powershell
git clone https://github.com/mohan05713/nexus-crisis-platform.git
cd nexus-crisis-platform
```

Alternatively, download the repository ZIP from GitHub and extract it.

### 2. Create a virtual environment

```powershell
py -3 -m venv .venv
```

If the Python launcher is unavailable, use:

```powershell
python -m venv .venv
```

### 3. Install dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 4. Configure optional model endpoints

Copy `.env.example` to `.env` and add only the credentials and endpoint URLs you actually have:

```powershell
Copy-Item .env.example .env
```

Keep `.env` private. Never commit `HF_TOKEN`, API keys, or other secrets. Do not put secrets in frontend JavaScript.

### 5. Run the application

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Open:

- Website: http://127.0.0.1:8000
- API health: http://127.0.0.1:8000/api/health
- Interactive API documentation: http://127.0.0.1:8000/docs

Keep the terminal open while using the application. Press `Ctrl+C` to stop the server.

**Windows shortcut:** Double-click `run_local.bat` in the repository root. It checks Python, creates the virtual environment if needed, installs requirements, and starts the local server.

## API overview

The FastAPI application exposes routes for application health, dashboards, investigations, media analysis, incident intelligence, geocoding, and PDF reports. The main route groups include:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend, database, and model configuration health |
| GET | `/api/dashboard` | Investigation analytics |
| GET | `/api/investigations` | Search/list investigations |
| GET | `/api/investigations/{id}` | Investigation details |
| DELETE | `/api/investigations/{id}` | Delete an investigation |
| POST | `/api/analyze/image` | Image metadata and optional model analysis |
| POST | `/api/analyze/audio` | Audio metadata and optional model analysis |
| POST | `/api/analyze/multimodal` | Combined case review |
| GET | `/api/incidents` | Filter and list mapped incidents |
| POST | `/api/incidents/sync` | Synchronise implemented external feeds |
| GET | `/api/incidents/statistics` | Incident statistics |
| GET | `/api/incidents/health` | External-source health records |
| GET | `/api/geocode/search` | Forward geocoding |
| GET | `/api/geocode/reverse` | Reverse geocoding |
| GET | `/api/incidents/radar` | Nearby incidents by radius |

For the complete interactive schema, run the backend and open `/docs`.

## Data handling, privacy, and responsible use

- Uploaded image and audio bytes are processed in memory and are not written to the local evidence database.
- Investigation metadata, file metadata, analysis outputs, and incident records are stored in SQLite.
- If a configured external model is going to receive media, the application requires an explicit consent flag before sending it.
- Keep credentials in the backend environment and out of source control.
- Risk levels are keyword-based indicators, not verified emergency classifications.
- Model output may be inaccurate, incomplete, biased, or unavailable. Human review and independent source verification are required.
- Do not use this application as the sole basis for emergency dispatch, medical decisions, legal findings, or accusations about a person.

## Testing and verification

A basic API health check can be performed after starting the server:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

The repository also supports automated endpoint checks using FastAPI's `TestClient`. For example:

```powershell
.\.venv\Scripts\python.exe -c "from fastapi.testclient import TestClient; from backend.main import app; c=TestClient(app); paths=['/','/api/health','/api/dashboard','/api/investigations']; results=[(p,c.get(p).status_code) for p in paths]; print(results); assert all(code==200 for _,code in results)"
```

The result depends on the current database state and availability of configured external services. A successful API response does not prove that optional AI endpoints or all external data feeds are operational.

## Current limitations

- Hosted AI analysis requires separately deployed and correctly configured inference endpoints.
- External-feed ingestion is currently implemented for NASA EONET and GDACS; other source names shown in health reporting are not full ingestion integrations in this code version.
- Geocoding depends on the public Nominatim service and its usage policy.
- SQLite is intended for local/demo-scale persistence; production multi-user deployment may require a managed database, migrations, authentication, backups, and stronger operational controls.
- Incident data and sample/demo records must be checked against original providers before being treated as confirmed current events.
- The Vercel project domain may be protected by deployment SSO; access and production routing should be checked in the hosting dashboard.

## Roadmap

Potential next steps include:
- Complete and validate additional official data-source adapters (IMD, NDMA Sachet, and NASA FIRMS).
- Add source-level provenance, timestamps, deduplication, and freshness indicators to every incident.
- Add authentication, role-based access, audit controls, and secure production database hosting.
- Expand automated tests for API routes, ingestion failures, model timeouts, and privacy behaviour.
- Capture and publish verified desktop and mobile application screenshots.
- Improve deployment health checks, monitoring, and operational documentation.

## Project links

- **Repository:** https://github.com/mohan05713/nexus-crisis-platform
- **Vercel domain:** https://nexus-crisis-platform.vercel.app/
- **API documentation (when the backend is reachable):** `/docs`
- **Issue tracker:** https://github.com/mohan05713/nexus-crisis-platform/issues

## Author

**Mohan**  
GitHub: [@mohan05713](https://github.com/mohan05713)

---

*Built as a crisis-intelligence and media-analysis project. Verify all incident information independently and follow local emergency guidance.*
