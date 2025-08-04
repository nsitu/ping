// Audio receiver for detecting submarine pings from other devices

import { decodeFrequency, getFrequencyRanges } from '../core/mapping.js';

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

    // Get all submarine frequency ranges
    const frequencyRanges = getFrequencyRanges();

    // Check each peak against our submarine frequency ranges
    for (const peak of peaks) {
        const frequency = peak.frequency;

        // Try to decode the frequency to get submarine type and hue
        const decoded = decodeFrequency(frequency, HZ_TOLERANCE);

        if (decoded) {
            const { submarineType, hue } = decoded;
            const strength = peak.magnitude;

            // Only process significant peaks
            if (strength > -40) { // dB threshold
                // Create ping event
                const pingEvent = {
                    frequency: frequency,
                    modelId: submarineType,
                    hue: hue,
                    strength: normalizeStrength(strength),
                    timestamp: now
                };

                // Fire ping detected event
                window.dispatchEvent(new CustomEvent('pingDetected', {
                    detail: pingEvent
                }));

                console.log(`Ping detected: ${frequency.toFixed(1)} Hz, ${submarineType}, hue: ${hue}, strength: ${strength.toFixed(1)} dB`);
            }
        }
    }
}

function findFrequencyPeaks(frequencyData) {
    const peaks = [];
    const minPeakHeight = -50; // dB
    const minPeakDistance = 3; // bins (reduced for better precision in our narrow ranges)

    // Focus on our submarine frequency ranges (400-775 Hz)
    const minFreq = 400;
    const maxFreq = 775;
    const minBin = Math.floor(minFreq / FREQ_BIN_SIZE);
    const maxBin = Math.ceil(maxFreq / FREQ_BIN_SIZE);

    for (let i = Math.max(minBin, minPeakDistance);
        i < Math.min(maxBin, frequencyData.length - minPeakDistance);
        i++) {
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