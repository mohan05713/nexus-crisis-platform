/* =========================================================================
   NEXUS AI CRISIS - LOCATION INTELLIGENCE & GLOBAL INCIDENT MAPPING ENGINE
   ========================================================================= */

const MapState = {
    map: null,
    markersGroup: null,
    heatLayer: null,
    viewMode: 'markers', // 'markers' | 'heatmap' | 'both'
    incidents: [],
    selectedIncident: null,
    userCoords: null,
    radarCircle: null,
    isInitialized: false,
};

// Comprehensive Indian States and Districts Data
const INDIA_GEOGRAPHY = {
    "Tamil Nadu": {
        center: [11.1271, 78.6569],
        zoom: 7,
        districts: {
            "Salem": [11.6643, 78.1460],
            "Chennai": [13.0827, 80.2707],
            "Coimbatore": [11.0168, 76.9558],
            "Madurai": [9.9252, 78.1198],
            "Tiruchirappalli": [10.7905, 78.7047],
            "Tirunelveli": [8.7139, 77.7567],
            "Erode": [11.3410, 77.7172],
            "Vellore": [12.9165, 79.1325],
            "Thanjavur": [10.7870, 79.1378],
            "Dindigul": [10.3673, 77.9803],
            "Kanyakumari": [8.0883, 77.5385],
            "Cuddalore": [11.7480, 79.7714],
            "Nagapattinam": [10.7672, 79.8449],
            "Nilgiris": [11.4102, 76.6950]
        }
    },
    "Maharashtra": {
        center: [19.7515, 75.7139],
        zoom: 7,
        districts: {
            "Mumbai City": [18.9388, 72.8354],
            "Mumbai Suburban": [19.0760, 72.8777],
            "Pune": [18.5204, 73.8567],
            "Nagpur": [21.1458, 79.0882],
            "Thane": [19.2183, 72.9781],
            "Nashik": [19.9975, 73.7898],
            "Aurangabad": [19.8762, 75.3433]
        }
    },
    "Delhi": {
        center: [28.6139, 77.2090],
        zoom: 11,
        districts: {
            "New Delhi": [28.6139, 77.2090],
            "North Delhi": [28.7306, 77.1327],
            "South Delhi": [28.5355, 77.2410],
            "Central Delhi": [28.6448, 77.2167],
            "East Delhi": [28.6273, 77.2789]
        }
    },
    "Karnataka": {
        center: [15.3173, 75.7139],
        zoom: 7,
        districts: {
            "Bengaluru Urban": [12.9716, 77.5946],
            "Mysuru": [12.2958, 76.6394],
            "Mangaluru": [12.9141, 74.8560],
            "Hubballi-Dharwad": [15.3647, 75.1240],
            "Belagavi": [15.8497, 74.4977],
            "Kodagu": [12.4244, 75.7382]
        }
    },
    "Kerala": {
        center: [10.8505, 76.2711],
        zoom: 7,
        districts: {
            "Thiruvananthapuram": [8.5241, 76.9366],
            "Kochi (Ernakulam)": [9.9312, 76.2673],
            "Kozhikode": [11.2588, 75.7804],
            "Thrissur": [10.5276, 76.2144],
            "Wayanad": [11.6854, 76.1320]
        }
    },
    "Andhra Pradesh": {
        center: [15.9129, 79.7400],
        zoom: 7,
        districts: {
            "Visakhapatnam": [17.6868, 83.2185],
            "Vijayawada": [16.5062, 80.6480],
            "Guntur": [16.3067, 80.4365],
            "Tirupati": [13.6288, 79.4192]
        }
    },
    "Telangana": {
        center: [18.1124, 79.0193],
        zoom: 7,
        districts: {
            "Hyderabad": [17.3850, 78.4867],
            "Warangal": [17.9689, 79.5941],
            "Nizamabad": [18.6725, 78.0941]
        }
    },
    "Gujarat": {
        center: [22.2587, 71.1924],
        zoom: 7,
        districts: {
            "Ahmedabad": [23.0225, 72.5714],
            "Surat": [21.1702, 72.8311],
            "Vadodara": [22.3072, 73.1812],
            "Rajkot": [22.3039, 70.8022]
        }
    },
    "Uttar Pradesh": {
        center: [26.8467, 80.9462],
        zoom: 7,
        districts: {
            "Lucknow": [26.8467, 80.9462],
            "Kanpur": [26.4499, 80.3319],
            "Varanasi": [25.3176, 82.9739],
            "Agra": [27.1767, 78.0081],
            "Noida (GB Nagar)": [28.5355, 77.3910]
        }
    }
};

