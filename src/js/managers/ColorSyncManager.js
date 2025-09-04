export default class ColorSyncManager {
  constructor() {
    this.subscribers = new Map()
    this.currentColors = {
      primary: 0xff00ff,    // Magenta
      secondary: 0x00ffff,  // Cyan
      accent: 0xff6b6b,     // Coral
      background: 0x000000  // Black
    }
    this.colorHistory = []
    this.maxHistorySize = 10
    this.isUpdating = false
  }

  // Subscribe a visualizer to color updates
  subscribe(visualizerId, updateCallback, colorProperties = ['primary', 'secondary']) {
    if (typeof updateCallback !== 'function') {
      console.error(`ColorSyncManager: Invalid callback for ${visualizerId}`)
      return false
    }

    this.subscribers.set(visualizerId, {
      callback: updateCallback,
      properties: colorProperties,
      isActive: true,
      lastUpdate: Date.now()
    })

    console.log(`ColorSyncManager: Subscribed ${visualizerId} for properties:`, colorProperties)
    
    // Immediately sync current colors to new subscriber
    this.syncToSubscriber(visualizerId)
    return true
  }

  // Unsubscribe a visualizer
  unsubscribe(visualizerId) {
    const removed = this.subscribers.delete(visualizerId)
    if (removed) {
      console.log(`ColorSyncManager: Unsubscribed ${visualizerId}`)
    }
    return removed
  }

  // Update a specific color and sync to all subscribers
  updateColor(colorType, colorValue, source = 'unknown') {
    if (!this.currentColors.hasOwnProperty(colorType)) {
      console.error(`ColorSyncManager: Invalid color type: ${colorType}`)
      return false
    }

    // Prevent recursive updates
    if (this.isUpdating) {
      return false
    }

    const oldColor = this.currentColors[colorType]
    this.currentColors[colorType] = colorValue

    // Add to history
    this.addToHistory({
      type: colorType,
      oldValue: oldColor,
      newValue: colorValue,
      source: source,
      timestamp: Date.now()
    })

    console.log(`ColorSyncManager: Color ${colorType} updated from ${oldColor.toString(16)} to ${colorValue.toString(16)} by ${source}`)

    // Sync to all subscribers
    this.syncToAllSubscribers(colorType)
    
    // Dispatch global event
    this.dispatchColorChangeEvent(colorType, colorValue, oldColor)
    
    return true
  }

  // Update multiple colors at once
  updateColors(colorUpdates, source = 'unknown') {
    if (this.isUpdating) {
      return false
    }

    this.isUpdating = true
    const changes = []

    try {
      // Apply all color changes
      for (const [colorType, colorValue] of Object.entries(colorUpdates)) {
        if (this.currentColors.hasOwnProperty(colorType)) {
          const oldColor = this.currentColors[colorType]
          this.currentColors[colorType] = colorValue
          changes.push({ type: colorType, oldValue: oldColor, newValue: colorValue })
        }
      }

      // Add batch to history
      if (changes.length > 0) {
        this.addToHistory({
          batch: changes,
          source: source,
          timestamp: Date.now()
        })

        // Sync all changes to subscribers
        this.syncToAllSubscribers()
        
        // Dispatch batch event
        this.dispatchBatchColorChangeEvent(changes, source)
      }

      return true
    } finally {
      this.isUpdating = false
    }
  }

  // Sync current colors to a specific subscriber
  syncToSubscriber(visualizerId) {
    const subscriber = this.subscribers.get(visualizerId)
    if (!subscriber || !subscriber.isActive) {
      return false
    }

    try {
      const colorsToSync = {}
      subscriber.properties.forEach(prop => {
        if (this.currentColors.hasOwnProperty(prop)) {
          colorsToSync[prop] = this.currentColors[prop]
        }
      })

      subscriber.callback(colorsToSync, visualizerId)
      subscriber.lastUpdate = Date.now()
      return true
    } catch (error) {
      console.error(`ColorSyncManager: Error syncing to ${visualizerId}:`, error)
      // Deactivate problematic subscriber
      subscriber.isActive = false
      return false
    }
  }

  // Sync colors to all active subscribers
  syncToAllSubscribers(specificColorType = null) {
    let successCount = 0
    let errorCount = 0

    this.subscribers.forEach((subscriber, visualizerId) => {
      if (!subscriber.isActive) {
        return
      }

      // If specific color type, only sync if subscriber cares about it
      if (specificColorType && !subscriber.properties.includes(specificColorType)) {
        return
      }

      const success = this.syncToSubscriber(visualizerId)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    })

    console.log(`ColorSyncManager: Synced to ${successCount} subscribers, ${errorCount} errors`)
    return { successCount, errorCount }
  }

  // Get current color values
  getColors() {
    return { ...this.currentColors }
  }

  // Get specific color
  getColor(colorType) {
    return this.currentColors[colorType]
  }

  // Add entry to color history
  addToHistory(entry) {
    this.colorHistory.unshift(entry)
    if (this.colorHistory.length > this.maxHistorySize) {
      this.colorHistory = this.colorHistory.slice(0, this.maxHistorySize)
    }
  }

  // Get color change history
  getHistory() {
    return [...this.colorHistory]
  }

  // Revert to previous color state
  revertLastChange() {
    if (this.colorHistory.length === 0) {
      return false
    }

    const lastChange = this.colorHistory[0]
    
    if (lastChange.batch) {
      // Revert batch changes
      const revertUpdates = {}
      lastChange.batch.forEach(change => {
        revertUpdates[change.type] = change.oldValue
      })
      return this.updateColors(revertUpdates, 'revert')
    } else {
      // Revert single change
      return this.updateColor(lastChange.type, lastChange.oldValue, 'revert')
    }
  }

  // Dispatch custom color change event
  dispatchColorChangeEvent(colorType, newValue, oldValue) {
    const event = new CustomEvent('globalColorChange', {
      detail: {
        colorType,
        newValue,
        oldValue,
        timestamp: Date.now(),
        allColors: this.getColors()
      }
    })
    document.dispatchEvent(event)
  }

  // Dispatch batch color change event
  dispatchBatchColorChangeEvent(changes, source) {
    const event = new CustomEvent('globalColorBatchChange', {
      detail: {
        changes,
        source,
        timestamp: Date.now(),
        allColors: this.getColors()
      }
    })
    document.dispatchEvent(event)
  }

  // Generate harmonious color palette based on a base color
  generateHarmoniousColors(baseColor, scheme = 'complementary') {
    const hsl = this.hexToHsl(baseColor)
    const colors = {}

    switch (scheme) {
      case 'complementary':
        colors.primary = baseColor
        colors.secondary = this.hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)
        colors.accent = this.hslToHex((hsl.h + 60) % 360, hsl.s * 0.8, Math.min(hsl.l * 1.2, 100))
        break
        
      case 'triadic':
        colors.primary = baseColor
        colors.secondary = this.hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l)
        colors.accent = this.hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
        break
        
      case 'analogous':
        colors.primary = baseColor
        colors.secondary = this.hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l)
        colors.accent = this.hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l)
        break
        
      default:
        colors.primary = baseColor
        colors.secondary = this.hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)
        colors.accent = baseColor
    }

    return colors
  }

  // Utility: Convert hex to HSL
  hexToHsl(hex) {
    const r = ((hex >> 16) & 255) / 255
    const g = ((hex >> 8) & 255) / 255
    const b = (hex & 255) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2

    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  // Utility: Convert HSL to hex
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

  // Get active subscriber count
  getActiveSubscriberCount() {
    let count = 0
    this.subscribers.forEach(subscriber => {
      if (subscriber.isActive) count++
    })
    return count
  }

  // Cleanup inactive subscribers
  cleanupInactiveSubscribers() {
    const toRemove = []
    this.subscribers.forEach((subscriber, id) => {
      if (!subscriber.isActive) {
        toRemove.push(id)
      }
    })
    
    toRemove.forEach(id => this.subscribers.delete(id))
    return toRemove.length
  }

  // Reset to default colors
  resetToDefaults() {
    const defaultColors = {
      primary: 0xff00ff,
      secondary: 0x00ffff,
      accent: 0xff6b6b,
      background: 0x000000
    }
    
    return this.updateColors(defaultColors, 'reset')
  }

  // Destroy manager and cleanup
  destroy() {
    this.subscribers.clear()
    this.colorHistory = []
    console.log('ColorSyncManager: Destroyed')
  }
}