varying vec3 vColor;

void main() {
  float r = distance(gl_PointCoord, vec2(0.5, 0.5));
  if (r > 0.5) discard;
  
  float glow = 1.0 - (r * 2.0);
  glow = pow(glow, 2.0);
  
  gl_FragColor = vec4(vColor, glow);
}