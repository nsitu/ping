import { decodeFrequency, getFrequencyRanges } from '../core/mapping.js';

// Audio analysis configuration
const SAMPLE_RATE = 44100;
const FFT_SIZE = 4096;
const FREQ_BIN_SIZE = SAMPLE_RATE / (FFT_SIZE / 2);

// Get all submarine frequency ranges for detection
const SUBMARINE_RANGES = getFrequencyRanges();
const ALL_FREQ_RANGE = {
    min: Math.min(...Object.values(SUBMARINE_RANGES).map(r => r.min)),
    max: Math.max(...Object.values(SUBMARINE_RANGES).map(r => r.max))
};

// Detection thresholds (simplified for single-frequency)
const DETECTION_THRESHOLDS = {
    PEAK_SEARCH: -60,  // dB threshold for peak detection
    SIGNAL_STRENGTH: -50,    // dB threshold for valid signal
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

// Test mode for direct audio connection
let testMode = false;
let testAudioBuffer = null;
let directAudioMode = false;
let emitterAudioContext = null;

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

        // Log frequency analysis setup for debugging
        console.log(`Audio analysis setup:
- Sample rate: ${SAMPLE_RATE} Hz
- FFT size: ${FFT_SIZE}
- Frequency bins: ${analyser.frequencyBinCount}
- Frequency resolution: ${FREQ_BIN_SIZE.toFixed(2)} Hz per bin
- Detection range: ${ALL_FREQ_RANGE.min}-${ALL_FREQ_RANGE.max} Hz (bins ${Math.floor(ALL_FREQ_RANGE.min / FREQ_BIN_SIZE)}-${Math.ceil(ALL_FREQ_RANGE.max / FREQ_BIN_SIZE)})
- Submarine ranges: ${Object.entries(SUBMARINE_RANGES).map(([type, range]) => `${type}(${range.min}-${range.max}Hz)`).join(', ')}
- Detection thresholds: Peak=${DETECTION_THRESHOLDS.PEAK_SEARCH}dB, Signal=${DETECTION_THRESHOLDS.SIGNAL_STRENGTH}dB`);

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
    console.log('Starting single-frequency ping receiver...');

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

    // Get frequency domain data (real or test)
    if (testMode && !getTestFrequencyData()) {
        // Test mode enabled but no test data available
        analyser.getFloatFrequencyData(frequencyData);
    } else if (!testMode) {
        // Normal mode - get real microphone data
        analyser.getFloatFrequencyData(frequencyData);
    }
    // If test mode and test data loaded, frequencyData already has test data

    // Add debug logging every 2 seconds to see what we're detecting
    const now = Date.now();
    if (now % 2000 < 100) { // Log roughly every 2 seconds
        logFrequencySpectrum(frequencyData);
    }

    // Look for single-frequency signals
    const signalResult = detectSingleFrequency(frequencyData);
    if (signalResult) {
        processSingleFrequencyPing(signalResult);
    }

    // Continue processing
    if (isActive) {
        requestAnimationFrame(processAudioFrame);
    }
}

function detectSingleFrequency(frequencyData) {
    const now = Date.now();

    // Respect detection cooldown
    if (now - lastDetectionTime < DETECTION_COOLDOWN) {
        return null;
    }

    // Find the strongest peak in all submarine frequency ranges
    const strongestPeak = findStrongestPeakInRange(frequencyData, ALL_FREQ_RANGE);

    if (!strongestPeak) {
        return null;
    }

    // Check if signal is strong enough
    if (strongestPeak.magnitude < DETECTION_THRESHOLDS.SIGNAL_STRENGTH) {
        console.log(`Signal too weak: ${strongestPeak.frequency.toFixed(1)}Hz at ${strongestPeak.magnitude.toFixed(1)}dB (threshold: ${DETECTION_THRESHOLDS.SIGNAL_STRENGTH}dB)`);
        return null;
    }

    // Try to decode the frequency
    const decoded = decodeFrequency(strongestPeak.frequency);
    if (!decoded) {
        console.log(`Signal detected but not in any submarine range: ${strongestPeak.frequency.toFixed(1)}Hz`);
        return null;
    }

    console.log(`✓ ${decoded.submarineType} ping detected: ${strongestPeak.frequency.toFixed(1)}Hz (${strongestPeak.magnitude.toFixed(1)}dB), hue: ${decoded.hue}`);

    return {
        frequency: strongestPeak.frequency,
        magnitude: strongestPeak.magnitude,
        submarineType: decoded.submarineType,
        hue: decoded.hue,
        timestamp: now
    };
}

