// Mapping functions for single-frequency submarine ping encoding
// Each submarine type gets a 75Hz frequency range with hue encoded within that range

// Frequency ranges for each submarine type (75Hz each)
const SUBMARINE_FREQUENCY_RANGES = {
    military: { min: 400, max: 475 },   // 400-475 Hz
    research: { min: 500, max: 575 },   // 500-575 Hz  
    robotic: { min: 600, max: 675 },    // 600-675 Hz
    tourist: { min: 700, max: 775 }     // 700-775 Hz
};

// Get frequency for a submarine type with encoded hue
export function getSubmarineFrequency(modelId, hue = 128) {
    const range = SUBMARINE_FREQUENCY_RANGES[modelId];
    if (!range) {
        console.warn(`Unknown submarine type: ${modelId}`);
        return SUBMARINE_FREQUENCY_RANGES.research.min; // Default to research
    }

    // Map hue (0-255) to frequency within the submarine's range
    const normalizedHue = hue / 255;
    const frequency = range.min + (normalizedHue * (range.max - range.min));

    return Math.round(frequency * 10) / 10; // Round to 0.1 Hz precision
}

// Decode submarine type and hue from frequency
export function decodeFrequency(frequency, tolerance = 5) {
    // Find which submarine range this frequency belongs to
    for (const [modelId, range] of Object.entries(SUBMARINE_FREQUENCY_RANGES)) {
        if (frequency >= (range.min - tolerance) && frequency <= (range.max + tolerance)) {
            // Calculate hue from position within range
            const normalizedPosition = (frequency - range.min) / (range.max - range.min);
            const hue = Math.round(Math.max(0, Math.min(255, normalizedPosition * 255)));

            return {
                submarineType: modelId,
                hue: hue,
                frequency: frequency
            };
        }
    }

    return null; // No match found
}

// Legacy compatibility functions
export function getSubmarineFromFrequency(frequency, tolerance = 5) {
    const decoded = decodeFrequency(frequency, tolerance);
    return decoded ? decoded.submarineType : null;
}

export function hueToFrequency(hue, submarineType = 'research') {
    return getSubmarineFrequency(submarineType, hue);
}

export function frequencyToHue(frequency) {
    const decoded = decodeFrequency(frequency);
    return decoded ? decoded.hue : 128; // Default to middle hue if can't decode
}

// Get all frequency ranges for validation
export function getFrequencyRanges() {
    return { ...SUBMARINE_FREQUENCY_RANGES };
}

export function getWaveform(modelId) {
    const waveformMap = {
        research: 'sine',
        military: 'square',
        tourist: 'sawtooth',
        robotic: 'triangle'
    };

    return waveformMap[modelId] || 'sine';
}

export function getModelFromWaveform(waveform) {
    const modelMap = {
        sine: 'research',
        square: 'military',
        sawtooth: 'tourist',
        triangle: 'robotic'
    };

    return modelMap[waveform] || 'research';
}

// Utility function to get model display info
export function getModelInfo(modelId) {
    const modelInfo = {
        research: { name: 'Research', icon: 'R', waveform: 'sine' },
        military: { name: 'Military', icon: 'M', waveform: 'square' },
        tourist: { name: 'Tourist', icon: 'T', waveform: 'sawtooth' },
        robotic: { name: 'Robotic', icon: '★', waveform: 'triangle' }
    };

    return modelInfo[modelId] || modelInfo.research;
}
