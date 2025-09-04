import * as THREE from 'three'

export default class AdvancedAudioManager {
  constructor() {
    this.frequencyArray = []
    this.frequencyData = {
      bass: 0,
      mid: 0,
      treble: 0,
      overall: 0
    }
    this.smoothedData = {
      bass: 0,
      mid: 0,
      treble: 0,
      overall: 0
    }
    this.isPlaying = false
    this.audioContext = null
    this.currentAudioBuffer = null
    this.currentFileName = 'Default Track'
    this.sensitivity = 1.0
    this.smoothingFactor = 0.85
    this.volumeThreshold = 0.01
    
    // Frequency ranges (Hz)
    this.bassRange = { min: 20, max: 250 }
    this.midRange = { min: 250, max: 4000 }
    this.trebleRange = { min: 4000, max: 20000 }
    
    // Peak detection
    this.peakHistory = []
    this.peakThreshold = 0.7
    this.lastPeakTime = 0
    
    // Beat detection
    this.beatHistory = []
    this.beatThreshold = 1.3
    this.lastBeatTime = 0
    this.beatCallbacks = []

    this.song = {
      url: 'https://p.scdn.co/mp3-preview/3be3fb77f5b2945c95e86d4c40ceceac20e5108f',
    }
  }

  async loadAudioBuffer() {
    const promise = new Promise(async (resolve, reject) => {
      const audioListener = new THREE.AudioListener()
      this.audio = new THREE.Audio(audioListener)
      const audioLoader = new THREE.AudioLoader()

      audioLoader.load(this.song.url, (buffer) => {
        this.audio.setBuffer(buffer)
        this.audio.setLoop(true)
        this.audio.setVolume(0.5)
        this.audioContext = this.audio.context
        this.currentAudioBuffer = buffer
        this.bufferLength = this.audioAnalyser.data.length
        resolve()
      })

      // Enhanced analyzer with higher resolution
      this.audioAnalyser = new THREE.AudioAnalyser(this.audio, 2048)
    })

    return promise
  }

  async loadCustomAudioBuffer(audioBuffer, fileName) {
    if (this.audio) {
      this.pause()
      this.audio.setBuffer(audioBuffer)
      this.currentAudioBuffer = audioBuffer
      this.currentFileName = fileName
      
      if (!this.audioContext) {
        this.audioContext = this.audio.context
      }
      
      this.bufferLength = this.audioAnalyser.data.length
      this.play()
      this.updateTrackDisplay()
    }
  }

  updateTrackDisplay() {
    let trackDisplay = document.querySelector('.current-track')
    if (!trackDisplay) {
      trackDisplay = document.createElement('div')
      trackDisplay.className = 'current-track'
      document.querySelector('.frame').appendChild(trackDisplay)
    }
    
    trackDisplay.innerHTML = `
      <div class="track-info">
        <svg class="track-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="2"></circle>
          <path d="M12 1v6m0 6v6"></path>
          <path d="m15.5 3.5-3.5 3.5-3.5-3.5"></path>
          <path d="m8.5 20.5 3.5-3.5 3.5 3.5"></path>
        </svg>
        <span class="track-name">${this.currentFileName}</span>
        <button class="track-controls" onclick="this.closest('.current-track').style.display='none'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `
  }

  play() {
    this.audio.play()
    this.isPlaying = true
  }

  pause() {
    this.audio.pause()
    this.isPlaying = false
  }

  collectAudioData() {
    this.frequencyArray = this.audioAnalyser.getFrequencyData()
  }

  analyzeFrequency() {
    if (!this.audioContext || !this.frequencyArray.length) return

    const sampleRate = this.audioContext.sampleRate
    const nyquist = sampleRate / 2
    const binCount = this.frequencyArray.length
    
    // Calculate frequency ranges in bins
    const bassStart = Math.floor((this.bassRange.min / nyquist) * binCount)
    const bassEnd = Math.floor((this.bassRange.max / nyquist) * binCount)
    const midStart = Math.floor((this.midRange.min / nyquist) * binCount)
    const midEnd = Math.floor((this.midRange.max / nyquist) * binCount)
    const trebleStart = Math.floor((this.trebleRange.min / nyquist) * binCount)
    const trebleEnd = Math.floor((this.trebleRange.max / nyquist) * binCount)

    // Calculate average amplitudes for each range
    const bassAvg = this.calculateRangeAverage(bassStart, bassEnd)
    const midAvg = this.calculateRangeAverage(midStart, midEnd)
    const trebleAvg = this.calculateRangeAverage(trebleStart, trebleEnd)
    const overallAvg = this.calculateRangeAverage(0, binCount - 1)

    // Apply sensitivity and normalize
    this.frequencyData.bass = this.normalizeValue(bassAvg) * this.sensitivity
    this.frequencyData.mid = this.normalizeValue(midAvg) * this.sensitivity
    this.frequencyData.treble = this.normalizeValue(trebleAvg) * this.sensitivity
    this.frequencyData.overall = this.normalizeValue(overallAvg) * this.sensitivity

    // Apply smoothing to prevent jarring transitions
    this.smoothedData.bass = this.smoothValue(this.smoothedData.bass, this.frequencyData.bass)
    this.smoothedData.mid = this.smoothValue(this.smoothedData.mid, this.frequencyData.mid)
    this.smoothedData.treble = this.smoothValue(this.smoothedData.treble, this.frequencyData.treble)
    this.smoothedData.overall = this.smoothValue(this.smoothedData.overall, this.frequencyData.overall)

    // Detect beats and peaks
    this.detectBeats()
    this.detectPeaks()
  }

