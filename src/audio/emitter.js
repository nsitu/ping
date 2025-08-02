// Audio emitter for generating submarine ping sounds

import { hueToFrequency, getWaveform } from '../core/mapping.js';

let audioContext = null;
let lastEmitTime = 0;

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
  if (now - lastEmitTime < 500) {
    return;
  }
  lastEmitTime = now;
  
  const frequency = hueToFrequency(hue);
  const waveform = getWaveform(modelId);
  const duration = 0.2; // 200ms
  
  // Create oscillator
  const oscillator = audioContext.createOscillator();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // Create gain node for envelope
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  
  // Create envelope: quick attack, sustain, quick release
  const startTime = audioContext.currentTime;
  const attackTime = 0.01;
  const releaseTime = 0.05;
  
  gainNode.gain.linearRampToValueAtTime(0.3, startTime + attackTime);
  gainNode.gain.setValueAtTime(0.3, startTime + duration - releaseTime);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  
  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Start and stop oscillator
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
  
  // Fire ping emitted event
  window.dispatchEvent(new CustomEvent('pingEmitted', {
    detail: {
      frequency: frequency,
      modelId: modelId,
      timestamp: now
    }
  }));
  
  console.log(`Ping emitted: ${frequency} Hz (${waveform}) for ${modelId} submarine`);
}
