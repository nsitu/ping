// Tests for mapping functions

import { getSubmarineFrequency, decodeFrequency, getWaveform, getModelFromWaveform, getFrequencyRanges } from '../src/core/mapping.js';

// Test submarine frequency mapping
function testSubmarineFrequencyMapping() {
    console.log('Testing submarine frequency mapping...');

    const submarineTypes = ['military', 'research', 'robotic', 'tourist'];
    const ranges = getFrequencyRanges();

    for (const submarineType of submarineTypes) {
        // Test boundaries
        const freq0 = getSubmarineFrequency(submarineType, 0);
        const freq255 = getSubmarineFrequency(submarineType, 255);
        const freqMid = getSubmarineFrequency(submarineType, 128);

        const range = ranges[submarineType];

        console.assert(Math.abs(freq0 - range.min) < 0.1,
            `Expected ~${range.min}Hz for ${submarineType} hue 0, got ${freq0}`);
        console.assert(Math.abs(freq255 - range.max) < 0.1,
            `Expected ~${range.max}Hz for ${submarineType} hue 255, got ${freq255}`);

        const expectedMid = range.min + (range.max - range.min) * 128 / 255;
        console.assert(Math.abs(freqMid - expectedMid) < 1,
            `Expected ~${expectedMid}Hz for ${submarineType} hue 128, got ${freqMid}`);
    }

    console.log('✓ Submarine frequency mapping tests passed');
}

// Test frequency decoding
function testFrequencyDecoding() {
    console.log('Testing frequency decoding...');

    const testCases = [
        { freq: 400, expectedType: 'military', expectedHue: 0 },
        { freq: 475, expectedType: 'military', expectedHue: 255 },
        { freq: 500, expectedType: 'research', expectedHue: 0 },
        { freq: 575, expectedType: 'research', expectedHue: 255 },
        { freq: 600, expectedType: 'robotic', expectedHue: 0 },
        { freq: 675, expectedType: 'robotic', expectedHue: 255 },
        { freq: 700, expectedType: 'tourist', expectedHue: 0 },
        { freq: 775, expectedType: 'tourist', expectedHue: 255 }
    ];

    for (const testCase of testCases) {
        const decoded = decodeFrequency(testCase.freq);

        console.assert(decoded !== null, `Failed to decode frequency ${testCase.freq}`);
        console.assert(decoded.submarineType === testCase.expectedType,
            `Expected type ${testCase.expectedType} for ${testCase.freq}Hz, got ${decoded.submarineType}`);
        console.assert(Math.abs(decoded.hue - testCase.expectedHue) < 2,
            `Expected hue ~${testCase.expectedHue} for ${testCase.freq}Hz, got ${decoded.hue}`);
    }

    console.log('✓ Frequency decoding tests passed');
}

// Test round-trip conversion
function testRoundTripConversion() {
    console.log('Testing round-trip conversion...');

    const testHues = [0, 64, 128, 192, 255];
    const submarineTypes = ['military', 'research', 'robotic', 'tourist'];

    for (const submarineType of submarineTypes) {
        for (const originalHue of testHues) {
            const freq = getSubmarineFrequency(submarineType, originalHue);
            const decoded = decodeFrequency(freq);

            console.assert(decoded !== null, `Failed to decode frequency ${freq} for ${submarineType}`);
            console.assert(decoded.submarineType === submarineType,
                `Wrong submarine type: expected ${submarineType}, got ${decoded.submarineType}`);

            const difference = Math.abs(originalHue - decoded.hue);
            console.assert(difference < 2,
                `Round-trip failed for ${submarineType} hue ${originalHue}: ${originalHue} -> ${freq}Hz -> ${decoded.hue}`);
        }
    }

    console.log('✓ Round-trip conversion tests passed');
}

// Test waveform mapping
function testWaveformMapping() {
    console.log('Testing waveform mapping...');

    const modelWaveforms = {
        research: 'sine',
        military: 'square',
        tourist: 'sawtooth',
        robotic: 'triangle'
    };

    for (const [model, expectedWaveform] of Object.entries(modelWaveforms)) {
        const waveform = getWaveform(model);
        console.assert(waveform === expectedWaveform, `Expected ${expectedWaveform} for ${model}, got ${waveform}`);

        const recoveredModel = getModelFromWaveform(waveform);
        console.assert(recoveredModel === model, `Expected ${model} for ${waveform}, got ${recoveredModel}`);
    }

    // Test default fallback
    const unknownWaveform = getWaveform('unknown');
    console.assert(unknownWaveform === 'sine', `Expected sine for unknown model, got ${unknownWaveform}`);

    console.log('✓ Waveform mapping tests passed');
}

// Run all tests
export function runMappingTests() {
    console.log('=== Running Mapping Tests ===');

    try {
        testSubmarineFrequencyMapping();
        testFrequencyDecoding();
        testRoundTripConversion();
        testWaveformMapping();

        console.log('=== All Mapping Tests Passed! ===');
        return true;
    } catch (error) {
        console.error('=== Mapping Tests Failed ===', error);
        return false;
    }
}

// Auto-run tests if this module is loaded directly in Node.js
if (typeof window === 'undefined') {
    runMappingTests();
}
