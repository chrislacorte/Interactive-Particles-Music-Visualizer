# Audio-Reactive Visuals in Three.js

Enhanced music visualizer in Three.js with local file upload and gesture controls, inspired by ARKx's work for Coala Music's website.

![Audio Reactive Particles](https://tympanus.net/codrops/wp-content/uploads/2023/12/feature_particles-visualizer_high.gif)

[Article on Codrops](https://tympanus.net/codrops/?p=74700)

[Demo](https://tympanus.net/Tutorials/ParticlesMusicVisualizer/)

## New Features

### 🎵 Local Music File Upload
- Upload your own music files (MP3, WAV, FLAC, OGG, M4A)
- Drag and drop support
- Real-time progress feedback
- Automatic BPM detection for uploaded tracks

### 🤲 Gesture Controls (MediaPipe)
- **Pinch Gesture**: Zoom in/out on particles
- **Swipe Left/Right**: Switch between box and cylinder visualizations
- **Swipe Up/Down**: Increase/decrease particle intensity
- **Open Palm**: Reset all parameters to default
- **Body Lean**: Adjust particle rotation and frequency

## How to Use

### File Upload
1. Click the upload area in the top-right corner
2. Select an audio file from your computer
3. The visualizer will automatically switch to your uploaded track
4. BPM will be detected and synchronized with the visuals

### Gesture Controls
1. Click "Enable Gestures" button at the top
2. Allow camera access when prompted
3. Use the gesture guide to control the visualizer:
   - Make a pinch gesture with thumb and index finger to zoom
   - Swipe left or right to change visualization modes
   - Swipe up or down to adjust intensity
   - Show an open palm to reset all settings
   - Lean your body left or right for dynamic effects

## Installation

Install dependencies:

```
npm install
```

Compile the code for development and start a local server:

```
npm run dev
```

Create the build:

```
npm run build
```

## Browser Requirements

- Modern browser with WebGL support
- Camera access required for gesture controls
- Microphone permissions not required

## Troubleshooting

### File Upload Issues
- Ensure your audio file is in a supported format
- Check that the file isn't corrupted
- Try a different audio file if upload fails

### Gesture Control Issues
- Ensure camera permissions are granted
- Check that your camera is not being used by another application
- Ensure adequate lighting for hand detection
- Keep hands within the camera frame

## Credits

- [Coala Music Website](https://coalamusic.com/) by [ARKx](https://arkx.cc)
- [FBO Particles](https://www.youtube.com/watch?v=oLH00MXTqNg) by Yuri Artiukh
- [Threejs](https://threejs.org/)
- [GSAP](https://gsap.com/)
- [WebGL Noise](https://github.com/ashima/webgl-noise)
- [web-audio-beat-detector](https://github.com/chrisguttandin/web-audio-beat-detector)
- [MediaPipe](https://mediapipe.dev/) for gesture recognition

- Music by Kendrick Lamar - Money Trees from [Spotify API](https://developer.spotify.com/documentation/web-api/reference/get-track)

## Misc

Follow Tiago: [Instagram](https://instagram.com/tgcnzn), [Twitter](https://twitter.com/tgcnzn), [GitHub](https://github.com/tgcnzn), [Linkedin](https://www.linkedin.com/in/tcanzian/)

Follow ARKx: [Website](https://arkx.cc), [Instagram](https://instagram.com/arkx_cc), [Twitter](https://twitter.com/arkx_cc), [Linkedin](https://www.linkedin.com/company/arkx/)

Follow Codrops: [Twitter](http://www.twitter.com/codrops), [Facebook](http://www.facebook.com/codrops), [GitHub](https://github.com/codrops), [Instagram](https://www.instagram.com/codropsss/)

## License

[MIT](LICENSE)

Made with :blue_heart: by [Codrops](http://www.codrops.com)
