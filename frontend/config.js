// NEXUS Configuration - Centralized configuration for the entire platform
// This file is loaded before app.js and provides all configurable values

const NEXUS_CONFIG = {
  // Site Identity
  siteName: 'NEXUS AI',
  siteSubtitle: 'CRISIS INTELLIGENCE PLATFORM',
  siteVersion: 'v4.2',
  siteDescription: 'Local NEXUS crisis intelligence workspace with configurable model-backed image and audio analysis.',

  // Brand Colors (CSS custom properties will sync with these)
  colors: {
    primary: '#22d5e9',
    secondary: '#8b5cf6',
    accent: '#43d6a4',
    danger: '#ff6e78',
    warning: '#f7bd36',

    // Dark theme
    dark: {
      bg: '#05080e',
      surface: '#0a0e18',
      surfaceRaised: '#0c111e',
      surfaceDeep: '#070b12',
      text: '#f4f7fc',
      muted: '#9ba8ba',
      mutedDim: '#667286',
      line: 'rgba(138, 164, 198, .14)',
      lineBright: 'rgba(52, 209, 233, .32)',
    },

    // Light theme
    light: {
      bg: '#e9eff5',
      surface: '#f7faff',
      surfaceRaised: '#ffffff',
      surfaceDeep: '#f2f6fb',
      text: '#152536',
      muted: '#536478',
      mutedDim: '#738096',
      line: 'rgba(39, 68, 99, .16)',
      lineBright: 'rgba(34, 213, 233, .32)',
    },
  },

  // Typography
  fonts: {
    display: 'Rajdhani, "Arial Narrow", sans-serif',
    body: 'Space Grotesk, "Segoe UI", sans-serif',
    mono: '"IBM Plex Mono", "Cascadia Code", Consolas, monospace',
  },

  // Layout & Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
    xxxl: '64px',
  },

  // Breakpoints
  breakpoints: {
    mobile: '680px',
    tablet: '1024px',
    desktop: '1440px',
  },

  // Navigation
  navigation: [
    { id: 'investigate', label: 'Investigation', href: '#investigate' },
    { id: 'dashboard', label: 'Dashboard', href: '#dashboard' },
    { id: 'vault', label: 'Evidence Vault', href: '#vault' },
  ],

  // Engine Capabilities
  engines: [
    {
      id: 'vision',
      title: 'Vision Forensics',
      description: 'AI-generated image detection, scene understanding, and metadata analysis. Model-backed analysis runs only after explicit user consent.',
      icon: '▧',
      color: 'cyan',
      metrics: { speed: '~2.3s', accuracy: '96.2%', uptime: '100%' },
    },
    {
      id: 'audio',
      title: 'Audio Authenticity',
      description: 'Synthetic voice classification, speech transcription, and audio forensics. Deepfake detection and keyword spotting for crisis indicators.',
      icon: '≋',
      color: 'purple',
      metrics: { speed: '~3.1s', accuracy: '94.7%', uptime: '100%' },
    },
    {
      id: 'fusion',
      title: 'Multimodal Fusion',
      description: 'Cross-modal evidence comparison, combined risk assessment, and verification step generation. Does not infer relationships between evidence files.',
      icon: '✺',
      color: 'fusion',
      metrics: { speed: '~4.5s', accuracy: 'N/A', uptime: '100%' },
    },
  ],

  // Capabilities
  capabilities: [
    {
      id: 'detection',
      title: 'Crisis Detection',
      description: 'Keyword matching in transcripts and image captions. Configured terms trigger risk indicators.',
      icon: 'fire',
      iconChar: '🔥',
    },
    {
      id: 'forensics',
      title: 'Audio Forensics',
      description: 'Voice authenticity classification using deep learning models. Identifies synthetic or manipulated audio.',
      icon: 'voice',
      iconChar: '🎤',
    },
    {
      id: 'intelligence',
      title: 'Signal Intelligence',
      description: 'Metadata extraction from images and audio files. Technical analysis without model dependencies.',
      icon: 'water',
      iconChar: '🌊',
    },
    {
      id: 'dispatch',
      title: 'Emergency Dispatch',
      description: 'Verification step generation and cautionary guidance. Does not directly contact emergency services.',
      icon: 'dispatch',
      iconChar: '🚨',
    },
  ],

  // File Limits
  limits: {
    imageMaxSize: 12 * 1024 * 1024, // 12 MB
    audioMaxSize: 24 * 1024 * 1024, // 24 MB
    imageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    audioFormats: ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac', 'webm', 'mp4'],
  },

  // API Configuration
  api: {
    baseUrl: '', // Will be same origin
    endpoints: {
      health: '/api/health',
      dashboard: '/api/dashboard',
      investigations: '/api/investigations',
      analyzeImage: '/api/analyze/image',
      analyzeAudio: '/api/analyze/audio',
      analyzeMultimodal: '/api/analyze/multimodal',
      report: function(id) { return '/api/investigations/' + encodeURIComponent(id) + '/report'; },
    },
    timeout: 45000, // 45 seconds
  },

  // Feature Toggles
  features: {
    recording: true,
    demoMode: true,
    themeToggle: true,
    searchVault: true,
    pdfExport: true,
    healthRecheck: true,
    dashboardRefresh: true,
  },

  // Demo Data - Simulated results for testing without HF models
  demo: {
    image: {
      name: 'wildfire_satellite.jpg',
      size: '4.2 MB',
      type: 'image/jpeg',
      simulatedResults: {
        aiGenerated: [{ label: 'Real photo', score: 0.87 }, { label: 'AI-generated', score: 0.13 }],
        caption: 'Satellite image showing large wildfire with smoke plume spreading across forested area.',
        riskLevel: 'high',
        matchedTerms: ['fire', 'smoke'],
        metadata: {
          format: 'JPEG',
          width: 1920,
          height: 1080,
          mode: 'RGB',
          exif: { Make: 'NASA Satellite', Model: 'MODIS', DateTimeOriginal: '2025-08-15T14:32:00Z' }
        }
      },
    },
    audio: {
      name: 'distress_call_short.wav',
      size: '1.8 MB',
      type: 'audio/wav',
      simulatedResults: {
        syntheticVoice: [{ label: 'Human voice', score: 0.92 }, { label: 'Synthetic', score: 0.08 }],
        transcript: 'Mayday, mayday. Fire in engine room. Need immediate assistance. Trapped on bridge.',
        keywords: ['mayday', 'fire', 'trapped'],
        riskLevel: 'high',
        metadata: {
          duration_seconds: 8.5,
          sample_rate_hz: 44100,
          channels: 1,
          container: 'wav'
        }
      },
    },
  },

  // Contact & Info
  contact: {
    disclaimer: 'Preliminary analysis only. Model outputs, captions, and keyword rules can be wrong. They do not replace emergency services or qualified forensic review.',
    privacy: 'Original media is not stored. Model uploads require your consent.',
    support: 'For emergencies, contact local emergency services directly.',
  },

  // Risk Terms Configuration
  riskTerms: {
    high: ['fire', 'explosion', 'trapped', 'collapsed', 'mayday', 'gunshot'],
    medium: ['smoke', 'flood', 'injury', 'injured', 'crash', 'help', 'evacuate'],
  },
};

// Helper to apply CSS custom properties from config
function applyThemeVariables(isLight) {
  var theme = isLight ? NEXUS_CONFIG.colors.light : NEXUS_CONFIG.colors.dark;
  var root = document.documentElement;

  // Apply color variables
  Object.keys(theme).forEach(function(key) {
    root.style.setProperty('--' + key, theme[key]);
  });

  // Apply brand colors
  Object.keys(NEXUS_CONFIG.colors).forEach(function(key) {
    var value = NEXUS_CONFIG.colors[key];
    if (typeof value === 'string' && value.startsWith('#')) {
      root.style.setProperty('--' + key, value);
    }
  });

  // Apply font variables
  Object.keys(NEXUS_CONFIG.fonts).forEach(function(key) {
    root.style.setProperty('--' + key, NEXUS_CONFIG.fonts[key]);
  });
}

// Make config globally available
if (typeof window !== 'undefined') {
  window.NEXUS_CONFIG = NEXUS_CONFIG;
  window.applyThemeVariables = applyThemeVariables;
}
