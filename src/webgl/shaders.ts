export const quadVertexShader = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const dropFragmentShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_texture;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_strength;

void main() {
  vec4 info = texture(u_texture, v_uv);
  float dist = length(v_uv - u_center);
  if (dist < u_radius) {
    // Smooth cosine wave impulse
    float factor = max(0.0, cos(dist / u_radius * 3.141592653589793 * 0.5));
    info.r += u_strength * factor;
  }
  fragColor = info;
}
`;

export const windFragmentShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_texture;
uniform float u_time;
uniform float u_strength;

void main() {
  vec4 info = texture(u_texture, v_uv);
  float bands = sin((v_uv.x * 17.0 + v_uv.y * 11.0) + u_time * 2.1);
  float detail = sin((v_uv.x * 41.0 - v_uv.y * 29.0) - u_time * 1.4);
  float edge = smoothstep(0.0, 0.08, v_uv.x) * smoothstep(0.0, 0.08, v_uv.y)
    * smoothstep(0.0, 0.08, 1.0 - v_uv.x) * smoothstep(0.0, 0.08, 1.0 - v_uv.y);
  info.r += (bands * 0.65 + detail * 0.35) * u_strength * edge;
  fragColor = info;
}
`;

export const updateFragmentShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_texture;
uniform vec2 u_delta;
uniform float u_damping;

void main() {
  vec4 info = texture(u_texture, v_uv);
  
  // Sample 4-point cardinal neighbors
  float top = texture(u_texture, v_uv + vec2(0.0, u_delta.y)).r;
  float bottom = texture(u_texture, v_uv - vec2(0.0, u_delta.y)).r;
  float left = texture(u_texture, v_uv - vec2(u_delta.x, 0.0)).r;
  float right = texture(u_texture, v_uv + vec2(u_delta.x, 0.0)).r;

  // Discrete 2D wave propagation equation:
  // info.r is current height, info.g is previous height
  float next = (top + bottom + left + right) * 0.5 - info.g;
  float shore = smoothstep(0.0, 0.04, min(min(v_uv.x, v_uv.y), min(1.0 - v_uv.x, 1.0 - v_uv.y)));
  next *= mix(0.94, u_damping, shore);

  // Store new height in .r, current becomes previous in .g
  fragColor = vec4(next, info.r, 0.0, 1.0);
}
`;

export const compositeFragmentShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_water;        // Height map (.r = current, .g = previous)
uniform sampler2D u_riverbed;     // Static riverbed
uniform sampler2D u_underwater;   // Dynamic submerged koi fish + food
uniform sampler2D u_sky;          // Sky reflection gradient
uniform sampler2D u_floating;     // Surface leaves / lotus pads
uniform vec2 u_delta;
uniform vec3 u_lightDir;
uniform float u_refraction;
uniform float u_specular;
uniform float u_caustics;
uniform vec3 u_waterTint;
uniform float u_time;

void main() {
  // Compute normal from heightfield spatial gradient
  float top = texture(u_water, v_uv + vec2(0.0, u_delta.y)).r;
  float bottom = texture(u_water, v_uv - vec2(0.0, u_delta.y)).r;
  float left = texture(u_water, v_uv - vec2(u_delta.x, 0.0)).r;
  float right = texture(u_water, v_uv + vec2(u_delta.x, 0.0)).r;
  float current = texture(u_water, v_uv).r;

  // Surface normal vector with calibrated scaling
  vec2 micro = vec2(sin(v_uv.y * 95.0 + u_time * 1.7), cos(v_uv.x * 83.0 - u_time * 1.3)) * 0.012;
  vec3 normal = normalize(vec3((left - right) * 2.8 + micro.x, (bottom - top) * 2.8 + micro.y, 1.0));

  // 1. Water Refraction (distorting underwater pebbles & fish)
  vec2 refractOffset = normal.xy * u_refraction;
  vec2 underwaterUV = clamp(v_uv + refractOffset, 0.0, 1.0);
  vec4 underwaterColor = texture(u_riverbed, underwaterUV);
  vec4 underwaterEntities = texture(u_underwater, underwaterUV);
  underwaterColor.rgb = mix(underwaterColor.rgb, underwaterEntities.rgb, underwaterEntities.a);

  // 2. Dynamic Underwater Caustics with Vibrant Lagoon Glow
  // Laplacian approximates surface curvature and light focusing
  float laplacian = (top + bottom + left + right) - 4.0 * current;
  float causticLight = clamp(laplacian * 16.0 * u_caustics, -0.25, 0.95);
  // Vibrant cyan-aquamarine caustic light
  vec3 causticColor = mix(vec3(0.15, 0.92, 0.84), vec3(0.9, 1.0, 1.0), 0.65);
  underwaterColor.rgb += causticLight * causticColor;

  // 3. Water Depth Color Tint (Deep Nocturnal Teal Abyss)
  underwaterColor.rgb = mix(underwaterColor.rgb, u_waterTint, 0.22);

  // 4. Fresnel Sky Reflection
  vec3 eyeDir = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - max(0.0, dot(normal, eyeDir)), 3.0);
  fresnel = clamp(0.12 + 0.88 * fresnel, 0.0, 1.0);

  // Sample sky gradient reflection with normal distortion
  vec2 skyUV = clamp(v_uv * 0.45 + normal.xy * 0.35 + vec2(0.27, 0.27), 0.0, 1.0);
  vec4 skyColor = texture(u_sky, skyUV);

  // Composite underwater view with sky reflection
  vec3 finalColor = mix(underwaterColor.rgb, skyColor.rgb, fresnel * 0.42);

  // 5. Specular Sunlight Glint
  vec3 normLight = normalize(u_lightDir);
  vec3 reflected = reflect(-normLight, normal);
  float spec = pow(max(0.0, dot(reflected, eyeDir)), 42.0) * u_specular;
  finalColor += spec * vec3(1.0, 0.98, 0.92);

  // 6. Surface Floating Elements (Lily pads, lotus flowers, cherry petals)
  vec4 floatElem = texture(u_floating, v_uv);
  finalColor = mix(finalColor, floatElem.rgb, floatElem.a);

  fragColor = vec4(finalColor, 1.0);
}
`;
