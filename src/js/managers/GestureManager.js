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
    
    // Webcam display mode
    this.webcamMode = 'small' // 'hidden', 'small', 'background', 'bottom-left'
    
    // Gesture state tracking
    this.gestureState = {
      isPinching: false,
      isSwipeActive: false,
      lastHandPosition: null,
      swipeDirection: null,
      poseDetected: false,
      bodyLean: 0,
      isFollowing: false,
      followPosition: { x: 0, y: 0 },
      smoothedFollowPosition: { x: 0, y: 0 },
      // Enhanced gesture states
      isPainting: false,
      paintingConfidence: 0,
      gestureHistory: [],
      handVelocity: { x: 0, y: 0 },
      smoothedVelocity: { x: 0, y: 0 },
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
      onFollow: null,
      onPaint: null,
      onBrushSize: null,
      onColorPalette: null,
      onReset: null,
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
      bodyLean: 0,
      paintingPressure: 0,
      brushSize: 0.5
    }
    
    // Gesture recognition thresholds and settings
    this.gestureThresholds = {
      playConfidence: 0.7,
      stopConfidence: 0.8,
      swipeVelocity: 0.05,
      cooldownDuration: 1000, // 1 second cooldown
      confirmationDelay: 300,   // 300ms confirmation for critical actions
      followSmoothingFactor: 0.7,
      paintingThreshold: 0.8,
      velocityThreshold: 0.02,
      pressureThreshold: 0.3
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
    
    // Gesture recording state
    this.isRecording = false
    this.recordedFrames = []
    this.recordStartTime = 0
    this.recordingTimer = null
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
          <li><strong>👆 Follow:</strong> Control particle position</li>
          <li><strong>🤏 Pinch:</strong> Zoom particles</li>
          <li><strong>🫴 Reset:</strong> All fingers extended</li>
        </ul>
        <div class="current-theme">
          <span>Current Theme: <strong id="currentThemeName">Neon</strong></span>
        </div>
      </div>
    `
    
    document.querySelector('.frame').appendChild(gestureContainer)
    
    // Create webcam controls
    this.createWebcamControls()
    
    // Setup toggle button
    document.getElementById('gestureToggle').addEventListener('click', () => {
      this.toggleGestures()
    })
    
    // Setup record button
    document.getElementById('gestureRecord').addEventListener('click', () => {
      this.toggleRecording()
    })
  }

  createWebcamControls() {
    const webcamControls = document.createElement('div')
    webcamControls.className = 'webcam-controls'
    webcamControls.innerHTML = `
      <h3>Webcam Display</h3>
      <div class="webcam-mode-options">
        <div class="webcam-mode-option" data-mode="hidden">
          Hidden
        </div>
        <div class="webcam-mode-option active" data-mode="small">
          Small Size
        </div>
        <div class="webcam-mode-option" data-mode="background">
          Background
        </div>
        <div class="webcam-mode-option" data-mode="bottom-left">
          Bottom Left Corner
        </div>
      </div>
    `
    
    document.querySelector('.frame').appendChild(webcamControls)
    
    // Setup webcam mode selection
    const modeOptions = webcamControls.querySelectorAll('.webcam-mode-option')
    modeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const mode = option.getAttribute('data-mode')
        this.setWebcamMode(mode)
        
        // Update active state
        modeOptions.forEach(opt => opt.classList.remove('active'))
        option.classList.add('active')
      })
    })
  }

  setWebcamMode(mode) {
    this.webcamMode = mode
    
    const videoElement = document.querySelector('.gesture-video')
    const canvasElement = document.querySelector('.gesture-canvas')
    const previewElement = document.querySelector('.gesture-preview')
    
    if (!videoElement || !canvasElement || !previewElement) {
      return
    }
    
    // Remove all existing mode classes
    const modes = ['webcam-hidden', 'webcam-small', 'webcam-background', 'webcam-bottom-left']
    modes.forEach(modeClass => {
      videoElement.classList.remove(modeClass)
      canvasElement.classList.remove(modeClass)
      previewElement.classList.remove(modeClass)
    })
    
    // Apply new mode class
    const modeClass = `webcam-${mode}`
    videoElement.classList.add(modeClass)
    canvasElement.classList.add(modeClass)
    previewElement.classList.add(modeClass)
    
    // Update canvas size for drawing
    if (mode === 'background') {
      canvasElement.width = window.innerWidth
      canvasElement.height = window.innerHeight
    } else if (mode === 'bottom-left') {
      canvasElement.width = 200
      canvasElement.height = 150
    } else if (mode === 'small') {
      canvasElement.width = 160
      canvasElement.height = 120
    } else {
      canvasElement.width = 320
      canvasElement.height = 240
    }
    
    console.log(`Webcam mode changed to: ${mode}`)
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
        
        // Show record button when gestures are enabled
        const recordButton = document.getElementById('gestureRecord')
        recordButton.style.display = 'flex'
        
        // Apply current webcam mode
        this.setWebcamMode(this.webcamMode)
        
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
      
      // Hide record button and stop recording if active
      const recordButton = document.getElementById('gestureRecord')
      recordButton.style.display = 'none'
      
      if (this.isRecording) {
        this.stopRecording()
      }
      
      if (this.callbacks.onGestureEnd) {
        this.callbacks.onGestureEnd()
      }
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording()
    } else {
      this.startRecording()
    }
  }

  startRecording() {
    if (!this.isEnabled) {
      this.showError('Please enable gestures first before recording')
      return
    }

    this.isRecording = true
    this.recordedFrames = []
    this.recordStartTime = Date.now()
    
    // Update UI
    const recordButton = document.getElementById('gestureRecord')
    const recordingStatus = document.querySelector('.recording-status')
    const recordingTimer = document.querySelector('.recording-timer')
    
    recordButton.classList.add('recording')
    recordButton.innerHTML = `
      <svg class="gesture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
      Stop Recording
    `
    
    recordingStatus.style.display = 'flex'
    
    // Start timer
    this.recordingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordStartTime) / 1000)
      recordingTimer.textContent = `${elapsed}s`
    }, 100)
    
    console.log('Started gesture recording')
  }

  stopRecording() {
    if (!this.isRecording) return
    
    this.isRecording = false
    
    // Clear timer
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer)
      this.recordingTimer = null
    }
    
    // Update UI
    const recordButton = document.getElementById('gestureRecord')
    const recordingStatus = document.querySelector('.recording-status')
    
    recordButton.classList.remove('recording')
    recordButton.innerHTML = `
      <svg class="gesture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6"></path>
        <path d="m15.5 3.5-3.5 3.5-3.5-3.5"></path>
        <path d="m8.5 20.5 3.5-3.5 3.5 3.5"></path>
      </svg>
      Record Gesture
    `
    
    recordingStatus.style.display = 'none'
    
    // Download recorded data
    this.downloadRecordedData()
    
    console.log(`Stopped gesture recording. Captured ${this.recordedFrames.length} frames`)
  }

  downloadRecordedData() {
    if (this.recordedFrames.length === 0) {
      console.warn('No frames recorded')
      return
    }
    
    const recordingData = {
      metadata: {
        recordingStartTime: this.recordStartTime,
        recordingEndTime: Date.now(),
        totalFrames: this.recordedFrames.length,
        duration: Date.now() - this.recordStartTime,
        averageFPS: this.recordedFrames.length / ((Date.now() - this.recordStartTime) / 1000)
      },
      frames: this.recordedFrames
    }
    
    // Create downloadable JSON file
    const dataStr = JSON.stringify(recordingData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    // Create download link
    const link = document.createElement('a')
    link.href = url
    link.download = `gesture-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up
    URL.revokeObjectURL(url)
    
    // Show success feedback
    this.showGestureFeedback('record', `Recorded ${this.recordedFrames.length} frames`)
    
    console.log('Downloaded gesture recording data:', recordingData.metadata)
  }
  onHandResults(results) {
    if (!this.isEnabled) return
    
    // Record frame data if recording is active
    if (this.isRecording) {
      this.recordFrame('hand', results)
    }
    
    this.canvasCtx.save()
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height)
    
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(this.canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 })
        drawLandmarks(this.canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 })
        
        // Process gestures
        this.processHandGestures(landmarks)
        
        // Process follow gesture
        this.processFollowGesture(landmarks)
      }
    }
    
    this.canvasCtx.restore()
  }

  onPoseResults(results) {
    if (!this.isEnabled || !results.poseLandmarks) return
    
    // Record frame data if recording is active
    if (this.isRecording) {
      this.recordFrame('pose', results)
    }
    
    // Process body gestures
    this.processBodyGestures(results.poseLandmarks)
  }

  recordFrame(type, results) {
    const frameData = {
      timestamp: Date.now(),
      relativeTime: Date.now() - this.recordStartTime,
      type: type,
      data: {}
    }
    
    if (type === 'hand') {
      frameData.data = {
        multiHandLandmarks: results.multiHandLandmarks || [],
        multiHandedness: results.multiHandedness || [],
        handCount: results.multiHandLandmarks ? results.multiHandLandmarks.length : 0
      }
    } else if (type === 'pose') {
      frameData.data = {
        poseLandmarks: results.poseLandmarks || [],
        poseWorldLandmarks: results.poseWorldLandmarks || []
      }
    }
    
    this.recordedFrames.push(frameData)
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
      
      // Enhanced brush size control
      if (this.callbacks.onBrushSize) {
        this.callbacks.onBrushSize(this.smoothedValues.pinchStrength)
      }
    } else {
      this.gestureState.isPinching = false
    }

    // Enhanced painting gesture detection
    const paintingData = this.detectPaintingGesture(landmarks)
    if (paintingData.isPainting) {
      this.gestureState.isPainting = true
      this.gestureState.paintingConfidence = paintingData.confidence
      
      if (this.callbacks.onPaint) {
        this.callbacks.onPaint(paintingData.position.x, paintingData.position.y, paintingData.pressure)
      }
    } else {
      this.gestureState.isPainting = false
    }

    // Detect swipe gesture
    const swipeData = this.detectSwipe(landmarks)
    if (swipeData.isSwipe && !this.gestureState.isSwipeActive && !this.gestureState.isFollowing) {
      this.gestureState.isSwipeActive = true
      this.gestureState.swipeDirection = swipeData.direction
      
      if (this.callbacks.onSwipe) {
        this.callbacks.onSwipe(swipeData.direction, swipeData.velocity)
      }
      
      // Enhanced color palette switching
      if (this.callbacks.onColorPalette) {
        this.callbacks.onColorPalette(swipeData.direction)
      }
      
      this.showGestureFeedback('swipe', `Swipe ${swipeData.direction}`)
      
      // Reset swipe state after a delay
      setTimeout(() => {
        this.gestureState.isSwipeActive = false
      }, 800)
    }

    // Detect open palm (reset gesture)
    if (this.detectOpenPalm(landmarks)) {
      if (this.callbacks.onReset) {
        this.callbacks.onReset()
      }
    }
  }

  processFollowGesture(landmarks) {
    // Use index finger tip for following
    const indexTip = landmarks[8]
    
    if (indexTip) {
      // Convert MediaPipe coordinates (0-1) to normalized screen coordinates (-1 to 1)
      const normalizedX = (indexTip.x - 0.5) * 2
      const normalizedY = (0.5 - indexTip.y) * 2 // Flip Y axis
      
      // Calculate velocity for enhanced interaction
      const deltaX = normalizedX - this.gestureState.followPosition.x
      const deltaY = normalizedY - this.gestureState.followPosition.y
      
      this.gestureState.handVelocity.x = deltaX
      this.gestureState.handVelocity.y = deltaY
      
      // Smooth velocity
      this.gestureState.smoothedVelocity.x = this.smoothValue(
        this.gestureState.smoothedVelocity.x, 
        this.gestureState.handVelocity.x
      )
      this.gestureState.smoothedVelocity.y = this.smoothValue(
        this.gestureState.smoothedVelocity.y, 
        this.gestureState.handVelocity.y
      )
      
      // Update follow position
      this.gestureState.followPosition.x = normalizedX
      this.gestureState.followPosition.y = normalizedY
      
      // Apply smoothing to reduce jitter
      const smoothing = this.gestureThresholds.followSmoothingFactor
      this.gestureState.smoothedFollowPosition.x = 
        this.gestureState.smoothedFollowPosition.x * smoothing + normalizedX * (1 - smoothing)
      this.gestureState.smoothedFollowPosition.y = 
        this.gestureState.smoothedFollowPosition.y * smoothing + normalizedY * (1 - smoothing)
      
      // Check if we should start following (index finger extended)
      const isIndexExtended = this.isFingerExtended(landmarks, 8) // Index finger
      const isMiddleExtended = this.isFingerExtended(landmarks, 12) // Middle finger
      const isRingExtended = this.isFingerExtended(landmarks, 16) // Ring finger
      const isPinkyExtended = this.isFingerExtended(landmarks, 20) // Pinky finger
      
      // Follow gesture: only index finger extended
      const shouldFollow = isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended
      
      if (shouldFollow && !this.gestureState.isFollowing) {
        this.gestureState.isFollowing = true
        this.showGestureFeedback('follow', 'Following finger')
      } else if (!shouldFollow && this.gestureState.isFollowing) {
        this.gestureState.isFollowing = false
        this.hideGestureFeedback()
      }
      
      // Send follow data to callbacks
      if (this.gestureState.isFollowing && this.callbacks.onFollow) {
        this.callbacks.onFollow(
          this.gestureState.smoothedFollowPosition.x,
          this.gestureState.smoothedFollowPosition.y,
          this.gestureState.isFollowing
        )
      }
    }
  }

  detectPaintingGesture(landmarks) {
    // Enhanced painting detection using index finger
    const indexTip = landmarks[8]
    const indexMcp = landmarks[5]
    const thumbTip = landmarks[4]
    
    if (!indexTip || !indexMcp || !thumbTip) {
      return { isPainting: false, confidence: 0, position: { x: 0, y: 0 }, pressure: 0 }
    }
    
    // Check if index finger is extended and prominent
    const isIndexExtended = this.isFingerExtended(landmarks, 8)
    const isMiddleExtended = this.isFingerExtended(landmarks, 12)
    const isRingExtended = this.isFingerExtended(landmarks, 16)
    const isPinkyExtended = this.isFingerExtended(landmarks, 20)
    
    // Painting gesture: index finger extended, others curled
    const isPaintingPose = isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended
    
    // Calculate confidence based on finger positions
    let confidence = 0
    if (isPaintingPose) {
      confidence = 0.8
      
      // Increase confidence if thumb is also extended (pointing gesture)
      const isThumbExtended = this.isFingerExtended(landmarks, 4)
      if (!isThumbExtended) {
        confidence += 0.2
      }
    }
    
    // Calculate pressure based on hand stability and velocity
    const velocity = Math.sqrt(
      this.gestureState.smoothedVelocity.x ** 2 + 
      this.gestureState.smoothedVelocity.y ** 2
    )
    
    const pressure = Math.max(0.1, Math.min(1.0, 1.0 - velocity * 10))
    
    // Convert to normalized coordinates
    const normalizedX = (indexTip.x - 0.5) * 2
    const normalizedY = (0.5 - indexTip.y) * 2
    
    return {
      isPainting: confidence > this.gestureThresholds.paintingThreshold,
      confidence: confidence,
      position: { x: normalizedX, y: normalizedY },
      pressure: pressure
    }
  }

  isFingerExtended(landmarks, tipIndex) {
    // Get the tip and pip (proximal interphalangeal) joint indices
    let pipIndex
    switch (tipIndex) {
      case 4: pipIndex = 3; break  // Thumb
      case 8: pipIndex = 6; break  // Index
      case 12: pipIndex = 10; break // Middle
      case 16: pipIndex = 14; break // Ring
      case 20: pipIndex = 18; break // Pinky
      default: return false
    }
    
    const tip = landmarks[tipIndex]
    const pip = landmarks[pipIndex]
    
    // For thumb, check x-axis; for others, check y-axis
    if (tipIndex === 4) {
      return Math.abs(tip.x - pip.x) > 0.04
    } else {
      return tip.y < pip.y - 0.02
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
      
      if (velocity > this.gestureThresholds.swipeVelocity) {
        let direction = 'none'
        
        // Require more horizontal movement for left/right swipes
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          direction = deltaX > 0 ? 'right' : 'left'
        } else if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
          direction = deltaY > 0 ? 'down' : 'up'
        }
        
        if (direction !== 'none') {
          this.gestureState.lastHandPosition = currentPosition
          return { isSwipe: true, direction, velocity }
        }
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

  onFollow(callback) {
    this.callbacks.onFollow = callback
  }

  onPaint(callback) {
    this.callbacks.onPaint = callback
  }

  onBrushSize(callback) {
    this.callbacks.onBrushSize = callback
  }

  onColorPalette(callback) {
    this.callbacks.onColorPalette = callback
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

  showGestureFeedback(type, message) {
    const feedbackEl = document.querySelector('.gesture-feedback')
    const feedbackText = document.querySelector('.feedback-text')
    const feedbackIcon = document.querySelector('.feedback-icon')
    
    if (feedbackEl && feedbackText && feedbackIcon) {
      feedbackEl.className = `gesture-feedback gesture-feedback--${type}`
      feedbackText.textContent = message
      feedbackEl.style.display = 'flex'
      
      // Auto-hide after 2 seconds for non-persistent gestures
      if (type !== 'follow') {
        setTimeout(() => {
          this.hideGestureFeedback()
        }, 2000)
      }
    }
  }

  hideGestureFeedback() {
    const feedbackEl = document.querySelector('.gesture-feedback')
    if (feedbackEl) {
      feedbackEl.style.display = 'none'
    }
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