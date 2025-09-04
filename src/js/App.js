import * as THREE from 'three'
import ReativeParticles from './entities/ReactiveParticles'
import AnomalyVisualizer from './entities/AnomalyVisualizer'
import AudioReactiveVisualizer from './entities/AudioReactiveVisualizer'
import DistortionVisualizer from './entities/DistortionVisualizer'
import MicrophoneVisualizer from './entities/MicrophoneVisualizer'
import FingerPaintingVisualizer from './entities/FingerPaintingVisualizer'
import * as dat from 'dat.gui'
import BPMManager from './managers/BPMManager'
import AdvancedAudioManager from './managers/AdvancedAudioManager'
import FileUploadManager from './managers/FileUploadManager'
import GestureManager from './managers/GestureManager'
import VisualizationModeManager from './managers/VisualizationModeManager'

export default class App {
  //THREE objects
  static holder = null
  static camera = null
  static gui = null

  //Managers
  static advancedAudioManager = null
  static bpmManager = null
  static fileUploadManager = null
  static gestureManager = null
  static visualizationModeManager = null
  
  //Visual entities
  static particles = null
  static anomalyVisualizer = null
  static audioReactiveVisualizer = null
  static distortionVisualizer = null
  static microphoneVisualizer = null
  static fingerPaintingVisualizer = null

  constructor() {
    this.onClickBinder = () => this.init()
    document.addEventListener('click', this.onClickBinder)
  }

