import * as THREE from 'three'
import gsap from 'gsap'
import vertex from './glsl/vertex.glsl?raw'
import fragment from './glsl/fragment.glsl?raw'
import App from '../App'

export default class AudioReactiveVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'AudioReactiveVisualizer'
    this.time = 0
    
    // Visual properties
    this.properties = {
      startColor: 0x00ffff,
      endColor: 0xff00ff,
      bassColor: 0xff4444,
      midColor: 0x44ff44,
      trebleColor: 0x4444ff,
      particleCount: 5000,
      bassIntensity: 1.0,
      midIntensity: 1.0,
      trebleIntensity: 1.0,
      reactivity: 1.0,
      smoothing: 0.8
    }
    
    // Audio-reactive elements
    this.bassElements = []
    this.midElements = []
    this.trebleElements = []
    this.particleSystem = null
    this.waveform = null
    
    // Animation state
    this.bassScale = 1.0
    this.midRotation = 0
    this.trebleSpeed = 1.0
    this.lastBeatTime = 0
    
    // Particle data
    this.particlePositions = null
    this.particleVelocities = null
    this.particleColors = null
    this.particleSizes = null
  }

  init() {
    App.holder.add(this)

    this.holderObjects = new THREE.Object3D()
    this.add(this.holderObjects)

    this.createParticleSystem()
    this.createBassElements()
    this.createMidElements()
    this.createTrebleElements()
    this.createWaveform()
    this.setupAudioCallbacks()
    this.addGUI()
    this.setupColorSync()
  }

  createParticleSystem() {
    const particleCount = this.properties.particleCount
    const geometry = new THREE.BufferGeometry()
    
    // Initialize particle data arrays
    this.particlePositions = new Float32Array(particleCount * 3)
    this.particleVelocities = new Float32Array(particleCount * 3)
    this.particleColors = new Float32Array(particleCount * 3)
    this.particleSizes = new Float32Array(particleCount)
    
    // Initialize particles in a sphere
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      
      // Random position in sphere
      const radius = Math.random() * 10 + 5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      
      this.particlePositions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      this.particlePositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      this.particlePositions[i3 + 2] = radius * Math.cos(phi)
      
      // Random velocity
      this.particleVelocities[i3] = (Math.random() - 0.5) * 0.02
      this.particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.02
      this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02
      
      // Initial color (will be updated by audio)
      this.particleColors[i3] = 0.5
      this.particleColors[i3 + 1] = 0.5
      this.particleColors[i3 + 2] = 1.0
      
      // Initial size
      this.particleSizes[i] = Math.random() * 2 + 1
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1))
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        bassLevel: { value: 0 },
        midLevel: { value: 0 },
        trebleLevel: { value: 0 },
        overallLevel: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float time;
        uniform float bassLevel;
        uniform float midLevel;
        uniform float trebleLevel;
        uniform float overallLevel;
        
        void main() {
          vColor = color;
          
          vec3 pos = position;
          
          // Bass affects Y movement (up/down)
          pos.y += sin(time * 2.0 + position.x * 0.1) * bassLevel * 2.0;
          
          // Mid affects rotation around center
          float angle = time * midLevel + length(position.xz) * 0.1;
          float cosA = cos(angle);
          float sinA = sin(angle);
          pos.x = position.x * cosA - position.z * sinA;
          pos.z = position.x * sinA + position.z * cosA;
          
          // Treble affects rapid oscillation
          pos += sin(pos * 10.0 + time * 10.0) * trebleLevel * 0.1;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (1.0 + overallLevel * 2.0) * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          float r = distance(gl_PointCoord, vec2(0.5, 0.5));
          if (r > 0.5) discard;
          
          float glow = 1.0 - (r * 2.0);
          glow = pow(glow, 2.0);
          
          gl_FragColor = vec4(vColor, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    })
    
    this.particleSystem = new THREE.Points(geometry, material)
    this.holderObjects.add(this.particleSystem)
  }

  createBassElements() {
    // Create large, slow-moving elements for bass
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.SphereGeometry(1, 16, 16)
      const material = new THREE.MeshBasicMaterial({
        color: this.properties.bassColor,
        transparent: true,
        opacity: 0.3,
        wireframe: true
      })
      
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      )
      
      this.bassElements.push(sphere)
      this.holderObjects.add(sphere)
    }
  }

  createMidElements() {
    // Create medium-sized rotating elements for mid frequencies
    for (let i = 0; i < 6; i++) {
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
      const material = new THREE.MeshBasicMaterial({
        color: this.properties.midColor,
        transparent: true,
        opacity: 0.6,
        wireframe: true
      })
      
      const box = new THREE.Mesh(geometry, material)
      const radius = 5 + Math.random() * 3
      const angle = (i / 6) * Math.PI * 2
      
      box.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 4,
        Math.sin(angle) * radius
      )
      
      this.midElements.push(box)
      this.holderObjects.add(box)
    }
  }

  createTrebleElements() {
    // Create small, fast-moving elements for treble
    for (let i = 0; i < 12; i++) {
      const geometry = new THREE.TetrahedronGeometry(0.2)
      const material = new THREE.MeshBasicMaterial({
        color: this.properties.trebleColor,
        transparent: true,
        opacity: 0.8
      })
      
      const tetra = new THREE.Mesh(geometry, material)
      tetra.position.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      )
      
      this.trebleElements.push(tetra)
      this.holderObjects.add(tetra)
    }
  }

  createWaveform() {
    // Create a visual waveform representation
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(128 * 3)
    
    for (let i = 0; i < 128; i++) {
      positions[i * 3] = (i - 64) * 0.2
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7
    })
    
    this.waveform = new THREE.Line(geometry, material)
    this.waveform.position.y = -8
    this.holderObjects.add(this.waveform)
  }

  setupAudioCallbacks() {
    if (App.advancedAudioManager) {
      // Set up beat detection callback
      App.advancedAudioManager.onBeat((intensity) => {
        this.onBeatDetected(intensity)
      })
    }
  }

  onBeatDetected(intensity) {
    this.lastBeatTime = Date.now()
    
    // Trigger visual effects on beat
    this.bassElements.forEach(element => {
      gsap.to(element.scale, {
        duration: 0.1,
        x: 1 + intensity * 2,
        y: 1 + intensity * 2,
        z: 1 + intensity * 2,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1
      })
    })
    
    // Flash effect on particles
    if (this.particleSystem) {
      const colors = this.particleSystem.geometry.attributes.color.array
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = Math.min(1, colors[i] + intensity * 0.5)     // R
        colors[i + 1] = Math.min(1, colors[i + 1] + intensity * 0.3) // G
        colors[i + 2] = Math.min(1, colors[i + 2] + intensity * 0.7) // B
      }
      this.particleSystem.geometry.attributes.color.needsUpdate = true
    }
  }

  updateParticleColors(audioData) {
    if (!this.particleSystem) return
    
    const colors = this.particleSystem.geometry.attributes.color.array
    const positions = this.particleSystem.geometry.attributes.position.array
    
    for (let i = 0; i < colors.length; i += 3) {
      const particleIndex = i / 3
      const x = positions[i]
      const y = positions[i + 1]
      const z = positions[i + 2]
      
      // Map position to frequency response
      const distance = Math.sqrt(x * x + y * y + z * z)
      const normalizedDistance = Math.min(1, distance / 15)
      
      // Bass affects red channel (inner particles)
      colors[i] = (1 - normalizedDistance) * audioData.smoothed.bass + 0.1
      
      // Mid affects green channel (middle particles)
      colors[i + 1] = (0.5 - Math.abs(normalizedDistance - 0.5)) * audioData.smoothed.mid + 0.1
      
      // Treble affects blue channel (outer particles)
      colors[i + 2] = normalizedDistance * audioData.smoothed.treble + 0.3
    }
    
    this.particleSystem.geometry.attributes.color.needsUpdate = true
  }

  updateWaveform(audioData) {
    if (!this.waveform || !App.advancedAudioManager) return
    
    const positions = this.waveform.geometry.attributes.position.array
    const frequencyArray = App.advancedAudioManager.frequencyArray
    
    if (frequencyArray && frequencyArray.length >= 128) {
      for (let i = 0; i < 128; i++) {
        const amplitude = frequencyArray[i] / 255
        positions[i * 3 + 1] = amplitude * 3 * this.properties.reactivity
      }
      
      this.waveform.geometry.attributes.position.needsUpdate = true
    }
  }

  update() {
    if (!App.advancedAudioManager) return
    
    const audioData = App.advancedAudioManager.getFrequencyData()
    this.time += 0.016
    
    // Update particle system uniforms
    if (this.particleSystem) {
      const material = this.particleSystem.material
      material.uniforms.time.value = this.time
      material.uniforms.bassLevel.value = audioData.smoothed.bass * this.properties.bassIntensity
      material.uniforms.midLevel.value = audioData.smoothed.mid * this.properties.midIntensity
      material.uniforms.trebleLevel.value = audioData.smoothed.treble * this.properties.trebleIntensity
      material.uniforms.overallLevel.value = audioData.smoothed.overall
    }
    
    // Update bass elements (large, slow movements)
    this.bassElements.forEach((element, index) => {
      const bassLevel = audioData.smoothed.bass * this.properties.bassIntensity
      element.scale.setScalar(1 + bassLevel * 2)
      element.material.opacity = 0.3 + bassLevel * 0.4
      
      // Slow orbital movement
      const angle = this.time * 0.1 + index * Math.PI * 2 / 3
      element.position.x = Math.cos(angle) * (3 + bassLevel * 2)
      element.position.z = Math.sin(angle) * (3 + bassLevel * 2)
    })
    
    // Update mid elements (rotation and medium movements)
    this.midElements.forEach((element, index) => {
      const midLevel = audioData.smoothed.mid * this.properties.midIntensity
      element.rotation.x += midLevel * 0.1
      element.rotation.y += midLevel * 0.05
      element.material.opacity = 0.6 + midLevel * 0.3
      
      // Medium speed orbital movement
      const angle = this.time * 0.3 + index * Math.PI * 2 / 6
      const radius = 5 + midLevel * 2
      element.position.x = Math.cos(angle) * radius
      element.position.z = Math.sin(angle) * radius
    })
    
    // Update treble elements (fast, erratic movements)
    this.trebleElements.forEach((element, index) => {
      const trebleLevel = audioData.smoothed.treble * this.properties.trebleIntensity
      element.rotation.x += trebleLevel * 0.3
      element.rotation.y += trebleLevel * 0.2
      element.rotation.z += trebleLevel * 0.4
      element.material.opacity = 0.8 + trebleLevel * 0.2
      
      // Fast, jittery movement
      element.position.x += (Math.random() - 0.5) * trebleLevel * 0.5
      element.position.y += (Math.random() - 0.5) * trebleLevel * 0.5
      element.position.z += (Math.random() - 0.5) * trebleLevel * 0.5
      
      // Keep within bounds
      element.position.clampLength(0, 8)
    })
    
    // Update particle colors based on audio
    this.updateParticleColors(audioData)
    
    // Update waveform visualization
    this.updateWaveform(audioData)
    
    // Rotate entire system based on overall audio level
    this.holderObjects.rotation.y += audioData.smoothed.overall * 0.01
  }

  addGUI() {
    if (!App.gui) return
    
    const gui = App.gui
    const audioFolder = gui.addFolder('AUDIO REACTIVE')
    
    audioFolder.add(this.properties, 'bassIntensity', 0.1, 3.0).name('Bass Intensity')
    audioFolder.add(this.properties, 'midIntensity', 0.1, 3.0).name('Mid Intensity')
    audioFolder.add(this.properties, 'trebleIntensity', 0.1, 3.0).name('Treble Intensity')
    audioFolder.add(this.properties, 'reactivity', 0.1, 2.0).name('Overall Reactivity')
    
    audioFolder.addColor(this.properties, 'bassColor').name('Bass Color').onChange((color) => {
      this.bassElements.forEach(element => {
        element.material.color.setHex(color)
      })
      // Sync to global color manager
      if (App.colorSyncManager) {
        App.colorSyncManager.updateColor('primary', color, 'AudioReactiveVisualizer')
      }
    })
    
    audioFolder.addColor(this.properties, 'midColor').name('Mid Color').onChange((color) => {
      this.midElements.forEach(element => {
        element.material.color.setHex(color)
      })
      // Sync to global color manager
      if (App.colorSyncManager) {
        App.colorSyncManager.updateColor('secondary', color, 'AudioReactiveVisualizer')
      }
    })
    
    audioFolder.addColor(this.properties, 'trebleColor').name('Treble Color').onChange((color) => {
      this.trebleElements.forEach(element => {
        element.material.color.setHex(color)
      })
      // Sync to global color manager
      if (App.colorSyncManager) {
        App.colorSyncManager.updateColor('accent', color, 'AudioReactiveVisualizer')
      }
    })
    
    // Audio settings
    const audioSettings = gui.addFolder('AUDIO SETTINGS')
    
    audioSettings.add({ sensitivity: 1.0 }, 'sensitivity', 0.1, 3.0).name('Sensitivity').onChange((value) => {
      if (App.advancedAudioManager) {
        App.advancedAudioManager.setSensitivity(value)
      }
    })
    
    audioSettings.add({ smoothing: 0.8 }, 'smoothing', 0.1, 0.95).name('Smoothing').onChange((value) => {
      if (App.advancedAudioManager) {
        App.advancedAudioManager.setSmoothing(value)
      }
    })
  }

  destroy() {
    // Clean up audio callbacks
    if (App.advancedAudioManager) {
      App.advancedAudioManager.removeBeatCallback(this.onBeatDetected.bind(this))
    }
    
    // Clean up geometries and materials
    this.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    
    // Remove from parent
    if (this.parent) {
      this.parent.remove(this)
    }
  }
}