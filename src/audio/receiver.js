// Audio receiver for detecting submarine pings from other devices

import { frequencyToHue, getModelFromWaveform } from '../core/mapping.js';

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let lastSelfPingTime = 0;

// Pulse pattern detection
let recentPulses = []; // Store recent pulse detections
const PATTERN_TIMEOUT = 1500; // How long to wait for complete pattern (ms)

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const FREQ_BIN_SIZE = SAMPLE_RATE / FFT_SIZE;
const HZ_TOLERANCE = 5;

// Detection thresholds (configurable)
const DETECTION_THRESHOLDS = {
    PEAK_SEARCH: -55,      // dB - minimum to consider as potential peak
    SIGNAL_PROCESS: -45,   // dB - minimum to actually process/report
    NOISE_FLOOR: -65       // dB - estimated noise floor
};

// Expected pulse patterns for each submarine type (pulse_duration_ms, pause_duration_ms, ...)
const SUBMARINE_PATTERNS = {
    research: [200],                    // Single long ping
    military: [100, 50, 100, 50, 100], // Triple rapid ping
    tourist: [150, 75, 150],           // Double ping  
    robotic: [80, 40, 80, 40, 80, 40, 80] // Quadruple quick ping
};

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
    if (now - lastSelfPingTime < 2500) { // Longer cooldown for pattern sequences
        return;
    }

    // Clean up old pulses from detection buffer
    recentPulses = recentPulses.filter(pulse => now - pulse.timestamp < PATTERN_TIMEOUT);

    // Find peaks in frequency domain
    const peaks = findFrequencyPeaks(frequencyData);

    // Check each peak against our expected frequency range
    for (const peak of peaks) {
        const frequency = peak.frequency;

        // Check if frequency is in our range (440-1000 Hz)
        if (frequency >= 440 && frequency <= 1000) {
            const strength = peak.magnitude;

            // Only process significant peaks
            if (strength > DETECTION_THRESHOLDS.SIGNAL_PROCESS) {
                // Add this pulse to our detection buffer
                const pulse = {
                    frequency: frequency,
                    magnitude: strength,
                    timestamp: now
                };
                
                recentPulses.push(pulse);
                
                console.log(`Pulse detected: ${frequency.toFixed(1)} Hz, ${strength.toFixed(1)} dB, total pulses: ${recentPulses.length}`);
                
                // Try to match against submarine patterns
                const detectedPattern = detectPulsePattern(recentPulses);
                if (detectedPattern) {
                    const hue = frequencyToHue(frequency);
                    
                    // Create ping event
                    const pingEvent = {
                        frequency: frequency,
                        modelId: detectedPattern.modelId,
                        strength: normalizeStrength(strength),
                        magnitude: strength,
                        timestamp: now,
                        pattern: detectedPattern.pattern
                    };

                    // Fire ping detected event
                    window.dispatchEvent(new CustomEvent('pingDetected', {
                        detail: pingEvent
                    }));

                    console.log(`${detectedPattern.modelId} submarine detected: ${frequency.toFixed(1)} Hz, pattern: [${detectedPattern.pattern.join(', ')}]ms, strength: ${strength.toFixed(1)} dB`);
                    
                    // Clear the buffer after successful detection
                    recentPulses = [];
                }
            }
        }
    }
}

function findFrequencyPeaks(frequencyData) {
    const peaks = [];
    const minPeakHeight = DETECTION_THRESHOLDS.PEAK_SEARCH; // Use configurable threshold
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

function detectPulsePattern(pulses) {
    if (pulses.length < 1) return null;
    
    // Sort pulses by timestamp
    const sortedPulses = [...pulses].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate intervals between pulses
    const intervals = [];
    for (let i = 1; i < sortedPulses.length; i++) {
        intervals.push(sortedPulses[i].timestamp - sortedPulses[i-1].timestamp);
    }
    
    // Try to match against each known pattern
    for (const [modelId, pattern] of Object.entries(SUBMARINE_PATTERNS)) {
        if (matchesPattern(intervals, pattern, modelId, sortedPulses.length)) {
            return { modelId, pattern };
        }
    }
    
    return null;
}

function matchesPattern(detectedIntervals, expectedPattern, modelId, pulseCount) {
    // Extract expected intervals from pattern (every second element is a pause)
    const expectedIntervals = [];
    for (let i = 1; i < expectedPattern.length; i += 2) {
        if (expectedPattern[i] > 0) { // Only count actual pauses
            expectedIntervals.push(expectedPattern[i]);
        }
    }
    
    // Calculate expected number of pulses
    const expectedPulseCount = Math.ceil(expectedPattern.length / 2);
    
    // For single pulse patterns (research), just check if we have one pulse and enough time has passed
    if (expectedPattern.length === 1) {
        return pulseCount === 1; // Single pulse, no intervals to check
    }
    
    // For multi-pulse patterns, we need the right number of intervals
    if (detectedIntervals.length !== expectedIntervals.length) {
        return false;
    }
    
    // Check if intervals match within tolerance
    const tolerance = 50; // 50ms tolerance
    for (let i = 0; i < expectedIntervals.length; i++) {
        const expected = expectedIntervals[i];
        const detected = detectedIntervals[i];
        
        if (Math.abs(detected - expected) > tolerance) {
            return false;
        }
    }
    
    console.log(`Pattern match for ${modelId}: expected intervals [${expectedIntervals.join(', ')}]ms, detected [${detectedIntervals.join(', ')}]ms`);
    return true;
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
window.addEventListener('pingEmitted', (event) => {
    lastSelfPingTime = Date.now();
    // Also clear any pulse buffer when we emit to avoid detecting our own patterns
    recentPulses = [];
    console.log('Self-ping emitted, clearing pulse buffer and starting cooldown');
});

// Utility functions for threshold adjustment
export function setDetectionThresholds(newThresholds) {
    Object.assign(DETECTION_THRESHOLDS, newThresholds);
    console.log('Detection thresholds updated:', DETECTION_THRESHOLDS);
}

export function getDetectionThresholds() {
    return { ...DETECTION_THRESHOLDS };
}

export function getSubmarinePatterns() {
    return { ...SUBMARINE_PATTERNS };
}

// Debug function to get current noise levels
export function getNoiseLevel(duration = 1000) {
    if (!analyser) {
        console.warn('Analyser not available');
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        const samples = [];

        const startTime = Date.now();

        function sampleNoise() {
            if (Date.now() - startTime > duration) {
                // Calculate average noise level
                const avgNoise = samples.reduce((a, b) => a + b, 0) / samples.length;
                resolve(avgNoise);
                return;
            }

            analyser.getFloatFrequencyData(frequencyData);

            // Sample noise from our frequency range (440-1000 Hz)
            const startBin = Math.floor(440 / FREQ_BIN_SIZE);
            const endBin = Math.floor(1000 / FREQ_BIN_SIZE);

            let sum = 0;
            let count = 0;
            for (let i = startBin; i <= endBin; i++) {
                sum += frequencyData[i];
                count++;
            }

            samples.push(sum / count);

            setTimeout(sampleNoise, 50); // Sample every 50ms
        }

        sampleNoise();
    });
}
