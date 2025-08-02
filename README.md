# 🌊 SubmarinePing 🌊

A browser-based "submarine ping"  art app where users pick a hue (0–255) and one of four submarine types. Pressing "Ping" emits a short audio burst (440–1000 Hz mapped from hue, with a waveform encoding the sub type). Nearby peers running the same app detect each other via the mic, and display colored subs in a shared viewport for 1 sec before fade-out.

## Features

- **Audio-based Peer Detection**: Uses microphone and speakers for device-to-device communication
- **Submarine Customization**: Choose from 4 submarine types (Research, Military, Tourist, Robotic)
- **Color Mapping**: Hue (0-255) maps to audio frequency (440-1000 Hz)
- **Waveform Encoding**: Each submarine type uses a different waveform (sine, square, sawtooth, triangle)
- **Real-time Visualization**: See detected submarines appear in your sonar display
- **No Network Required**: Pure local audio signaling between devices

## How It Works

1. **Choose Your Submarine**: Pick a color (hue) and submarine type
2. **Emit Pings**: Press the red PING button to send an audio signal
3. **Detect Others**: Your microphone listens for pings from other devices
4. **Visualize**: Detected submarines appear as colored icons in your ocean view
5. **Peer Interaction**: Multiple devices running the app can "see" each other

## Technical Details

### Audio Mapping
- **Frequency Range**: 440 Hz - 1000 Hz
- **Hue Mapping**: 0 (red) = 440 Hz, 255 (red again) = 1000 Hz
- **Waveforms**: 
  - Research: Sine wave
  - Military: Square wave  
  - Tourist: Sawtooth wave
  - Robotic: Triangle wave

### File Structure
```
src/
├── app.js              # Main application entry point
├── styles.css          # Ocean/cockpit styling & animations
├── ui/
│   ├── welcomeOverlay.js   # Microphone permission UI
│   ├── setupScreen.js      # Color & submarine selection
│   └── viewport.js         # Ocean view & ping visualization
├── audio/
│   ├── emitter.js          # Audio signal generation
│   └── receiver.js         # Microphone analysis & detection
└── core/
    ├── mapping.js          # Hue ↔ frequency conversion
    ├── state.js            # Settings & peer management
    └── events.js           # Custom event system
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Usage Tips

- **Test with Multiple Devices**: Open the app on different devices/tabs for the full experience
- **Volume Matters**: Ensure speakers and microphone are at reasonable levels
- **Quiet Environment**: Works best in relatively quiet spaces
- **Browser Permissions**: Allow microphone access when prompted

## GitHub Pages Deployment

This template includes a GitHub Action workflow for automatic deployment:

1. In Repository Settings, go to `Pages`
2. Under `Build and Deployment` change the `Source` to `GitHub Actions`
3. Push changes to automatically deploy to `https://user.github.io/ping`

## Browser Compatibility

- Requires modern browsers with Web Audio API support
- Needs microphone access for peer detection
- Works best on desktop/laptop computers with speakers

## License

ISC License
