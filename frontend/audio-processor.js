// Audio Processor - Complete Voice Recording, Analysis & Transcription Engine
class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.chunks = [];
    this.isRecording = false;
    this.recordingStartTime = null;
    this.timerInterval = null;
  }

  // Initialize Web Audio API
  async init() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return true;
    } catch (e) {
      console.error('Web Audio API not supported:', e);
      return false;
    }
  }

  // Start microphone recording
  async startRecording() {
    try {
      await this.init();

      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });
      this.chunks = [];
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.onRecordingStop();
      };

      this.mediaRecorder.start();
      this.startTimer();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Stop recording
  stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return { success: false, error: 'No active recording' };
    }

    this.mediaRecorder.stop();
    this.stopTimer();
    this.audioStream.getTracks().forEach(track => track.stop());
    this.isRecording = false;

    return { success: true };
  }

  // Handle recording completion
  async onRecordingStop() {
    const mimeType = this.getSupportedMimeType();
    const blob = new Blob(this.chunks, { type: mimeType });

    // Convert to WAV if needed
    const wavBlob = await this.convertToWav(blob);

    // Create file object
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const file = new File([wavBlob], `nexus-recording-${timestamp}.wav`, {
      type: 'audio/wav'
    });

    return file;
  }

  // Convert audio to WAV format
  async convertToWav(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    return this.encodeWav(audioBuffer);
  }

  // WAV encoder
  encodeWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const channelData = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channelData.push(audioBuffer.getChannelData(channel));
    }

    const interleaved = new Float32Array(audioBuffer.length * numberOfChannels);
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        interleaved[i * numberOfChannels + channel] = channelData[channel][i];
      }
    }

    const dataLength = interleaved.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    const volume = 0.8;
    for (let i = 0; i < interleaved.length; i++) {
      let s = Math.max(-1, Math.min(1, interleaved[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // Get supported MIME type
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/wav';
  }

  // Record timer
  startTimer() {
    let seconds = 0;
    this.timerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const timerEl = document.getElementById('record-timer');
      if (timerEl) timerEl.textContent = display;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Analyze audio file
  async analyzeAudio(file) {
    try {
      await this.init();

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;

      // Analyze frequency spectrum
      const spectrum = this.analyzeFrequencies(audioBuffer);

      // Detect silence
      const silenceRatio = this.detectSilence(audioBuffer);

      // Voice characteristics
      const voiceMetrics = this.analyzeVoiceMetrics(audioBuffer);

      return {
        success: true,
        duration: duration.toFixed(2),
        sampleRate: sampleRate,
        channels: numberOfChannels,
        spectrum: spectrum,
        silenceRatio: silenceRatio.toFixed(2),
        voiceMetrics: voiceMetrics,
        fileSize: file.size
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Analyze frequency spectrum
  analyzeFrequencies(audioBuffer) {
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = offlineCtx.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(analyser);
    analyser.connect(offlineCtx.destination);
    source.start();

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Find dominant frequencies
    const dominant = Array.from(dataArray)
      .map((v, i) => ({ freq: i, level: v }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 5)
      .map(d => ({ frequency: (d.freq * audioBuffer.sampleRate / 2048).toFixed(1), level: d.level }));

    return dominant;
  }

  // Detect silence
  detectSilence(audioBuffer, threshold = 0.01) {
    let silentSamples = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) < threshold) {
          silentSamples++;
        }
      }
    }

    return silentSamples / (audioBuffer.length * audioBuffer.numberOfChannels);
  }

  // Analyze voice metrics
  analyzeVoiceMetrics(audioBuffer) {
    let totalEnergy = 0;
    let maxAmplitude = 0;
    let zerosCrossing = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const data = audioBuffer.getChannelData(channel);

      for (let i = 0; i < data.length; i++) {
        const sample = Math.abs(data[i]);
        totalEnergy += sample * sample;
        maxAmplitude = Math.max(maxAmplitude, sample);

        if (i > 0) {
          if ((data[i] > 0 && data[i - 1] <= 0) || (data[i] < 0 && data[i - 1] >= 0)) {
            zerosCrossing++;
          }
        }
      }
    }

    return {
      energy: (totalEnergy / audioBuffer.length).toFixed(4),
      amplitude: maxAmplitude.toFixed(4),
      zerosCrossing: zerosCrossing,
      estimatedPitch: this.estimatePitch(zerosCrossing, audioBuffer)
    };
  }

  // Estimate pitch from zero-crossing rate
  estimatePitch(zcr, audioBuffer) {
    const rate = zcr / audioBuffer.length;
    const fundamentalFreq = 2 * rate * audioBuffer.sampleRate;

    if (fundamentalFreq < 85) return 'Very Low (Bass)';
    if (fundamentalFreq < 180) return 'Low (Baritone)';
    if (fundamentalFreq < 255) return 'Mid-Low (Tenor)';
    if (fundamentalFreq < 340) return 'Mid (Alto)';
    if (fundamentalFreq < 530) return 'High (Soprano)';
    return 'Very High';
  }
}

// Global instance
window.audioProcessor = new AudioProcessor();
