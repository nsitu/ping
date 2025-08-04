// Audio emitter for generating dual-tone submarine pings
// Uses two simultaneous frequencies: submarine type (500-600Hz) + hue (650-800Hz)

import { hueToFrequency, getSubmarineFrequency } from '../core/mapping.js';

let audioContext = null;
let lastEmitTime = 0;

// Configurable audio settings for dual-tone pings
const AUDIO_SETTINGS = {
    PING_GAIN: 0.3,        // 30% volume per tone (0.0 - 1.0)
    PING_DURATION: 200,    // 200ms ping duration
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
    if (now - lastEmitTime < 1000) { // Reduced cooldown for simpler dual-tone
        return;
    }
    lastEmitTime = now;

    // Get the two frequencies for dual-tone encoding
    const submarineFreq = getSubmarineFrequency(modelId);  // 500-600 Hz range
    const hueFreq = hueToFrequency(hue);                   // 650-800 Hz range
    const duration = AUDIO_SETTINGS.PING_DURATION / 1000; // Convert to seconds

    console.log(`Emitting ${modelId} dual-tone ping: ${submarineFreq} Hz (type) + ${hueFreq.toFixed(1)} Hz (hue: ${hue})`);

    const currentTime = audioContext.currentTime;

    // Create first oscillator for submarine type (500-600 Hz)
    const submarineOsc = audioContext.createOscillator();
    const submarineGain = audioContext.createGain();
    
    submarineOsc.type = 'sine';
    submarineOsc.frequency.setValueAtTime(submarineFreq, currentTime);
    
    submarineOsc.connect(submarineGain);
    submarineGain.connect(audioContext.destination);
    
    // Create second oscillator for hue (650-800 Hz)
    const hueOsc = audioContext.createOscillator();
    const hueGainNode = audioContext.createGain();
    
    hueOsc.type = 'sine';
    hueOsc.frequency.setValueAtTime(hueFreq, currentTime);
    
    hueOsc.connect(hueGainNode);
    hueGainNode.connect(audioContext.destination);

    // Configure gain envelopes for both tones (simultaneous)
    const gain = AUDIO_SETTINGS.PING_GAIN;
    const attackTime = AUDIO_SETTINGS.ATTACK_TIME;
    const releaseTime = AUDIO_SETTINGS.RELEASE_TIME;

    // Submarine tone envelope
    submarineGain.gain.setValueAtTime(0, currentTime);
    submarineGain.gain.linearRampToValueAtTime(gain, currentTime + attackTime);
    submarineGain.gain.setValueAtTime(gain, currentTime + duration - releaseTime);
    submarineGain.gain.linearRampToValueAtTime(0, currentTime + duration);

    // Hue tone envelope
    hueGainNode.gain.setValueAtTime(0, currentTime);
    hueGainNode.gain.linearRampToValueAtTime(gain, currentTime + attackTime);
    hueGainNode.gain.setValueAtTime(gain, currentTime + duration - releaseTime);
    hueGainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

    // Start and stop both oscillators simultaneously
    submarineOsc.start(currentTime);
    submarineOsc.stop(currentTime + duration);
    
    hueOsc.start(currentTime);
    hueOsc.stop(currentTime + duration);

    // Fire ping emitted event
    window.dispatchEvent(new CustomEvent('pingEmitted', {
        detail: {
            submarineFreq: submarineFreq,
            hueFreq: hueFreq,
            hue: hue,
            modelId: modelId,
            timestamp: now,
            duration: AUDIO_SETTINGS.PING_DURATION
        }
    }));

    console.log(`${modelId} dual-tone ping emitted successfully`);
}

// Utility functions for audio configuration
export function setAudioSettings(newSettings) {
    Object.assign(AUDIO_SETTINGS, newSettings);
    console.log('Audio settings updated:', AUDIO_SETTINGS);
}

export function getAudioSettings() {
    return { ...AUDIO_SETTINGS };
}
