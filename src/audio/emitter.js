// Audio emitter for generating single-frequency submarine pings
// Each submarine type has a frequency range with hue encoded within it

import { getSubmarineFrequency } from '../core/mapping.js';

let audioContext = null;
let lastEmitTime = 0;

// Configurable audio settings for single-frequency pings
const AUDIO_SETTINGS = {
    PING_GAIN: 0.6,        // 60% volume (good balance of loudness and clarity)
    PING_DURATION: 300,    // 300ms ping duration (long enough for detection)
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
    if (now - lastEmitTime < 800) {
        return;
    }
    lastEmitTime = now;

    // Get the single frequency that encodes both submarine type and hue
    const frequency = getSubmarineFrequency(modelId, hue);
    const duration = AUDIO_SETTINGS.PING_DURATION / 1000; // Convert to seconds

    console.log(`Emitting ${modelId} ping: ${frequency.toFixed(1)} Hz (hue: ${hue})`);

    const currentTime = audioContext.currentTime;

    // Create single oscillator for encoded frequency
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure gain envelope
    const gain = AUDIO_SETTINGS.PING_GAIN;
    const attackTime = AUDIO_SETTINGS.ATTACK_TIME;
    const releaseTime = AUDIO_SETTINGS.RELEASE_TIME;

    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(gain, currentTime + attackTime);
    gainNode.gain.setValueAtTime(gain, currentTime + duration - releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

    // Start and stop oscillator
    oscillator.start(currentTime);
    oscillator.stop(currentTime + duration);

    // Fire ping emitted event
    window.dispatchEvent(new CustomEvent('pingEmitted', {
        detail: {
            frequency: frequency,
            hue: hue,
            modelId: modelId,
            timestamp: now,
            duration: AUDIO_SETTINGS.PING_DURATION
        }
    }));

    console.log(`${modelId} ping emitted successfully at ${frequency.toFixed(1)} Hz`);
}

// Utility functions for audio configuration
export function setAudioSettings(newSettings) {
    Object.assign(AUDIO_SETTINGS, newSettings);
    console.log('Audio settings updated:', AUDIO_SETTINGS);
}

export function getAudioSettings() {
    return { ...AUDIO_SETTINGS };
}
