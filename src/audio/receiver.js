// Audio receiver for detecting submarine pings from other devices

import { frequencyToHue, getModelFromWaveform } from '../core/mapping.js';

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let lastSelfPingTime = 0;

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const FREQ_BIN_SIZE = SAMPLE_RATE / FFT_SIZE;
const HZ_TOLERANCE = 5;

export async function startListening() {
  if (isListening) return;
  
  try {
    // Get microphone stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
        sampleRate: SAMPLE_RATE
      }
    });
    
    // Create audio context if needed
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Create analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.1;
    
    // Connect microphone to analyser
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    
    isListening = true;
    
    // Start audio analysis loop
    startAudioAnalysis();
    
    console.log('Audio receiver started, listening for pings...');
    
  } catch (error) {
    console.error('Failed to start audio receiver:', error);
    window.dispatchEvent(new CustomEvent('micPermissionDenied'));
    throw error;
  }
}

export function stopListening() {
  if (!isListening) return;
  
  isListening = false;
  
  if (microphone) {
    microphone.disconnect();
    microphone = null;
  }
  
  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }
  
  console.log('Audio receiver stopped');
}

function startAudioAnalysis() {
  const frequencyData = new Float32Array(analyser.frequencyBinCount);
  
  function analyzeFrame() {
    if (!isListening) return;
    
    // Get frequency domain data
    analyser.getFloatFrequencyData(frequencyData);
    
    // Analyze for ping signals
    onAudioFrame(frequencyData);
    
    // Continue loop
    requestAnimationFrame(analyzeFrame);
  }
  
  analyzeFrame();
}

function onAudioFrame(frequencyData) {
  const now = Date.now();
  
  // Skip analysis during cooldown period after self-ping
  if (now - lastSelfPingTime < 500) {
    return;
  }
  
  // Find peaks in frequency domain
  const peaks = findFrequencyPeaks(frequencyData);
  
  // Check each peak against our expected frequency range
  for (const peak of peaks) {
    const frequency = peak.frequency;
    
    // Check if frequency is in our range (440-1000 Hz)
    if (frequency >= 440 && frequency <= 1000) {
      const hue = frequencyToHue(frequency);
      const strength = peak.magnitude;
      
      // Only process significant peaks
      if (strength > -40) { // dB threshold
        // Try to determine model type from harmonic content
        const modelId = detectModelFromSpectrum(frequencyData, frequency);
        
        // Create ping event
        const pingEvent = {
          frequency: frequency,
          modelId: modelId,
          strength: normalizeStrength(strength),
          timestamp: now
        };
        
        // Fire ping detected event
        window.dispatchEvent(new CustomEvent('pingDetected', {
          detail: pingEvent
        }));
        
        console.log(`Ping detected: ${frequency.toFixed(1)} Hz, ${modelId}, strength: ${strength.toFixed(1)} dB`);
      }
    }
  }
}

function findFrequencyPeaks(frequencyData) {
  const peaks = [];
  const minPeakHeight = -50; // dB
  const minPeakDistance = 5; // bins
  
  for (let i = minPeakDistance; i < frequencyData.length - minPeakDistance; i++) {
    const magnitude = frequencyData[i];
    
    if (magnitude > minPeakHeight) {
      // Check if this is a local maximum
      let isPeak = true;
      for (let j = i - minPeakDistance; j <= i + minPeakDistance; j++) {
        if (j !== i && frequencyData[j] >= magnitude) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        const frequency = i * FREQ_BIN_SIZE;
        peaks.push({ frequency, magnitude, bin: i });
      }
    }
  }
  
  // Sort by magnitude (strongest first)
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  
  return peaks.slice(0, 10); // Return top 10 peaks
}

function detectModelFromSpectrum(frequencyData, fundamentalFreq) {
  // Simple heuristic based on harmonic content
  // This is a simplified approach - in reality, waveform detection 
  // would require more sophisticated analysis
  
  const fundamentalBin = Math.round(fundamentalFreq / FREQ_BIN_SIZE);
  const fundamental = frequencyData[fundamentalBin];
  
  // Check harmonic content
  const harmonics = [];
  for (let h = 2; h <= 4; h++) {
    const harmonicBin = Math.round((fundamentalFreq * h) / FREQ_BIN_SIZE);
    if (harmonicBin < frequencyData.length) {
      harmonics.push(frequencyData[harmonicBin] - fundamental);
    }
  }
  
  // Simple classification based on harmonic strength
  const avgHarmonic = harmonics.reduce((a, b) => a + b, 0) / harmonics.length;
  
  if (avgHarmonic > -10) {
    return 'military'; // Square wave has strong harmonics
  } else if (avgHarmonic > -20) {
    return 'tourist'; // Sawtooth has moderate harmonics
  } else if (avgHarmonic > -30) {
    return 'robotic'; // Triangle has some harmonics
  } else {
    return 'research'; // Sine wave has minimal harmonics
  }
}

function normalizeStrength(magnitudeDb) {
  // Convert dB magnitude to 0-1 range
  // Assuming range from -60 dB (weak) to -10 dB (strong)
  const minDb = -60;
  const maxDb = -10;
  
  const normalized = (magnitudeDb - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(1, normalized));
}

// Listen for ping emissions to update self-suppression timing
window.addEventListener('pingEmitted', () => {
  lastSelfPingTime = Date.now();
});
