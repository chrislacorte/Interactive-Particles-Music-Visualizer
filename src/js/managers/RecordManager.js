export default class RecordManager {
  constructor() {
    this.isRecording = false
    this.mediaRecorder = null
    this.recordedChunks = []
    this.canvasStream = null
    this.audioStream = null
    this.combinedStream = null
    this.startTime = null
    this.recordingTimer = null
    this.frameCount = 0
    this.targetFPS = 30
    this.frameInterval = 1000 / this.targetFPS
    
    // Recording settings
    this.settings = {
      videoBitsPerSecond: 8000000, // 8 Mbps for high quality
      audioBitsPerSecond: 128000,  // 128 kbps for audio
      mimeType: 'video/webm;codecs=vp9,opus', // Fallback to vp8,vorbis if needed
      fileName: 'visualizer-recording'
    }
    
    // UI elements
    this.recordButton = null
    this.recordingIndicator = null
    this.recordingTimer = null
    this.recordingStatus = null
    
    // Error handling
    this.lastError = null
    this.maxRecordingDuration = 600000 // 10 minutes max
    this.memoryWarningThreshold = 100 * 1024 * 1024 // 100MB
  }

  init() {
    this.createRecordInterface()
    this.setupEventListeners()
    this.checkBrowserSupport()
    console.log('RecordManager initialized')
  }

  checkBrowserSupport() {
    if (!MediaRecorder.isTypeSupported(this.settings.mimeType)) {
      // Fallback to more compatible format
      this.settings.mimeType = 'video/webm;codecs=vp8,vorbis'
      console.warn('VP9/Opus not supported, falling back to VP8/Vorbis')
      
      if (!MediaRecorder.isTypeSupported(this.settings.mimeType)) {
        this.settings.mimeType = 'video/webm'
        console.warn('Specific codecs not supported, using default WebM')
      }
    }
    
    console.log(`Recording format: ${this.settings.mimeType}`)
  }

  createRecordInterface() {
    const recordContainer = document.createElement('div')
    recordContainer.className = 'record-container'
    recordContainer.innerHTML = `
      <div class="record-controls">
        <button class="record-button" id="recordButton" aria-label="Start/Stop Recording">
          <svg class="record-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6"></path>
            <path d="m15.5 3.5-3.5 3.5-3.5-3.5"></path>
            <path d="m8.5 20.5 3.5-3.5 3.5 3.5"></path>
          </svg>
          <span class="record-text">Record</span>
        </button>
        
        <div class="recording-status" style="display: none;">
          <div class="recording-indicator"></div>
          <span class="recording-time">00:00</span>
          <span class="recording-size">0 MB</span>
        </div>
        
        <div class="record-settings" style="display: none;">
          <div class="setting-group">
            <label for="recordQuality">Quality:</label>
            <select id="recordQuality">
              <option value="high">High (8 Mbps)</option>
              <option value="medium" selected>Medium (4 Mbps)</option>
              <option value="low">Low (2 Mbps)</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label for="recordFileName">File Name:</label>
            <input type="text" id="recordFileName" value="visualizer-recording" maxlength="50">
          </div>
          
          <button class="settings-toggle" id="settingsToggle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="record-progress" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-info">
          <span class="frames-info">Frames: 0</span>
          <span class="fps-info">FPS: 30</span>
        </div>
      </div>
      
      <div class="record-error" style="display: none;">
        <div class="error-content">
          <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span class="error-message">Recording error occurred</span>
          <button class="error-dismiss">Dismiss</button>
        </div>
      </div>
    `
    
    // Position the record container
    document.querySelector('.frame').appendChild(recordContainer)
    
    // Store references to UI elements
    this.recordButton = document.getElementById('recordButton')
    this.recordingStatus = document.querySelector('.recording-status')
    this.recordingIndicator = document.querySelector('.recording-indicator')
    this.recordingTime = document.querySelector('.recording-time')
    this.recordingSize = document.querySelector('.recording-size')
    this.recordProgress = document.querySelector('.record-progress')
    this.recordError = document.querySelector('.record-error')
    this.settingsPanel = document.querySelector('.record-settings')
  }

  setupEventListeners() {
    // Record button
    this.recordButton.addEventListener('click', () => {
      this.toggleRecording()
    })
    
    // Settings toggle
    const settingsToggle = document.getElementById('settingsToggle')
    settingsToggle.addEventListener('click', () => {
      this.toggleSettings()
    })
    
    // Quality setting
    const qualitySelect = document.getElementById('recordQuality')
    qualitySelect.addEventListener('change', (e) => {
      this.updateQualitySettings(e.target.value)
    })
    
    // File name setting
    const fileNameInput = document.getElementById('recordFileName')
    fileNameInput.addEventListener('input', (e) => {
      this.settings.fileName = e.target.value || 'visualizer-recording'
    })
    
    // Error dismiss
    const errorDismiss = document.querySelector('.error-dismiss')
    errorDismiss.addEventListener('click', () => {
      this.hideError()
    })
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + R to toggle recording
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault()
        this.toggleRecording()
      }
      
      // Escape to stop recording
      if (e.key === 'Escape' && this.isRecording) {
        this.stopRecording()
      }
    })
    
    // Prevent accidental page refresh during recording
    window.addEventListener('beforeunload', (e) => {
      if (this.isRecording) {
        e.preventDefault()
        e.returnValue = 'Recording in progress. Are you sure you want to leave?'
        return e.returnValue
      }
    })
  }

  toggleSettings() {
    const isVisible = this.settingsPanel.style.display !== 'none'
    this.settingsPanel.style.display = isVisible ? 'none' : 'block'
  }

  updateQualitySettings(quality) {
    switch (quality) {
      case 'high':
        this.settings.videoBitsPerSecond = 8000000
        break
      case 'medium':
        this.settings.videoBitsPerSecond = 4000000
        break
      case 'low':
        this.settings.videoBitsPerSecond = 2000000
        break
    }
    console.log(`Recording quality set to: ${quality} (${this.settings.videoBitsPerSecond} bps)`)
  }

  async toggleRecording() {
    if (this.isRecording) {
      await this.stopRecording()
    } else {
      await this.startRecording()
    }
  }

  async startRecording() {
    try {
      console.log('Starting recording...')
      
      // Check available storage (if supported)
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const availableSpace = estimate.quota - estimate.usage
        const minRequiredSpace = 100 * 1024 * 1024 // 100MB minimum
        
        if (availableSpace < minRequiredSpace) {
          throw new Error('Insufficient storage space for recording')
        }
      }
      
      // Get canvas stream from the renderer
      const canvas = document.querySelector('canvas')
      if (!canvas) {
        throw new Error('Canvas element not found')
      }
      
      // Create canvas stream at target FPS
      this.canvasStream = canvas.captureStream(this.targetFPS)
      
      // Get audio stream from the audio context
      await this.setupAudioStream()
      
      // Combine video and audio streams
      this.combinedStream = new MediaStream([
        ...this.canvasStream.getVideoTracks(),
        ...this.audioStream.getAudioTracks()
      ])
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.combinedStream, {
        mimeType: this.settings.mimeType,
        videoBitsPerSecond: this.settings.videoBitsPerSecond,
        audioBitsPerSecond: this.settings.audioBitsPerSecond
      })
      
      // Setup MediaRecorder event handlers
      this.setupMediaRecorderEvents()
      
      // Start recording
      this.recordedChunks = []
      this.frameCount = 0
      this.startTime = Date.now()
      this.mediaRecorder.start(100) // Collect data every 100ms
      
      // Update UI
      this.updateRecordingUI(true)
      
      // Start monitoring
      this.startRecordingMonitor()
      
      console.log('Recording started successfully')
      
    } catch (error) {
      console.error('Failed to start recording:', error)
      this.showError(`Failed to start recording: ${error.message}`)
      await this.cleanup()
    }
  }

  async setupAudioStream() {
    try {
      // Try to get audio from the existing audio context
      if (window.App && window.App.advancedAudioManager && window.App.advancedAudioManager.audioContext) {
        const audioContext = window.App.advancedAudioManager.audioContext
        
        // Create a destination node for recording
        const destination = audioContext.createMediaStreamDestination()
        
        // Connect the audio source to the destination
        if (window.App.advancedAudioManager.audio && window.App.advancedAudioManager.audio.source) {
          window.App.advancedAudioManager.audio.source.connect(destination)
        }
        
        this.audioStream = destination.stream
        console.log('Audio stream created from existing audio context')
      } else {
        // Fallback: create silent audio track
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        const destination = audioContext.createMediaStreamDestination()
        
        oscillator.connect(gainNode)
        gainNode.connect(destination)
        gainNode.gain.value = 0 // Silent
        oscillator.start()
        
        this.audioStream = destination.stream
        console.log('Silent audio stream created as fallback')
      }
    } catch (error) {
      console.warn('Failed to setup audio stream:', error)
      // Create empty audio stream as last resort
      this.audioStream = new MediaStream()
    }
  }

  setupMediaRecorderEvents() {
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data)
        this.updateRecordingStats()
      }
    }
    
    this.mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped')
      this.saveRecording()
    }
    
    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error)
      this.showError(`Recording error: ${event.error.message}`)
      this.stopRecording()
    }
    
    this.mediaRecorder.onstart = () => {
      console.log('MediaRecorder started')
      this.isRecording = true
    }
  }

  startRecordingMonitor() {
    this.recordingTimer = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(this.recordingTimer)
        return
      }
      
      const elapsed = Date.now() - this.startTime
      
      // Update time display
      this.updateTimeDisplay(elapsed)
      
      // Check for maximum duration
      if (elapsed > this.maxRecordingDuration) {
        console.warn('Maximum recording duration reached')
        this.stopRecording()
        return
      }
      
      // Check memory usage
      const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0)
      if (totalSize > this.memoryWarningThreshold) {
        console.warn('Memory usage high, consider stopping recording')
      }
      
      // Update frame count (approximate)
      this.frameCount = Math.floor(elapsed / this.frameInterval)
      
    }, 1000) // Update every second
  }

  updateTimeDisplay(elapsed) {
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    if (this.recordingTime) {
      this.recordingTime.textContent = timeString
    }
  }

  updateRecordingStats() {
    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0)
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(1)
    
    if (this.recordingSize) {
      this.recordingSize.textContent = `${sizeMB} MB`
    }
    
    // Update progress info
    const framesInfo = document.querySelector('.frames-info')
    const fpsInfo = document.querySelector('.fps-info')
    
    if (framesInfo) {
      framesInfo.textContent = `Frames: ${this.frameCount}`
    }
    
    if (fpsInfo) {
      const elapsed = Date.now() - this.startTime
      const actualFPS = elapsed > 0 ? Math.round((this.frameCount * 1000) / elapsed) : 0
      fpsInfo.textContent = `FPS: ${actualFPS}`
    }
  }

  async stopRecording() {
    try {
      console.log('Stopping recording...')
      
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop()
      }
      
      // Stop monitoring
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }
      
      // Update UI
      this.updateRecordingUI(false)
      
      console.log('Recording stopped')
      
    } catch (error) {
      console.error('Error stopping recording:', error)
      this.showError(`Error stopping recording: ${error.message}`)
    }
  }

  saveRecording() {
    try {
      if (this.recordedChunks.length === 0) {
        throw new Error('No recorded data to save')
      }
      
      console.log('Saving recording...')
      
      // Create blob from recorded chunks
      const blob = new Blob(this.recordedChunks, {
        type: this.settings.mimeType
      })
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const extension = this.settings.mimeType.includes('webm') ? 'webm' : 'mp4'
      link.download = `${this.settings.fileName}-${timestamp}.${extension}`
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      URL.revokeObjectURL(url)
      
      // Show success message
      this.showSuccess(`Recording saved: ${link.download}`)
      
      console.log('Recording saved successfully')
      
    } catch (error) {
      console.error('Error saving recording:', error)
      this.showError(`Error saving recording: ${error.message}`)
    } finally {
      this.cleanup()
    }
  }

  updateRecordingUI(recording) {
    if (recording) {
      // Update record button
      this.recordButton.classList.add('recording')
      this.recordButton.innerHTML = `
        <svg class="record-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12"></rect>
        </svg>
        <span class="record-text">Stop</span>
      `
      
      // Show recording status
      this.recordingStatus.style.display = 'flex'
      this.recordProgress.style.display = 'block'
      
      // Hide settings
      this.settingsPanel.style.display = 'none'
      
    } else {
      // Reset record button
      this.recordButton.classList.remove('recording')
      this.recordButton.innerHTML = `
        <svg class="record-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6"></path>
          <path d="m15.5 3.5-3.5 3.5-3.5-3.5"></path>
          <path d="m8.5 20.5 3.5-3.5 3.5 3.5"></path>
        </svg>
        <span class="record-text">Record</span>
      `
      
      // Hide recording status
      this.recordingStatus.style.display = 'none'
      this.recordProgress.style.display = 'none'
    }
  }

  showError(message) {
    this.lastError = message
    const errorMessage = document.querySelector('.error-message')
    if (errorMessage) {
      errorMessage.textContent = message
    }
    this.recordError.style.display = 'block'
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideError()
    }, 5000)
  }

  hideError() {
    this.recordError.style.display = 'none'
  }

  showSuccess(message) {
    // Create temporary success notification
    const notification = document.createElement('div')
    notification.className = 'record-success'
    notification.innerHTML = `
      <div class="success-content">
        <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22,4 12,14.01 9,11.01"></polyline>
        </svg>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(notification)
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 3000)
  }

  async cleanup() {
    this.isRecording = false
    this.recordedChunks = []
    this.frameCount = 0
    this.startTime = null
    
    // Stop streams
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach(track => track.stop())
      this.canvasStream = null
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
      this.audioStream = null
    }
    
    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop())
      this.combinedStream = null
    }
    
    // Clear MediaRecorder
    this.mediaRecorder = null
    
    console.log('Recording cleanup completed')
  }

  // Public API methods
  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      frameCount: this.frameCount,
      dataSize: this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0)
    }
  }

  setQuality(quality) {
    this.updateQualitySettings(quality)
    const qualitySelect = document.getElementById('recordQuality')
    if (qualitySelect) {
      qualitySelect.value = quality
    }
  }

  setFileName(fileName) {
    this.settings.fileName = fileName
    const fileNameInput = document.getElementById('recordFileName')
    if (fileNameInput) {
      fileNameInput.value = fileName
    }
  }

  destroy() {
    console.log('Destroying RecordManager')
    
    // Stop any active recording
    if (this.isRecording) {
      this.stopRecording()
    }
    
    // Clean up
    this.cleanup()
    
    // Remove UI elements
    const recordContainer = document.querySelector('.record-container')
    if (recordContainer && recordContainer.parentNode) {
      recordContainer.parentNode.removeChild(recordContainer)
    }
    
    // Clear timers
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer)
    }
  }
}