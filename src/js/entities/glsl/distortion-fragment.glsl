precision mediump float;

uniform float time;
uniform float audioLevel;
uniform float bassLevel;
uniform float midLevel;
uniform float trebleLevel;
uniform vec2 handPosition;
uniform float handInfluence;
uniform vec3 baseColor;
uniform vec3 accentColor;
uniform float grainIntensity;

varying vec2 vUv;
varying float vDistortion;
varying float vAudioInfluence;

// Random function for grain effect
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Noise function
float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  
  // Calculate distance from hand position for color influence
  float handDistance = distance(uv, handPosition * 0.5 + 0.5);
  float handColorEffect = 1.0 - smoothstep(0.0, 0.4, handDistance);
  
  // Base color mixing based on audio
  vec3 color = mix(baseColor, accentColor, vAudioInfluence * 0.5);
  
  // Hand influence on color
  if (handInfluence > 0.1) {
    vec3 handColor = vec3(1.0, 0.5, 0.8); // Pink-ish color for hand interaction
    color = mix(color, handColor, handColorEffect * handInfluence * 0.7);
  }
  
  // Audio-reactive color shifts
  color.r += sin(time * 2.0 + uv.x * 10.0) * bassLevel * 0.3;
  color.g += cos(time * 1.5 + uv.y * 8.0) * midLevel * 0.3;
  color.b += sin(time * 3.0 + length(uv) * 12.0) * trebleLevel * 0.3;
  
  // Distortion-based brightness
  float brightness = 1.0 + vDistortion * 0.5;
  color *= brightness;
  
  // Grain effect
  float grain = noise(uv * 100.0 + time * 0.5) * grainIntensity;
  color += grain * 0.1;
  
  // Vignette effect
  float vignette = 1.0 - smoothstep(0.3, 1.0, length(uv - 0.5));
  color *= vignette;
  
  // Pulsing effect based on overall audio
  float pulse = 1.0 + sin(time * 4.0) * audioLevel * 0.2;
  color *= pulse;
  
  gl_FragColor = vec4(color, 1.0);
}