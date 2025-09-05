uniform float u_time;
uniform float u_audio_bass;
uniform float u_audio_mid;
uniform float u_audio_treble;
uniform float u_audio_overall;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vNoise;

void main() {
  // Base color with audio-reactive hue shifting
  vec3 baseColor = vec3(0.8, 0.4, 0.9); // Purple-ish base
  
  // Audio-reactive color modulation
  vec3 bassColor = vec3(1.0, 0.2, 0.2); // Red for bass
  vec3 midColor = vec3(0.2, 1.0, 0.2);  // Green for mid
  vec3 trebleColor = vec3(0.2, 0.2, 1.0); // Blue for treble
  
  // Mix colors based on audio frequencies
  vec3 audioColor = baseColor;
  audioColor = mix(audioColor, bassColor, u_audio_bass * 0.5);
  audioColor = mix(audioColor, midColor, u_audio_mid * 0.3);
  audioColor = mix(audioColor, trebleColor, u_audio_treble * 0.4);
  
  // Add noise-based color variation
  float colorNoise = snoise(vec4(vPosition * 2.0, u_time * 0.3));
  audioColor += colorNoise * 0.1;
  
  // Calculate lighting
  vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
  float lightIntensity = max(0.0, dot(vNormal, lightDirection));
  
  // Add ambient lighting
  float ambient = 0.3 + u_audio_overall * 0.2;
  lightIntensity = ambient + lightIntensity * 0.7;
  
  // Apply fresnel effect for rim lighting
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
  fresnel = pow(fresnel, 2.0);
  
  // Combine lighting and fresnel
  vec3 finalColor = audioColor * lightIntensity;
  finalColor += fresnel * vec3(0.5, 0.8, 1.0) * (0.3 + u_audio_overall * 0.5);
  
  // Add subtle pulsing based on overall audio
  finalColor *= 1.0 + sin(u_time * 4.0) * u_audio_overall * 0.1;
  
  gl_FragColor = vec4(finalColor, 1.0);
}