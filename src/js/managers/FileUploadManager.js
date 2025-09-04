export default class FileUploadManager {
  constructor() {
    this.supportedFormats = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4', 'audio/m4a']
    this.onFileLoadedCallback = null
    this.isUploading = false
  }

  init() {
    this.createUploadInterface()
    this.setupEventListeners()
  }

  createUploadInterface() {
    const uploadContainer = document.createElement('div')
    uploadContainer.className = 'upload-container'
    uploadContainer.innerHTML = `
      <div class="upload-area">
        <input type="file" id="audioFileInput" accept="audio/*" style="display: none;">
        <div class="upload-content">
          <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7,10 12,15 17,10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <p class="upload-text">Click to upload your music file</p>
          <p class="upload-formats">Supports MP3, WAV, FLAC, OGG, M4A</p>
        </div>
        <div class="upload-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p class="progress-text">Loading...</p>
        </div>
      </div>
    `
    
    document.querySelector('.frame').appendChild(uploadContainer)
  }

  setupEventListeners() {
    const uploadArea = document.querySelector('.upload-area')
    const fileInput = document.getElementById('audioFileInput')

    uploadArea.addEventListener('click', () => {
      if (!this.isUploading) {
        fileInput.click()
      }
    })

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault()
      uploadArea.classList.add('drag-over')
    })

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over')
    })

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault()
      uploadArea.classList.remove('drag-over')
      const files = e.dataTransfer.files
      if (files.length > 0) {
        this.handleFileSelection(files[0])
      }
    })

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelection(e.target.files[0])
      }
    })
  }

  async handleFileSelection(file) {
    if (!this.validateFile(file)) {
      this.showError('Unsupported file format. Please select an audio file.')
      return
    }

    this.showProgress()
    
    try {
      const audioBuffer = await this.loadAudioFile(file)
      if (this.onFileLoadedCallback) {
        await this.onFileLoadedCallback(audioBuffer, file.name)
      }
      this.hideProgress()
      this.showSuccess(`Successfully loaded: ${file.name}`)
    } catch (error) {
      this.hideProgress()
      this.showError('Failed to load audio file. Please try another file.')
      console.error('Audio loading error:', error)
    }
  }

  validateFile(file) {
    return this.supportedFormats.some(format => 
      file.type === format || file.name.toLowerCase().endsWith(format.split('/')[1])
    )
  }

  async loadAudioFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)()
          const audioBuffer = await audioContext.decodeAudioData(e.target.result)
          resolve(audioBuffer)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  showProgress() {
    this.isUploading = true
    document.querySelector('.upload-content').style.display = 'none'
    document.querySelector('.upload-progress').style.display = 'block'
    
    // Simulate progress animation
    const progressFill = document.querySelector('.progress-fill')
    progressFill.style.width = '0%'
    
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
      }
      progressFill.style.width = progress + '%'
    }, 100)
  }

  hideProgress() {
    this.isUploading = false
    document.querySelector('.upload-content').style.display = 'block'
    document.querySelector('.upload-progress').style.display = 'none'
  }

  showError(message) {
    this.showMessage(message, 'error')
  }

  showSuccess(message) {
    this.showMessage(message, 'success')
  }

  showMessage(message, type) {
    const existingMessage = document.querySelector('.upload-message')
    if (existingMessage) {
      existingMessage.remove()
    }

    const messageEl = document.createElement('div')
    messageEl.className = `upload-message upload-message--${type}`
    messageEl.textContent = message
    document.querySelector('.upload-container').appendChild(messageEl)

    setTimeout(() => {
      messageEl.remove()
    }, 3000)
  }

  onFileLoaded(callback) {
    this.onFileLoadedCallback = callback
  }
}