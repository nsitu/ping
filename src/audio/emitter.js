// Audio emitter for generating submarine ping sounds

import { hueToFrequency, getWaveform } from '../core/mapping.js';

let audioContext = null;
let lastEmitTime = 0;

// Configurable audio settings
const AUDIO_SETTINGS = {
    PING_GAIN: 0.5,        // 50% volume (0.0 - 1.0)
    ATTACK_TIME: 0.01,     // 10ms attack
    RELEASE_TIME: 0.05     // 50ms release
};

// Enhanced pulse patterns with amplitude signatures for each submarine type
const SUBMARINE_PATTERNS = {
    research: { 
        timing: [200],
        amplitudePattern: 'constant',
        gains: [0.5] // Single constant gain
    },
    military: { 
        timing: [100, 50, 100, 50, 100],
        amplitudePattern: 'ascending',
        gains: [0.3, 0.4, 0.5] // Ascending gains
    },
    tourist: { 
        timing: [150, 75, 150],
        amplitudePattern: 'descending', 
        gains: [0.5, 0.3] // Descending gains
    },
    robotic: { 
        timing: [80, 40, 80, 40, 80, 40, 80],
        amplitudePattern: 'alternating',
        gains: [0.5, 0.3, 0.5, 0.3] // Alternating gains
    }
};

export async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended (required by browser policies)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    return audioContext;
}

export async function emitPing(hue, modelId) {
    if (!audioContext) {
        throw new Error('Audio context not initialized');
    }

    // Prevent rapid-fire pings
    const now = Date.now();
    if (now - lastEmitTime < 2000) { // Increased cooldown for pattern sequences
        return;
    }
    lastEmitTime = now;

    const frequency = hueToFrequency(hue);
    const patternData = SUBMARINE_PATTERNS[modelId] || SUBMARINE_PATTERNS.research;
    const pattern = patternData.timing;
    const gains = patternData.gains;

    console.log(`Emitting ${modelId} ping pattern:`, pattern, `at ${frequency} Hz with amplitude pattern: ${patternData.amplitudePattern}`);

    let currentTime = audioContext.currentTime;
    let pulseIndex = 0;

    // Emit each pulse in the pattern
    for (let i = 0; i < pattern.length; i += 2) {
        const pulseDuration = pattern[i] / 1000; // Convert ms to seconds
        const pauseDuration = (pattern[i + 1] || 0) / 1000; // Pause after pulse
        const pulseGain = gains[pulseIndex] || 0.5; // Use specific gain for this pulse

        // Create oscillator and gain for this pulse
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine'; // Use sine wave for reliability across all types
        oscillator.frequency.setValueAtTime(frequency, currentTime);

        // Connect audio nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Create clean pulse envelope with specific amplitude
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(pulseGain, currentTime + AUDIO_SETTINGS.ATTACK_TIME);
        gainNode.gain.setValueAtTime(pulseGain, currentTime + pulseDuration - AUDIO_SETTINGS.RELEASE_TIME);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + pulseDuration);

        // Schedule oscillator
        oscillator.start(currentTime);
        oscillator.stop(currentTime + pulseDuration);

        // Move to next pulse time
        currentTime += pulseDuration + pauseDuration;
        pulseIndex++;
    }

    // Fire ping emitted event
    window.dispatchEvent(new CustomEvent('pingEmitted', {
        detail: {
            frequency: frequency,
            modelId: modelId,
            pattern: patternData,
            timestamp: now
        }
    }));

    console.log(`${modelId} ping pattern emitted: ${frequency} Hz, ${Math.ceil(pattern.length / 2)} pulses, amplitude: ${patternData.amplitudePattern}`);
}

// Utility functions for audio configuration
export function setAudioSettings(newSettings) {
    Object.assign(AUDIO_SETTINGS, newSettings);
    console.log('Audio settings updated:', AUDIO_SETTINGS);
}

export function getAudioSettings() {
    return { ...AUDIO_SETTINGS };
}

export function getSubmarinePatterns() {
    return { ...SUBMARINE_PATTERNS };
}
