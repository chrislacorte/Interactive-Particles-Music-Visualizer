import * as THREE from 'three'

export default class AudioManager {
  constructor() {
    this.frequencyArray = []
    this.frequencyData = {
      low: 0,
      mid: 0,
      high: 0,
    }
    this.isPlaying = false
    this.lowFrequency = 10 //10Hz to 250Hz
    this.midFrequency = 150 //150Hz to 2000Hz
    this.highFrequency = 9000 //2000Hz to 20000Hz
    this.smoothedLowFrequency = 0
    this.audioContext = null
    this.currentAudioBuffer = null
    this.currentFileName = 'Default Track'

    this.song = {
      url: 'https://p.scdn.co/mp3-preview/3be3fb77f5b2945c95e86d4c40ceceac20e5108f?cid=b62f0af3b0d54eca9bb49b99a2fc5820',
    }
  }

  async loadAudioBuffer() {
    // Load the audio file and create the audio buffer
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

      this.audioAnalyser = new THREE.AudioAnalyser(this.audio, 1024)
    })

    return promise
  }

  async loadCustomAudioBuffer(audioBuffer, fileName) {
    // Load a custom audio buffer from file upload
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
      
      // Update UI to show current track
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
    // Calculate the average frequency value for each range of frequencies
    const lowFreqRangeStart = Math.floor((this.lowFrequency * this.bufferLength) / this.audioContext.sampleRate)
    const lowFreqRangeEnd = Math.floor((this.midFrequency * this.bufferLength) / this.audioContext.sampleRate)
    const midFreqRangeStart = Math.floor((this.midFrequency * this.bufferLength) / this.audioContext.sampleRate)
    const midFreqRangeEnd = Math.floor((this.highFrequency * this.bufferLength) / this.audioContext.sampleRate)
    const highFreqRangeStart = Math.floor((this.highFrequency * this.bufferLength) / this.audioContext.sampleRate)
    const highFreqRangeEnd = this.bufferLength - 1

    const lowAvg = this.normalizeValue(this.calculateAverage(this.frequencyArray, lowFreqRangeStart, lowFreqRangeEnd))
    const midAvg = this.normalizeValue(this.calculateAverage(this.frequencyArray, midFreqRangeStart, midFreqRangeEnd))
    const highAvg = this.normalizeValue(this.calculateAverage(this.frequencyArray, highFreqRangeStart, highFreqRangeEnd))

    this.frequencyData = {
      low: lowAvg,
      mid: midAvg,
      high: highAvg,
    }
  }

  calculateAverage(array, start, end) {
    let sum = 0
    for (let i = start; i <= end; i++) {
      sum += array[i]
    }
    return sum / (end - start + 1)
  }

  normalizeValue(value) {
    // Assuming the frequency values are in the range 0-256 (for 8-bit data)
    return value / 256
  }

  update() {
    if (!this.isPlaying) return

    this.collectAudioData()
    this.analyzeFrequency()
  }
}
