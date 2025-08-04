// Audio receiver for detecting submarine pings from other devices

import { frequencyToHue, getModelFromWaveform } from '../core/mapping.js';

let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let lastSelfPingTime = 0;

// Pulse pattern detection
let recentPulses = []; // Store recent pulse detections
let signalHistory = []; // Store signal strength history for pattern analysis
let lastDetectionTime = 0; // Track last successful detection to prevent duplicates
const PATTERN_TIMEOUT = 1500; // How long to wait for complete pattern (ms)
const PATTERN_WAIT_TIME = 500; // Wait time after first pulse before pattern matching (ms)
const HISTORY_DURATION = 500; // Keep 500ms of signal history

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

    // Clean up old signal history - keep only last HISTORY_DURATION ms
    signalHistory = signalHistory.filter(sample => now - sample.timestamp < HISTORY_DURATION);

    // Find peaks in frequency domain
    const peaks = findFrequencyPeaks(frequencyData);

    // Record signal strength for our frequency range
    let maxSignalInRange = -100; // Start with very low value
    let bestFrequency = null;

    for (const peak of peaks) {
        const frequency = peak.frequency;

        // Check if frequency is in our range (440-1000 Hz)
        if (frequency >= 440 && frequency <= 1000) {
            const strength = peak.magnitude;

            if (strength > maxSignalInRange) {
                maxSignalInRange = strength;
                bestFrequency = frequency;
            }
        }
    }

    // Add current signal strength to history
    signalHistory.push({
        timestamp: now,
        frequency: bestFrequency,
        magnitude: maxSignalInRange,
        isSignal: maxSignalInRange > DETECTION_THRESHOLDS.SIGNAL_PROCESS
    });

    // Check if we have enough history and if signal pattern just ended
    if (signalHistory.length > 15) { // Need more samples for multi-pulse patterns
        const recentSamples = signalHistory.slice(-8); // Last 8 samples (~128ms)
        const olderSamples = signalHistory.slice(-25, -8); // Previous samples (~272ms)

        const recentHasSignal = recentSamples.some(s => s.isSignal);
        const olderHasSignal = olderSamples.some(s => s.isSignal);

        // If we had signal before but not recently, analyze the pattern
        // Wait longer for complex patterns to complete
        if (olderHasSignal && !recentHasSignal) {
            // Wait a bit longer to ensure we captured the complete pattern
            setTimeout(() => {
                analyzeSignalPattern(bestFrequency || getAverageFrequency(signalHistory));
            }, 50); // 50ms delay to ensure pattern completion
        }
    }
}

function analyzeSignalPattern(frequency) {
    if (signalHistory.length < 20) return; // Need enough samples

    const now = Date.now();

    // Prevent duplicate detections within 1 second
    if (now - lastDetectionTime < 1000) {
        console.log('Skipping analysis - too soon after last detection');
        return;
    }

    console.log(`Analyzing signal pattern for ${frequency?.toFixed(1) || 'unknown'} Hz with ${signalHistory.length} samples`);

    // Convert signal history to binary pattern (signal/no-signal)
    const threshold = DETECTION_THRESHOLDS.SIGNAL_PROCESS;
    const binaryPattern = signalHistory.map(sample => sample.magnitude > threshold ? 1 : 0);

    // Find pulse sequences (groups of consecutive 1s)
    const pulseSequences = [];
    let currentPulse = null;

    for (let i = 0; i < binaryPattern.length; i++) {
        const sample = signalHistory[i];

        if (binaryPattern[i] === 1) { // Signal detected
            if (!currentPulse) {
                // Start of new pulse
                currentPulse = {
                    startTime: sample.timestamp,
                    endTime: sample.timestamp,
                    startIndex: i,
                    endIndex: i,
                    maxMagnitude: sample.magnitude,
                    frequency: sample.frequency || frequency
                };
            } else {
                // Continue current pulse
                currentPulse.endTime = sample.timestamp;
                currentPulse.endIndex = i;
                if (sample.magnitude > currentPulse.maxMagnitude) {
                    currentPulse.maxMagnitude = sample.magnitude;
                    currentPulse.frequency = sample.frequency || frequency;
                }
            }
        } else { // No signal
            if (currentPulse) {
                // End of current pulse
                currentPulse.duration = currentPulse.endTime - currentPulse.startTime;
                pulseSequences.push(currentPulse);
                currentPulse = null;
            }
        }
    }

    // Handle case where pattern ends with a pulse
    if (currentPulse) {
        currentPulse.duration = currentPulse.endTime - currentPulse.startTime;
        pulseSequences.push(currentPulse);
    }

    console.log(`Found ${pulseSequences.length} pulse sequences:`,
        pulseSequences.map(p => `${p.duration}ms`).join(', '));

    if (pulseSequences.length === 0) return;

    // Try to match pattern
    const detectedPattern = matchSignalPattern(pulseSequences);
    if (detectedPattern) {
        const strongestPulse = pulseSequences.reduce((prev, current) =>
            (prev.maxMagnitude > current.maxMagnitude) ? prev : current
        );

        const pingEvent = {
            frequency: frequency || strongestPulse.frequency,
            modelId: detectedPattern.modelId,
            strength: normalizeStrength(strongestPulse.maxMagnitude),
            magnitude: strongestPulse.maxMagnitude,
            timestamp: pulseSequences[0].startTime,
            pattern: detectedPattern.pattern
        };

        // Fire ping detected event
        window.dispatchEvent(new CustomEvent('pingDetected', {
            detail: pingEvent
        }));

        console.log(`${detectedPattern.modelId} submarine detected: ${frequency?.toFixed(1) || 'unknown'} Hz, pattern: [${detectedPattern.pattern.join(', ')}]ms, strength: ${strongestPulse.maxMagnitude.toFixed(1)} dB`);

        // Clear history after successful detection and set cooldown
        signalHistory = [];
        lastDetectionTime = Date.now();
    }
}

