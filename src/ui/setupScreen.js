// Setup screen for choosing hue and submarine model

export function initSetupScreen(onSettingsChanged) {
  const app = document.querySelector('#app');
  const setupScreen = document.querySelector('#setup-screen');
  setupScreen.className = 'setup-screen';

  // Get references to controls
  const hueSlider = setupScreen.querySelector('#hue-slider');
  const hueDisplay = setupScreen.querySelector('#hue-display');
  const freqDisplay = setupScreen.querySelector('#freq-display');
  const modelOptions = setupScreen.querySelectorAll('.model-option');

  // Debug controls
  const volumeSlider = setupScreen.querySelector('#volume-slider');
  const volumeDisplay = setupScreen.querySelector('#volume-display');
  const thresholdSlider = setupScreen.querySelector('#threshold-slider');
  const thresholdDisplay = setupScreen.querySelector('#threshold-display');
  const noiseTestBtn = setupScreen.querySelector('#noise-test');
  const noiseResult = setupScreen.querySelector('#noise-result');    // Import mapping functions
  import('../core/mapping.js').then(({ getSubmarineFrequency }) => {
    // Update frequency display
    function updateFrequencyDisplay() {
      const hue = parseInt(hueSlider.value);
      const selectedModel = setupScreen.querySelector('.model-option.selected');
      const modelId = selectedModel ? selectedModel.dataset.model : 'research';
      const frequency = Math.round(getSubmarineFrequency(modelId, hue));
      hueDisplay.textContent = hue;
      freqDisplay.textContent = frequency;
    }

    // Initialize display
    updateFrequencyDisplay();

    // Handle hue slider changes
    hueSlider.addEventListener('input', () => {
      updateFrequencyDisplay();
      emitSettingsChange();
    });

    // Update frequency display when model changes
    modelOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remove selected class from all options
        modelOptions.forEach(opt => opt.classList.remove('selected'));
        // Add selected class to clicked option
        option.classList.add('selected');
        // Update frequency display for new model
        updateFrequencyDisplay();
        emitSettingsChange();
      });
    });
  });

  // Set default selection (research submarine)
  modelOptions[0].classList.add('selected');

  // Setup debug controls
  setupDebugControls();

  function setupDebugControls() {
    // Volume control
    volumeSlider.addEventListener('input', () => {
      const volume = parseInt(volumeSlider.value);
      volumeDisplay.textContent = volume + '%';

      // Update emitter settings
      import('../audio/emitter.js').then(({ setAudioSettings }) => {
        setAudioSettings({ PING_GAIN: volume / 100 });
      });
    });

    // Threshold control
    thresholdSlider.addEventListener('input', () => {
      const threshold = parseInt(thresholdSlider.value);
      thresholdDisplay.textContent = threshold;

      // Update receiver settings
      import('../audio/receiver.js').then(({ setDetectionThresholds }) => {
        setDetectionThresholds({ SIGNAL_PROCESS: threshold });
      });
    });

    // Noise test
    noiseTestBtn.addEventListener('click', async () => {
      noiseTestBtn.disabled = true;
      noiseTestBtn.textContent = 'Testing...';
      noiseResult.textContent = 'Measuring noise level...';

      try {
        const { getNoiseLevel } = await import('../audio/receiver.js');
        const noiseLevel = await getNoiseLevel(2000); // 2 second test

        if (noiseLevel !== null) {
          noiseResult.innerHTML = `
            <div>Average Noise: ${noiseLevel.toFixed(1)} dB</div>
            <div>Recommended threshold: ${Math.max(-60, noiseLevel + 10).toFixed(0)} dB</div>
          `;
        } else {
          noiseResult.textContent = 'Could not measure noise (microphone not active)';
        }
      } catch (error) {
        noiseResult.textContent = 'Error measuring noise: ' + error.message;
      }

      noiseTestBtn.disabled = false;
      noiseTestBtn.textContent = 'Test Noise Level';
    });
  } function emitSettingsChange() {
    const hue = parseInt(hueSlider.value);
    const selectedModel = setupScreen.querySelector('.model-option.selected');
    const modelId = selectedModel ? selectedModel.dataset.model : 'research';

    const settings = { hue, modelId };

    // Fire custom event
    window.dispatchEvent(new CustomEvent('settingsChanged', {
      detail: settings
    }));

    // Also call the callback directly
    onSettingsChanged(settings);
  }

  // Initial settings emission
  setTimeout(() => {
    emitSettingsChange();
  }, 100);
}
