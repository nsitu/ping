// Mapping functions for dual-tone submarine ping encoding
// Similar to DTMF (touch-tone) but with submarine type + hue encoding

// Frequency ranges for dual-tone encoding
const SUBMARINE_FREQ_RANGE = [500, 600]; // Submarine type frequency range
const HUE_FREQ_RANGE = [650, 800];       // Hue frequency range

// Submarine type to frequency mapping (500-600 Hz)
const SUBMARINE_FREQUENCIES = {
    research: 520,  // 500 + (20/100 * 100) = 520 Hz
    military: 540,  // 500 + (40/100 * 100) = 540 Hz  
    tourist: 560,   // 500 + (60/100 * 100) = 560 Hz
    robotic: 580    // 500 + (80/100 * 100) = 580 Hz
};

// Reverse mapping for detection
const FREQUENCY_TO_SUBMARINE = {
    520: 'research',
    540: 'military', 
    560: 'tourist',
    580: 'robotic'
};

export function getSubmarineFrequency(modelId) {
    return SUBMARINE_FREQUENCIES[modelId] || SUBMARINE_FREQUENCIES.research;
}

export function getSubmarineFromFrequency(frequency, tolerance = 10) {
    // Find closest submarine frequency within tolerance
    for (const [freq, modelId] of Object.entries(FREQUENCY_TO_SUBMARINE)) {
        if (Math.abs(frequency - parseInt(freq)) <= tolerance) {
            return modelId;
        }
    }
    return null;
}

export function hueToFrequency(hue) {
    // Map hue (0-255) to frequency (650-800 Hz)
    const normalizedHue = hue / 255;
    const frequency = HUE_FREQ_RANGE[0] + (normalizedHue * (HUE_FREQ_RANGE[1] - HUE_FREQ_RANGE[0]));
    return frequency;
}

export function frequencyToHue(frequency) {
    // Map frequency (650-800 Hz) to hue (0-255)
    const normalizedFreq = (frequency - HUE_FREQ_RANGE[0]) / (HUE_FREQ_RANGE[1] - HUE_FREQ_RANGE[0]);
    const hue = Math.round(normalizedFreq * 255);
    return Math.max(0, Math.min(255, hue)); // Clamp to valid range
}

export function getFrequencyRanges() {
    return {
        submarine: SUBMARINE_FREQ_RANGE,
        hue: HUE_FREQ_RANGE,
        submarineFreqs: SUBMARINE_FREQUENCIES
    };
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
