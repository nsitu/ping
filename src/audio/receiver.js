import { hueToFrequency, frequencyToHue, getSubmarineFromFrequency } from '../core/mapping.js';

// Audio analysis configuration
const SAMPLE_RATE = 44100;
const FFT_SIZE = 4096;
const FREQ_BIN_SIZE = SAMPLE_RATE / (FFT_SIZE / 2);

// Dual-tone frequency ranges
const SUBMARINE_FREQ_RANGE = { min: 500, max: 600 };
const HUE_FREQ_RANGE = { min: 650, max: 800 };

// Detection thresholds
const DETECTION_THRESHOLDS = {
    PEAK_SEARCH: -50,  // dB threshold for peak detection
    DUAL_TONE: -40,    // dB threshold for valid dual-tone signal
    MAGNITUDE_DIFF: 15 // Max dB difference between submarine and hue tones
};

// Audio processing components
let audioContext = null;
let analyser = null;
let mediaStream = null;
let frequencyData = null;
let isActive = false;

// Detection state
let lastDetectionTime = 0;
const DETECTION_COOLDOWN = 300; // ms between detections

export async function initializeReceiver() {
    try {
        console.log('Initializing audio receiver...');
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();

        // Request microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: SAMPLE_RATE
            } 
        });

        // Create analyzer
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.3;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;

        // Connect microphone to analyzer
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);

        // Initialize frequency data array
        frequencyData = new Float32Array(analyser.frequencyBinCount);

        console.log('Audio receiver initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize audio receiver:', error);
        return false;
    }
}

export function startReceiver() {
    if (!analyser) {
        console.error('Audio receiver not initialized');
        return false;
    }

    isActive = true;
    console.log('Starting dual-tone ping receiver...');
    
    // Start the audio processing loop
    processAudioFrame();
    return true;
}

export function stopReceiver() {
    isActive = false;
    console.log('Stopped ping receiver');
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
    }
    
    analyser = null;
    frequencyData = null;
}

function processAudioFrame() {
    if (!isActive || !analyser) return;

    // Get frequency domain data
    analyser.getFloatFrequencyData(frequencyData);

    // Look for dual-tone signals
    const dualToneResult = detectDualTone(frequencyData);
    if (dualToneResult) {
        processDualTonePing(dualToneResult);
    }

    // Continue processing
    if (isActive) {
        requestAnimationFrame(processAudioFrame);
    }
}

function detectDualTone(frequencyData) {
    const now = Date.now();
    
    // Respect detection cooldown
    if (now - lastDetectionTime < DETECTION_COOLDOWN) {
        return null;
    }

    // Find peaks in both frequency ranges
    const submarinePeak = findStrongestPeakInRange(frequencyData, SUBMARINE_FREQ_RANGE);
    const huePeak = findStrongestPeakInRange(frequencyData, HUE_FREQ_RANGE);

    // Both peaks must be present and strong enough
    if (!submarinePeak || !huePeak) {
        return null;
    }

    if (submarinePeak.magnitude < DETECTION_THRESHOLDS.DUAL_TONE || 
        huePeak.magnitude < DETECTION_THRESHOLDS.DUAL_TONE) {
        return null;
    }

    // Check that both peaks are similar strength (simultaneous tones)
    const magnitudeDiff = Math.abs(submarinePeak.magnitude - huePeak.magnitude);
    if (magnitudeDiff > DETECTION_THRESHOLDS.MAGNITUDE_DIFF) {
        console.log(`Magnitude difference too large: ${magnitudeDiff.toFixed(1)}dB`);
        return null;
    }

    console.log(`Dual-tone detected: Submarine ${submarinePeak.frequency.toFixed(1)}Hz (${submarinePeak.magnitude.toFixed(1)}dB), Hue ${huePeak.frequency.toFixed(1)}Hz (${huePeak.magnitude.toFixed(1)}dB)`);

    return {
        submarineFreq: submarinePeak.frequency,
        hueFreq: huePeak.frequency,
        submarineMagnitude: submarinePeak.magnitude,
        hueMagnitude: huePeak.magnitude,
        timestamp: now
    };
}

function findStrongestPeakInRange(frequencyData, freqRange) {
    const minBin = Math.floor(freqRange.min / FREQ_BIN_SIZE);
    const maxBin = Math.ceil(freqRange.max / FREQ_BIN_SIZE);
    
    let strongestPeak = null;
    
    for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
        const magnitude = frequencyData[i];
        
        if (magnitude > DETECTION_THRESHOLDS.PEAK_SEARCH) {
            // Check if this is a local maximum within the range
            let isPeak = true;
            const checkRange = 3; // bins to check around
            
            for (let j = Math.max(minBin, i - checkRange); 
                 j <= Math.min(maxBin, i + checkRange) && j < frequencyData.length; 
                 j++) {
                if (j !== i && frequencyData[j] >= magnitude) {
                    isPeak = false;
                    break;
                }
            }
            
            if (isPeak && (!strongestPeak || magnitude > strongestPeak.magnitude)) {
                strongestPeak = {
                    frequency: i * FREQ_BIN_SIZE,
                    magnitude: magnitude,
                    bin: i
                };
            }
        }
    }
    
    return strongestPeak;
}

function processDualTonePing(dualToneResult) {
    // Decode submarine type from frequency
    const submarineType = getSubmarineFromFrequency(dualToneResult.submarineFreq);
    if (!submarineType) {
        console.log(`Unknown submarine frequency: ${dualToneResult.submarineFreq.toFixed(1)}Hz`);
        return;
    }

    // Decode hue from frequency
    const hue = frequencyToHue(dualToneResult.hueFreq);

    // Calculate signal strength (average of both tones)
    const avgMagnitude = (dualToneResult.submarineMagnitude + dualToneResult.hueMagnitude) / 2;
    const strength = normalizeStrength(avgMagnitude);

    // Create ping event
    const pingEvent = {
        submarineType: submarineType,
        hue: hue,
        frequency: dualToneResult.submarineFreq, // Primary frequency for compatibility
        hueFrequency: dualToneResult.hueFreq,
        strength: strength,
        magnitude: avgMagnitude,
        timestamp: dualToneResult.timestamp
    };

    // Dispatch the ping detected event
    window.dispatchEvent(new CustomEvent('pingDetected', {
        detail: pingEvent
    }));

    console.log(`${submarineType} submarine detected: ${dualToneResult.submarineFreq.toFixed(1)}Hz + ${dualToneResult.hueFreq.toFixed(1)}Hz, hue: ${hue.toFixed(0)}°, strength: ${strength.toFixed(1)}`);

    // Set detection cooldown
    lastDetectionTime = Date.now();
}

function normalizeStrength(magnitudeDb) {
    // Convert dB magnitude to 0-1 strength scale
    // -90dB = 0, -10dB = 1
    const minDb = -90;
    const maxDb = -10;
    
    const normalized = (magnitudeDb - minDb) / (maxDb - minDb);
    return Math.max(0, Math.min(1, normalized));
}

// Status functions
export function getReceiverStatus() {
    return {
        initialized: !!analyser,
        active: isActive,
        audioContext: audioContext?.state || 'none',
        sampleRate: audioContext?.sampleRate || 0
    };
}

// Compatibility functions for existing app.js
export async function startListening() {
    // Initialize if not already done
    if (!analyser) {
        const initialized = await initializeReceiver();
        if (!initialized) {
            throw new Error('Failed to initialize audio receiver');
        }
    }
    
    // Start the receiver
    return startReceiver();
}

export const stopListening = stopReceiver;
