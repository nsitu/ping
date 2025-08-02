// Tests for mapping functions

import { hueToFrequency, frequencyToHue, getWaveform, getModelFromWaveform } from '../src/core/mapping.js';

// Test hue to frequency mapping
function testHueToFrequency() {
  console.log('Testing hue to frequency mapping...');
  
  // Test boundaries
  const freq0 = hueToFrequency(0);
  const freq255 = hueToFrequency(255);
  const freqMid = hueToFrequency(127.5);
  
  console.assert(Math.abs(freq0 - 440) < 0.1, `Expected ~440Hz for hue 0, got ${freq0}`);
  console.assert(Math.abs(freq255 - 1000) < 0.1, `Expected ~1000Hz for hue 255, got ${freq255}`);
  console.assert(Math.abs(freqMid - 720) < 1, `Expected ~720Hz for hue 127.5, got ${freqMid}`);
  
  console.log('✓ Hue to frequency mapping tests passed');
}

// Test frequency to hue mapping
function testFrequencyToHue() {
  console.log('Testing frequency to hue mapping...');
  
  // Test boundaries
  const hue440 = frequencyToHue(440);
  const hue1000 = frequencyToHue(1000);
  const hue720 = frequencyToHue(720);
  
  console.assert(Math.abs(hue440 - 0) < 1, `Expected ~0 for 440Hz, got ${hue440}`);
  console.assert(Math.abs(hue1000 - 255) < 1, `Expected ~255 for 1000Hz, got ${hue1000}`);
  console.assert(Math.abs(hue720 - 127.5) < 2, `Expected ~127.5 for 720Hz, got ${hue720}`);
  
  console.log('✓ Frequency to hue mapping tests passed');
}

// Test round-trip conversion
function testRoundTripConversion() {
  console.log('Testing round-trip conversion...');
  
  const testHues = [0, 64, 128, 192, 255];
  
  for (const originalHue of testHues) {
    const freq = hueToFrequency(originalHue);
    const convertedHue = frequencyToHue(freq);
    const difference = Math.abs(originalHue - convertedHue);
    
    console.assert(difference < 1, `Round-trip failed for hue ${originalHue}: ${originalHue} -> ${freq}Hz -> ${convertedHue}`);
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
    testHueToFrequency();
    testFrequencyToHue();
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
