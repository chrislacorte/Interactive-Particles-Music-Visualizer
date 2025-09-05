uniform float u_time;
uniform float u_width;
uniform float u_bump_frequency;
uniform float u_bump_scale;
uniform float u_audio_bass;
uniform float u_audio_mid;
uniform float u_audio_treble;
uniform float u_audio_overall;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vNoise;

void main() {
  vNormal = normalize(normalMatrix * normal);
  
  // Calculate noise based on position and time
  vec4 noiseInput = vec4(position * u_bump_frequency, u_time * 0.5);
  float noise = snoise(noiseInput);
  
  // Add audio reactivity to the noise
  float audioNoise = u_audio_bass * 0.3 + u_audio_mid * 0.5 + u_audio_treble * 0.2;
  noise += audioNoise * 0.5;
  
  // Apply displacement along normal
  vec3 displacedPosition = position + normal * noise * u_bump_scale * u_width;
  
  // Add overall audio pulsing
  float pulse = 1.0 + u_audio_overall * 0.2;
  displacedPosition *= pulse;
  
  vPosition = displacedPosition;
  vNoise = noise;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}