// Welcome overlay for user consent and microphone permissions

export function initWelcomeOverlay(onConsent) {
  const app = document.querySelector('#app');
  
  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.innerHTML = `
    <div class="welcome-content">
      <h1>🌊 SubmarinePing 🌊</h1>
      <p>
        Welcome to SubmarinePing! This app uses your device's microphone and speakers 
        to detect other submarines nearby through acoustic signals.
      </p>
      <p>
        <strong>How it works:</strong><br>
        • Choose your submarine color and type<br>
        • Press "Ping" to emit a sonar signal<br>
        • Detect other submarines in the area<br>
        • Watch them appear in your sonar display
      </p>
      <p>
        <em>We need access to your microphone to detect acoustic signals from other devices.</em>
      </p>
      <button class="consent-button" id="grant-permission">
        Enable Sonar System
      </button>
    </div>
  `;
  
  app.appendChild(overlay);
  
  const button = overlay.querySelector('#grant-permission');
  button.addEventListener('click', async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      });
      
      // Permission granted, clean up the test stream
      stream.getTracks().forEach(track => track.stop());
      
      // Remove overlay
      overlay.remove();
      
      // Call success callback
      onConsent(true);
      
    } catch (error) {
      console.error('Microphone permission denied:', error);
      
      // Update button to show error
      button.textContent = 'Permission Denied - Try Again';
      button.style.background = 'linear-gradient(45deg, #ff4444, #cc0000)';
      
      setTimeout(() => {
        onConsent(false);
      }, 2000);
    }
  });
}
