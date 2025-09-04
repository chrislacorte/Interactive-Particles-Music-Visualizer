varying vec3 vNormal;
varying vec3 vPosition;
uniform vec3 color;
uniform float time;
uniform float audioLevel;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
  fresnel = pow(fresnel, 3.0 + audioLevel * 3.0);
  
  float pulse = 0.5 + 0.5 * sin(time * 2.0);
  float audioFactor = 1.0 + audioLevel * 3.0;
  
  vec3 finalColor = color * fresnel * (0.8 + 0.2 * pulse) * audioFactor;
  
  float alpha = fresnel * (0.3 * audioFactor) * (1.0 - audioLevel * 0.2);
  
  gl_FragColor = vec4(finalColor, alpha);
}