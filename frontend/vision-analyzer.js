// NEXUS Vision Analyzer - Advanced Image Analysis Engine
// Real-time pixel histogram, thermal analysis, anomaly detection, canvas visualization

class VisionAnalyzer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.pixelData = null;
  }

  // Initialize canvas for analysis
  initCanvas(containerId, width, height) {
    const container = document.getElementById(containerId);
    if (!container) return false;

    container.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.border = '1px solid rgba(34,213,233,.32)';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.backgroundColor = '#0a0e18';

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    container.appendChild(this.canvas);
    return true;
  }

  // Load image from file and extract pixel data
  async loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (!this.initCanvas('vision-canvas', img.width, img.height)) {
            reject('Canvas initialization failed');
            return;
          }

          this.ctx.drawImage(img, 0, 0);
          this.imageData = this.ctx.getImageData(0, 0, img.width, img.height);
          this.pixelData = this.imageData.data;

          resolve({
            width: img.width,
            height: img.height,
            pixelCount: this.pixelData.length / 4
          });
        };
        img.onerror = () => reject('Image load failed');
        img.src = e.target.result;
      };
      reader.onerror = () => reject('File read failed');
      reader.readAsDataURL(file);
    });
  }

  // Extract RGB histogram data
  getHistogram() {
    const histogram = {
      red: new Array(256).fill(0),
      green: new Array(256).fill(0),
      blue: new Array(256).fill(0),
      alpha: new Array(256).fill(0)
    };

    for (let i = 0; i < this.pixelData.length; i += 4) {
      histogram.red[this.pixelData[i]]++;
      histogram.green[this.pixelData[i + 1]]++;
      histogram.blue[this.pixelData[i + 2]]++;
      histogram.alpha[this.pixelData[i + 3]]++;
    }

    return histogram;
  }

  // Calculate thermal radiance (brightness/heat signature)
  getThermalRadiance() {
    let totalBrightness = 0;
    let maxBrightness = 0;

    for (let i = 0; i < this.pixelData.length; i += 4) {
      const brightness = (this.pixelData[i] * 0.299 + this.pixelData[i + 1] * 0.587 + this.pixelData[i + 2] * 0.114);
      totalBrightness += brightness;
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    const avgBrightness = totalBrightness / (this.pixelData.length / 4);
    const radiance = (avgBrightness / 255) * 100;

    return {
      average: radiance.toFixed(2),
      max: (maxBrightness / 255 * 100).toFixed(2),
      normalized: (radiance / 100).toFixed(4)
    };
  }

  // Detect water reflectance (high blue and alpha channel signatures)
  getWaterReflectance() {
    let blueChannelSum = 0;
    let reflectivePixels = 0;

    for (let i = 0; i < this.pixelData.length; i += 4) {
      const r = this.pixelData[i];
      const g = this.pixelData[i + 1];
      const b = this.pixelData[i + 2];

      // Water typically has high blue, moderate green, low red
      const waterScore = (b * 0.6 + g * 0.3 - r * 0.1) / 255;

      if (waterScore > 0.4) {
        reflectivePixels++;
        blueChannelSum += b;
      }
    }

    const reflectance = (reflectivePixels / (this.pixelData.length / 4)) * 100;
    return reflectance.toFixed(2);
  }

  // Calculate pixel variance (noise detection for AI-generated images)
  getPixelVariance() {
    const pixelCount = this.pixelData.length / 4;
    let totalVariance = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < this.pixelData.length; i += 16) {
      const r = this.pixelData[i];
      const g = this.pixelData[i + 1];
      const b = this.pixelData[i + 2];

      // Next pixel
      if (i + 4 < this.pixelData.length) {
        const nextR = this.pixelData[i + 4];
        const nextG = this.pixelData[i + 5];
        const nextB = this.pixelData[i + 6];

        const variance = Math.sqrt(
          Math.pow(r - nextR, 2) +
          Math.pow(g - nextG, 2) +
          Math.pow(b - nextB, 2)
        );

        totalVariance += variance;
      }
    }

    const avgVariance = totalVariance / (pixelCount / 4);
    return avgVariance.toFixed(2);
  }

  // Detect anomalies (edge detection + color deviation)
  detectAnomalies() {
    const width = this.imageData.width;
    const height = this.imageData.height;
    const anomalyData = this.ctx.createImageData(width, height);
    const anomalyPixels = anomalyData.data;

    // Copy original image
    anomalyPixels.set(this.pixelData);

    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        // Sobel operators
        let gx = 0, gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const px = ((y + ky) * width + (x + kx)) * 4;
            const gray = this.pixelData[px] * 0.299 + this.pixelData[px + 1] * 0.587 + this.pixelData[px + 2] * 0.114;

            const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
            const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

            gx += gray * sobelX[ky + 1][kx + 1];
            gy += gray * sobelY[ky + 1][kx + 1];
          }
        }

        const edge = Math.sqrt(gx * gx + gy * gy);

        if (edge > 100) {
          // Highlight edges in cyan
          anomalyPixels[idx] = 34;      // R
          anomalyPixels[idx + 1] = 213; // G (cyan)
          anomalyPixels[idx + 2] = 233; // B
          anomalyPixels[idx + 3] = 200; // A
        }
      }
    }

    this.ctx.putImageData(anomalyData, 0, 0);
    return anomalyData;
  }

  // Draw bounding boxes around detected anomalies
  drawAnomalyBBox() {
    const width = this.imageData.width;
    const height = this.imageData.height;
    const data = this.imageData.data;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.putImageData(this.imageData, 0, 0);

    // Detect regions of high variance
    const regions = [];
    const blockSize = 32;

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let variance = 0;
        let pixelCount = 0;

        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4;
            const brightness = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            variance += brightness;
            pixelCount++;
          }
        }

        variance = variance / pixelCount;

        if (variance > 100 && variance < 180) {
          regions.push({ x, y, w: blockSize, h: blockSize, intensity: variance });
        }
      }
    }

    // Draw bounding boxes
    this.ctx.strokeStyle = '#22d5e9';
    this.ctx.lineWidth = 2;
    this.ctx.font = 'bold 12px "IBM Plex Mono"';
    this.ctx.fillStyle = '#22d5e9';

    regions.forEach((region, i) => {
      this.ctx.strokeRect(region.x, region.y, region.w, region.h);
      this.ctx.fillText(`[${i + 1}]`, region.x + 5, region.y - 5);
    });

    return regions;
  }

  // Draw histogram visualization
  drawHistogram(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const histogram = this.getHistogram();
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 150;
    canvas.style.border = '1px solid rgba(34,213,233,.16)';
    canvas.style.borderRadius = '6px';
    canvas.style.backgroundColor = '#0a0e18';

    const ctx = canvas.getContext('2d');
    const channels = ['red', 'green', 'blue'];
    const colors = ['#ff6b6b', '#51cf66', '#4dabf7'];

    channels.forEach((channel, idx) => {
      const data = histogram[channel];
      const max = Math.max(...data);
      const barWidth = canvas.width / 256;

      ctx.fillStyle = colors[idx];
      ctx.globalAlpha = 0.6;

      for (let i = 0; i < 256; i++) {
        const barHeight = (data[i] / max) * canvas.height;
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
      }
    });

    ctx.globalAlpha = 1;
    container.innerHTML = '';
    container.appendChild(canvas);
  }

  // Generate full analysis report
  async generateReport(file) {
    try {
      await this.loadImageFile(file);

      const histogram = this.getHistogram();
      const thermal = this.getThermalRadiance();
      const water = this.getWaterReflectance();
      const variance = this.getPixelVariance();
      const anomalies = this.detectAnomalies();
      const bboxes = this.drawAnomalyBBox();

      return {
        success: true,
        dimensions: {
          width: this.imageData.width,
          height: this.imageData.height,
          pixels: this.imageData.width * this.imageData.height
        },
        thermal: thermal,
        water: parseFloat(water),
        variance: parseFloat(variance),
        histogram: histogram,
        anomalies: bboxes.length,
        anomalyBoxes: bboxes
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Analysis failed'
      };
    }
  }
}

// Global instance
window.visionAnalyzer = new VisionAnalyzer();
