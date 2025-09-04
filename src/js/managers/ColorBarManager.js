export default class ColorBarManager {
  constructor() {
    this.colorBar = null
    this.colorPoint = null
    this.colorPreview = null
    this.colorValue = null
    this.isDragging = false
    this.currentHue = 300 // Default to magenta
    this.callbacks = []
    
    // Color stops for the gradient (hue values)
    this.colorStops = [
      { hue: 0, color: '#ff0000', name: 'Red' },
      { hue: 60, color: '#ffff00', name: 'Yellow' },
      { hue: 120, color: '#00ff00', name: 'Green' },
      { hue: 180, color: '#00ffff', name: 'Cyan' },
      { hue: 240, color: '#0000ff', name: 'Blue' },
      { hue: 300, color: '#ff00ff', name: 'Magenta' }
    ]
  }

  init() {
    this.setupElements()
    this.setupEventListeners()
    this.updateColorDisplay()
    console.log('ColorBarManager initialized')
  }

  setupElements() {
    this.colorBar = document.getElementById('colorBar')
    this.colorPoint = document.getElementById('colorPoint')
    this.colorPreview = document.getElementById('colorPreview')
    this.colorValue = document.getElementById('colorValue')

    if (!this.colorBar || !this.colorPoint || !this.colorPreview || !this.colorValue) {
      console.error('ColorBarManager: Required elements not found')
      return false
    }

    return true
  }

  setupEventListeners() {
    // Mouse events for color bar
    this.colorBar.addEventListener('mousedown', (e) => this.handleBarClick(e))
    this.colorBar.addEventListener('mousemove', (e) => this.handleBarHover(e))

    // Mouse events for color point
    this.colorPoint.addEventListener('mousedown', (e) => this.startDrag(e))
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', (e) => this.handleDrag(e))
    document.addEventListener('mouseup', () => this.stopDrag())

    // Touch events for mobile support
    this.colorBar.addEventListener('touchstart', (e) => this.handleBarTouch(e))
    this.colorPoint.addEventListener('touchstart', (e) => this.startDragTouch(e))
    document.addEventListener('touchmove', (e) => this.handleDragTouch(e))
    document.addEventListener('touchend', () => this.stopDrag())

    // Keyboard navigation
    this.colorPoint.addEventListener('keydown', (e) => this.handleKeyboard(e))

    // Prevent context menu on color point
    this.colorPoint.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  handleBarClick(event) {
    if (event.target === this.colorPoint || event.target.closest('.color-point')) {
      return // Don't handle clicks on the point itself
    }

    const rect = this.colorBar.getBoundingClientRect()
    const x = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    
    this.setPositionFromPercentage(percentage)
    this.addUpdateAnimation()
  }

  handleBarTouch(event) {
    event.preventDefault()
    const touch = event.touches[0]
    const rect = this.colorBar.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    
    this.setPositionFromPercentage(percentage)
    this.addUpdateAnimation()
  }

  handleBarHover(event) {
    if (!this.isDragging) {
      // Optional: Show preview of color on hover
      const rect = this.colorBar.getBoundingClientRect()
      const x = event.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, x / rect.width))
      const hue = percentage * 360
      
      // Could add hover preview functionality here
    }
  }

  startDrag(event) {
    event.preventDefault()
    this.isDragging = true
    this.colorPoint.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  startDragTouch(event) {
    event.preventDefault()
    this.isDragging = true
  }

  handleDrag(event) {
    if (!this.isDragging) return

    const rect = this.colorBar.getBoundingClientRect()
    const x = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    
    this.setPositionFromPercentage(percentage)
  }

  handleDragTouch(event) {
    if (!this.isDragging) return
    
    event.preventDefault()
    const touch = event.touches[0]
    const rect = this.colorBar.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    
    this.setPositionFromPercentage(percentage)
  }

  stopDrag() {
    if (this.isDragging) {
      this.isDragging = false
      this.colorPoint.style.cursor = 'grab'
      document.body.style.userSelect = ''
      this.addUpdateAnimation()
    }
  }

  handleKeyboard(event) {
    const step = event.shiftKey ? 10 : 1 // Larger steps with Shift
    let newHue = this.currentHue

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        newHue = Math.max(0, this.currentHue - step)
        break
      case 'ArrowRight':
        event.preventDefault()
        newHue = Math.min(360, this.currentHue + step)
        break
      case 'Home':
        event.preventDefault()
        newHue = 0
        break
      case 'End':
        event.preventDefault()
        newHue = 360
        break
      default:
        return
    }

    this.setHue(newHue)
    this.addUpdateAnimation()
  }

  setPositionFromPercentage(percentage) {
    const hue = percentage * 360
    this.setHue(hue)
    
    // Update visual position
    this.colorPoint.style.left = `${percentage * 100}%`
  }

  setHue(hue) {
    this.currentHue = Math.max(0, Math.min(360, hue))
    this.updateColorDisplay()
    this.notifyCallbacks()
    
    // Update ARIA attributes
    this.colorPoint.setAttribute('aria-valuenow', Math.round(this.currentHue))
  }

  updateColorDisplay() {
    const color = this.hslToHex(this.currentHue, 100, 50)
    const colorString = `#${color.toString(16).padStart(6, '0')}`
    
    // Update preview circle
    this.colorPreview.style.background = colorString
    
    // Update color point
    const pointInner = this.colorPoint.querySelector('.color-point-inner')
    if (pointInner) {
      pointInner.style.background = colorString
    }
    
    // Update color value display
    this.colorValue.textContent = colorString.toUpperCase()
    
    // Update position based on hue
    const percentage = this.currentHue / 360
    this.colorPoint.style.left = `${percentage * 100}%`
  }

  addUpdateAnimation() {
    this.colorPoint.classList.add('updating')
    setTimeout(() => {
      this.colorPoint.classList.remove('updating')
    }, 300)
  }

  // Convert HSL to RGB to Hex
  hslToHex(h, s, l) {
    h /= 360
    s /= 100
    l /= 100

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }

    let r, g, b
    if (s === 0) {
      r = g = b = l
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }

    const toHex = (c) => {
      const hex = Math.round(c * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }

    return parseInt(toHex(r) + toHex(g) + toHex(b), 16)
  }

  // Get current color as hex number
  getCurrentColor() {
    return this.hslToHex(this.currentHue, 100, 50)
  }

  // Get current color as hex string
  getCurrentColorString() {
    const color = this.getCurrentColor()
    return `#${color.toString(16).padStart(6, '0')}`
  }

  // Set color programmatically
  setColor(color) {
    let hue
    
    if (typeof color === 'string') {
      // Convert hex string to hue
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255
      const g = parseInt(hex.substr(2, 2), 16) / 255
      const b = parseInt(hex.substr(4, 2), 16) / 255
      
      hue = this.rgbToHue(r, g, b)
    } else if (typeof color === 'number') {
      // Convert hex number to hue
      const r = ((color >> 16) & 255) / 255
      const g = ((color >> 8) & 255) / 255
      const b = (color & 255) / 255
      
      hue = this.rgbToHue(r, g, b)
    } else {
      console.error('Invalid color format')
      return
    }
    
    this.setHue(hue)
    this.addUpdateAnimation()
  }

  rgbToHue(r, g, b) {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h

    if (max === min) {
      h = 0
    } else {
      const d = max - min
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return h * 360
  }

  // Register callback for color changes
  onColorChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback)
    }
  }

  // Remove callback
  removeColorChangeCallback(callback) {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }

  // Notify all callbacks of color change
  notifyCallbacks() {
    const color = this.getCurrentColor()
    const colorString = this.getCurrentColorString()
    
    this.callbacks.forEach(callback => {
      try {
        callback(color, colorString, this.currentHue)
      } catch (error) {
        console.error('Error in color change callback:', error)
      }
    })
  }

  // Get closest color stop name
  getClosestColorName() {
    let closestStop = this.colorStops[0]
    let minDistance = Math.abs(this.currentHue - closestStop.hue)
    
    for (const stop of this.colorStops) {
      const distance = Math.abs(this.currentHue - stop.hue)
      if (distance < minDistance) {
        minDistance = distance
        closestStop = stop
      }
    }
    
    return closestStop.name
  }

  // Animate to specific color
  animateToColor(targetColor, duration = 500) {
    let targetHue
    
    if (typeof targetColor === 'string') {
      const hex = targetColor.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255
      const g = parseInt(hex.substr(2, 2), 16) / 255
      const b = parseInt(hex.substr(4, 2), 16) / 255
      targetHue = this.rgbToHue(r, g, b)
    } else {
      const r = ((targetColor >> 16) & 255) / 255
      const g = ((targetColor >> 8) & 255) / 255
      const b = (targetColor & 255) / 255
      targetHue = this.rgbToHue(r, g, b)
    }
    
    const startHue = this.currentHue
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      
      const currentHue = startHue + (targetHue - startHue) * easeOut
      this.setHue(currentHue)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        this.addUpdateAnimation()
      }
    }
    
    animate()
  }

  // Destroy the color bar manager
  destroy() {
    // Remove event listeners
    if (this.colorBar) {
      this.colorBar.removeEventListener('mousedown', this.handleBarClick)
      this.colorBar.removeEventListener('mousemove', this.handleBarHover)
      this.colorBar.removeEventListener('touchstart', this.handleBarTouch)
    }
    
    if (this.colorPoint) {
      this.colorPoint.removeEventListener('mousedown', this.startDrag)
      this.colorPoint.removeEventListener('touchstart', this.startDragTouch)
      this.colorPoint.removeEventListener('keydown', this.handleKeyboard)
    }
    
    document.removeEventListener('mousemove', this.handleDrag)
    document.removeEventListener('mouseup', this.stopDrag)
    document.removeEventListener('touchmove', this.handleDragTouch)
    document.removeEventListener('touchend', this.stopDrag)
    
    // Clear callbacks
    this.callbacks = []
    
    console.log('ColorBarManager destroyed')
  }
}