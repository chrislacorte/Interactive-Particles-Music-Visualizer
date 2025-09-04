import * as THREE from 'three'
import gsap from 'gsap'
import App from '../App'

export default class FingerPaintingVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'FingerPaintingVisualizer'
    
    // Canvas and drawing properties
    this.canvas = null
    this.ctx = null
    this.width = 0
    this.height = 0
    
    // Drawing state
    this.isDrawing = false
    this.lastPosition = { x: 0, y: 0 }
    this.currentStroke = []
    this.strokes = []
    
    // Visual properties
    this.properties = {
      brushSize: 8,
      brushColor: '#ffb72e',
      glowIntensity: 8,
      fadeSpeed: 0.02,
      maxStrokes: 50,
      audioReactive: true,
      particleCount: 15,
      trailLength: 20
    }
    
    // Audio-reactive properties
    this.audioState = {
      bassLevel: 0,
      midLevel: 0,
      trebleLevel: 0,
      overallLevel: 0
    }
    
    // Particle system for enhanced effects
    this.particles = []
    this.animationId = null
    
    // Face graphics inspired by the provided code
    this.faceGraphics = []
    this.faceCount = 25
    this.midX = 0
    this.midY = 0
    
    // Gesture state
    this.gestureState = {
      fingerPosition: { x: 0, y: 0 },
      isFingerDetected: false,
      smoothedPosition: { x: 0, y: 0 },
      brushPressure: 1.0
    }
  }

  init() {
    App.holder.add(this)
    
    this.createCanvas()
    this.setupFaceGraphics()
    this.setupGestureControls()
    this.startAnimation()
    this.addGUI()
    
    console.log('Finger Painting Visualizer initialized')
  }

  createCanvas() {
    // Create main drawing canvas
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'finger-painting-canvas'
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
      background: transparent;
      cursor: crosshair;
    `
    
    this.ctx = this.canvas.getContext('2d')
    this.resize()
    
    // Add to DOM
    document.querySelector('.content').appendChild(this.canvas)
    
    // Setup mouse/touch events as fallback
    this.setupFallbackControls()
  }

  setupFaceGraphics() {
    // Create face graphics inspired by the provided code
    this.midX = this.width * 0.5
    this.midY = this.height * 0.5
    
    // Create profile path from the provided plot points
    const plotPoints = [
      {"x":47.09302325581396,"y":12.11031175059952},
      {"x":49.28940568475453,"y":13.908872901678656},
      {"x":51.48578811369511,"y":17.1462829736211},
      {"x":53.16537467700259,"y":20.863309352517987},
      {"x":54.7157622739018,"y":23.741007194244606},
      {"x":54.7157622739018,"y":26.139088729016784},
      {"x":54.06976744186047,"y":28.297362110311752},
      {"x":54.7157622739018,"y":30.09592326139089},
      {"x":56.00775193798451,"y":32.25419664268585},
      {"x":57.94573643410853,"y":33.932853717026376},
      {"x":59.88372093023256,"y":35.25179856115108},
      {"x":61.17571059431525,"y":36.69064748201439},
      {"x":60.91731266149871,"y":37.88968824940047},
      {"x":60.01291989664084,"y":38.84892086330935},
      {"x":58.59173126614987,"y":39.44844124700239},
      {"x":57.94573643410853,"y":40.52757793764987},
      {"x":58.333333333333336,"y":42.086330935251794},
      {"x":59.23772609819123,"y":43.16546762589928},
      {"x":59.88372093023256,"y":43.884892086330936},
      {"x":59.49612403100777,"y":44.724220623501196},
      {"x":58.850129198966414,"y":45.32374100719424},
      {"x":58.333333333333336,"y":45.68345323741007},
      {"x":57.687338501292004,"y":45.98345323741007},
      {"x":58.333333333333336,"y":46.163069544364504},
      {"x":59.23772609819123,"y":46.52278177458034},
      {"x":59.49612403100777,"y":47.12230215827338},
      {"x":59.23772609819123,"y":47.96163069544364},
      {"x":58.97932816537469,"y":48.32134292565948},
      {"x":58.204134366925075,"y":48.920863309352505},
      {"x":57.94573643410853,"y":49.52038369304556},
      {"x":57.94573643410853,"y":50.11990407673861},
      {"x":58.204134366925075,"y":51.07913669064747},
      {"x":58.333333333333336,"y":52.15827338129496},
      {"x":58.204134366925075,"y":52.877697841726615},
      {"x":57.94573643410853,"y":53.71702637889687},
      {"x":57.2997416020672,"y":54.31654676258992},
      {"x":56.65374677002586,"y":54.916067146282955},
      {"x":56.00775193798451,"y":55.15587529976019},
      {"x":55.103359173126634,"y":55.51558752997602},
      {"x":53.81136950904395,"y":56.11510791366907},
      {"x":52.51937984496126,"y":56.11510791366907},
      {"x":52.51937984496126,"y":56.11510791366907},
      {"x":51.098191214470305,"y":56.11510791366907},
      {"x":49.28940568475453,"y":55.87529976019183},
      {"x":47.60981912144704,"y":55.87529976019183},
      {"x":46.05943152454781,"y":55.75539568345324},
      {"x":45.02583979328167,"y":56.35491606714628},
      {"x":43.73385012919898,"y":56.95443645083932},
      {"x":43.2170542635659,"y":57.9136690647482},
      {"x":42.57105943152456,"y":59.71223021582732},
      {"x":41.279069767441875,"y":62.110311750599514},
      {"x":40.63307493540053,"y":63.90887290167865},
      {"x":39.34108527131784,"y":65.70743405275779},
      {"x":38.04909560723516,"y":67.5059952038369},
      {"x":37.015503875969,"y":68.94484412470024},
      {"x":35.72351421188632,"y":70.74340527577937},
      {"x":34.431524547803626,"y":72.30215827338128},
      {"x":33.78552971576228,"y":73.8609112709832},
      {"x":33.13953488372094,"y":75.05995203836929},
      {"x":32.493540051679595,"y":76.73860911270982},
      {"x":32.23514211886307,"y":78.29736211031174},
      {"x":32.493540051679595,"y":79.85611510791367}
    ]
    
    // Convert plot points to canvas coordinates
    const profile = plotPoints.map(point => ({
      x: (point.x * 0.01) * this.width,
      y: (point.y * 0.01) * this.height
    }))
    
    // Create face graphics
    this.faceGraphics = []
    for (let i = 0; i < this.faceCount; i++) {
      const size = this.mapValue(i, 0, this.faceCount - 1, this.width * 1.5, this.width * 0.5)
      
      this.faceGraphics.push({
        x: this.midX,
        y: this.midY,
        size: size,
        rotation: this.mapValue(i, 0, this.faceCount - 1, 0, Math.PI * 2),
        profile: profile,
        alpha: this.mapValue(i, 0, this.faceCount - 1, 0.1, 0.8)
      })
    }
  }

  setupGestureControls() {
    if (App.gestureManager) {
      // Enhanced gesture callbacks for finger painting
      App.gestureManager.onFollow((x, y, isActive) => {
        this.handleFingerPainting(x, y, isActive)
      })
      
      App.gestureManager.onPinch((strength) => {
        this.handleBrushSize(strength)
      })
      
      App.gestureManager.onSwipe((direction, velocity) => {
        this.handleColorChange(direction)
      })
      
      App.gestureManager.onReset(() => {
        this.clearCanvas()
      })
    }
  }

  setupFallbackControls() {
    // Mouse/touch controls as fallback
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e))
    this.canvas.addEventListener('mousemove', (e) => this.draw(e))
    this.canvas.addEventListener('mouseup', () => this.stopDrawing())
    this.canvas.addEventListener('mouseleave', () => this.stopDrawing())
    
    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      this.startDrawing(e.touches[0])
    })
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      this.draw(e.touches[0])
    })
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault()
      this.stopDrawing()
    })
  }

  handleFingerPainting(x, y, isActive) {
    // Convert normalized coordinates (-1 to 1) to canvas coordinates
    const canvasX = (x + 1) * 0.5 * this.width
    const canvasY = (1 - y) * 0.5 * this.height // Flip Y axis
    
    this.gestureState.fingerPosition.x = canvasX
    this.gestureState.fingerPosition.y = canvasY
    this.gestureState.isFingerDetected = isActive
    
    // Smooth the position
    const smoothing = 0.3
    this.gestureState.smoothedPosition.x += 
      (canvasX - this.gestureState.smoothedPosition.x) * smoothing
    this.gestureState.smoothedPosition.y += 
      (canvasY - this.gestureState.smoothedPosition.y) * smoothing
    
    if (isActive) {
      if (!this.isDrawing) {
        this.startDrawingAt(this.gestureState.smoothedPosition.x, this.gestureState.smoothedPosition.y)
      } else {
        this.drawTo(this.gestureState.smoothedPosition.x, this.gestureState.smoothedPosition.y)
      }
    } else {
      this.stopDrawing()
    }
  }

  handleBrushSize(strength) {
    // Map pinch strength to brush size
    this.properties.brushSize = 4 + strength * 20
    this.gestureState.brushPressure = 0.5 + strength * 0.5
  }

  handleColorChange(direction) {
    const colors = [
      '#ffb72e', '#ff6b6b', '#4ecdc4', '#45b7d1', 
      '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'
    ]
    
    const currentIndex = colors.indexOf(this.properties.brushColor)
    let newIndex = currentIndex
    
    if (direction === 'left') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : colors.length - 1
    } else if (direction === 'right') {
      newIndex = currentIndex < colors.length - 1 ? currentIndex + 1 : 0
    }
    
    this.properties.brushColor = colors[newIndex]
    console.log(`Brush color changed to: ${this.properties.brushColor}`)
  }

  startDrawing(event) {
    this.isDrawing = true
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.startDrawingAt(x, y)
  }

  startDrawingAt(x, y) {
    this.isDrawing = true
    this.lastPosition = { x, y }
    this.currentStroke = [{ x, y, pressure: this.gestureState.brushPressure }]
    
    // Add particles at start position
    this.addParticles(x, y)
  }

  draw(event) {
    if (!this.isDrawing) return
    
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    this.drawTo(x, y)
  }

  drawTo(x, y) {
    if (!this.isDrawing) return
    
    const pressure = this.gestureState.brushPressure
    this.currentStroke.push({ x, y, pressure })
    
    // Draw smooth line
    this.drawSmoothLine(this.lastPosition.x, this.lastPosition.y, x, y, pressure)
    
    this.lastPosition = { x, y }
    
    // Add particles along the stroke
    this.addParticles(x, y)
  }

  drawSmoothLine(x1, y1, x2, y2, pressure = 1) {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const steps = Math.max(1, Math.floor(distance / 2))
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x1 + (x2 - x1) * t
      const y = y1 + (y2 - y1) * t
      
      // Audio-reactive brush size
      const audioMultiplier = this.properties.audioReactive ? 
        (1 + this.audioState.overallLevel * 0.5) : 1
      const brushSize = this.properties.brushSize * pressure * audioMultiplier
      
      // Draw glow effect
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'screen'
      this.ctx.fillStyle = this.properties.brushColor
      this.ctx.filter = `blur(${this.properties.glowIntensity}px)`
      this.ctx.beginPath()
      this.ctx.arc(x, y, brushSize, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.restore()
      
      // Draw solid brush stroke
      this.ctx.save()
      this.ctx.fillStyle = this.properties.brushColor
      this.ctx.beginPath()
      this.ctx.arc(x, y, brushSize * 0.3, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.restore()
    }
  }

  stopDrawing() {
    if (this.isDrawing && this.currentStroke.length > 0) {
      this.strokes.push({
        points: [...this.currentStroke],
        color: this.properties.brushColor,
        timestamp: Date.now()
      })
      
      // Limit number of strokes
      if (this.strokes.length > this.properties.maxStrokes) {
        this.strokes.shift()
      }
    }
    
    this.isDrawing = false
    this.currentStroke = []
  }

  addParticles(x, y) {
    for (let i = 0; i < this.properties.particleCount; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.02,
        size: 2 + Math.random() * 4,
        color: this.properties.brushColor
      })
    }
    
    // Limit particle count
    if (this.particles.length > 1000) {
      this.particles.splice(0, this.particles.length - 1000)
    }
  }

  startAnimation() {
    this.animationId = requestAnimationFrame(() => this.animate())
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate())
    
    // Update audio state
    this.updateAudioState()
    
    // Apply fade effect
    this.applyFadeEffect()
    
    // Update and draw particles
    this.updateParticles()
    
    // Draw face graphics
    this.drawFaceGraphics()
  }

  updateAudioState() {
    if (App.advancedAudioManager) {
      const audioData = App.advancedAudioManager.getFrequencyData()
      this.audioState.bassLevel = audioData.smoothed.bass
      this.audioState.midLevel = audioData.smoothed.mid
      this.audioState.trebleLevel = audioData.smoothed.treble
      this.audioState.overallLevel = audioData.smoothed.overall
    }
  }

  applyFadeEffect() {
    if (this.properties.fadeSpeed > 0) {
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'destination-out'
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.properties.fadeSpeed})`
      this.ctx.fillRect(0, 0, this.width, this.height)
      this.ctx.restore()
    }
  }

  updateParticles() {
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'screen'
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]
      
      // Update particle
      particle.x += particle.vx
      particle.y += particle.vy
      particle.life -= particle.decay
      particle.vx *= 0.98
      particle.vy *= 0.98
      
      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      
      // Draw particle
      this.ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16).padStart(2, '0')
      this.ctx.beginPath()
      this.ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2)
      this.ctx.fill()
    }
    
    this.ctx.restore()
  }

  drawFaceGraphics() {
    if (!this.properties.audioReactive) return
    
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'multiply'
    
    this.faceGraphics.forEach((face, index) => {
      const audioOffset = this.audioState.overallLevel * 50
      const x = face.x + Math.sin(face.rotation) * audioOffset
      const y = face.y
      const size = face.size * (0.8 + this.audioState.bassLevel * 0.4)
      
      // Update rotation
      face.rotation += 0.03 + this.audioState.midLevel * 0.02
      
      // Draw face profile
      this.ctx.save()
      this.ctx.translate(x, y)
      this.ctx.scale(size / this.width, size / this.width)
      this.ctx.strokeStyle = this.properties.brushColor + Math.floor(face.alpha * 255).toString(16).padStart(2, '0')
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      
      face.profile.forEach((point, i) => {
        if (i === 0) {
          this.ctx.moveTo(point.x - this.midX, point.y - this.midY)
        } else {
          this.ctx.lineTo(point.x - this.midX, point.y - this.midY)
        }
      })
      
      this.ctx.stroke()
      this.ctx.restore()
    })
    
    this.ctx.restore()
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.strokes = []
    this.particles = []
    console.log('Canvas cleared')
  }

  resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    
    if (this.canvas) {
      this.canvas.width = this.width
      this.canvas.height = this.height
    }
    
    // Update face graphics positions
    this.midX = this.width * 0.5
    this.midY = this.height * 0.5
  }

  mapValue(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1))
  }

  addGUI() {
    if (!App.gui) return

    const gui = App.gui
    const paintingFolder = gui.addFolder('FINGER PAINTING')

    paintingFolder
      .add(this.properties, 'brushSize', 2, 50)
      .name('Brush Size')

    paintingFolder
      .addColor(this.properties, 'brushColor')
      .name('Brush Color')

    paintingFolder
      .add(this.properties, 'glowIntensity', 0, 20)
      .name('Glow Intensity')

    paintingFolder
      .add(this.properties, 'fadeSpeed', 0, 0.1)
      .name('Fade Speed')

    paintingFolder
      .add(this.properties, 'audioReactive')
      .name('Audio Reactive')

    paintingFolder
      .add(this.properties, 'particleCount', 5, 50)
      .name('Particle Count')

    const clearButton = {
      clear: () => this.clearCanvas()
    }
    paintingFolder.add(clearButton, 'clear').name('Clear Canvas')
  }

  destroy() {
    console.log('Destroying finger painting visualizer')
    
    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
      this.canvas = null
      this.ctx = null
    }
    
    // Clean up arrays
    this.strokes = []
    this.particles = []
    this.faceGraphics = []
    
    // Remove from parent
    if (this.parent) {
      this.parent.remove(this)
    }
  }
}