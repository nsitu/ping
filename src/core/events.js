// Custom event bus for application events

export function setupEventBus() {
  // Ensure we have a clean event bus
  // This function can be called to initialize or reset the event system
  
  console.log('Event bus initialized');
}

// Event types and their expected detail structures:
//
// pingEmitted: { frequency: number, modelId: string, timestamp: number }
// pingDetected: { frequency: number, modelId: string, strength: number, timestamp: number }
// settingsChanged: { hue: number, modelId: string }
// micPermissionDenied: {} (no detail)

// Helper functions for common event patterns

export function emitPingEmitted(frequency, modelId, timestamp = Date.now()) {
  window.dispatchEvent(new CustomEvent('pingEmitted', {
    detail: { frequency, modelId, timestamp }
  }));
}

export function emitPingDetected(frequency, modelId, strength, timestamp = Date.now()) {
  window.dispatchEvent(new CustomEvent('pingDetected', {
    detail: { frequency, modelId, strength, timestamp }
  }));
}

export function emitSettingsChanged(hue, modelId) {
  window.dispatchEvent(new CustomEvent('settingsChanged', {
    detail: { hue, modelId }
  }));
}

export function emitMicPermissionDenied() {
  window.dispatchEvent(new CustomEvent('micPermissionDenied'));
}

// Event listener helpers
export function onPingEmitted(callback) {
  window.addEventListener('pingEmitted', callback);
}

export function onPingDetected(callback) {
  window.addEventListener('pingDetected', callback);
}

export function onSettingsChanged(callback) {
  window.addEventListener('settingsChanged', callback);
}

export function onMicPermissionDenied(callback) {
  window.addEventListener('micPermissionDenied', callback);
}

// Cleanup helpers
export function removeEventListener(eventType, callback) {
  window.removeEventListener(eventType, callback);
}