const CATEGORY_ICONS = {
    "cyclone": "fa-hurricane",
    "flood": "fa-water",
    "wildfire": "fa-fire-flame-curved",
    "building_fire": "fa-fire",
    "chemical": "fa-biohazard",
    "earthquake": "fa-volcano",
    "road_accident": "fa-car-burst",
    "other": "fa-triangle-exclamation"
};

const SEVERITY_COLORS = {
    "critical": "#ef4444",
    "high": "#f97316",
    "moderate": "#f59e0b",
    "resolved": "#10b981"
};

// Initialize Leaflet Map
function initCrisisMap() {
    const container = document.getElementById('nexusMap');
    if (!container) return;

    if (!MapState.map) {
        // Create Leaflet instance
        MapState.map = L.map('nexusMap', {
            center: [20.5937, 78.9629], // Centered on India
            zoom: 5,
            minZoom: 2,
            maxZoom: 18,
            zoomControl: true,
        });

        // Add OpenStreetMap Standard Tiles (100% Free, Zero API Key Required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(MapState.map);

        MapState.markersGroup = L.layerGroup().addTo(MapState.map);
        MapState.isInitialized = true;
    }

    setTimeout(() => {
        MapState.map.invalidateSize();
    }, 200);

    loadMapIncidents();
    loadDataSourceHealth();
}

