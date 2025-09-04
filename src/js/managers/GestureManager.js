import { Hands } from '@mediapipe/hands'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS, POSE_CONNECTIONS } from '@mediapipe/hands'

export default class GestureManager {
  constructor() {
    this.isEnabled = false
    this.hands = null
    this.pose = null
    this.camera = null
    this.videoElement = null
    this.canvasElement = null
    this.canvasCtx = null
    
    // Gesture state tracking
    this.gestureState = {
      isPinching: false,
      isSwipeActive: false,
      lastHandPosition: null,
      swipeDirection: null,
      poseDetected: false,
      bodyLean: 0,
      // Media control gesture states
      isPlayGesture: false,
      isStopGesture: false,
      lastGestureTime: 0,
      gestureConfidence: 0,
      gestureCooldown: false
    }
    
    // Gesture callbacks
    this.callbacks = {
      onPinch: null,
      onSwipe: null,
      onBodyLean: null,
      onGestureStart: null,
      onGestureEnd: null,
      // Media control callbacks
      onPlay: null,
      onStop: null,
      onColorChange: null
    }
    
    // Smoothing for gesture values
    this.smoothingFactor = 0.8
    this.smoothedValues = {
      pinchStrength: 0,
      swipeVelocity: 0,
      bodyLean: 0
    }
    
    // Gesture recognition thresholds and settings
    this.gestureThresholds = {
      playConfidence: 0.7,
      stopConfidence: 0.8,
      swipeVelocity: 0.08,
      cooldownDuration: 1000, // 1 second cooldown
      confirmationDelay: 300   // 300ms confirmation for critical actions
    }
    
    // Color themes for swipe functionality
    this.colorThemes = [
      { name: 'Neon', startColor: 0xff00ff, endColor: 0x00ffff },
      { name: 'Fire', startColor: 0xff4500, endColor: 0xffd700 },
      { name: 'Ocean', startColor: 0x0066cc, endColor: 0x00ffcc },
      { name: 'Forest', startColor: 0x228b22, endColor: 0x90ee90 },
      { name: 'Sunset', startColor: 0xff6347, endColor: 0xff1493 },
      { name: 'Aurora', startColor: 0x9400d3, endColor: 0x00ff7f }
    ]
    this.currentThemeIndex = 0
    
    // Visual feedback state
    this.feedbackState = {
      activeGesture: null,
      feedbackTimeout: null,
      isTransitioning: false
    }
  }

  async init() {
    try {
      this.createGestureInterface()
      await this.setupMediaPipe()
      await this.setupCamera()
      this.setupGestureDetection()
      console.log('Gesture controls initialized successfully')
    } catch (error) {
      console.error('Failed to initialize gesture controls:', error)
      this.showError('Camera access required for gesture controls')
    }
  }

  createGestureInterface() {
    const gestureContainer = document.createElement('div')
    gestureContainer.className = 'gesture-container'
    gestureContainer.innerHTML = `
      <div class="gesture-controls">
        <button class="gesture-toggle" id="gestureToggle">
          <svg class="gesture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"></path>
            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
          </svg>
          Enable Gestures
        </button>
        <div class="gesture-status" style="display: none;">
          <div class="status-indicator"></div>
          <span class="status-text">Gestures Active</span>
        </div>
        <div class="gesture-feedback" style="display: none;">
          <div class="feedback-icon"></div>
          <span class="feedback-text"></span>
        </div>
      </div>
      <div class="gesture-preview" style="display: none;">
        <video class="gesture-video" autoplay muted playsinline></video>
        <canvas class="gesture-canvas"></canvas>
        <div class="gesture-overlay">
          <div class="confidence-meter">
            <div class="confidence-bar"></div>
          </div>
        </div>
      </div>
      <div class="gesture-help" style="display: none;">
        <h3>Gesture Controls</h3>
        <ul>
          <li><strong>👍 Thumbs Up:</strong> Play/Resume music</li>
          <li><strong>✋ Open Palm:</strong> Stop music (hold for 0.3s)</li>
          <li><strong>👈👉 Swipe:</strong> Change color themes</li>
          <li><strong>🤏 Pinch:</strong> Zoom particles</li>
          <li><strong>🫴 Reset:</strong> All fingers extended</li>
        </ul>
        <div class="current-theme">
          <span>Current Theme: <strong id="currentThemeName">Neon</strong></span>
        </div>
      </div>
    `
    
    document.querySelector('.frame').appendChild(gestureContainer)
    
    // Setup toggle button
    document.getElementById('gestureToggle').addEventListener('click', () => {
      this.toggleGestures()
    })
  }

