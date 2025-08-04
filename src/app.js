// Main application entrypoint
import './styles.css';
import { initWelcomeOverlay } from './ui/welcomeOverlay.js';
import { initSetupScreen } from './ui/setupScreen.js';
import { initViewport } from './ui/viewport.js';
import { initAudioContext, emitPing } from './audio/emitter.js';
import { startListening, stopListening } from './audio/receiver.js';
import { loadSettings, saveSettings, addPeer, getPeers, cleanupStalePeers } from './core/state.js';
import { setupEventBus } from './core/events.js';

class RelationShipApp {
    constructor() {
        this.settings = null;
        this.isInitialized = false;
        this.cleanupInterval = null;
    }

    async init() {
        // Setup event bus
        setupEventBus();

        // Listen for custom events
        this.setupEventListeners();

        // Show welcome overlay first
        initWelcomeOverlay((consented) => {
            if (consented) {
                this.onUserConsent();
            } else {
                document.querySelector('#app').innerHTML = '<p>Audio permission is required for RelationShip to work.</p>';
            }
        });
    }

    setupEventListeners() {
        window.addEventListener('pingEmitted', (event) => {
            console.log('Ping emitted:', event.detail);
        });

        window.addEventListener('pingDetected', (event) => {
            console.log('Ping detected:', event.detail);
            addPeer(event.detail);
        });

        window.addEventListener('settingsChanged', (event) => {
            this.onSettingsChanged(event.detail);
        });

        window.addEventListener('micPermissionDenied', () => {
            alert('Microphone permission is required for RelationShip to detect other submarines.');
        });
    }

    async onUserConsent() {
        // Load saved settings
        this.settings = loadSettings();

        // Initialize setup screen
        initSetupScreen((newSettings) => {
            this.onSettingsChanged(newSettings);
        });

        // Apply current settings
        await this.onSettingsChanged(this.settings);

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            cleanupStalePeers();
        }, 1000);
    }

    async onSettingsChanged(newSettings) {
        this.settings = newSettings;
        saveSettings(newSettings);

        // Initialize audio context if not done yet
        if (!this.isInitialized) {
            try {
                await initAudioContext();
                await startListening();
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize audio:', error);
                return;
            }
        }

        // Initialize viewport with current settings
        initViewport({
            settings: newSettings,
            getPeers: getPeers,
            onPingClick: () => {
                emitPing(newSettings.hue, newSettings.modelId);
            }
        });
    }

    destroy() {
        stopListening();
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Initialize app when DOM is loaded
const app = new RelationShipApp();
app.init();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    app.destroy();
});
