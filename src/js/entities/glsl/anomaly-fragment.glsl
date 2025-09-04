uniform float time;
uniform vec3 color;
uniform float audioLevel;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
  fresnel = pow(fresnel, 2.0 + audioLevel * 2.0);
  
  float pulse = 0.8 + 0.2 * sin(time * 2.0);
  
  vec3 finalColor = color * fresnel * pulse * (1.0 + audioLevel * 0.8);
  
  float alpha = fresnel * (0.7 - audioLevel * 0.3);
  
  gl_FragColor = vec4(finalColor, alpha);
}