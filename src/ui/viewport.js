// Viewport for displaying ocean, cockpit, ping button and peer submarines

export function initViewport({ settings, getPeers, onPingClick }) {
  const app = document.querySelector('#app');
  
  // Remove any existing viewport
  const existing = app.querySelector('.viewport');
  if (existing) {
    existing.remove();
  }
  
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  viewport.innerHTML = `
    <div class="ocean-layer"></div>
    <div class="cockpit">
      <button class="ping-button" id="ping-btn">PING</button>
    </div>
  `;
  
  app.appendChild(viewport);
  
  const pingButton = viewport.querySelector('#ping-btn');
  let cooldownActive = false;
  
  // Handle ping button click
  pingButton.addEventListener('click', () => {
    if (cooldownActive) return;
    
    // Trigger ping
    onPingClick();
    
    // Start cooldown
    cooldownActive = true;
    pingButton.classList.add('cooldown');
    pingButton.textContent = 'COOLING';
    
    // Create ping wave animation
    createPingWave();
    
    // End cooldown after 500ms
    setTimeout(() => {
      cooldownActive = false;
      pingButton.classList.remove('cooldown');
      pingButton.textContent = 'PING';
    }, 500);
  });
  
  // Function to create ping wave effect
  function createPingWave() {
    const wave = document.createElement('div');
    wave.className = 'ping-wave';
    viewport.appendChild(wave);
    
    // Remove wave after animation
    setTimeout(() => {
      if (wave.parentNode) {
        wave.parentNode.removeChild(wave);
      }
    }, 1000);
  }
  
  // Function to render peer submarines
  function renderPeers() {
    // Remove existing peer elements that are fully faded
    const existingPeers = viewport.querySelectorAll('.peer-submarine');
    existingPeers.forEach(peer => {
      if (peer.style.opacity === '0' || peer.classList.contains('fading-out')) {
        setTimeout(() => {
          if (peer.parentNode) {
            peer.parentNode.removeChild(peer);
          }
        }, 1000);
      }
    });
    
    // Get current peers
    const peers = getPeers();
    const now = Date.now();
    
    peers.forEach(peer => {
      const timeSinceLastSeen = now - peer.lastSeen;
      
      // Check if peer element already exists
      let peerElement = viewport.querySelector(`[data-peer-id="${peer.id}"]`);
      
      if (!peerElement && timeSinceLastSeen < 1000) {
        // Create new peer element
        peerElement = createPeerElement(peer);
        viewport.appendChild(peerElement);
      } else if (peerElement) {
        // Update existing peer
        updatePeerElement(peerElement, peer, timeSinceLastSeen);
      }
    });
  }
  
  function createPeerElement(peer) {
    const element = document.createElement('div');
    element.className = 'peer-submarine';
    element.setAttribute('data-peer-id', peer.id);
    
    // Random position in the ocean area
    const x = Math.random() * (window.innerWidth - 80);
    const y = Math.random() * (window.innerHeight * 0.6) + (window.innerHeight * 0.2);
    
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    
    // Create submarine icon
    const icon = document.createElement('div');
    icon.className = 'submarine-icon';
    
    // Set color based on hue
    const hsl = `hsl(${Math.round(peer.hue * 360 / 255)}, 100%, 50%)`;
    icon.style.backgroundColor = hsl;
    icon.style.boxShadow = `0 0 10px ${hsl}`;
    
    // Set icon text based on model
    const modelIcons = {
      research: 'R',
      military: 'M',
      tourist: 'T',
      robotic: '★'
    };
    icon.textContent = modelIcons[peer.modelId] || '?';
    
    // Scale based on signal strength
    const scale = 0.5 + (peer.strength * 0.5);
    icon.style.transform = `scale(${scale})`;
    
    element.appendChild(icon);
    return element;
  }
  
  function updatePeerElement(element, peer, timeSinceLastSeen) {
    if (timeSinceLastSeen >= 1000) {
      // Start fade out
      if (!element.classList.contains('fading-out')) {
        element.classList.add('fading-out');
      }
    } else {
      // Update strength-based scaling
      const icon = element.querySelector('.submarine-icon');
      const scale = 0.5 + (peer.strength * 0.5);
      icon.style.transform = `scale(${scale})`;
    }
  }
  
  // Start rendering loop
  const renderInterval = setInterval(renderPeers, 100);
  
  // Store cleanup function on viewport element
  viewport._cleanup = () => {
    clearInterval(renderInterval);
  };
  
  // Listen for ping detected events to trigger immediate re-render
  window.addEventListener('pingDetected', () => {
    renderPeers();
  });
}

// Cleanup function for when viewport is recreated
export function cleanupViewport() {
  const viewport = document.querySelector('.viewport');
  if (viewport && viewport._cleanup) {
    viewport._cleanup();
  }
}