  init() {
    document.removeEventListener('click', this.onClickBinder)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })

    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.autoClear = false
    document.querySelector('.content').appendChild(this.renderer.domElement)

    App.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10000)
    App.camera.position.z = 12
    App.camera.frustumCulled = false

    this.scene = new THREE.Scene()
    this.scene.add(App.camera)

    App.holder = new THREE.Object3D()
    App.holder.name = 'holder'
    this.scene.add(App.holder)
    App.holder.sortObjects = false

    App.gui = new dat.GUI()

    this.createManagers()

    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  async createManagers() {
    // Initialize file upload manager
    App.fileUploadManager = new FileUploadManager()
    App.fileUploadManager.init()
    
    // Initialize gesture manager
    App.gestureManager = new GestureManager()
    
    // Initialize visualization mode manager
    App.visualizationModeManager = new VisualizationModeManager()
    
    App.advancedAudioManager = new AdvancedAudioManager()
    await App.advancedAudioManager.loadAudioBuffer()

    // Initialize visual entities first
    App.particles = new ReativeParticles()
    App.particles.init()
    
    App.anomalyVisualizer = new AnomalyVisualizer()
    App.anomalyVisualizer.init()
    
    App.audioReactiveVisualizer = new AudioReactiveVisualizer()
    App.audioReactiveVisualizer.init()
    
    App.distortionVisualizer = new DistortionVisualizer()
    App.distortionVisualizer.init()
    
    App.microphoneVisualizer = new MicrophoneVisualizer()
    
    App.fingerPaintingVisualizer = new FingerPaintingVisualizer()
    App.fingerPaintingVisualizer.init()
    
    // Start with particles mode, hide anomaly visualizer
    App.anomalyVisualizer.visible = false
    App.audioReactiveVisualizer.visible = false
    App.distortionVisualizer.visible = false
    App.fingerPaintingVisualizer.visible = false

    App.bpmManager = new BPMManager()
    App.bpmManager.addEventListener('beat', () => {
      App.particles.onBPMBeat()
    })
    await App.bpmManager.detectBPM(App.advancedAudioManager.audio.buffer)

    // Setup file upload callback
    App.fileUploadManager.onFileLoaded(async (audioBuffer, fileName) => {
      await App.advancedAudioManager.loadCustomAudioBuffer(audioBuffer, fileName)
      await App.bpmManager.detectBPM(audioBuffer)
    })
    
    // Initialize gesture controls (optional - user can enable later)
    try {
      await App.gestureManager.init()
    } catch (error) {
      console.log('Gesture controls not available:', error.message)
    }
    document.querySelector('.user_interaction').remove()



    // Initialize visualization mode manager and set up mode change callback
    App.visualizationModeManager.init()
    App.visualizationModeManager.onModeChange((newMode, previousMode) => {
      this.handleVisualizationModeChange(newMode, previousMode)
    })

    this.update()
  }

  handleVisualizationModeChange(newMode, previousMode) {
    console.log(`Switching visualization from ${previousMode} to ${newMode}`)
    
    // Temporarily disable mode switching during transition
    App.visualizationModeManager.setEnabled(false)
    
    // Handle microphone mode cleanup
    if (previousMode === 'microphone' && App.microphoneVisualizer) {
      App.microphoneVisualizer.destroy()
    }
    
    // Handle finger painting mode cleanup
    if (previousMode === 'finger-painting' && App.fingerPaintingVisualizer) {
      App.fingerPaintingVisualizer.destroy()
      App.fingerPaintingVisualizer.init() // Reinitialize for next use
    }
    
    // Stop/start audio manager based on mode
    if (newMode === 'microphone' || newMode === 'finger-painting') {
      if (App.advancedAudioManager && App.advancedAudioManager.isPlaying) {
        App.advancedAudioManager.pause()
      }
    } else {
      if (App.advancedAudioManager && !App.advancedAudioManager.isPlaying) {
        App.advancedAudioManager.play()
      }
    }
    
    // Hide all visualizers first
    if (App.particles) App.particles.visible = false
    if (App.anomalyVisualizer) App.anomalyVisualizer.visible = false
    if (App.audioReactiveVisualizer) App.audioReactiveVisualizer.visible = false
    if (App.distortionVisualizer) App.distortionVisualizer.visible = false
    if (App.fingerPaintingVisualizer) App.fingerPaintingVisualizer.visible = false
    
    // Switch visualization based on the selected mode
    switch (newMode) {
      case 'particles':
        App.particles.visible = true
        App.particles.properties.autoMix = true
        App.particles.resetMesh()
        break
        
      case 'circles':
        App.particles.visible = true
        App.particles.destroyMesh()
        App.particles.createCylinderMesh()
        App.particles.properties.autoMix = false
        break
        
      case 'lines':
        App.particles.visible = true
        App.particles.destroyMesh()
        App.particles.createBoxMesh()
        App.particles.properties.autoMix = false
        break
        
      case 'anomaly':
        App.anomalyVisualizer.visible = true
        // Reset anomaly visualizer state
        App.anomalyVisualizer.anomalyTargetPosition.set(0, 0, 0)
        App.anomalyVisualizer.anomalyVelocity.set(0, 0)
        if (App.anomalyVisualizer.anomalyObject) {
          App.anomalyVisualizer.anomalyObject.position.set(0, 0, 0)
        }
        break
        
      case 'audio-reactive':
        App.audioReactiveVisualizer.visible = true
        break
        
      case 'distortion':
        App.distortionVisualizer.visible = true
        break
        
      case 'finger-painting':
        App.fingerPaintingVisualizer.visible = true
        // Clear previous painting when entering mode
        App.fingerPaintingVisualizer.clearCanvas()
        break
        
      case 'microphone':
        // Initialize microphone visualizer when selected
        if (App.microphoneVisualizer) {
          App.microphoneVisualizer.init().catch(error => {
            console.error('Failed to initialize microphone visualizer:', error)
            // Fallback to particles mode
            setTimeout(() => {
              App.visualizationModeManager.setMode('particles')
            }, 100)
          })
        }
        break
        
      default:
        console.warn(`Unknown visualization mode: ${newMode}`)
        // Fallback to particles mode
        App.particles.visible = true
        App.particles.properties.autoMix = true
        break
    }
    
    // Re-enable mode switching after a short delay
    setTimeout(() => {
      App.visualizationModeManager.setEnabled(true)
    }, 500)
  }
  resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight

    App.camera.aspect = this.width / this.height
    App.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
    
    // Update gesture canvas size if active
    if (App.gestureManager?.isEnabled) {
      const canvas = document.querySelector('.gesture-canvas')
      if (canvas) {
        canvas.width = 320
        canvas.height = 240
      }
    }
  }

  update() {
    requestAnimationFrame(() => this.update())

    // Update active visualizers
    if (App.particles?.visible) {
      App.particles.update()
    }
    
    if (App.anomalyVisualizer?.visible) {
      App.anomalyVisualizer.update()
    }
    
    if (App.audioReactiveVisualizer?.visible) {
      App.audioReactiveVisualizer.update()
    }
    
    if (App.distortionVisualizer?.visible) {
      App.distortionVisualizer.update()
    }
    
    if (App.fingerPaintingVisualizer?.visible) {
      // Finger painting visualizer handles its own animation loop
      // Just ensure it's receiving audio data
    }
    
    App.advancedAudioManager.update()

    this.renderer.render(this.scene, App.camera)
  }
}
