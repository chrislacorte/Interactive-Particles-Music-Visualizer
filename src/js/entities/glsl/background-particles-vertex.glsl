attribute float size;
varying vec3 vColor;
uniform float time;

void main() {
  vColor = color;
  
  vec3 pos = position;
  pos.x += sin(time * 0.1 + position.z * 0.2) * 0.05;
  pos.y += cos(time * 0.1 + position.x * 0.2) * 0.05;
  pos.z += sin(time * 0.1 + position.y * 0.2) * 0.05;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}