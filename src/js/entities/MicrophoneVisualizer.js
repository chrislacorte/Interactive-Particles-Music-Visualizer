import * as THREE from 'three'
import gsap from 'gsap'
import App from '../App'

export default class MicrophoneVisualizer extends THREE.Object3D {
  constructor() {
    super()
    this.name = 'MicrophoneVisualizer'
    
    // Canvas and drawing properties
    this.canvas = null
    this.ctx = null
    this.width = 0
    this.height = 0
    
    // Audio properties
    this.audioContext = null
    this.analyser = null
    this.microphone = null
    this.dataArray = null
    this.waveformArray = null
    this.bufferLength = 0
    this.stream = null
    
    // Animation properties
    this.animationId = null
    this.isActive = false
    
    // Visual properties
    this.properties = {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -90,
      maxDecibels: -10,
      waveformColor: '#00ffff',
      frequencyColor: '#ff00ff',
      backgroundColor: '#000000',
      lineWidth: 2,
      barWidth: 3,
      sensitivity: 1.0
    }
    
    // Drawing state
    this.drawingState = {
      waveformPoints: [],
      frequencyBars: [],
      time: 0
    }
  }

  async init() {
    try {
      this.createCanvas()
      await this.setupAudio()
      this.setupEventListeners()
      this.startVisualization()
      this.addGUI()
      console.log('Microphone visualizer initialized successfully')
    } catch (error) {
      console.error('Failed to initialize microphone visualizer:', error)
      this.showError('Microphone access denied or not available')
    }
  }

