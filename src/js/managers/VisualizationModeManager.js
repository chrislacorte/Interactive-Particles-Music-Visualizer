export default class VisualizationModeManager {
  constructor() {
    this.currentMode = 'particles'
    this.modes = ['particles', 'circles', 'lines', 'anomaly']
    this.onModeChangeCallback = null
    this.navOptions = null
    this.isInitialized = false
  }

  init() {
    this.setupEventListeners()
    this.updateActiveState()
    this.isInitialized = true
    console.log('VisualizationModeManager initialized')
  }

  setupEventListeners() {
    this.navOptions = document.querySelectorAll('.nav-option')
    
    this.navOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode')
        if (mode && mode !== this.currentMode) {
          this.setMode(mode)
        }
      })

      // Add keyboard support for accessibility
      option.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const mode = e.target.getAttribute('data-mode')
          if (mode && mode !== this.currentMode) {
            this.setMode(mode)
          }
        }
      })

      // Add focus management
      option.addEventListener('focus', () => {
        option.style.boxShadow = '0 0 0 2px rgba(255, 0, 255, 0.5)'
      })

      option.addEventListener('blur', () => {
        option.style.boxShadow = ''
      })
    })

    // Add keyboard navigation between options
    document.addEventListener('keydown', (e) => {
      if (!this.isNavigationFocused()) return

      const currentIndex = this.modes.indexOf(this.currentMode)
      let newIndex = currentIndex

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          newIndex = currentIndex > 0 ? currentIndex - 1 : this.modes.length - 1
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          newIndex = currentIndex < this.modes.length - 1 ? currentIndex + 1 : 0
          break
      }

      if (newIndex !== currentIndex) {
        const newMode = this.modes[newIndex]
        this.setMode(newMode)
        this.focusOption(newMode)
      }
    })
  }

  isNavigationFocused() {
    const activeElement = document.activeElement
    return activeElement && activeElement.classList.contains('nav-option')
  }

  focusOption(mode) {
    const option = document.querySelector(`[data-mode="${mode}"]`)
    if (option) {
      option.focus()
    }
  }

  setMode(mode) {
    if (!this.modes.includes(mode)) {
      console.warn(`Invalid mode: ${mode}`)
      return
    }

    const previousMode = this.currentMode
    this.currentMode = mode
    
    this.updateActiveState()
    this.triggerModeChange(mode, previousMode)
    
    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }

    console.log(`Visualization mode changed from ${previousMode} to ${mode}`)
  }

  updateActiveState() {
    if (!this.navOptions) return

    this.navOptions.forEach(option => {
      const mode = option.getAttribute('data-mode')
      if (mode === this.currentMode) {
        option.classList.add('active')
        option.setAttribute('aria-pressed', 'true')
      } else {
        option.classList.remove('active')
        option.setAttribute('aria-pressed', 'false')
      }
    })
  }

  triggerModeChange(newMode, previousMode) {
    if (this.onModeChangeCallback) {
      this.onModeChangeCallback(newMode, previousMode)
    }

    // Dispatch custom event for other components to listen to
    const event = new CustomEvent('visualizationModeChange', {
      detail: { newMode, previousMode }
    })
    document.dispatchEvent(event)
  }

  getCurrentMode() {
    return this.currentMode
  }

  getAvailableModes() {
    return [...this.modes]
  }

  onModeChange(callback) {
    this.onModeChangeCallback = callback
  }

  // Method to programmatically cycle through modes
  nextMode() {
    const currentIndex = this.modes.indexOf(this.currentMode)
    const nextIndex = (currentIndex + 1) % this.modes.length
    this.setMode(this.modes[nextIndex])
  }

  previousMode() {
    const currentIndex = this.modes.indexOf(this.currentMode)
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : this.modes.length - 1
    this.setMode(this.modes[prevIndex])
  }

  // Method to hide/show the navigation menu
  setVisibility(visible) {
    const bottomNav = document.querySelector('.bottom-nav')
    if (bottomNav) {
      bottomNav.style.display = visible ? 'flex' : 'none'
    }
  }

  // Method to temporarily disable mode switching (useful during transitions)
  setEnabled(enabled) {
    if (!this.navOptions) return

    this.navOptions.forEach(option => {
      option.disabled = !enabled
      option.style.pointerEvents = enabled ? 'auto' : 'none'
      option.style.opacity = enabled ? '1' : '0.5'
    })
  }

  destroy() {
    if (this.navOptions) {
      this.navOptions.forEach(option => {
        option.removeEventListener('click', this.handleClick)
        option.removeEventListener('keydown', this.handleKeydown)
      })
    }
    
    document.removeEventListener('keydown', this.handleGlobalKeydown)
    this.onModeChangeCallback = null
    this.isInitialized = false
  }
}