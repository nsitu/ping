// Setup screen for choosing hue and submarine model

export function initSetupScreen(onSettingsChanged) {
  const app = document.querySelector('#app');
  
  // Remove any existing setup screen
  const existing = app.querySelector('.setup-screen');
  if (existing) {
    existing.remove();
  }
  
  const setupScreen = document.createElement('div');
  setupScreen.className = 'setup-screen';
  setupScreen.innerHTML = `
    <h2>⚙️ Submarine Configuration</h2>
    
    <div class="color-picker">
      <label for="hue-slider">Sonar Frequency (Hue):</label>
      <input type="range" id="hue-slider" class="hue-slider" min="0" max="255" value="128">
      <div class="hue-value">Hue: <span id="hue-display">128</span> | Frequency: <span id="freq-display">720</span> Hz</div>
    </div>
    
    <div class="submarine-models">
      <label>Submarine Type:</label>
      <div class="model-grid">
        <div class="model-option" data-model="research">
          <div class="model-icon">R</div>
          <div>Research</div>
          <small>Sine Wave</small>
        </div>
        <div class="model-option" data-model="military">
          <div class="model-icon">M</div>
          <div>Military</div>
          <small>Square Wave</small>
        </div>
        <div class="model-option" data-model="tourist">
          <div class="model-icon">T</div>
          <div>Tourist</div>
          <small>Sawtooth Wave</small>
        </div>
        <div class="model-option" data-model="robotic">
          <div class="model-icon">★</div>
          <div>Robotic</div>
          <small>Triangle Wave</small>
        </div>
      </div>
    </div>
  `;
  
  app.appendChild(setupScreen);
  
  // Get references to controls
  const hueSlider = setupScreen.querySelector('#hue-slider');
  const hueDisplay = setupScreen.querySelector('#hue-display');
  const freqDisplay = setupScreen.querySelector('#freq-display');
  const modelOptions = setupScreen.querySelectorAll('.model-option');
  
  // Import mapping functions
  import('../core/mapping.js').then(({ hueToFrequency }) => {
    // Update frequency display
    function updateFrequencyDisplay() {
      const hue = parseInt(hueSlider.value);
      const frequency = Math.round(hueToFrequency(hue));
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
  });
  
  // Handle model selection
  modelOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      modelOptions.forEach(opt => opt.classList.remove('selected'));
      // Add selected class to clicked option
      option.classList.add('selected');
      emitSettingsChange();
    });
  });
  
  // Set default selection (research submarine)
  modelOptions[0].classList.add('selected');
  
  function emitSettingsChange() {
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