function matchSignalPattern(pulseSequences) {
    if (pulseSequences.length === 1) {
        // Single pulse - check if it matches research pattern
        const duration = pulseSequences[0].duration;
        console.log(`Single pulse: ${duration}ms duration`);

        if (duration >= 150 && duration <= 300) {
            return { modelId: 'research', pattern: [200] };
        }
    } else if (pulseSequences.length > 1) {
        // Multi-pulse pattern - calculate intervals
        const intervals = [];
        for (let i = 1; i < pulseSequences.length; i++) {
            const interval = pulseSequences[i].startTime - pulseSequences[i - 1].endTime;
            intervals.push(interval);
        }

        console.log(`Multi-pulse pattern: ${pulseSequences.length} pulses, intervals: [${intervals.join(', ')}]ms`);

        // Try to match against known patterns - check most specific patterns first
        const patternEntries = Object.entries(SUBMARINE_PATTERNS)
            .filter(([modelId]) => modelId !== 'research')
            .sort((a, b) => {
                // Sort by specificity: more pulses first, then by smaller intervals
                const aPulses = Math.ceil(a[1].length / 2);
                const bPulses = Math.ceil(b[1].length / 2);
                if (aPulses !== bPulses) {
                    return bPulses - aPulses; // More pulses first
                }
                // If same pulse count, prioritize smaller intervals (more specific timing)
                const aInterval = a[1][1] || 0;
                const bInterval = b[1][1] || 0;
                return aInterval - bInterval; // Smaller intervals first
            });

        for (const [modelId, pattern] of patternEntries) {
            if (matchesTimingPattern(intervals, pattern, modelId, pulseSequences.length)) {
                return { modelId, pattern };
            }
        }
    }

    return null;
}

function matchesTimingPattern(detectedIntervals, expectedPattern, modelId, pulseCount) {
    // Extract expected intervals from pattern
    const expectedIntervals = [];
    for (let i = 1; i < expectedPattern.length; i += 2) {
        expectedIntervals.push(expectedPattern[i]);
    }

    const expectedPulseCount = Math.ceil(expectedPattern.length / 2);

    console.log(`Checking ${modelId}: expected ${expectedPulseCount} pulses with intervals [${expectedIntervals.join(', ')}]ms, got ${pulseCount} pulses with intervals [${detectedIntervals.join(', ')}]ms`);

    // Check pulse count
    if (pulseCount !== expectedPulseCount) {
        console.log(`✗ ${modelId} pulse count mismatch: expected ${expectedPulseCount}, got ${pulseCount}`);
        return false;
    }

    // Check interval count
    if (detectedIntervals.length !== expectedIntervals.length) {
        console.log(`✗ ${modelId} interval count mismatch: expected ${expectedIntervals.length}, got ${detectedIntervals.length}`);
        return false;
    }

    // Check if intervals match within tolerance - use different tolerances for different patterns
    let tolerance;
    switch (modelId) {
        case 'robotic': tolerance = 25; break;  // 40ms intervals, tight tolerance
        case 'military': tolerance = 35; break; // 50ms intervals, moderate tolerance  
        case 'tourist': tolerance = 45; break;  // 75ms intervals, looser tolerance
        default: tolerance = 50; break;
    }

    for (let i = 0; i < expectedIntervals.length; i++) {
        const expected = expectedIntervals[i];
        const detected = detectedIntervals[i];

        if (Math.abs(detected - expected) > tolerance) {
            console.log(`✗ ${modelId} interval ${i} mismatch: expected ${expected}ms, got ${detected}ms (diff: ${Math.abs(detected - expected)}ms > ${tolerance}ms tolerance)`);
            return false;
        }
    }

    console.log(`✓ ${modelId} pattern matched: ${expectedPulseCount} pulses with intervals [${expectedIntervals.join(', ')}]ms`);
    return true;
}

function getAverageFrequency(history) {
    const validSamples = history.filter(s => s.frequency !== null);
    if (validSamples.length === 0) return null;

    return validSamples.reduce((sum, s) => sum + s.frequency, 0) / validSamples.length;
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
    lastDetectionTime = Date.now(); // Also reset detection cooldown
    // Also clear signal history when we emit to avoid detecting our own patterns
    signalHistory = [];
    console.log('Self-ping emitted, clearing signal history and starting cooldown');
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