  createCanvas() {
    // Create canvas element
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'microphone-canvas'
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      background: ${this.properties.backgroundColor};
    `
    
    // Get 2D context
    this.ctx = this.canvas.getContext('2d')
    
    // Set initial size
    this.resize()
    
    // Add to DOM
    document.querySelector('.content').appendChild(this.canvas)
  }

  async setupAudio() {
    // Request microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })

    // Create audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Create analyser node
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.properties.fftSize
    this.analyser.smoothingTimeConstant = this.properties.smoothingTimeConstant
    this.analyser.minDecibels = this.properties.minDecibels
    this.analyser.maxDecibels = this.properties.maxDecibels
    
    // Connect microphone to analyser
    this.microphone = this.audioContext.createMediaStreamSource(this.stream)
    this.microphone.connect(this.analyser)
    
    // Setup data arrays
    this.bufferLength = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(this.bufferLength)
    this.waveformArray = new Uint8Array(this.bufferLength)
    
    console.log('Audio setup complete, buffer length:', this.bufferLength)
  }

  setupEventListeners() {
    // Handle window resize
    this.resizeHandler = () => this.resize()
    window.addEventListener('resize', this.resizeHandler)
    
    // Handle visibility change
    this.visibilityHandler = () => {
      if (document.hidden && this.audioContext?.state === 'running') {
        this.audioContext.suspend()
      } else if (!document.hidden && this.audioContext?.state === 'suspended') {
        this.audioContext.resume()
      }
    }
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  startVisualization() {
    this.isActive = true
    this.draw()
  }

  draw() {
    if (!this.isActive) return
    
    this.animationId = requestAnimationFrame(() => this.draw())
    
    // Get audio data
    this.analyser.getByteFrequencyData(this.dataArray)
    this.analyser.getByteTimeDomainData(this.waveformArray)
    
    // Clear canvas
    this.ctx.fillStyle = this.properties.backgroundColor
    this.ctx.fillRect(0, 0, this.width, this.height)
    
    // Update time
    this.drawingState.time += 0.016
    
    // Draw visualizations
    this.drawWaveform()
    this.drawFrequencyBars()
    this.drawCircularVisualization()
  }

  drawWaveform() {
    const centerY = this.height / 2
    const amplitude = 100 * this.properties.sensitivity
    
    this.ctx.lineWidth = this.properties.lineWidth
    this.ctx.strokeStyle = this.properties.waveformColor
    this.ctx.beginPath()
    
    let x = 0
    const sliceWidth = this.width / this.bufferLength
    
    for (let i = 0; i < this.bufferLength; i++) {
      const v = this.waveformArray[i] / 128.0
      const y = centerY + (v - 1) * amplitude
      
      if (i === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
      
      x += sliceWidth
    }
    
    this.ctx.stroke()
  }

  drawFrequencyBars() {
    const barWidth = this.properties.barWidth
    const barSpacing = 1
    const maxBarHeight = this.height * 0.3
    const startY = this.height - 50
    
    this.ctx.fillStyle = this.properties.frequencyColor
    
    for (let i = 0; i < this.bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * maxBarHeight * this.properties.sensitivity
      const x = i * (barWidth + barSpacing)
      
      if (x > this.width) break
      
      // Create gradient for bars
      const gradient = this.ctx.createLinearGradient(0, startY, 0, startY - barHeight)
      gradient.addColorStop(0, this.properties.frequencyColor)
      gradient.addColorStop(1, this.properties.waveformColor)
      
      this.ctx.fillStyle = gradient
      this.ctx.fillRect(x, startY - barHeight, barWidth, barHeight)
    }
  }

  drawCircularVisualization() {
    const centerX = this.width / 2
    const centerY = this.height / 2
    const radius = Math.min(this.width, this.height) * 0.15
    const maxRadius = radius * 2
    
    this.ctx.strokeStyle = this.properties.waveformColor
    this.ctx.lineWidth = 2
    
    // Draw multiple concentric circles based on frequency data
    const numCircles = 8
    const dataStep = Math.floor(this.bufferLength / numCircles)
    
    for (let circle = 0; circle < numCircles; circle++) {
      const dataIndex = circle * dataStep
      const amplitude = (this.dataArray[dataIndex] / 255) * this.properties.sensitivity
      const currentRadius = radius + (amplitude * (maxRadius - radius))
      
      // Create pulsing effect
      const pulseRadius = currentRadius + Math.sin(this.drawingState.time * 3 + circle) * 10
      
      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI)
      
      // Set opacity based on amplitude
      const opacity = 0.3 + amplitude * 0.7
      this.ctx.strokeStyle = this.properties.waveformColor + Math.floor(opacity * 255).toString(16).padStart(2, '0')
      
      this.ctx.stroke()
    }
    
    // Draw radial lines
    const numLines = 32
    const angleStep = (2 * Math.PI) / numLines
    
    for (let i = 0; i < numLines; i++) {
      const angle = i * angleStep
      const dataIndex = Math.floor((i / numLines) * this.bufferLength)
      const amplitude = (this.dataArray[dataIndex] / 255) * this.properties.sensitivity
      const lineLength = radius + amplitude * (maxRadius - radius)
      
      const x1 = centerX + Math.cos(angle) * radius
      const y1 = centerY + Math.sin(angle) * radius
      const x2 = centerX + Math.cos(angle) * lineLength
      const y2 = centerY + Math.sin(angle) * lineLength
      
      this.ctx.beginPath()
      this.ctx.moveTo(x1, y1)
      this.ctx.lineTo(x2, y2)
      
      // Color based on frequency
      const hue = (i / numLines) * 360
      const opacity = 0.5 + amplitude * 0.5
      this.ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${opacity})`
      this.ctx.lineWidth = 1 + amplitude * 2
      
      this.ctx.stroke()
    }
  }

  resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    
    if (this.canvas) {
      this.canvas.width = this.width
      this.canvas.height = this.height
    }
  }

  showError(message) {
    // Create error overlay
    const errorEl = document.createElement('div')
    errorEl.className = 'microphone-error'
    errorEl.innerHTML = `
      <div class="error-content">
        <h3>Microphone Access Required</h3>
        <p>${message}</p>
        <p>Please allow microphone access and refresh the page to use this visualizer.</p>
        <button onclick="location.reload()">Refresh Page</button>
      </div>
    `
    errorEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
      color: white;
      text-align: center;
    `
    
    document.querySelector('.content').appendChild(errorEl)
  }

  addGUI() {
    if (!App.gui) return

    const gui = App.gui
    const micFolder = gui.addFolder('MICROPHONE VISUALIZER')

    micFolder
      .add(this.properties, 'sensitivity', 0.1, 3.0)
      .name('Sensitivity')

    micFolder
      .add(this.properties, 'smoothingTimeConstant', 0.0, 1.0)
      .name('Smoothing')
      .onChange((value) => {
        if (this.analyser) {
          this.analyser.smoothingTimeConstant = value
        }
      })

    micFolder
      .add(this.properties, 'lineWidth', 1, 5)
      .name('Line Width')

    micFolder
      .add(this.properties, 'barWidth', 1, 10)
      .name('Bar Width')

    micFolder
      .addColor(this.properties, 'waveformColor')
      .name('Waveform Color')

    micFolder
      .addColor(this.properties, 'frequencyColor')
      .name('Frequency Color')

    micFolder
      .addColor(this.properties, 'backgroundColor')
      .name('Background Color')
      .onChange((color) => {
        if (this.canvas) {
          this.canvas.style.background = color
        }
      })

    const resetButton = {
      reset: () => {
        this.properties.sensitivity = 1.0
        this.properties.smoothingTimeConstant = 0.8
        this.properties.lineWidth = 2
        this.properties.barWidth = 3
        this.properties.waveformColor = '#00ffff'
        this.properties.frequencyColor = '#ff00ff'
        this.properties.backgroundColor = '#000000'
        
        if (this.analyser) {
          this.analyser.smoothingTimeConstant = this.properties.smoothingTimeConstant
        }
        if (this.canvas) {
          this.canvas.style.background = this.properties.backgroundColor
        }
      }
    }
    micFolder.add(resetButton, 'reset').name('Reset All')
  }

  destroy() {
    console.log('Destroying microphone visualizer')
    
    // Stop animation
    this.isActive = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    
    // Stop microphone stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop()
        console.log('Stopped microphone track')
      })
      this.stream = null
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
      console.log('Closed audio context')
    }
    
    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
      this.canvas = null
      this.ctx = null
    }
    
    // Remove error overlay if it exists
    const errorEl = document.querySelector('.microphone-error')
    if (errorEl && errorEl.parentNode) {
      errorEl.parentNode.removeChild(errorEl)
    }
    
    // Clean up references
    this.analyser = null
    this.microphone = null
    this.dataArray = null
    this.waveformArray = null
  }
}