varying vec3 vNormal;
varying vec3 vPosition;
uniform float audioLevel;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position * (1.0 + audioLevel * 0.2);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}