function logFrequencySpectrum(frequencyData) {
    // Find the strongest peaks across the submarine frequency ranges
    const allPeaks = [];

    for (let i = 1; i < frequencyData.length - 1; i++) {
        const magnitude = frequencyData[i];
        const frequency = i * FREQ_BIN_SIZE;

        // Only consider frequencies in submarine ranges
        if (frequency < ALL_FREQ_RANGE.min || frequency > ALL_FREQ_RANGE.max) continue;

        if (magnitude > -60) { // Only log relatively strong signals
            // Check if it's a local peak
            if (magnitude > frequencyData[i - 1] && magnitude > frequencyData[i + 1]) {
                const decoded = decodeFrequency(frequency);
                allPeaks.push({
                    frequency,
                    magnitude,
                    decoded: decoded ? `${decoded.submarineType}(${decoded.hue})` : 'unknown'
                });
            }
        }
    }

    // Sort by magnitude and take top 3
    allPeaks.sort((a, b) => b.magnitude - a.magnitude);
    const topPeaks = allPeaks.slice(0, 3);

    if (topPeaks.length > 0) {
        console.log(`Spectrum peaks:`, topPeaks.map(p => `${p.frequency.toFixed(1)}Hz(${p.magnitude.toFixed(1)}dB,${p.decoded})`).join(', '));
    }
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

function processSingleFrequencyPing(signalResult) {
    // Calculate signal strength
    const strength = normalizeStrength(signalResult.magnitude);

    // Create ping event
    const pingEvent = {
        submarineType: signalResult.submarineType,
        hue: signalResult.hue,
        frequency: signalResult.frequency,
        strength: strength,
        magnitude: signalResult.magnitude,
        timestamp: signalResult.timestamp
    };

    // Dispatch the ping detected event
    window.dispatchEvent(new CustomEvent('pingDetected', {
        detail: pingEvent
    }));

    console.log(`${signalResult.submarineType} submarine detected: ${signalResult.frequency.toFixed(1)}Hz, hue: ${signalResult.hue}°, strength: ${strength.toFixed(2)}`);

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

// Configuration functions
export function setDetectionThresholds(newThresholds) {
    // Map old threshold names to new ones for compatibility
    if (newThresholds.SIGNAL_PROCESS !== undefined) {
        DETECTION_THRESHOLDS.SIGNAL_STRENGTH = newThresholds.SIGNAL_PROCESS;
        DETECTION_THRESHOLDS.PEAK_SEARCH = newThresholds.SIGNAL_PROCESS - 10; // Set peak search 10dB lower
    }

    // Apply any direct threshold updates
    Object.assign(DETECTION_THRESHOLDS, newThresholds);

    console.log('Updated detection thresholds:', DETECTION_THRESHOLDS);
}

export function getNoiseLevel(duration = 0) {
    if (!analyser || !frequencyData) {
        return -90; // Return minimum if not initialized
    }

    if (duration > 0) {
        // Timed noise level test
        return new Promise((resolve) => {
            const samples = [];
            const sampleInterval = 50; // Sample every 50ms
            const totalSamples = Math.floor(duration / sampleInterval);
            let currentSample = 0;

            const collectSample = () => {
                // Get current frequency data
                analyser.getFloatFrequencyData(frequencyData);

                // Calculate average magnitude across relevant frequency range
                const minBin = Math.floor(400 / FREQ_BIN_SIZE);
                const maxBin = Math.ceil(900 / FREQ_BIN_SIZE);

                let totalMagnitude = 0;
                let sampleCount = 0;

                for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
                    totalMagnitude += frequencyData[i];
                    sampleCount++;
                }

                if (sampleCount > 0) {
                    samples.push(totalMagnitude / sampleCount);
                }

                currentSample++;
                if (currentSample < totalSamples) {
                    setTimeout(collectSample, sampleInterval);
                } else {
                    // Calculate average noise level
                    const averageNoise = samples.length > 0
                        ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length
                        : -90;
                    resolve(averageNoise);
                }
            };

            collectSample();
        });
    } else {
        // Instant noise level
        analyser.getFloatFrequencyData(frequencyData);

        const minBin = Math.floor(ALL_FREQ_RANGE.min / FREQ_BIN_SIZE);
        const maxBin = Math.ceil(ALL_FREQ_RANGE.max / FREQ_BIN_SIZE);

        let totalMagnitude = 0;
        let sampleCount = 0;

        for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
            totalMagnitude += frequencyData[i];
            sampleCount++;
        }

        const averageNoise = sampleCount > 0 ? totalMagnitude / sampleCount : -90;
        return averageNoise;
    }
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

// Debug function to test if any audio is being detected
export function testAudioDetection() {
    if (!analyser || !frequencyData) {
        console.log('Audio receiver not initialized');
        return;
    }

    analyser.getFloatFrequencyData(frequencyData);

    // Find the loudest frequency across the entire spectrum
    let maxMagnitude = -Infinity;
    let maxFrequency = 0;

    for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxMagnitude) {
            maxMagnitude = frequencyData[i];
            maxFrequency = i * FREQ_BIN_SIZE;
        }
    }

    console.log(`Audio test - Loudest signal: ${maxFrequency.toFixed(1)}Hz at ${maxMagnitude.toFixed(1)}dB`);

    // Check for any signals in our target ranges
    const allRangeMax = findStrongestPeakInRange(frequencyData, ALL_FREQ_RANGE);

    console.log(`Target ranges - All submarine ranges (${ALL_FREQ_RANGE.min}-${ALL_FREQ_RANGE.max}Hz): ${allRangeMax ? `${allRangeMax.frequency.toFixed(1)}Hz (${allRangeMax.magnitude.toFixed(1)}dB)` : 'no signal'}`);
}

