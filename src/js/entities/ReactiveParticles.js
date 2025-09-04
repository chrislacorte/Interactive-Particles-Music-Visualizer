import * as THREE from 'three'
import gsap from 'gsap'
import vertex from './glsl/vertex.glsl'
import fragment from './glsl/fragment.glsl'
import App from '../App'

export default class ReactiveParticles extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'ReactiveParticles'
    this.time = 0
    this.properties = {
      startColor: 0xff00ff,
      endColor: 0x00ffff,
      autoMix: true,
      autoRotate: true,
    }
    
    // Gesture control state
    this.gestureControls = {
      zoomLevel: 1,
      rotationSpeed: 1,
      intensityMultiplier: 1,
      basePosition: { x: 0, y: 0, z: 12 }
    }
  }

  init() {
    App.holder.add(this)

    this.holderObjects = new THREE.Object3D()
    this.add(this.holderObjects)

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      uniforms: {
        time: { value: 0 },
        offsetSize: { value: 2 },
        size: { value: 1.1 },
        frequency: { value: 2 },
        amplitude: { value: 1 },
        offsetGain: { value: 0 },
        maxDistance: { value: 1.8 },
        startColor: { value: new THREE.Color(this.properties.startColor) },
        endColor: { value: new THREE.Color(this.properties.endColor) },
      },
    })

    this.addGUI()
    this.resetMesh()
    this.setupGestureControls()
  }

  setupGestureControls() {
    if (App.gestureManager) {
      // Setup gesture callbacks
      App.gestureManager.onPinch((strength) => {
        this.handlePinchGesture(strength)
      })
      
      App.gestureManager.onSwipe((direction, velocity) => {
        this.handleSwipeGesture(direction, velocity)
      })
      
      App.gestureManager.onBodyLean((lean) => {
        this.handleBodyLeanGesture(lean)
      })
      
      App.gestureManager.onReset(() => {
        this.handleResetGesture()
      })
    }
  }

  handlePinchGesture(strength) {
    // Map pinch strength to zoom level
    const targetZoom = 0.5 + strength * 2 // Range: 0.5 to 2.5
    this.gestureControls.zoomLevel = targetZoom
    
    // Apply zoom to camera position
    gsap.to(App.camera?.position || {}, {
      duration: 0.1,
      z: this.gestureControls.basePosition.z / targetZoom,
      ease: 'power2.out'
    })
    
    // Adjust particle size based on zoom
    gsap.to(this.material.uniforms.size, {
      duration: 0.1,
      value: 1.1 * targetZoom,
      ease: 'power2.out'
    })
  }

  handleSwipeGesture(direction, velocity) {
    switch (direction) {
      case 'left':
        // Switch to box mesh
        this.destroyMesh()
        this.createBoxMesh()
        this.properties.autoMix = false
        break
      case 'right':
        // Switch to cylinder mesh
        this.destroyMesh()
        this.createCylinderMesh()
        this.properties.autoMix = false
        break
      case 'up':
        // Increase particle intensity
        gsap.to(this.material.uniforms.amplitude, {
          duration: 0.3,
          value: Math.min(this.material.uniforms.amplitude.value + 0.5, 3),
          ease: 'power2.out'
        })
        break
      case 'down':
        // Decrease particle intensity
        gsap.to(this.material.uniforms.amplitude, {
          duration: 0.3,
          value: Math.max(this.material.uniforms.amplitude.value - 0.5, 0.1),
          ease: 'power2.out'
        })
        break
    }
  }

  handleBodyLeanGesture(lean) {
    // Map body lean to rotation and color mixing
    this.gestureControls.intensityMultiplier = 1 + Math.abs(lean) * 0.5
    
    // Apply rotation based on lean
    if (this.holderObjects) {
      gsap.to(this.holderObjects.rotation, {
        duration: 0.2,
        z: lean * Math.PI * 0.1,
        ease: 'power2.out'
      })
    }
    
    // Adjust frequency based on lean intensity
    gsap.to(this.material.uniforms.frequency, {
      duration: 0.2,
      value: 2 + Math.abs(lean) * 2,
      ease: 'power2.out'
    })
  }

  handleResetGesture() {
    // Reset all gesture-controlled parameters
    this.gestureControls.zoomLevel = 1
    this.gestureControls.intensityMultiplier = 1
    
    // Reset camera position
    gsap.to(App.camera?.position || {}, {
      duration: 0.5,
      z: this.gestureControls.basePosition.z,
      ease: 'elastic.out(1, 0.3)'
    })
    
    // Reset material properties
    gsap.to(this.material.uniforms.size, {
      duration: 0.5,
      value: 1.1,
      ease: 'elastic.out(1, 0.3)'
    })
    
    gsap.to(this.material.uniforms.frequency, {
      duration: 0.5,
      value: 2,
      ease: 'elastic.out(1, 0.3)'
    })
    
    gsap.to(this.material.uniforms.amplitude, {
      duration: 0.5,
      value: 1,
      ease: 'elastic.out(1, 0.3)'
    })
    
    // Reset rotation
    if (this.holderObjects) {
      gsap.to(this.holderObjects.rotation, {
        duration: 0.5,
        x: 0,
        y: 0,
        z: 0,
        ease: 'elastic.out(1, 0.3)'
      })
    }
    
    // Re-enable auto mix
    this.properties.autoMix = true
  }
  createBoxMesh() {
    // Randomly generate segment counts for width, height, and depth to create varied box geometries
    let widthSeg = Math.floor(THREE.MathUtils.randInt(5, 20))
    let heightSeg = Math.floor(THREE.MathUtils.randInt(1, 40))
    let depthSeg = Math.floor(THREE.MathUtils.randInt(5, 80))
    this.geometry = new THREE.BoxGeometry(1, 1, 1, widthSeg, heightSeg, depthSeg)

    // Update shader material uniform for offset size with a random value
    this.material.uniforms.offsetSize.value = Math.floor(THREE.MathUtils.randInt(30, 60))
    this.material.needsUpdate = true

    // Create a container for the points mesh and set its orientation
    this.pointsMesh = new THREE.Object3D()
    this.pointsMesh.rotateX(Math.PI / 2) // Rotate the mesh for better visual orientation
    this.holderObjects.add(this.pointsMesh)

    // Create a points mesh using the box geometry and the shader material
    const pointsMesh = new THREE.Points(this.geometry, this.material)
    this.pointsMesh.add(pointsMesh)

    // Animate the rotation of the of the container
    gsap.to(this.pointsMesh.rotation, {
      duration: 3,
      x: Math.random() * Math.PI,
      z: Math.random() * Math.PI * 2,
      ease: 'none', // No easing for a linear animation
    })

    gsap.to(this.position, {
      duration: 0.6,
      z: THREE.MathUtils.randInt(9, 11), // Random depth positioning within a range
      ease: 'elastic.out(0.8)', // Elastic ease-out for a bouncy effect
    })
  }

  createCylinderMesh() {
    // Randomize radial and height segments for the cylinder geometry
    let radialSeg = Math.floor(THREE.MathUtils.randInt(1, 3))
    let heightSeg = Math.floor(THREE.MathUtils.randInt(1, 5))
    this.geometry = new THREE.CylinderGeometry(1, 1, 4, 64 * radialSeg, 64 * heightSeg, true)

    // Update shader material uniforms for offset and size with random and fixed values
    this.material.uniforms.offsetSize.value = Math.floor(THREE.MathUtils.randInt(30, 60))
    this.material.uniforms.size.value = 2 // Fixed size for uniform appearance
    this.material.needsUpdate = true
    this.material.uniforms.needsUpdate = true

    // Create a points mesh using the cylinder geometry and shader material
    this.pointsMesh = new THREE.Points(this.geometry, this.material)
    this.pointsMesh.rotation.set(Math.PI / 2, 0, 0) // Rotate the mesh for better orientation
    this.holderObjects.add(this.pointsMesh)

    let rotY = 0
    let posZ = THREE.MathUtils.randInt(9, 11)

    if (Math.random() < 0.2) {
      rotY = Math.PI / 2
      posZ = THREE.MathUtils.randInt(10, 11.5)
    }

    gsap.to(this.holderObjects.rotation, {
      duration: 0.2,
      y: rotY,
      ease: 'elastic.out(0.2)',
    })

    gsap.to(this.position, {
      duration: 0.6,
      z: posZ,
      ease: 'elastic.out(0.8)',
    })
  }

  onBPMBeat() {
    // Calculate a reduced duration based on the BPM (beats per minute) duration
    const duration = App.bpmManager.getBPMDuration() / 1000

    if (App.audioManager.isPlaying) {
      // Randomly determine whether to rotate the holder object
      if (Math.random() < 0.3 && this.properties.autoRotate) {
        gsap.to(this.holderObjects.rotation, {
          duration: Math.random() < 0.8 ? 15 : duration, // Either a longer or BPM-synced duration
          // y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI,
          ease: 'elastic.out(0.2)',
        })
      }

      // Randomly decide whether to reset the mesh
      if (Math.random() < 0.3) {
        this.resetMesh()
      }
    }
  }

  resetMesh() {
    if (this.properties.autoMix) {
      this.destroyMesh()
      if (Math.random() < 0.5) {
        this.createCylinderMesh()
      } else {
        this.createBoxMesh()
      }

      // Animate the position of the mesh for an elastic movement effect

      // Animate the frequency uniform in the material, syncing with BPM if available
      gsap.to(this.material.uniforms.frequency, {
        duration: App.bpmManager ? (App.bpmManager.getBPMDuration() / 1000) * 2 : 2,
        value: THREE.MathUtils.randFloat(0.5, 3), // Random frequency value for dynamic visual changes
        ease: 'expo.easeInOut', // Smooth exponential transition for visual effect
      })
    }
  }

  destroyMesh() {
    if (this.pointsMesh) {
      this.holderObjects.remove(this.pointsMesh)
      this.pointsMesh.geometry?.dispose()
      this.pointsMesh.material?.dispose()
      this.pointsMesh = null
    }
  }

  update() {
    if (App.audioManager?.isPlaying) {
      // Dynamically update amplitude based on the high frequency data from the audio manager
      const baseAmplitude = 0.8 + THREE.MathUtils.mapLinear(App.audioManager.frequencyData.high, 0, 0.6, -0.1, 0.2)
      this.material.uniforms.amplitude.value = baseAmplitude * this.gestureControls.intensityMultiplier

      // Update offset gain based on the low frequency data for subtle effect changes
      this.material.uniforms.offsetGain.value = App.audioManager.frequencyData.mid * 0.6

      // Map low frequency data to a range and use it to increment the time uniform
      const t = THREE.MathUtils.mapLinear(App.audioManager.frequencyData.low, 0.6, 1, 0.2, 0.5)
      this.time += THREE.MathUtils.clamp(t, 0.2, 0.5) * this.gestureControls.rotationSpeed // Clamp the value to ensure it stays within a desired range
    } else {
      // Set default values for the uniforms when audio is not playing
      this.material.uniforms.frequency.value = 0.8
      this.material.uniforms.amplitude.value = 1
      this.time += 0.2
    }

    this.material.uniforms.time.value = this.time
  }

  addGUI() {
    //Add GUI controls
    const gui = App.gui
    const particlesFolder = gui.addFolder('PARTICLES')
    particlesFolder
      .addColor(this.properties, 'startColor')
      .listen()
      .name('Start Color')
      .onChange((e) => {
        this.material.uniforms.startColor.value = new THREE.Color(e)
      })

    particlesFolder
      .addColor(this.properties, 'endColor')
      .listen()
      .name('End Color')
      .onChange((e) => {
        this.material.uniforms.endColor.value = new THREE.Color(e)
      })

    const visualizerFolder = gui.addFolder('VISUALIZER')
    visualizerFolder.add(this.properties, 'autoMix').listen().name('Auto Mix')
    visualizerFolder.add(this.properties, 'autoRotate').listen().name('Auto Rotate')

    const buttonShowBox = {
      showBox: () => {
        this.destroyMesh()
        this.createBoxMesh()
        this.properties.autoMix = false
      },
    }
    visualizerFolder.add(buttonShowBox, 'showBox').name('Show Box')

    const buttonShowCylinder = {
      showCylinder: () => {
        this.destroyMesh()
        this.createCylinderMesh()
        this.properties.autoMix = false
      },
    }
    visualizerFolder.add(buttonShowCylinder, 'showCylinder').name('Show Cylinder')
    
    // Add gesture controls to GUI
    const gestureFolder = gui.addFolder('GESTURE CONTROLS')
    gestureFolder.add(this.gestureControls, 'zoomLevel', 0.1, 3).name('Zoom Level').listen()
    gestureFolder.add(this.gestureControls, 'rotationSpeed', 0.1, 3).name('Rotation Speed').listen()
    gestureFolder.add(this.gestureControls, 'intensityMultiplier', 0.1, 3).name('Intensity Multiplier').listen()
  }
}
