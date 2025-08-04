// Mapping functions for hue ↔ frequency and model ↔ waveform

// Configuration constants
const HUE_RANGE = [0, 255];
const FREQ_RANGE_HZ = [600, 800]; // Optimized range for better detection reliability

export function hueToFrequency(hue) {
    // Map hue (0-255) to frequency (440-1000 Hz)
    const normalizedHue = hue / 255;
    const frequency = FREQ_RANGE_HZ[0] + (normalizedHue * (FREQ_RANGE_HZ[1] - FREQ_RANGE_HZ[0]));
    return frequency;
}

export function frequencyToHue(frequency) {
    // Map frequency (440-1000 Hz) to hue (0-255)
    const normalizedFreq = (frequency - FREQ_RANGE_HZ[0]) / (FREQ_RANGE_HZ[1] - FREQ_RANGE_HZ[0]);
    const hue = Math.round(normalizedFreq * 255);
    return Math.max(0, Math.min(255, hue)); // Clamp to valid range
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