// Enable test mode with simulated audio data
export function enableTestMode(enable = true) {
    testMode = enable;
    console.log(`Test mode ${enable ? 'enabled' : 'disabled'}`);

    if (enable && !testAudioBuffer) {
        // Create a test buffer with simulated single-frequency signal
        testAudioBuffer = new Float32Array(analyser?.frequencyBinCount || 2048);
        testAudioBuffer.fill(-90); // Fill with noise floor

        // Add simulated peak for research submarine with mid-range hue
        const testFreq = 537.5; // Research submarine (500-575Hz range) with hue 128

        const testBin = Math.round(testFreq / FREQ_BIN_SIZE);

        if (testBin < testAudioBuffer.length) testAudioBuffer[testBin] = -30; // Strong signal

        console.log(`Test buffer created with simulated peak at ${testFreq}Hz (research submarine)`);
    }
}

// Get test data instead of real microphone data
function getTestFrequencyData() {
    if (testAudioBuffer && frequencyData) {
        // Copy test data to the real frequency buffer
        for (let i = 0; i < Math.min(testAudioBuffer.length, frequencyData.length); i++) {
            frequencyData[i] = testAudioBuffer[i];
        }
        return true;
    }
    return false;
}

// Enable direct audio routing from emitter to receiver (bypasses microphone)
export function enableDirectAudioMode(enable = true) {
    directAudioMode = enable;
    console.log(`Direct audio mode ${enable ? 'enabled' : 'disabled'}`);

    if (enable) {
        // We'll need to connect to the emitter's audio context
        // This will be set up when the emitter creates tones
        console.log('Direct audio mode will connect emitter output directly to receiver analyzer');
    }
}
