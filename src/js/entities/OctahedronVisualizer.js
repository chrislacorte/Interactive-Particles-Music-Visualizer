import * as THREE from 'three'
import gsap from 'gsap'
import octahedronVertex from './glsl/octahedron-vertex.glsl?raw'
import octahedronFragment from './glsl/octahedron-fragment.glsl?raw'
import simplexNoise4D from './glsl/simplex-noise-4d.glsl?raw'
import App from '../App'

export default class OctahedronVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'OctahedronVisualizer'
    this.time = 0
    
    this.properties = {
      backgroundColor: 0x331144,
      width: 1.3,
      bumpFrequency: 0.3,
      bumpScale: 0.4,
      rotationSpeed: 1.0,
      audioReactivity: 1.0,
      positionY: 0.15
    }
    
    // Audio reactive state
    this.audioState = {
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedOverall: 0
    }
    
    // Visual components
    this.octahedronMesh = null
    this.material = null
    this.clock = new THREE.Clock()
  }

  init() {
    App.holder.add(this)

    this.holderObjects = new THREE.Object3D()
    this.add(this.holderObjects)

    this.createOctahedronMesh()
    this.setupGestureControls()
    this.addGUI()
    this.setupColorSync()
    
    // Set scene background color
    if (App.holder.parent && App.holder.parent.parent) {
      const scene = App.holder.parent.parent
      if (scene.background) {
        scene.background = new THREE.Color(this.properties.backgroundColor)
      }
    }
    
    this.clock.start()
  }

  createOctahedronMesh() {
    // Clean up existing mesh
    if (this.octahedronMesh) {
      this.holderObjects.remove(this.octahedronMesh)
      if (this.octahedronMesh.geometry) this.octahedronMesh.geometry.dispose()
      if (this.octahedronMesh.material) this.octahedronMesh.material.dispose()
    }

    // Create octahedron geometry
    const geometry = new THREE.OctahedronGeometry(1, 32)
    geometry.rotateX(Math.PI * -0.5)

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: simplexNoise4D + octahedronVertex,
      fragmentShader: simplexNoise4D + octahedronFragment,
      uniforms: {
        u_time: { value: 0.0 },
        u_width: { value: this.properties.width },
        u_bump_frequency: { value: this.properties.bumpFrequency },
        u_bump_scale: { value: this.properties.bumpScale },
        u_audio_bass: { value: 0.0 },
        u_audio_mid: { value: 0.0 },
        u_audio_treble: { value: 0.0 },
        u_audio_overall: { value: 0.0 }
      }
    })

    this.octahedronMesh = new THREE.Mesh(geometry, this.material)
    this.octahedronMesh.position.y = this.properties.positionY
    this.holderObjects.add(this.octahedronMesh)
  }

  setupGestureControls() {
    if (App.gestureManager) {
      // Setup gesture callbacks
      App.gestureManager.onSwipe((direction, velocity) => {
        this.handleSwipeGesture(direction, velocity)
      })
      
      App.gestureManager.onPinch((strength) => {
        this.handlePinchGesture(strength)
      })
      
      App.gestureManager.onFollow((x, y, isActive) => {
        this.handleFollowGesture(x, y, isActive)
      })
      
      App.gestureManager.onReset(() => {
        this.handleResetGesture()
      })
    }
  }

  handleSwipeGesture(direction, velocity) {
    switch (direction) {
      case 'left':
        // Decrease bump frequency
        this.properties.bumpFrequency = Math.max(0.1, this.properties.bumpFrequency - 0.1)
        this.material.uniforms.u_bump_frequency.value = this.properties.bumpFrequency
        break
      case 'right':
        // Increase bump frequency
        this.properties.bumpFrequency = Math.min(1.0, this.properties.bumpFrequency + 0.1)
        this.material.uniforms.u_bump_frequency.value = this.properties.bumpFrequency
        break
      case 'up':
        // Increase bump scale
        this.properties.bumpScale = Math.min(1.0, this.properties.bumpScale + 0.1)
        this.material.uniforms.u_bump_scale.value = this.properties.bumpScale
        break
      case 'down':
        // Decrease bump scale
        this.properties.bumpScale = Math.max(0.1, this.properties.bumpScale - 0.1)
        this.material.uniforms.u_bump_scale.value = this.properties.bumpScale
        break
    }
  }

  handlePinchGesture(strength) {
    // Map pinch to width parameter
    const targetWidth = 0.5 + strength * 2.0 // Range: 0.5 to 2.5
    gsap.to(this.material.uniforms.u_width, {
      duration: 0.1,
      value: targetWidth,
      ease: 'power2.out'
    })
  }

  handleFollowGesture(x, y, isActive) {
    if (isActive && this.octahedronMesh) {
      // Map normalized coordinates to position
      const targetX = x * 3
      const targetY = y * 2 + this.properties.positionY
      
      gsap.to(this.octahedronMesh.position, {
        duration: 0.1,
        x: targetX,
        y: targetY,
        ease: 'power2.out'
      })
    } else if (this.octahedronMesh) {
      // Return to center
      gsap.to(this.octahedronMesh.position, {
        duration: 0.8,
        x: 0,
        y: this.properties.positionY,
        ease: 'elastic.out(1, 0.3)'
      })
    }
  }

  handleResetGesture() {
    // Reset all properties to defaults
    this.properties.width = 1.3
    this.properties.bumpFrequency = 0.3
    this.properties.bumpScale = 0.4
    this.properties.rotationSpeed = 1.0
    this.properties.audioReactivity = 1.0
    
    // Animate reset
    gsap.to(this.material.uniforms.u_width, {
      duration: 0.5,
      value: this.properties.width,
      ease: 'elastic.out(1, 0.3)'
    })
    
    gsap.to(this.material.uniforms.u_bump_frequency, {
      duration: 0.5,
      value: this.properties.bumpFrequency,
      ease: 'elastic.out(1, 0.3)'
    })
    
    gsap.to(this.material.uniforms.u_bump_scale, {
      duration: 0.5,
      value: this.properties.bumpScale,
      ease: 'elastic.out(1, 0.3)'
    })
    
    // Reset position
    if (this.octahedronMesh) {
      gsap.to(this.octahedronMesh.position, {
        duration: 0.5,
        x: 0,
        y: this.properties.positionY,
        z: 0,
        ease: 'elastic.out(1, 0.3)'
      })
    }
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
    
    // Update shader uniforms with audio data
    const reactivity = this.properties.audioReactivity
    this.material.uniforms.u_audio_bass.value = this.audioState.smoothedBass * reactivity
    this.material.uniforms.u_audio_mid.value = this.audioState.smoothedMid * reactivity
    this.material.uniforms.u_audio_treble.value = this.audioState.smoothedTreble * reactivity
    this.material.uniforms.u_audio_overall.value = this.audioState.smoothedOverall * reactivity
  }

  update() {
    const delta = this.clock.getDelta()
    this.time += delta * this.properties.rotationSpeed
    
    if (this.material) {
      this.material.uniforms.u_time.value = this.time
      
      this.updateAudioState()
      
      // Subtle rotation based on audio
      if (this.octahedronMesh && App.advancedAudioManager) {
        const rotationSpeed = this.audioState.smoothedOverall * 0.01 * this.properties.rotationSpeed
        this.octahedronMesh.rotation.y += rotationSpeed
      }
    }
  }
  
  setupColorSync() {
    if (App.colorSyncManager) {
      App.colorSyncManager.subscribe(
        'OctahedronVisualizer',
        (colors) => this.onColorsUpdated(colors),
        ['primary', 'background']
      )
    }
  }
  
  onColorsUpdated(colors) {
    if (colors.background !== undefined) {
      this.properties.backgroundColor = colors.background
      // Update scene background if available
      if (App.holder.parent && App.holder.parent.parent) {
        const scene = App.holder.parent.parent
        if (scene.background) {
          scene.background = new THREE.Color(colors.background)
        }
      }
    }
    
    console.log('OctahedronVisualizer: Colors updated', colors)
  }

  addGUI() {
    if (!App.gui) return

    const gui = App.gui
    const octahedronFolder = gui.addFolder('OCTAHEDRON VISUALIZER')

    octahedronFolder
      .add(this.properties, 'width', 0.1, 3.0)
      .name('Width')
      .onChange((value) => {
        this.material.uniforms.u_width.value = value
      })

    octahedronFolder
      .add(this.properties, 'bumpFrequency', 0.1, 1.0)
      .name('Bump Frequency')
      .onChange((value) => {
        this.material.uniforms.u_bump_frequency.value = value
      })

    octahedronFolder
      .add(this.properties, 'bumpScale', 0.1, 1.0)
      .name('Bump Scale')
      .onChange((value) => {
        this.material.uniforms.u_bump_scale.value = value
      })

    octahedronFolder
      .add(this.properties, 'rotationSpeed', 0.1, 3.0)
      .name('Rotation Speed')

    octahedronFolder
      .add(this.properties, 'audioReactivity', 0.1, 3.0)
      .name('Audio Reactivity')

    octahedronFolder
      .add(this.properties, 'positionY', -2.0, 2.0)
      .name('Position Y')
      .onChange((value) => {
        if (this.octahedronMesh) {
          this.octahedronMesh.position.y = value
        }
      })

    octahedronFolder
      .addColor(this.properties, 'backgroundColor')
      .name('Background Color')
      .onChange((color) => {
        if (App.holder.parent && App.holder.parent.parent) {
          const scene = App.holder.parent.parent
          if (scene.background) {
            scene.background = new THREE.Color(color)
          }
        }
        // Sync to global color manager
        if (App.colorSyncManager) {
          App.colorSyncManager.updateColor('background', color, 'OctahedronVisualizer')
        }
      })

    const resetButton = {
      reset: () => this.handleResetGesture()
    }
    octahedronFolder.add(resetButton, 'reset').name('Reset All')
  }

  destroy() {
    // Stop clock
    if (this.clock) {
      this.clock.stop()
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