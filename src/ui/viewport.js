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
        pingButton.textContent = '...';

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

        // Random position in the ocean area (account for larger submarine sizes)
        const maxSubSize = 512;
        const x = Math.random() * (window.innerWidth - maxSubSize);
        const y = Math.random() * (window.innerHeight * 0.6) + (window.innerHeight * 0.2);

        element.style.left = x + 'px';
        element.style.top = y + 'px';

        // Create submarine with SVG mask
        const sub = document.createElement('div');
        sub.className = `sub sub-${peer.modelId}`;

        // Set color based on hue (convert 0-255 hue to 0-360 degrees)
        const hue = Math.round(peer.hue * 360 / 255);
        const hsl = `hsl(${hue}, 100%, 50%)`;
        sub.style.backgroundColor = hsl;

        // Calculate size based on signal strength
        // Map from detection threshold (-45 dB) to loud signal (-25 dB)
        // Size range: 256px (minimum) to 512px (maximum)
        const { width, height, glowSize } = calculateSubmarineSize(peer.strength, peer.magnitude);

        sub.style.width = width + 'px';
        sub.style.height = height + 'px';
        sub.style.filter = `drop-shadow(0 0 ${glowSize}px ${hsl})`;

        // Debug: Add fallback text if mask fails to load
        sub.setAttribute('data-model', peer.modelId);
        sub.setAttribute('title', `${peer.modelId} submarine (${hue}° hue, ${peer.frequency?.toFixed(1)} Hz, ${peer.magnitude?.toFixed(1)} dB)`);

        console.log(`Creating submarine: ${peer.modelId} at hue ${hue}° (${hsl}), size ${width}x${height}px (square), magnitude: ${peer.magnitude?.toFixed(1)} dB`); element.appendChild(sub);
        return element;
    }

    function updatePeerElement(element, peer, timeSinceLastSeen) {
        if (timeSinceLastSeen >= 1000) {
            // Start fade out
            if (!element.classList.contains('fading-out')) {
                element.classList.add('fading-out');
            }
        } else {
            // Update strength-based sizing
            const sub = element.querySelector('.sub');
            if (sub) {
                const { width, height, glowSize } = calculateSubmarineSize(peer.strength, peer.magnitude);

                sub.style.width = width + 'px';
                sub.style.height = height + 'px';

                // Update glow intensity based on signal strength
                const hue = Math.round(peer.hue * 360 / 255);
                const hsl = `hsl(${hue}, 100%, 50%)`;
                sub.style.filter = `drop-shadow(0 0 ${glowSize}px ${hsl})`;
            }
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

// Calculate submarine dimensions based on signal strength
function calculateSubmarineSize(normalizedStrength, rawMagnitudeDb) {
    // Define size mapping based on dB levels:
    // -45 dB (detection threshold) → 256px (minimum)
    // -25 dB (loud signal) → 512px (maximum)

    const MIN_DB = -45;  // Detection threshold
    const MAX_DB = -25;  // Loud signal threshold
    const MIN_SIZE = 256; // Minimum submarine size
    const MAX_SIZE = 512; // Maximum submarine size

    // If we have raw magnitude, use it for more accurate sizing
    let sizeMultiplier;
    if (rawMagnitudeDb !== undefined) {
        // Clamp the magnitude to our expected range
        const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, rawMagnitudeDb));
        // Convert to 0-1 range
        sizeMultiplier = (clampedDb - MIN_DB) / (MAX_DB - MIN_DB);
    } else {
        // Fallback to normalized strength (0-1)
        sizeMultiplier = normalizedStrength;
    }

    // Calculate dimensions - SQUARE to match 512x512 SVG files
    const size = Math.round(MIN_SIZE + (sizeMultiplier * (MAX_SIZE - MIN_SIZE)));
    const width = size;
    const height = size; // Square dimensions to prevent cropping

    // Glow size scales with submarine size (8px to 24px)
    const glowSize = Math.round(8 + (sizeMultiplier * 16));

    return { width, height, glowSize };
}// Cleanup function for when viewport is recreated
export function cleanupViewport() {
    const viewport = document.querySelector('.viewport');
    if (viewport && viewport._cleanup) {
        viewport._cleanup();
    }
}
