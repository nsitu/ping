// Global state management and localStorage persistence

const STORAGE_KEY = 'RelationShipSettings';
const MAX_PEERS = 20;
const FADE_OUT_MS = 1000;

// Default settings
const DEFAULT_SETTINGS = {
    hue: 128,
    modelId: 'research'
};

let currentSettings = null;
let peers = new Map();

export function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } else {
            currentSettings = { ...DEFAULT_SETTINGS };
        }
    } catch (error) {
        console.warn('Failed to load settings from localStorage:', error);
        currentSettings = { ...DEFAULT_SETTINGS };
    }

    return currentSettings;
}

export function saveSettings(settings) {
    currentSettings = { ...settings };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
    }
}

export function getCurrentSettings() {
    return currentSettings;
}

export function addPeer(pingEvent) {
    const { frequency, modelId, hue, strength, magnitude, timestamp } = pingEvent;

    // Create unique peer ID based on frequency and model
    const peerId = `${Math.round(frequency)}_${modelId}`;

    const peer = {
        id: peerId,
        lastSeen: timestamp,
        strength: strength,
        magnitude: magnitude, // Store raw dB value
        hue: hue, // Now directly provided from the ping event
        modelId: modelId,
        frequency: frequency
    };

    peers.set(peerId, peer);

    // Enforce max peers limit
    if (peers.size > MAX_PEERS) {
        // Remove oldest peer
        let oldestId = null;
        let oldestTime = Infinity;

        for (const [id, p] of peers.entries()) {
            if (p.lastSeen < oldestTime) {
                oldestTime = p.lastSeen;
                oldestId = id;
            }
        }

        if (oldestId) {
            peers.delete(oldestId);
        }
    }

    console.log(`Peer added/updated: ${peerId}, total peers: ${peers.size}`);

    return peers.get(peerId);
}

export function getPeers() {
    return Array.from(peers.values());
}

export function getPeer(peerId) {
    return peers.get(peerId);
}

export function removePeer(peerId) {
    return peers.delete(peerId);
}

export function cleanupStalePeers() {
    const now = Date.now();
    const cutoffTime = now - FADE_OUT_MS - 1000; // Add 1s buffer

    let removedCount = 0;
    for (const [id, peer] of peers.entries()) {
        if (peer.lastSeen < cutoffTime) {
            peers.delete(id);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} stale peers`);
    }
}

export function clearAllPeers() {
    peers.clear();
    console.log('All peers cleared');
}

// Debug helper
export function getStateDebugInfo() {
    return {
        settings: currentSettings,
        peerCount: peers.size,
        peers: Array.from(peers.entries())
    };
}