// Fetch Incidents from Backend
async function loadMapIncidents() {
    try {
        const stateVal = document.getElementById('filterState')?.value || '';
        const districtVal = document.getElementById('filterDistrict')?.value || '';
        const categoryVal = document.getElementById('filterCategory')?.value || '';
        const severityVal = document.getElementById('filterSeverity')?.value || '';

        let url = '/api/incidents?limit=250';
        if (stateVal) url += `&state=${encodeURIComponent(stateVal)}`;
        if (districtVal) url += `&district=${encodeURIComponent(districtVal)}`;
        if (categoryVal) url += `&category=${encodeURIComponent(categoryVal)}`;
        if (severityVal) url += `&severity=${encodeURIComponent(severityVal)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load incidents');
        const incidents = await res.json();
        MapState.incidents = incidents;

        renderIncidentsOnMap(incidents);
        updateActiveCountDisplay(incidents.length);
    } catch (err) {
        console.error('loadMapIncidents error:', err);
        showToast('Error loading crisis incidents: ' + err.message, 'error');
    }
}

// Render Markers & Heatmap
function renderIncidentsOnMap(incidents) {
    if (!MapState.map) return;

    // Clear existing markers
    if (MapState.markersGroup) {
        MapState.markersGroup.clearLayers();
    }

    // Heatmap data points [lat, lng, intensity]
    const heatPoints = [];

    incidents.forEach(inc => {
        if (inc.latitude == null || inc.longitude == null) return;
        const lat = parseFloat(inc.latitude);
        const lon = parseFloat(inc.longitude);
        if (isNaN(lat) || isNaN(lon)) return;

        const sev = inc.severity || 'moderate';
        const cat = inc.category || 'other';
        const color = SEVERITY_COLORS[sev] || '#3dd6c3';
        const iconName = CATEGORY_ICONS[cat] || 'fa-triangle-exclamation';

        // Add to heat points with higher intensity for critical/high
        const intensity = sev === 'critical' ? 1.0 : (sev === 'high' ? 0.7 : 0.4);
        heatPoints.push([lat, lon, intensity]);

        // Custom Tactical HTML Marker Icon
        const markerHtml = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
                <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: ${color}33; border: 2px solid ${color}; box-shadow: 0 0 14px ${color}88; animation: pulse 2s infinite;"></div>
                <i class="fa-solid ${iconName}" style="color: ${color}; font-size: 13px; position: relative; z-index: 2;"></i>
            </div>
        `;

        const customIcon = L.divIcon({
            html: markerHtml,
            className: 'nexus-crisis-marker',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18]
        });

        const marker = L.marker([lat, lon], { icon: customIcon });

        // Popup Content
        const popupContent = `
            <div style="font-family: monospace; font-size: 11px; padding: 4px; color: #e2e8f0; background: #0c121e;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 9px; font-weight: bold; color: ${color}; text-transform: uppercase;">● ${sev}</span>
                    <span style="font-size: 9px; color: #94a3b8;">${inc.source || 'NEXUS'}</span>
                </div>
                <strong style="display: block; font-size: 13px; color: #fff; margin-bottom: 4px;">${escapeHtml(inc.title || 'Incident')}</strong>
                <p style="margin: 0 0 6px 0; color: #cbd5e1; font-size: 11px; line-height: 1.4;">${escapeHtml((inc.description || '').substring(0, 110))}...</p>
                <div style="color: #38bdf8; font-size: 10px; margin-bottom: 6px;">📍 ${escapeHtml(inc.city || inc.district || inc.state || inc.country || 'Location')}</div>
                <button onclick="inspectIncident('${inc.id}')" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid #38bdf8; background: #0284c722; color: #38bdf8; font-size: 10px; cursor: pointer; font-weight: bold;">
                    Inspect Incident
                </button>
            </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 260 });
        marker.on('click', () => {
            inspectIncident(inc.id);
        });

        if (MapState.viewMode === 'markers' || MapState.viewMode === 'both') {
            MapState.markersGroup.addLayer(marker);
        }
    });

    // Update Heatmap Layer
    if (MapState.heatLayer) {
        MapState.map.removeLayer(MapState.heatLayer);
        MapState.heatLayer = null;
    }

    if ((MapState.viewMode === 'heatmap' || MapState.viewMode === 'both') && typeof L.heatLayer === 'function') {
        MapState.heatLayer = L.heatLayer(heatPoints, {
            radius: 28,
            blur: 18,
            maxZoom: 14,
            gradient: { 0.2: '#00F2FE', 0.5: '#FFB347', 0.8: '#FF5252' }
        }).addTo(MapState.map);
    }
}

// Switch View Modes: Markers, Heatmap, Both
function setMapViewMode(mode) {
    MapState.viewMode = mode;
    ['markers', 'heatmap', 'both'].forEach(m => {
        const btn = document.getElementById('modeBtn' + m.charAt(0).toUpperCase() + m.slice(1));
        if (btn) {
            if (m === mode) {
                btn.className = 'px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold transition';
            } else {
                btn.className = 'px-3 py-1 rounded text-slate-300 hover:text-white transition';
            }
        }
    });

    renderIncidentsOnMap(MapState.incidents);
}

// Recenter Actions
function recenterMapGlobal() {
    if (!MapState.map) return;
    MapState.map.setView([20, 0], 2);
}

function recenterMapIndia() {
    if (!MapState.map) return;
    MapState.map.setView([20.5937, 78.9629], 5);
}

// State & District Dropdown Filter Handling
function onStateFilterChange() {
    const stateSelect = document.getElementById('filterState');
    const districtSelect = document.getElementById('filterDistrict');
    if (!stateSelect || !districtSelect) return;

    const stateName = stateSelect.value;
    districtSelect.innerHTML = '<option value="">All Districts</option>';

    if (stateName && INDIA_GEOGRAPHY[stateName]) {
        const stateInfo = INDIA_GEOGRAPHY[stateName];
        Object.keys(stateInfo.districts).forEach(dist => {
            const opt = document.createElement('option');
            opt.value = dist;
            opt.textContent = dist;
            districtSelect.appendChild(opt);
        });

        if (MapState.map && stateInfo.center) {
            MapState.map.setView(stateInfo.center, stateInfo.zoom || 7);
        }
    }

    applyMapFilters();
}

function applyMapFilters() {
    const stateVal = document.getElementById('filterState')?.value;
    const districtVal = document.getElementById('filterDistrict')?.value;

    if (stateVal && districtVal && INDIA_GEOGRAPHY[stateVal]?.districts[districtVal] && MapState.map) {
        const coords = INDIA_GEOGRAPHY[stateVal].districts[districtVal];
        MapState.map.setView(coords, 10);
    }

    loadMapIncidents();
}

function resetMapFilters() {
    document.getElementById('mapSearchInput').value = '';
    document.getElementById('filterState').value = '';
    document.getElementById('filterDistrict').innerHTML = '<option value="">All Districts</option>';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterSeverity').value = '';
    recenterMapIndia();
    loadMapIncidents();
}

// Global Location Search
async function searchLocationQuery() {
    const input = document.getElementById('mapSearchInput');
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    showToast(`Geocoding location: ${query}...`, 'info');

    try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.found && data.location) {
            const loc = data.location;
            if (MapState.map) {
                MapState.map.setView([loc.latitude, loc.longitude], 10);
            }
            showToast(`Location resolved: ${loc.formatted_address}`, 'success');
        } else {
            showToast(`Location not found: "${query}"`, 'warning');
        }
    } catch (err) {
        showToast('Geocoding request failed: ' + err.message, 'error');
    }
}

// Inspect Selected Incident in Side Panel
function inspectIncident(incidentId) {
    const inc = MapState.incidents.find(i => i.id === incidentId);
    if (!inc) return;

    MapState.selectedIncident = inc;
    const content = document.getElementById('incidentDetailContent');
    const actions = document.getElementById('incidentDetailActions');
    const badge = document.getElementById('detailStatusBadge');

    if (!content) return;

    const sev = inc.severity || 'moderate';
    const color = SEVERITY_COLORS[sev] || '#3dd6c3';

    if (badge) {
        badge.textContent = sev.toUpperCase();
        badge.style.borderColor = color;
        badge.style.color = color;
        badge.style.background = `${color}22`;
    }

    content.innerHTML = `
        <div class="space-y-3">
            <div>
                <span class="text-[9px] text-slate-500 uppercase block font-bold">CASE ID // SOURCE</span>
                <div class="font-tech text-white text-base font-bold">${escapeHtml(inc.id)}</div>
                <div class="text-[10px] text-amber-400">${escapeHtml(inc.source || 'NEXUS Autonomous Feed')}</div>
            </div>
            <div>
                <span class="text-[9px] text-slate-500 uppercase block font-bold">INCIDENT TITLE</span>
                <strong class="text-white text-xs block leading-snug">${escapeHtml(inc.title)}</strong>
            </div>
            <div class="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5 text-[10px]">
                <div><span class="text-slate-500 block">CATEGORY</span><strong class="text-slate-200 capitalize">${escapeHtml(inc.category || 'Other')}</strong></div>
                <div><span class="text-slate-500 block">AI CONFIDENCE</span><strong class="text-emerald-400">${Math.round((inc.ai_confidence || 0.9) * 100)}%</strong></div>
                <div><span class="text-slate-500 block">VERIFICATION</span><strong class="text-amber-300 uppercase">${escapeHtml(inc.verification_status || 'Verified')}</strong></div>
                <div><span class="text-slate-500 block">ACCURACY</span><strong class="text-slate-300 capitalize">${escapeHtml(inc.location_accuracy || 'Exact')}</strong></div>
            </div>
            <div>
                <span class="text-[9px] text-slate-500 uppercase block font-bold">LOCATION DETAILS</span>
                <div class="text-slate-300 text-[11px] leading-relaxed">
                    📍 ${escapeHtml(inc.formatted_address || [inc.locality, inc.city, inc.district, inc.state, inc.country].filter(Boolean).join(', ') || 'Coordinates verified')}
                </div>
                <div class="text-[10px] text-slate-400 mt-1 font-mono">
                    Lat: <span class="text-amber-300">${inc.latitude}</span> | Lon: <span class="text-amber-300">${inc.longitude}</span>
                </div>
            </div>
            <div>
                <span class="text-[9px] text-slate-500 uppercase block font-bold">DESCRIPTION &amp; IMPACT</span>
                <div class="bg-black/40 p-2.5 rounded-xl border border-white/5 text-slate-300 text-[11px] leading-relaxed">
                    ${escapeHtml(inc.description || 'No additional narrative recorded.')}
                </div>
            </div>
            <div class="text-[9px] text-slate-500 border-t border-white/5 pt-2">
                Recorded: ${new Date(inc.occurred_at || inc.detected_at).toLocaleString()}
            </div>
        </div>
    `;

    if (actions) {
        actions.classList.remove('hidden');
        const dirBtn = document.getElementById('btnDirections');
        if (dirBtn) {
            dirBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${inc.latitude},${inc.longitude}`;
        }
    }

    // Smoothly pan map to incident location
    if (MapState.map && inc.latitude && inc.longitude) {
        MapState.map.panTo([inc.latitude, inc.longitude]);
    }
}

