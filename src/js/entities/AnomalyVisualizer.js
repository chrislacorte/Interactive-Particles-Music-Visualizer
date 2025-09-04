import * as THREE from 'three'
import gsap from 'gsap'
import anomalyVertex from './glsl/anomaly-vertex.glsl'
import anomalyFragment from './glsl/anomaly-fragment.glsl'
import glowVertex from './glsl/glow-vertex.glsl'
import glowFragment from './glsl/glow-fragment.glsl'
import backgroundParticlesVertex from './glsl/background-particles-vertex.glsl'
import backgroundParticlesFragment from './glsl/background-particles-fragment.glsl'
import App from '../App'

export default class AnomalyVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'AnomalyVisualizer'
    this.time = 0
    this.properties = {
      distortionAmount: 1.0,
      resolution: 32,
      anomalyColor: 0xff4e42,
      particleCount: 3000,
      autoRotate: true,
    }
    
    // Animation state
    this.anomalyVelocity = new THREE.Vector2(0, 0)
    this.anomalyTargetPosition = new THREE.Vector3(0, 0, 0)
    this.isDragging = false
    
    // Visual components
    this.anomalyObject = null
    this.backgroundParticles = null
  }

  init() {
    App.holder.add(this)

    this.holderObjects = new THREE.Object3D()
    this.add(this.holderObjects)

    this.createAnomalyObject()
    this.createBackgroundParticles()
    this.setupInteraction()
    this.addGUI()
  }

  createAnomalyObject() {
    // Clean up existing anomaly object
    if (this.anomalyObject) {
      this.holderObjects.remove(this.anomalyObject)
      this.anomalyObject.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    }

    this.anomalyObject = new THREE.Group()
    const radius = 2

    // Main anomaly geometry
    const outerGeometry = new THREE.IcosahedronGeometry(
      radius,
      Math.max(1, Math.floor(this.properties.resolution / 8))
    )

    // Main anomaly material
    const outerMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(this.properties.anomalyColor) },
        audioLevel: { value: 0 },
        distortion: { value: this.properties.distortionAmount }
      },
      vertexShader: anomalyVertex,
      fragmentShader: anomalyFragment,
      wireframe: true,
      transparent: true
    })

    const outerSphere = new THREE.Mesh(outerGeometry, outerMaterial)
    this.anomalyObject.add(outerSphere)

    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(radius * 1.2, 32, 32)
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(this.properties.anomalyColor) },
        audioLevel: { value: 0 }
      },
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial)
    this.anomalyObject.add(glowSphere)

    this.holderObjects.add(this.anomalyObject)

    // Store materials for updates
    this.outerMaterial = outerMaterial
    this.glowMaterial = glowMaterial
  }

  createBackgroundParticles() {
    // Clean up existing particles
    if (this.backgroundParticles) {
      this.holderObjects.remove(this.backgroundParticles)
      if (this.backgroundParticles.geometry) this.backgroundParticles.geometry.dispose()
      if (this.backgroundParticles.material) this.backgroundParticles.material.dispose()
    }

    const particlesGeometry = new THREE.BufferGeometry()
    const particleCount = this.properties.particleCount
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    // Color palette
    const color1 = new THREE.Color(0xff4e42)
    const color2 = new THREE.Color(0xc2362f)
    const color3 = new THREE.Color(0xffb3ab)

    for (let i = 0; i < particleCount; i++) {
      // Random positions in a large sphere
      positions[i * 3] = (Math.random() - 0.5) * 100
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100

      // Random colors from palette
      let color
      const colorChoice = Math.random()
      if (colorChoice < 0.33) {
        color = color1
      } else if (colorChoice < 0.66) {
        color = color2
      } else {
        color = color3
      }

      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      sizes[i] = 0.05
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const particlesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: backgroundParticlesVertex,
      fragmentShader: backgroundParticlesFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    })

    this.backgroundParticles = new THREE.Points(particlesGeometry, particlesMaterial)
    this.holderObjects.add(this.backgroundParticles)

    // Store material for updates
    this.particlesMaterial = particlesMaterial
  }

  setupInteraction() {
    // Setup mouse interaction for anomaly dragging
    const container = document.querySelector('.content')
    if (!container) return

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let dragStartPosition = new THREE.Vector2()
    const maxDragDistance = 3

    const onMouseDown = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

      raycaster.setFromCamera(mouse, App.camera || { position: { x: 0, y: 0, z: 10 } })
      
      if (this.anomalyObject) {
        const intersects = raycaster.intersectObject(this.anomalyObject, true)
        if (intersects.length > 0) {
          this.isDragging = true
          dragStartPosition.x = mouse.x
          dragStartPosition.y = mouse.y
        }
      }
    }

    const onMouseMove = (event) => {
      if (this.isDragging) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        const deltaX = (mouse.x - dragStartPosition.x) * 5
        const deltaY = (mouse.y - dragStartPosition.y) * 5

        this.anomalyTargetPosition.x += deltaX
        this.anomalyTargetPosition.y += deltaY

        // Limit drag distance
        const distance = Math.sqrt(
          this.anomalyTargetPosition.x * this.anomalyTargetPosition.x +
          this.anomalyTargetPosition.y * this.anomalyTargetPosition.y
        )
        if (distance > maxDragDistance) {
          const scale = maxDragDistance / distance
          this.anomalyTargetPosition.x *= scale
          this.anomalyTargetPosition.y *= scale
        }

        this.anomalyVelocity.x = deltaX * 2
        this.anomalyVelocity.y = deltaY * 2

        dragStartPosition.x = mouse.x
        dragStartPosition.y = mouse.y
      }
    }

    const onMouseUp = () => {
      this.isDragging = false
    }

    container.addEventListener('mousedown', onMouseDown)
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseup', onMouseUp)
    container.addEventListener('mouseleave', onMouseUp)

    // Store event listeners for cleanup
    this.eventListeners = {
      mousedown: onMouseDown,
      mousemove: onMouseMove,
      mouseup: onMouseUp,
      container
    }
  }

  updateAnomalyPosition() {
    if (!this.isDragging && this.anomalyObject) {
      // Apply physics when not dragging
      this.anomalyVelocity.x *= 0.95
      this.anomalyVelocity.y *= 0.95

      this.anomalyTargetPosition.x += this.anomalyVelocity.x * 0.1
      this.anomalyTargetPosition.y += this.anomalyVelocity.y * 0.1

      // Spring back to center
      const springStrength = 0.1
      this.anomalyVelocity.x -= this.anomalyTargetPosition.x * springStrength
      this.anomalyVelocity.y -= this.anomalyTargetPosition.y * springStrength

      // Stop small movements
      if (Math.abs(this.anomalyTargetPosition.x) < 0.05 && Math.abs(this.anomalyTargetPosition.y) < 0.05) {
        this.anomalyTargetPosition.set(0, 0, 0)
        this.anomalyVelocity.set(0, 0)
      }

      // Boundary collision
      const bounceThreshold = 3
      const bounceDamping = 0.8

      if (Math.abs(this.anomalyTargetPosition.x) > bounceThreshold) {
        this.anomalyVelocity.x = -this.anomalyVelocity.x * bounceDamping
        this.anomalyTargetPosition.x = Math.sign(this.anomalyTargetPosition.x) * bounceThreshold
      }

      if (Math.abs(this.anomalyTargetPosition.y) > bounceThreshold) {
        this.anomalyVelocity.y = -this.anomalyVelocity.y * bounceDamping
        this.anomalyTargetPosition.y = Math.sign(this.anomalyTargetPosition.y) * bounceThreshold
      }
    }

    // Smooth position interpolation
    if (this.anomalyObject) {
      this.anomalyObject.position.x += (this.anomalyTargetPosition.x - this.anomalyObject.position.x) * 0.2
      this.anomalyObject.position.y += (this.anomalyTargetPosition.y - this.anomalyObject.position.y) * 0.2

      // Rotation based on velocity when not dragging
      if (!this.isDragging) {
        this.anomalyObject.rotation.x += this.anomalyVelocity.y * 0.01
        this.anomalyObject.rotation.y += this.anomalyVelocity.x * 0.01
      }
    }
  }

  update() {
    this.time += 0.016 // ~60fps

    // Calculate audio level from existing audio manager
    let audioLevel = 0
    if (App.audioManager?.isPlaying && App.audioManager.frequencyData) {
      let sum = 0
      for (let i = 0; i < App.audioManager.frequencyData.low; i++) {
        sum += App.audioManager.frequencyData.low
      }
      audioLevel = sum * 0.01 // Normalize
    }

    // Update anomaly materials
    if (this.outerMaterial) {
      this.outerMaterial.uniforms.time.value = this.time
      this.outerMaterial.uniforms.audioLevel.value = audioLevel
      this.outerMaterial.uniforms.distortion.value = this.properties.distortionAmount
    }

    if (this.glowMaterial) {
      this.glowMaterial.uniforms.time.value = this.time
      this.glowMaterial.uniforms.audioLevel.value = audioLevel
    }

    // Update background particles
    if (this.particlesMaterial) {
      this.particlesMaterial.uniforms.time.value = this.time
    }

    // Update anomaly position and physics
    this.updateAnomalyPosition()

    // Auto rotation
    if (this.properties.autoRotate && this.anomalyObject) {
      const rotationSpeed = 1 + audioLevel * 2
      this.anomalyObject.rotation.y += 0.005 * rotationSpeed
      this.anomalyObject.rotation.z += 0.002 * rotationSpeed
    }
  }

  addGUI() {
    if (!App.gui) return

    const gui = App.gui
    const anomalyFolder = gui.addFolder('ANOMALY VISUALIZER')

    anomalyFolder
      .add(this.properties, 'distortionAmount', 0.1, 3.0)
      .name('Distortion')
      .onChange(() => {
        this.createAnomalyObject()
      })

    anomalyFolder
      .add(this.properties, 'resolution', 8, 64)
      .step(1)
      .name('Resolution')
      .onChange(() => {
        this.createAnomalyObject()
      })

    anomalyFolder
      .addColor(this.properties, 'anomalyColor')
      .name('Anomaly Color')
      .onChange(() => {
        if (this.outerMaterial) {
          this.outerMaterial.uniforms.color.value = new THREE.Color(this.properties.anomalyColor)
        }
        if (this.glowMaterial) {
          this.glowMaterial.uniforms.color.value = new THREE.Color(this.properties.anomalyColor)
        }
      })

    anomalyFolder
      .add(this.properties, 'particleCount', 1000, 5000)
      .step(100)
      .name('Particle Count')
      .onChange(() => {
        this.createBackgroundParticles()
      })

    anomalyFolder.add(this.properties, 'autoRotate').name('Auto Rotate')

    const resetButton = {
      reset: () => {
        this.properties.distortionAmount = 1.0
        this.properties.resolution = 32
        this.properties.anomalyColor = 0xff4e42
        this.properties.particleCount = 3000
        this.properties.autoRotate = true
        this.anomalyTargetPosition.set(0, 0, 0)
        this.anomalyVelocity.set(0, 0)
        if (this.anomalyObject) {
          this.anomalyObject.position.set(0, 0, 0)
        }
        this.createAnomalyObject()
        this.createBackgroundParticles()
      }
    }
    anomalyFolder.add(resetButton, 'reset').name('Reset All')
  }

  destroy() {
    // Clean up event listeners
    if (this.eventListeners) {
      const { container, mousedown, mousemove, mouseup } = this.eventListeners
      container.removeEventListener('mousedown', mousedown)
      container.removeEventListener('mousemove', mousemove)
      container.removeEventListener('mouseup', mouseup)
      container.removeEventListener('mouseleave', mouseup)
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