  calculateRangeAverage(startBin, endBin) {
    let sum = 0
    let count = 0
    
    for (let i = startBin; i <= endBin && i < this.frequencyArray.length; i++) {
      sum += this.frequencyArray[i]
      count++
    }
    
    return count > 0 ? sum / count : 0
  }

  normalizeValue(value) {
    // Normalize from 0-255 range to 0-1 range
    return Math.max(0, Math.min(1, value / 255))
  }

  smoothValue(current, target) {
    return current * this.smoothingFactor + target * (1 - this.smoothingFactor)
  }

  detectBeats() {
    const currentTime = Date.now()
    const bassEnergy = this.frequencyData.bass
    
    // Add current bass energy to history
    this.beatHistory.push(bassEnergy)
    if (this.beatHistory.length > 10) {
      this.beatHistory.shift()
    }

    // Calculate average energy
    const avgEnergy = this.beatHistory.reduce((sum, val) => sum + val, 0) / this.beatHistory.length
    
    // Detect beat if current energy exceeds threshold and enough time has passed
    if (bassEnergy > avgEnergy * this.beatThreshold && 
        currentTime - this.lastBeatTime > 200) { // Minimum 200ms between beats
      
      this.lastBeatTime = currentTime
      this.triggerBeatCallbacks(bassEnergy)
    }
  }

  detectPeaks() {
    const currentTime = Date.now()
    const overallEnergy = this.frequencyData.overall
    
    // Add current energy to history
    this.peakHistory.push(overallEnergy)
    if (this.peakHistory.length > 5) {
      this.peakHistory.shift()
    }

    // Detect peak if current energy is significantly higher than recent history
    const avgEnergy = this.peakHistory.reduce((sum, val) => sum + val, 0) / this.peakHistory.length
    
    if (overallEnergy > this.peakThreshold && 
        overallEnergy > avgEnergy * 1.5 && 
        currentTime - this.lastPeakTime > 100) {
      
      this.lastPeakTime = currentTime
      this.triggerPeakCallbacks(overallEnergy)
    }
  }

  triggerBeatCallbacks(intensity) {
    this.beatCallbacks.forEach(callback => {
      if (typeof callback === 'function') {
        callback(intensity)
      }
    })
  }

  triggerPeakCallbacks(intensity) {
    // Can be extended for peak-specific callbacks
  }

  onBeat(callback) {
    this.beatCallbacks.push(callback)
  }

  removeBeatCallback(callback) {
    const index = this.beatCallbacks.indexOf(callback)
    if (index > -1) {
      this.beatCallbacks.splice(index, 1)
    }
  }

  setSensitivity(value) {
    this.sensitivity = Math.max(0.1, Math.min(3.0, value))
  }

  setSmoothing(value) {
    this.smoothingFactor = Math.max(0.1, Math.min(0.95, value))
  }

  getFrequencyData() {
    return {
      raw: { ...this.frequencyData },
      smoothed: { ...this.smoothedData }
    }
  }

  getAudioFeatures() {
    return {
      volume: this.smoothedData.overall,
      bass: this.smoothedData.bass,
      mid: this.smoothedData.mid,
      treble: this.smoothedData.treble,
      isActive: this.smoothedData.overall > this.volumeThreshold,
      timestamp: Date.now()
    }
  }

  update() {
    if (!this.isPlaying) {
      // Gradually fade out values when no audio
      this.smoothedData.bass *= 0.95
      this.smoothedData.mid *= 0.95
      this.smoothedData.treble *= 0.95
      this.smoothedData.overall *= 0.95
      return
    }

    this.collectAudioData()
    this.analyzeFrequency()
  }
}