function copyIncidentCoords() {
    if (!MapState.selectedIncident) return;
    const coords = `${MapState.selectedIncident.latitude}, ${MapState.selectedIncident.longitude}`;
    navigator.clipboard.writeText(coords)
        .then(() => showToast('Coordinates copied: ' + coords, 'success'))
        .catch(() => showToast('Failed to copy to clipboard', 'warning'));
}

// Nearby Crisis Radar System
function openNearbyRadarModal() {
    const modal = document.getElementById('nearbyRadarModal');
    if (modal) modal.classList.remove('hidden');
}

function closeNearbyRadarModal() {
    const modal = document.getElementById('nearbyRadarModal');
    if (modal) modal.classList.add('hidden');
}

function requestUserGPSLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'warning');
        return;
    }
    showToast('Requesting GPS permission...', 'info');
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            document.getElementById('radarLat').value = lat.toFixed(5);
            document.getElementById('radarLon').value = lon.toFixed(5);
            showToast(`GPS Position Acquired: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
            fetchNearbyRadar();
        },
        (err) => {
            showToast('GPS access denied or unavailable. You can enter coordinates manually.', 'warning');
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

async function fetchNearbyRadar() {
    const lat = parseFloat(document.getElementById('radarLat').value);
    const lon = parseFloat(document.getElementById('radarLon').value);
    const radius = parseFloat(document.getElementById('radarRadius').value);

    if (isNaN(lat) || isNaN(lon)) {
        showToast('Please enter valid numeric latitude and longitude.', 'warning');
        return;
    }

    const container = document.getElementById('radarResultsContainer');
    container.innerHTML = '<div class="text-center py-4 text-amber-400"><i class="fa-solid fa-spinner animate-spin mr-2"></i> Scanning crisis radar...</div>';

    try {
        const res = await fetch(`/api/incidents/radar?lat=${lat}&lon=${lon}&radius_km=${radius}`);
        if (!res.ok) throw new Error('Radar scan failed');
        const data = await res.json();

        // Draw proximity circle on map
        if (MapState.map) {
            if (MapState.radarCircle) MapState.map.removeLayer(MapState.radarCircle);
            MapState.radarCircle = L.circle([lat, lon], {
                radius: radius * 1000,
                color: '#f59e0b',
                fillColor: '#f59e0b22',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(MapState.map);

            MapState.map.setView([lat, lon], radius <= 25 ? 11 : (radius <= 100 ? 9 : 7));
        }

        if (data.incidents.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400">
                    <i class="fa-solid fa-shield-halved text-2xl text-emerald-400 mb-2 block"></i>
                    All Clear. No crisis incidents detected within a ${radius} km radius of your location.
                </div>
            `;
            return;
        }

        let html = `<div class="text-xs text-slate-400 mb-2 font-bold uppercase flex items-center justify-between">
            <span>Threats in Range (${data.incidents.length})</span>
            <span class="text-cyan-400">Radius: ${radius} km</span>
        </div>`;

        data.incidents.forEach(inc => {
            const sev = inc.severity || 'moderate';
            const color = SEVERITY_COLORS[sev] || '#3dd6c3';
            html += `
                <div onclick="inspectIncident('${inc.id}'); closeNearbyRadarModal();" class="p-2.5 rounded-xl bg-black/50 border border-white/5 hover:border-amber-500/40 cursor-pointer transition flex items-center justify-between gap-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span style="color: ${color}; font-size: 8px;">● ${sev.toUpperCase()}</span>
                            <strong class="text-white text-xs">${escapeHtml(inc.title)}</strong>
                        </div>
                        <div class="text-[10px] text-slate-400">📍 ${escapeHtml(inc.city || inc.district || inc.state || 'Local area')}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-amber-400 font-bold text-xs">${inc.distance_km} km</div>
                        <div class="text-[9px] text-slate-500">Bearing: ${inc.bearing}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        showToast(`Radar scan completed: ${data.incidents.length} threat(s) in range.`, 'info');
    } catch (err) {
        container.innerHTML = `<div class="text-red-400 text-center py-4">Error: ${err.message}</div>`;
    }
}

// Report Incident Modal & AI Geocoding
function openReportIncidentModal() {
    const modal = document.getElementById('reportIncidentModal');
    if (modal) modal.classList.remove('hidden');
}

function closeReportIncidentModal() {
    const modal = document.getElementById('reportIncidentModal');
    if (modal) modal.classList.add('hidden');
}

async function submitNewIncident(event) {
    event.preventDefault();
    const title = document.getElementById('newIncTitle').value.trim();
    const description = document.getElementById('newIncDesc').value.trim();
    const category = document.getElementById('newIncCategory').value;
    const severity = document.getElementById('newIncSeverity').value;
    let lat = parseFloat(document.getElementById('newIncLat').value);
    let lon = parseFloat(document.getElementById('newIncLon').value);

    showToast('Extracting location & geocoding via AI engine...', 'info');

    try {
        // If coordinates missing, use AI geocoding extraction
        if (isNaN(lat) || isNaN(lon)) {
            const extRes = await fetch('/api/incidents/extract-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: `${title}. ${description}` })
            });
            const extData = await extRes.json();
            if (extData.geocoded && extData.geocoded.latitude) {
                lat = extData.geocoded.latitude;
                lon = extData.geocoded.longitude;
                showToast(`AI extracted location: ${extData.geocoded.formatted_address}`, 'success');
            } else {
                // Fallback default coordinates (center of India or user position)
                lat = 20.5937;
                lon = 78.9629;
            }
        }

        const sevColors = {
            critical: '#ff5252',
            high: '#ffb347',
            moderate: '#3dd6c3'
        };

        const payload = {
            title,
            description,
            category,
            severity,
            severity_color: sevColors[severity] || '#3dd6c3',
            status: 'active',
            verification_status: 'verified',
            ai_confidence: 0.94,
            latitude: lat,
            longitude: lon,
            source: 'Nexus Emergency Operator',
            location_source: 'AI Location Intelligence'
        };

        const createRes = await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!createRes.ok) throw new Error('Failed to record incident');

        showToast('Incident registered and mapped successfully!', 'success');
        closeReportIncidentModal();
        loadMapIncidents();

        // Focus map on newly created incident
        if (MapState.map) {
            MapState.map.setView([lat, lon], 9);
        }
    } catch (err) {
        showToast('Error registering incident: ' + err.message, 'error');
    }
}

// Synchronize External Data Sources
async function syncExternalIncidents() {
    showToast('Synchronizing GDACS, NASA EONET & FIRMS live feeds...', 'info');
    try {
        const res = await fetch('/api/incidents/sync', { method: 'POST' });
        if (!res.ok) throw new Error('Sync failed');
        const data = await res.json();
        showToast(`Sync complete! ${data.total_new_incidents} new crisis record(s) imported.`, 'success');
        loadMapIncidents();
        loadDataSourceHealth();
    } catch (err) {
        showToast('Sync request error: ' + err.message, 'error');
    }
}

// Load Data Source Health Status
async function loadDataSourceHealth() {
    try {
        const res = await fetch('/api/incidents/health');
        if (!res.ok) return;
        const healthList = await res.json();
        const container = document.getElementById('dataSourceHealthStrip');
        if (!container || !healthList.length) return;

        let html = '';
        healthList.forEach(item => {
            const isOk = item.status === 'healthy';
            const cls = isOk
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            html += `<span class="px-2.5 py-1 rounded border ${cls}">${escapeHtml(item.source)}: ${escapeHtml(item.status.toUpperCase())}</span>`;
        });
        container.innerHTML = html;
    } catch (err) {
        console.warn('loadDataSourceHealth error:', err);
    }
}

function updateActiveCountDisplay(count) {
    const el = document.getElementById('activeIncidentsCount');
    if (el) el.textContent = `${count} Incidents Displayed`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
