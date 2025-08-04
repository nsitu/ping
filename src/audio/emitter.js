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

// Pulse patterns for each submarine type (pulse_duration_ms, pause_duration_ms, ...)
const SUBMARINE_PATTERNS = {
    research: [200],                    // Single long ping
    military: [100, 50, 100, 50, 100], // Triple rapid ping
    tourist: [150, 75, 150],           // Double ping  
    robotic: [80, 40, 80, 40, 80, 40, 80] // Quadruple quick ping
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
    const pattern = SUBMARINE_PATTERNS[modelId] || SUBMARINE_PATTERNS.research;
    
    console.log(`Emitting ${modelId} ping pattern:`, pattern, `at ${frequency} Hz`);
    
    let currentTime = audioContext.currentTime;
    
    // Emit each pulse in the pattern
    for (let i = 0; i < pattern.length; i += 2) {
        const pulseDuration = pattern[i] / 1000; // Convert ms to seconds
        const pauseDuration = (pattern[i + 1] || 0) / 1000; // Pause after pulse
        
        // Create oscillator and gain for this pulse
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine'; // Use sine wave for reliability across all types
        oscillator.frequency.setValueAtTime(frequency, currentTime);
        
        // Connect audio nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create clean pulse envelope
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(AUDIO_SETTINGS.PING_GAIN, currentTime + AUDIO_SETTINGS.ATTACK_TIME);
        gainNode.gain.setValueAtTime(AUDIO_SETTINGS.PING_GAIN, currentTime + pulseDuration - AUDIO_SETTINGS.RELEASE_TIME);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + pulseDuration);
        
        // Schedule oscillator
        oscillator.start(currentTime);
        oscillator.stop(currentTime + pulseDuration);
        
        // Move to next pulse time
        currentTime += pulseDuration + pauseDuration;
    }

    // Fire ping emitted event
    window.dispatchEvent(new CustomEvent('pingEmitted', {
        detail: {
            frequency: frequency,
            modelId: modelId,
            pattern: pattern,
            timestamp: now
        }
    }));

    console.log(`${modelId} ping pattern emitted: ${frequency} Hz, ${pattern.length / 2} pulses`);
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
