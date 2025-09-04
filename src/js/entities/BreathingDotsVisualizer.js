import * as THREE from 'three'
import gsap from 'gsap'
import App from '../App'

export default class BreathingDotsVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'BreathingDotsVisualizer'
    this.time = 0
    
    // Visual properties
    this.properties = {
      dotCount: 200,
      baseRadius: 0.05,
      maxRadius: 0.3,
      breathingSpeed: 1.0,
      colorPrimary: 0x00ffff,
      colorSecondary: 0xff00ff,
      gridSize: 15,
      spacing: 0.8,
      audioReactivity: 1.0,
      handInfluence: 2.0,
      breathingIntensity: 1.0,
      pulseSync: true
    }
    
    // Breathing animation state
    this.breathingPhase = 0
    this.breathingCycle = {
      inhale: 4.0,    // seconds
      hold1: 1.0,     // seconds
      exhale: 6.0,    // seconds
      hold2: 1.0      // seconds
    }
    this.currentPhase = 'inhale'
    this.phaseProgress = 0
    
    // Hand gesture state
    this.handState = {
      position: new THREE.Vector2(0, 0),
      isActive: false,
      influence: 0,
      smoothedPosition: new THREE.Vector2(0, 0),
      smoothedInfluence: 0
    }
    
    // Audio reactive state
    this.audioState = {
      bass: 0,
      mid: 0,
      treble: 0,
      overall: 0
    }
    
    // Dot system
    this.dots = []
    this.dotMeshes = []
    this.instancedMesh = null
    this.dummy = new THREE.Object3D()
    
    // Materials
    this.dotMaterial = null
    this.glowMaterial = null
  }

  init() {
    App.holder.add(this)

    this.holderObjects = new THREE.Object3D()
    this.add(this.holderObjects)

    this.createDotSystem()
    this.setupGestureControls()
    this.setupColorSync()
    this.addGUI()
    
    console.log('Breathing Dots Visualizer initialized')
  }

  createDotSystem() {
    // Clean up existing system
    this.cleanupDotSystem()
    
    // Create dot data structure
    this.dots = []
    const gridSize = this.properties.gridSize
    const spacing = this.properties.spacing
    const offset = (gridSize - 1) * spacing * 0.5
    
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const worldX = x * spacing - offset
        const worldY = y * spacing - offset
        const worldZ = 0
        
        // Calculate distance from center for breathing effect
        const distanceFromCenter = Math.sqrt(worldX * worldX + worldY * worldY)
        const normalizedDistance = Math.min(1, distanceFromCenter / (gridSize * spacing * 0.5))
        
        this.dots.push({
          originalPosition: new THREE.Vector3(worldX, worldY, worldZ),
          currentPosition: new THREE.Vector3(worldX, worldY, worldZ),
          baseScale: 1.0,
          currentScale: 1.0,
          breathingOffset: Math.random() * Math.PI * 2, // Random phase offset
          distanceFromCenter: normalizedDistance,
          gridX: x,
          gridY: y,
          color: new THREE.Color(),
          targetColor: new THREE.Color(this.properties.colorPrimary),
          audioInfluence: Math.random() * 0.5 + 0.5,
          handInfluence: 0
        })
      }
    }
    
    // Create instanced mesh for performance
    const geometry = new THREE.SphereGeometry(this.properties.baseRadius, 8, 6)
    
    this.dotMaterial = new THREE.MeshBasicMaterial({
      color: this.properties.colorPrimary,
      transparent: true,
      opacity: 0.8
    })
    
    this.instancedMesh = new THREE.InstancedMesh(
      geometry, 
      this.dotMaterial, 
      this.dots.length
    )
    
    // Initialize instance matrices
    this.updateDotInstances()
    
    this.holderObjects.add(this.instancedMesh)
    
    // Create glow effect
    this.createGlowEffect()
  }

  createGlowEffect() {
    const glowGeometry = new THREE.SphereGeometry(this.properties.maxRadius, 16, 12)
    
    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        breathingPhase: { value: 0 },
        primaryColor: { value: new THREE.Color(this.properties.colorPrimary) },
        secondaryColor: { value: new THREE.Color(this.properties.colorSecondary) },
        audioLevel: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float breathingPhase;
        uniform float audioLevel;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          
          vec3 pos = position;
          float breathingScale = 1.0 + sin(breathingPhase) * 0.3;
          pos *= breathingScale * (1.0 + audioLevel * 0.5);
          
          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform float audioLevel;
        
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
          fresnel = pow(fresnel, 2.0);
          
          vec3 color = mix(primaryColor, secondaryColor, sin(time * 0.5) * 0.5 + 0.5);
          color *= fresnel * (0.3 + audioLevel * 0.7);
          
          float alpha = fresnel * (0.2 + audioLevel * 0.3);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    })
    
    // Create multiple glow spheres for depth
    for (let i = 0; i < 3; i++) {
      const glowMesh = new THREE.Mesh(glowGeometry, this.glowMaterial.clone())
      const scale = 1 + i * 0.5
      glowMesh.scale.setScalar(scale)
      glowMesh.material.uniforms.audioLevel.value = 0.3 - i * 0.1
      this.holderObjects.add(glowMesh)
    }
  }

  setupGestureControls() {
    if (App.gestureManager) {
      // Hand following for dot influence
      App.gestureManager.onFollow((x, y, isActive) => {
        this.handleHandGesture(x, y, isActive)
      })
      
      // Pinch for breathing speed control
      App.gestureManager.onPinch((strength) => {
        this.handleBreathingControl(strength)
      })
      
      // Swipe for color changes
      App.gestureManager.onSwipe((direction, velocity) => {
        this.handleColorSwipe(direction)
      })
      
      // Reset gesture
      App.gestureManager.onReset(() => {
        this.resetBreathingPattern()
      })
    }
  }

  handleHandGesture(x, y, isActive) {
    this.handState.position.x = x
    this.handState.position.y = y
    this.handState.isActive = isActive
    this.handState.influence = isActive ? 1.0 : 0.0
    
    // Update dot influences based on hand position
    if (isActive) {
      this.updateHandInfluence(x, y)
    }
  }

  updateHandInfluence(handX, handY) {
    const worldHandX = handX * 6 // Scale to world coordinates
    const worldHandY = handY * 6
    
    this.dots.forEach(dot => {
      const distance = Math.sqrt(
        Math.pow(dot.originalPosition.x - worldHandX, 2) +
        Math.pow(dot.originalPosition.y - worldHandY, 2)
      )
      
      // Influence decreases with distance
      const maxInfluenceDistance = 3.0
      dot.handInfluence = Math.max(0, 1 - (distance / maxInfluenceDistance))
    })
  }

  handleBreathingControl(strength) {
    // Map pinch strength to breathing speed
    this.properties.breathingSpeed = 0.5 + strength * 2.0
    
    // Visual feedback - temporarily increase breathing intensity
    gsap.to(this.properties, {
      duration: 0.2,
      breathingIntensity: 1.5,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1
    })
  }

  handleColorSwipe(direction) {
    const colorPalettes = [
      { primary: 0x00ffff, secondary: 0xff00ff, name: 'Cyan-Magenta' },
      { primary: 0xff6b6b, secondary: 0x4ecdc4, name: 'Coral-Teal' },
      { primary: 0xffd93d, secondary: 0x6bcf7f, name: 'Gold-Green' },
      { primary: 0xa8e6cf, secondary: 0xff8b94, name: 'Mint-Pink' },
      { primary: 0x88d8b0, secondary: 0xffeaa7, name: 'Sage-Cream' },
      { primary: 0xb4a7d6, secondary: 0xd63031, name: 'Lavender-Red' }
    ]
    
    // Find current palette
    let currentIndex = 0
    for (let i = 0; i < colorPalettes.length; i++) {
      if (colorPalettes[i].primary === this.properties.colorPrimary) {
        currentIndex = i
        break
      }
    }
    
    // Calculate new index
    let newIndex = currentIndex + (direction === 'right' ? 1 : -1)
    if (newIndex < 0) newIndex = colorPalettes.length - 1
    if (newIndex >= colorPalettes.length) newIndex = 0
    
    const newPalette = colorPalettes[newIndex]
    
    // Animate color transition
    this.animateColorTransition(newPalette.primary, newPalette.secondary)
    
    console.log(`Switched to ${newPalette.name} palette`)
  }

  animateColorTransition(newPrimary, newSecondary) {
    this.properties.colorPrimary = newPrimary
    this.properties.colorSecondary = newSecondary
    
    // Update material colors
    gsap.to(this.dotMaterial.color, {
      duration: 1,
      r: ((newPrimary >> 16) & 255) / 255,
      g: ((newPrimary >> 8) & 255) / 255,
      b: (newPrimary & 255) / 255,
      ease: 'power2.inOut'
    })
    
    // Update glow materials
    this.holderObjects.children.forEach(child => {
      if (child.material && child.material.uniforms) {
        gsap.to(child.material.uniforms.primaryColor.value, {
          duration: 1,
          r: ((newPrimary >> 16) & 255) / 255,
          g: ((newPrimary >> 8) & 255) / 255,
          b: (newPrimary & 255) / 255,
          ease: 'power2.inOut'
        })
        
        gsap.to(child.material.uniforms.secondaryColor.value, {
          duration: 1,
          r: ((newSecondary >> 16) & 255) / 255,
          g: ((newSecondary >> 8) & 255) / 255,
          b: (newSecondary & 255) / 255,
          ease: 'power2.inOut'
        })
      }
    })
    
    // Sync to global color manager
    if (App.colorSyncManager) {
      App.colorSyncManager.updateColor('primary', newPrimary, 'BreathingDotsVisualizer')
      App.colorSyncManager.updateColor('secondary', newSecondary, 'BreathingDotsVisualizer')
    }
  }

  resetBreathingPattern() {
    // Reset breathing cycle to beginning
    this.breathingPhase = 0
    this.currentPhase = 'inhale'
    this.phaseProgress = 0
    
    // Reset properties
    this.properties.breathingSpeed = 1.0
    this.properties.breathingIntensity = 1.0
    
    // Reset hand influence
    this.dots.forEach(dot => {
      dot.handInfluence = 0
    })
    
    console.log('Breathing pattern reset')
  }

  updateBreathingCycle(deltaTime) {
    const speed = this.properties.breathingSpeed
    const cycle = this.breathingCycle
    
    // Update phase progress
    let phaseDuration
    switch (this.currentPhase) {
      case 'inhale': phaseDuration = cycle.inhale; break
      case 'hold1': phaseDuration = cycle.hold1; break
      case 'exhale': phaseDuration = cycle.exhale; break
      case 'hold2': phaseDuration = cycle.hold2; break
    }
    
    this.phaseProgress += (deltaTime * speed) / phaseDuration
    
    // Check for phase transition
    if (this.phaseProgress >= 1.0) {
      this.phaseProgress = 0
      switch (this.currentPhase) {
        case 'inhale': this.currentPhase = 'hold1'; break
        case 'hold1': this.currentPhase = 'exhale'; break
        case 'exhale': this.currentPhase = 'hold2'; break
        case 'hold2': this.currentPhase = 'inhale'; break
      }
    }
    
    // Calculate breathing phase value (-1 to 1)
    let breathingValue = 0
    switch (this.currentPhase) {
      case 'inhale':
        breathingValue = -1 + (this.phaseProgress * 2) // -1 to 1
        break
      case 'hold1':
        breathingValue = 1 // Hold at peak
        break
      case 'exhale':
        breathingValue = 1 - (this.phaseProgress * 2) // 1 to -1
        break
      case 'hold2':
        breathingValue = -1 // Hold at bottom
        break
    }
    
    this.breathingPhase = breathingValue * this.properties.breathingIntensity
  }

  updateDotInstances() {
    this.dots.forEach((dot, index) => {
      // Calculate breathing effect
      const breathingScale = 1 + Math.sin(this.breathingPhase + dot.breathingOffset) * 0.3
      
      // Calculate audio influence
      const audioScale = 1 + this.audioState.overall * dot.audioInfluence * this.properties.audioReactivity
      
      // Calculate hand influence
      const handScale = 1 + dot.handInfluence * this.properties.handInfluence
      
      // Combine all influences
      dot.currentScale = dot.baseScale * breathingScale * audioScale * handScale
      
      // Update position (slight movement based on breathing)
      const breathingOffset = Math.sin(this.breathingPhase + dot.breathingOffset) * 0.1
      dot.currentPosition.copy(dot.originalPosition)
      dot.currentPosition.z += breathingOffset * dot.distanceFromCenter
      
      // Hand influence on position
      if (dot.handInfluence > 0) {
        const handX = this.handState.smoothedPosition.x * 6
        const handY = this.handState.smoothedPosition.y * 6
        const pullStrength = dot.handInfluence * 0.3
        
        dot.currentPosition.x += (handX - dot.originalPosition.x) * pullStrength
        dot.currentPosition.y += (handY - dot.originalPosition.y) * pullStrength
      }
      
      // Update instance matrix
      this.dummy.position.copy(dot.currentPosition)
      this.dummy.scale.setScalar(dot.currentScale)
      this.dummy.updateMatrix()
      
      this.instancedMesh.setMatrixAt(index, this.dummy.matrix)
    })
    
    this.instancedMesh.instanceMatrix.needsUpdate = true
  }

  updateAudioState() {
    if (App.advancedAudioManager) {
      const audioData = App.advancedAudioManager.getFrequencyData()
      
      // Smooth audio values
      const smoothing = 0.1
      this.audioState.bass += (audioData.smoothed.bass - this.audioState.bass) * smoothing
      this.audioState.mid += (audioData.smoothed.mid - this.audioState.mid) * smoothing
      this.audioState.treble += (audioData.smoothed.treble - this.audioState.treble) * smoothing
      this.audioState.overall += (audioData.smoothed.overall - this.audioState.overall) * smoothing
    }
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
  }

  setupColorSync() {
    if (App.colorSyncManager) {
      App.colorSyncManager.subscribe(
        'BreathingDotsVisualizer',
        (colors) => this.onColorsUpdated(colors),
        ['primary', 'secondary']
      )
    }
  }

  onColorsUpdated(colors) {
    if (colors.primary !== undefined) {
      this.properties.colorPrimary = colors.primary
      if (this.dotMaterial) {
        this.dotMaterial.color.setHex(colors.primary)
      }
    }
    
    if (colors.secondary !== undefined) {
      this.properties.colorSecondary = colors.secondary
    }
    
    // Update glow materials
    this.holderObjects.children.forEach(child => {
      if (child.material && child.material.uniforms) {
        if (colors.primary !== undefined) {
          child.material.uniforms.primaryColor.value.setHex(colors.primary)
        }
        if (colors.secondary !== undefined) {
          child.material.uniforms.secondaryColor.value.setHex(colors.secondary)
        }
      }
    })
    
    console.log('BreathingDotsVisualizer: Colors updated', colors)
  }

  update() {
    const deltaTime = 0.016 // ~60fps
    this.time += deltaTime
    
    // Update breathing cycle
    this.updateBreathingCycle(deltaTime)
    
    // Update audio state
    this.updateAudioState()
    
    // Update hand state
    this.updateHandState()
    
    // Update dot instances
    this.updateDotInstances()
    
    // Update glow materials
    this.holderObjects.children.forEach(child => {
      if (child.material && child.material.uniforms) {
        child.material.uniforms.time.value = this.time
        child.material.uniforms.breathingPhase.value = this.breathingPhase
        child.material.uniforms.audioLevel.value = this.audioState.overall
      }
    })
    
    // Subtle rotation based on breathing
    this.holderObjects.rotation.z = Math.sin(this.breathingPhase * 0.5) * 0.05
  }

  cleanupDotSystem() {
    if (this.instancedMesh) {
      this.holderObjects.remove(this.instancedMesh)
      if (this.instancedMesh.geometry) this.instancedMesh.geometry.dispose()
      if (this.instancedMesh.material) this.instancedMesh.material.dispose()
      this.instancedMesh = null
    }
    
    // Clean up glow effects
    this.holderObjects.children.forEach(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    this.holderObjects.clear()
  }

  addGUI() {
    if (!App.gui) return

    const gui = App.gui
    this.guiFolder = gui.addFolder('BREATHING DOTS')

    this.guiFolder
      .add(this.properties, 'gridSize', 5, 25)
      .step(1)
      .name('Grid Size')
      .onChange(() => {
        this.createDotSystem()
      })

    this.guiFolder
      .add(this.properties, 'spacing', 0.3, 1.5)
      .name('Dot Spacing')
      .onChange(() => {
        this.createDotSystem()
      })

    this.guiFolder
      .add(this.properties, 'breathingSpeed', 0.1, 3.0)
      .name('Breathing Speed')

    this.guiFolder
      .add(this.properties, 'breathingIntensity', 0.1, 2.0)
      .name('Breathing Intensity')

    this.guiFolder
      .add(this.properties, 'audioReactivity', 0.0, 3.0)
      .name('Audio Reactivity')

    this.guiFolder
      .add(this.properties, 'handInfluence', 0.0, 5.0)
      .name('Hand Influence')

    this.guiFolder
      .addColor(this.properties, 'colorPrimary')
      .name('Primary Color')
      .onChange((color) => {
        this.animateColorTransition(color, this.properties.colorSecondary)
      })

    this.guiFolder
      .addColor(this.properties, 'colorSecondary')
      .name('Secondary Color')
      .onChange((color) => {
        this.animateColorTransition(this.properties.colorPrimary, color)
      })

    const resetButton = {
      reset: () => this.resetBreathingPattern()
    }
    this.guiFolder.add(resetButton, 'reset').name('Reset Breathing')

    const breathingInfo = {
      currentPhase: () => this.currentPhase.toUpperCase()
    }
    this.guiFolder.add(breathingInfo, 'currentPhase').name('Current Phase').listen()
  }

  destroy() {
    console.log('Destroying breathing dots visualizer')
    
    // Clean up dot system
    this.cleanupDotSystem()
    
    // Remove GUI folder
    if (this.guiFolder && App.gui) {
      App.gui.removeFolder(this.guiFolder)
      this.guiFolder = null
    }
    
    // Unsubscribe from color sync
    if (App.colorSyncManager) {
      App.colorSyncManager.unsubscribe('BreathingDotsVisualizer')
    }
    
    // Remove from parent
    if (this.parent) {
      this.parent.remove(this)
    }
  }
}