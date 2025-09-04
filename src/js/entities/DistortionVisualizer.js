import * as THREE from 'three'
import gsap from 'gsap'
import distortionVertex from './glsl/distortion-vertex.glsl'
import distortionFragment from './glsl/distortion-fragment.glsl'
import App from '../App'

export default class DistortionVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'DistortionVisualizer'
    this.time = 0
    
    this.properties = {
      distortionStrength: 1.0,
      grainIntensity: 0.5,
      baseColor: 0x1a1a2e,
      accentColor: 0xff6b6b,
      resolution: 128,
      handSensitivity: 1.0,
      audioSensitivity: 1.0
    }
    
    // Hand interaction state
    this.handState = {
      position: new THREE.Vector2(0, 0),
      influence: 0,
      smoothedPosition: new THREE.Vector2(0, 0),
      smoothedInfluence: 0
    }
    
    // Audio reactive state
    this.audioState = {
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedOverall: 0
    }
    
    // Visual components
    this.distortionMesh = null
    this.material = null
  }

  init() {
    App.holder.add(this)

    this.holderObjects = new THREE.Object3D()
    this.add(this.holderObjects)

    this.createDistortionMesh()
    this.setupGestureControls()
    this.addGUI()
  }

  createDistortionMesh() {
    // Clean up existing mesh
    if (this.distortionMesh) {
      this.holderObjects.remove(this.distortionMesh)
      if (this.distortionMesh.geometry) this.distortionMesh.geometry.dispose()
      if (this.distortionMesh.material) this.distortionMesh.material.dispose()
    }

    // Create plane geometry with high resolution for smooth distortion
    const geometry = new THREE.PlaneGeometry(
      8, 8, 
      this.properties.resolution, 
      this.properties.resolution
    )

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        bassLevel: { value: 0 },
        midLevel: { value: 0 },
        trebleLevel: { value: 0 },
        handPosition: { value: new THREE.Vector2(0, 0) },
        handInfluence: { value: 0 },
        distortionStrength: { value: this.properties.distortionStrength },
        baseColor: { value: new THREE.Color(this.properties.baseColor) },
        accentColor: { value: new THREE.Color(this.properties.accentColor) },
        grainIntensity: { value: this.properties.grainIntensity }
      },
      vertexShader: distortionVertex,
      fragmentShader: distortionFragment,
      side: THREE.DoubleSide,
      transparent: false
    })

    this.distortionMesh = new THREE.Mesh(geometry, this.material)
    this.holderObjects.add(this.distortionMesh)
  }

  setupGestureControls() {
    if (App.gestureManager) {
      // Setup gesture callbacks
      App.gestureManager.onFollow((x, y, isActive) => {
        this.handleFollowGesture(x, y, isActive)
      })
      
      App.gestureManager.onSwipe((direction, velocity) => {
        this.handleSwipeGesture(direction, velocity)
      })
      
      App.gestureManager.onPinch((strength) => {
        this.handlePinchGesture(strength)
      })
      
      App.gestureManager.onReset(() => {
        this.handleResetGesture()
      })
    }
  }

  handleFollowGesture(x, y, isActive) {
    // Update hand position and influence
    this.handState.position.x = x
    this.handState.position.y = y
    this.handState.influence = isActive ? 1.0 : 0.0
    
    // Create ripple effect when hand moves
    if (isActive) {
      const intensity = Math.sqrt(x * x + y * y) * 0.5
      gsap.to(this.material.uniforms.distortionStrength, {
        duration: 0.1,
        value: this.properties.distortionStrength * (1 + intensity),
        ease: 'power2.out',
        yoyo: true,
        repeat: 1
      })
    }
  }

  handleSwipeGesture(direction, velocity) {
    switch (direction) {
      case 'left':
        // Cycle through color themes
        this.cycleColorTheme(-1)
        this.createWaveEffect('left')
        break
      case 'right':
        this.cycleColorTheme(1)
        this.createWaveEffect('right')
        break
      case 'up':
        // Increase distortion strength
        this.properties.distortionStrength = Math.min(this.properties.distortionStrength + 0.3, 3.0)
        this.material.uniforms.distortionStrength.value = this.properties.distortionStrength
        break
      case 'down':
        // Decrease distortion strength
        this.properties.distortionStrength = Math.max(this.properties.distortionStrength - 0.3, 0.1)
        this.material.uniforms.distortionStrength.value = this.properties.distortionStrength
        break
    }
  }

  handlePinchGesture(strength) {
    // Map pinch to grain intensity
    const targetGrain = 0.2 + strength * 0.8
    gsap.to(this.material.uniforms.grainIntensity, {
      duration: 0.1,
      value: targetGrain,
      ease: 'power2.out'
    })
  }

  handleResetGesture() {
    // Reset all properties to defaults
    this.properties.distortionStrength = 1.0
    this.properties.grainIntensity = 0.5
    this.properties.baseColor = 0x1a1a2e
    this.properties.accentColor = 0xff6b6b
    
    // Animate reset
    gsap.to(this.material.uniforms.distortionStrength, {
      duration: 0.5,
      value: this.properties.distortionStrength,
      ease: 'elastic.out(1, 0.3)'
    })
    
    gsap.to(this.material.uniforms.grainIntensity, {
      duration: 0.5,
      value: this.properties.grainIntensity,
      ease: 'elastic.out(1, 0.3)'
    })
    
    gsap.to(this.material.uniforms.baseColor.value, {
      duration: 1,
      r: ((this.properties.baseColor >> 16) & 255) / 255,
      g: ((this.properties.baseColor >> 8) & 255) / 255,
      b: (this.properties.baseColor & 255) / 255,
      ease: 'power2.inOut'
    })
    
    gsap.to(this.material.uniforms.accentColor.value, {
      duration: 1,
      r: ((this.properties.accentColor >> 16) & 255) / 255,
      g: ((this.properties.accentColor >> 8) & 255) / 255,
      b: (this.properties.accentColor & 255) / 255,
      ease: 'power2.inOut'
    })
  }

  cycleColorTheme(direction) {
    const colorThemes = [
      { base: 0x1a1a2e, accent: 0xff6b6b, name: 'Sunset' },
      { base: 0x0f3460, accent: 0x16537e, name: 'Ocean' },
      { base: 0x2d1b69, accent: 0x11998e, name: 'Aurora' },
      { base: 0x8e44ad, accent: 0xf39c12, name: 'Cosmic' },
      { base: 0x2c3e50, accent: 0xe74c3c, name: 'Fire' },
      { base: 0x27ae60, accent: 0xf1c40f, name: 'Nature' }
    ]
    
    // Find current theme
    let currentIndex = 0
    for (let i = 0; i < colorThemes.length; i++) {
      if (colorThemes[i].base === this.properties.baseColor) {
        currentIndex = i
        break
      }
    }
    
    // Calculate new index
    let newIndex = currentIndex + direction
    if (newIndex < 0) newIndex = colorThemes.length - 1
    if (newIndex >= colorThemes.length) newIndex = 0
    
    const newTheme = colorThemes[newIndex]
    
    // Update properties
    this.properties.baseColor = newTheme.base
    this.properties.accentColor = newTheme.accent
    
    // Animate color transition
    gsap.to(this.material.uniforms.baseColor.value, {
      duration: 1,
      r: ((newTheme.base >> 16) & 255) / 255,
      g: ((newTheme.base >> 8) & 255) / 255,
      b: (newTheme.base & 255) / 255,
      ease: 'power2.inOut'
    })
    
    gsap.to(this.material.uniforms.accentColor.value, {
      duration: 1,
      r: ((newTheme.accent >> 16) & 255) / 255,
      g: ((newTheme.accent >> 8) & 255) / 255,
      b: (newTheme.accent & 255) / 255,
      ease: 'power2.inOut'
    })
    
    console.log(`Switched to ${newTheme.name} theme`)
  }

  createWaveEffect(direction) {
    // Create a wave distortion effect based on swipe direction
    const originalStrength = this.properties.distortionStrength
    const waveStrength = originalStrength * 2
    
    gsap.timeline()
      .to(this.material.uniforms.distortionStrength, {
        duration: 0.2,
        value: waveStrength,
        ease: 'power2.out'
      })
      .to(this.material.uniforms.distortionStrength, {
        duration: 0.8,
        value: originalStrength,
        ease: 'elastic.out(1, 0.3)'
      })
  }

  updateHandState() {
    // Smooth hand position and influence
    const smoothing = 0.1
    
    this.handState.smoothedPosition.x += 
      (this.handState.position.x - this.handState.smoothedPosition.x) * smoothing
    this.handState.smoothedPosition.y += 
      (this.handState.position.y - this.handState.smoothedPosition.y) * smoothing
    
    this.handState.smoothedInfluence += 
      (this.handState.influence - this.handState.smoothedInfluence) * smoothing
    
    // Update shader uniforms
    this.material.uniforms.handPosition.value.copy(this.handState.smoothedPosition)
    this.material.uniforms.handInfluence.value = 
      this.handState.smoothedInfluence * this.properties.handSensitivity
  }

  updateAudioState() {
    if (!App.advancedAudioManager) return
    
    const audioData = App.advancedAudioManager.getFrequencyData()
    const smoothing = 0.15
    
    // Smooth audio values
    this.audioState.smoothedBass += 
      (audioData.smoothed.bass - this.audioState.smoothedBass) * smoothing
    this.audioState.smoothedMid += 
      (audioData.smoothed.mid - this.audioState.smoothedMid) * smoothing
    this.audioState.smoothedTreble += 
      (audioData.smoothed.treble - this.audioState.smoothedTreble) * smoothing
    this.audioState.smoothedOverall += 
      (audioData.smoothed.overall - this.audioState.smoothedOverall) * smoothing
    
    // Update shader uniforms with sensitivity multiplier
    const sensitivity = this.properties.audioSensitivity
    this.material.uniforms.audioLevel.value = this.audioState.smoothedOverall * sensitivity
    this.material.uniforms.bassLevel.value = this.audioState.smoothedBass * sensitivity
    this.material.uniforms.midLevel.value = this.audioState.smoothedMid * sensitivity
    this.material.uniforms.trebleLevel.value = this.audioState.smoothedTreble * sensitivity
  }

  update() {
    this.time += 0.016 // ~60fps
    
    if (this.material) {
      this.material.uniforms.time.value = this.time
      
      this.updateHandState()
      this.updateAudioState()
      
      // Subtle rotation based on audio
      if (this.distortionMesh && App.advancedAudioManager) {
        const rotationSpeed = this.audioState.smoothedOverall * 0.01
        this.distortionMesh.rotation.z += rotationSpeed
      }
    }
  }

  addGUI() {
    if (!App.gui) return

    const gui = App.gui
    const distortionFolder = gui.addFolder('DISTORTION VISUALIZER')

    distortionFolder
      .add(this.properties, 'distortionStrength', 0.1, 3.0)
      .name('Distortion Strength')
      .onChange((value) => {
        this.material.uniforms.distortionStrength.value = value
      })

    distortionFolder
      .add(this.properties, 'grainIntensity', 0.0, 1.0)
      .name('Grain Intensity')
      .onChange((value) => {
        this.material.uniforms.grainIntensity.value = value
      })

    distortionFolder
      .add(this.properties, 'resolution', 32, 256)
      .step(16)
      .name('Resolution')
      .onChange(() => {
        this.createDistortionMesh()
      })

    distortionFolder
      .add(this.properties, 'handSensitivity', 0.1, 2.0)
      .name('Hand Sensitivity')

    distortionFolder
      .add(this.properties, 'audioSensitivity', 0.1, 3.0)
      .name('Audio Sensitivity')

    distortionFolder
      .addColor(this.properties, 'baseColor')
      .name('Base Color')
      .onChange((color) => {
        this.material.uniforms.baseColor.value = new THREE.Color(color)
      })

    distortionFolder
      .addColor(this.properties, 'accentColor')
      .name('Accent Color')
      .onChange((color) => {
        this.material.uniforms.accentColor.value = new THREE.Color(color)
      })

    const resetButton = {
      reset: () => this.handleResetGesture()
    }
    distortionFolder.add(resetButton, 'reset').name('Reset All')
  }

  destroy() {
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