  async setupMediaPipe() {
    // Initialize MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      }
    })
    
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    
    this.hands.onResults((results) => this.onHandResults(results))
    
    // Initialize MediaPipe Pose
    this.pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      }
    })
    
    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    
    this.pose.onResults((results) => this.onPoseResults(results))
  }

  async setupCamera() {
    this.videoElement = document.querySelector('.gesture-video')
    this.canvasElement = document.querySelector('.gesture-canvas')
    this.canvasCtx = this.canvasElement.getContext('2d')
    
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        if (this.isEnabled) {
          await this.hands.send({ image: this.videoElement })
          await this.pose.send({ image: this.videoElement })
        }
      },
      width: 320,
      height: 240
    })
  }

  setupGestureDetection() {
    // Setup gesture recognition patterns
    this.gesturePatterns = {
      pinch: this.detectPinch.bind(this),
      swipe: this.detectSwipe.bind(this),
      openPalm: this.detectOpenPalm.bind(this)
    }
  }

  async toggleGestures() {
    const toggleButton = document.getElementById('gestureToggle')
    const statusEl = document.querySelector('.gesture-status')
    const previewEl = document.querySelector('.gesture-preview')
    const helpEl = document.querySelector('.gesture-help')
    
    if (!this.isEnabled) {
      try {
        await this.camera.start()
        this.isEnabled = true
        
        toggleButton.innerHTML = `
          <svg class="gesture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="15"></line>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
          Disable Gestures
        `
        
        statusEl.style.display = 'flex'
        previewEl.style.display = 'block'
        helpEl.style.display = 'block'
        
        if (this.callbacks.onGestureStart) {
          this.callbacks.onGestureStart()
        }
      } catch (error) {
        console.error('Failed to start camera:', error)
        this.showError('Camera access denied. Please allow camera permissions.')
      }
    } else {
      this.camera.stop()
      this.isEnabled = false
      
      toggleButton.innerHTML = `
        <svg class="gesture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4"></path>
          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
          <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
        </svg>
        Enable Gestures
      `
      
      statusEl.style.display = 'none'
      previewEl.style.display = 'none'
      helpEl.style.display = 'none'
      
      if (this.callbacks.onGestureEnd) {
        this.callbacks.onGestureEnd()
      }
    }
  }

  onHandResults(results) {
    if (!this.isEnabled) return
    
    this.canvasCtx.save()
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height)
    
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(this.canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 })
        drawLandmarks(this.canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 })
        
        // Process gestures
        this.processHandGestures(landmarks)
      }
    }
    
    this.canvasCtx.restore()
  }

  onPoseResults(results) {
    if (!this.isEnabled || !results.poseLandmarks) return
    
    // Process body gestures
    this.processBodyGestures(results.poseLandmarks)
  }

  processHandGestures(landmarks) {
    // Detect pinch gesture
    const pinchStrength = this.detectPinch(landmarks)
    if (pinchStrength > 0.3) {
      if (!this.gestureState.isPinching) {
        this.gestureState.isPinching = true
      }
      this.smoothedValues.pinchStrength = this.smoothValue(this.smoothedValues.pinchStrength, pinchStrength)
      
      if (this.callbacks.onPinch) {
        this.callbacks.onPinch(this.smoothedValues.pinchStrength)
      }
    } else {
      this.gestureState.isPinching = false
    }

    // Detect swipe gesture
    const swipeData = this.detectSwipe(landmarks)
    if (swipeData.isSwipe && !this.gestureState.isSwipeActive) {
      this.gestureState.isSwipeActive = true
      this.gestureState.swipeDirection = swipeData.direction
      
      if (this.callbacks.onSwipe) {
        this.callbacks.onSwipe(swipeData.direction, swipeData.velocity)
      }
      
      // Reset swipe state after a delay
      setTimeout(() => {
        this.gestureState.isSwipeActive = false
      }, 500)
    }

    // Detect open palm (reset gesture)
    if (this.detectOpenPalm(landmarks)) {
      if (this.callbacks.onReset) {
        this.callbacks.onReset()
      }
    }
  }

  processBodyGestures(landmarks) {
    // Calculate body lean based on shoulder positions
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]
    
    if (leftShoulder && rightShoulder) {
      const shoulderAngle = Math.atan2(
        rightShoulder.y - leftShoulder.y,
        rightShoulder.x - leftShoulder.x
      )
      
      const bodyLean = Math.sin(shoulderAngle) * 2 // Amplify the lean effect
      this.smoothedValues.bodyLean = this.smoothValue(this.smoothedValues.bodyLean, bodyLean)
      
      if (this.callbacks.onBodyLean) {
        this.callbacks.onBodyLean(this.smoothedValues.bodyLean)
      }
    }
  }

  detectPinch(landmarks) {
    // Calculate distance between thumb tip and index finger tip
    const thumbTip = landmarks[4]
    const indexTip = landmarks[8]
    
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    )
    
    // Convert distance to pinch strength (inverted - smaller distance = stronger pinch)
    return Math.max(0, 1 - (distance * 10))
  }

  detectSwipe(landmarks) {
    const indexTip = landmarks[8]
    const currentPosition = { x: indexTip.x, y: indexTip.y }
    
    if (this.gestureState.lastHandPosition) {
      const deltaX = currentPosition.x - this.gestureState.lastHandPosition.x
      const deltaY = currentPosition.y - this.gestureState.lastHandPosition.y
      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      
      if (velocity > 0.05) { // Threshold for swipe detection
        let direction = 'none'
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left'
        } else {
          direction = deltaY > 0 ? 'down' : 'up'
        }
        
        this.gestureState.lastHandPosition = currentPosition
        return { isSwipe: true, direction, velocity }
      }
    }
    
    this.gestureState.lastHandPosition = currentPosition
    return { isSwipe: false, direction: 'none', velocity: 0 }
  }

  detectOpenPalm(landmarks) {
    // Check if all fingers are extended (open palm)
    const fingerTips = [4, 8, 12, 16, 20] // Thumb, Index, Middle, Ring, Pinky tips
    const fingerMCPs = [2, 5, 9, 13, 17] // Corresponding MCP joints
    
    let extendedFingers = 0
    
    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]]
      const mcp = landmarks[fingerMCPs[i]]
      
      // For thumb, check x-axis; for others, check y-axis
      if (i === 0) {
        if (Math.abs(tip.x - mcp.x) > 0.05) extendedFingers++
      } else {
        if (tip.y < mcp.y - 0.02) extendedFingers++
      }
    }
    
    return extendedFingers >= 4 // At least 4 fingers extended
  }

  smoothValue(current, target) {
    return current * this.smoothingFactor + target * (1 - this.smoothingFactor)
  }

  // Callback registration methods
  onPinch(callback) {
    this.callbacks.onPinch = callback
  }

  onSwipe(callback) {
    this.callbacks.onSwipe = callback
  }

  onBodyLean(callback) {
    this.callbacks.onBodyLean = callback
  }

  onReset(callback) {
    this.callbacks.onReset = callback
  }

  onGestureStart(callback) {
    this.callbacks.onGestureStart = callback
  }

  onGestureEnd(callback) {
    this.callbacks.onGestureEnd = callback
  }
  
  // Media control callback registration
  onPlay(callback) {
    this.callbacks.onPlay = callback
  }
  
  onStop(callback) {
    this.callbacks.onStop = callback
  }
  
  onColorChange(callback) {
    this.callbacks.onColorChange = callback
  }

  showError(message) {
    const errorEl = document.createElement('div')
    errorEl.className = 'gesture-error'
    errorEl.textContent = message
    document.querySelector('.gesture-container').appendChild(errorEl)
    
    setTimeout(() => {
      errorEl.remove()
    }, 5000)
  }

  destroy() {
    if (this.camera) {
      this.camera.stop()
    }
    if (this.hands) {
      this.hands.close()
    }
    if (this.pose) {
      this.pose.close()
    }
  }
}