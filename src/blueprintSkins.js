/**
 * Workd Builder — Customizable Blueprint Ghost Block Skin System
 * Lightweight GPU ShaderMaterial + animated 3D edge-outline generator
 * designed for locked 60 FPS on iPhone 16e Safari (390x844, DPR capped at 2).
 */

import * as THREE from 'three';

export const DEFAULT_BLUEPRINT_SKIN = 'classic_cyan';

export const BLUEPRINT_SKIN_CATALOG = [
  {
    id: 'classic_cyan',
    name: 'Plan Cyan Classique',
    subtitle: 'Plan architectural cyan & or lumineux',
    price: 0,
    rarity: 'commun',
    colors: ['#28dcff', '#00b4f0', '#5ae8ff', '#ffe44d'],
    fillTint: '#1dcfff',
    highlightColors: ['#7eff7a', '#ffe04a', '#a8ff8e', '#fff27a'],
    flowSpeed: 0.28,
    sparkle: 0.0,
    previewGradient: 'linear-gradient(135deg, #28dcff 0%, #00b4f0 55%, #ffe44d 100%)',
    glowColor: 'rgba(40, 220, 255, 0.55)',
  },
  {
    id: 'solar_gold',
    name: 'Or du Pharaon',
    subtitle: 'Arêtes d’or en fusion & éclats solaires',
    price: 150,
    rarity: 'rare',
    colors: ['#ffd700', '#ff8c00', '#fff09c', '#ffa600'],
    fillTint: '#ffbd2e',
    highlightColors: ['#fff6a6', '#ffd700', '#ffffff', '#ffae2b'],
    flowSpeed: 0.42,
    sparkle: 1.0,
    previewGradient: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 60%, #fff1a8 100%)',
    glowColor: 'rgba(255, 200, 40, 0.65)',
  },
  {
    id: 'prism_rgb',
    name: 'Prisme Néon RGB',
    subtitle: 'Dégradé animé émeraude → cyan → bleu → violet',
    price: 200,
    rarity: 'legendaire',
    colors: ['#2eff8b', '#00e5ff', '#3b6cff', '#b84dff'],
    fillTint: '#26d8ff',
    highlightColors: ['#5effa8', '#38f0ff', '#6e94ff', '#d47bff'],
    flowSpeed: 0.58,
    sparkle: 0.35,
    previewGradient: 'linear-gradient(135deg, #2eff8b 0%, #00e5ff 35%, #3b6cff 68%, #b84dff 100%)',
    glowColor: 'rgba(0, 229, 255, 0.68)',
  },
  {
    id: 'jade_emerald',
    name: 'Jade Impérial',
    subtitle: 'Contours lumineux émeraude & turquoise',
    price: 250,
    rarity: 'rare',
    colors: ['#00ff9d', '#00dfbe', '#00b8d4', '#38ffb4'],
    fillTint: '#00dca8',
    highlightColors: ['#80ffc9', '#42f5e6', '#b8ffe6', '#00ff9d'],
    flowSpeed: 0.44,
    sparkle: 0.25,
    previewGradient: 'linear-gradient(135deg, #00ff9d 0%, #00dfbe 52%, #00b8d4 100%)',
    glowColor: 'rgba(0, 255, 157, 0.58)',
  },
  {
    id: 'ruby_ember',
    name: 'Braise Pourpre',
    subtitle: 'Néon ardent cramoisi, magenta & ambre',
    price: 300,
    rarity: 'legendaire',
    colors: ['#ff2a6d', '#ff4d9e', '#ff9e00', '#ff3b4a'],
    fillTint: '#ff4275',
    highlightColors: ['#ff7aa8', '#ffc44d', '#ffe07a', '#ff4576'],
    flowSpeed: 0.54,
    sparkle: 0.45,
    previewGradient: 'linear-gradient(135deg, #ff2a6d 0%, #ff4d9e 46%, #ff9e00 100%)',
    glowColor: 'rgba(255, 62, 118, 0.64)',
  },
];

export function getBlueprintSkinById(skinId) {
  return BLUEPRINT_SKIN_CATALOG.find((s) => s.id === skinId) || BLUEPRINT_SKIN_CATALOG[0];
}

/* ============================================================================
 * SHARED LIGHTWEIGHT GLSL SHADERS (4-STOP ANIMATED EDGE GRADIENT + CORNER SPARKLE)
 * ========================================================================== */

const RAMP_GLSL = /* glsl */ `
  vec3 sampleSkinRamp(float phase, vec3 c0, vec3 c1, vec3 c2, vec3 c3) {
    float p = fract(phase) * 4.0;
    if (p < 1.0) return mix(c0, c1, smoothstep(0.0, 1.0, p));
    if (p < 2.0) return mix(c1, c2, smoothstep(0.0, 1.0, p - 1.0));
    if (p < 3.0) return mix(c2, c3, smoothstep(0.0, 1.0, p - 2.0));
    return mix(c3, c0, smoothstep(0.0, 1.0, p - 3.0));
  }
`;

const GHOST_FACE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 transformed = vec4(position, 1.0);
    vec3 objectNormal = normal;
    #ifdef USE_INSTANCING
      transformed = instanceMatrix * transformed;
      objectNormal = mat3(instanceMatrix) * objectNormal;
    #endif
    vec4 mvPos = modelViewMatrix * transformed;
    vViewNormal = normalize(normalMatrix * objectNormal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const GHOST_FACE_FRAG = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uFillOpacity;
  uniform float uEdgeOpacity;
  uniform float uHighlight;
  uniform float uNearbyPulse;
  uniform float uSparkle;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uFillTint;

  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vViewNormal;
  varying vec3 vViewDir;

  ${RAMP_GLSL}

  void main() {
    // Continuous 3D edge phase flowing cleanly across all 12 cube edges
    float spatial = (vLocalPos.x * 0.56 + vLocalPos.y * 0.72 - vLocalPos.z * 0.56) * 0.85;
    float phase = spatial + uTime * uFlowSpeed;
    vec3 neonCol = sampleSkinRamp(phase, uColor0, uColor1, uColor2, uColor3);

    // Distance to nearest UV face border (creates luminous neon edge tubes on Safari mobile)
    float edgeX = min(vUv.x, 1.0 - vUv.x);
    float edgeY = min(vUv.y, 1.0 - vUv.y);
    float edgeDist = min(edgeX, edgeY);

    float coreWidth = mix(0.048, 0.068, uHighlight);
    float haloWidth = mix(0.145, 0.21, uHighlight);
    float edgeCore = 1.0 - smoothstep(coreWidth * 0.45, coreWidth, edgeDist);
    float edgeHalo = 1.0 - smoothstep(coreWidth * 0.7, haloWidth, edgeDist);

    // Subtle animated corner sparkles (prominent on Solar Gold, subtle shimmer on Prism/Ruby)
    float cornerDist = length(vec2(edgeX, edgeY));
    float sparkleWave = 0.5 + 0.5 * sin(uTime * 6.4 + vLocalPos.x * 7.0 + vLocalPos.z * 9.0 + vLocalPos.y * 5.0);
    float cornerSpark = uSparkle * (1.0 - smoothstep(0.02, 0.16, cornerDist)) * (0.45 + 0.55 * sparkleWave);

    // Fresnel glass rim + subtle diagonal blueprint hatch inside face
    float ndotv = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
    float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 1.85);
    float diag = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 28.0);
    float hatch = smoothstep(0.75, 0.98, diag) * 0.06;

    // Gentle breathing pulse amplified when dragging a finished block nearby
    float breath = 1.0 + sin(uTime * mix(2.8, 5.4, max(uHighlight, uNearbyPulse))) * mix(0.07, 0.16, max(uHighlight, uNearbyPulse));

    vec3 glassColor = mix(uFillTint, neonCol, 0.48 + fresnel * 0.32);
    vec3 col = mix(glassColor, neonCol * (1.18 + uHighlight * 0.22), clamp(edgeHalo * 0.72 + edgeCore * 0.95, 0.0, 1.0));
    col += vec3(1.0, 0.97, 0.86) * (edgeCore * (0.28 + uHighlight * 0.25) + cornerSpark * 0.72);
    col *= breath;

    float interiorAlpha = (uFillOpacity + fresnel * 0.12 + hatch) * (1.0 + uNearbyPulse * 0.16);
    float edgeAlpha = (edgeHalo * 0.42 + edgeCore * uEdgeOpacity + cornerSpark * 0.55);
    float alpha = clamp(max(interiorAlpha, edgeAlpha), 0.0, 0.96);

    gl_FragColor = vec4(col, alpha);
  }
`;

const GHOST_LINE_VERT = /* glsl */ `
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GHOST_LINE_FRAG = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uOpacity;
  uniform float uHighlight;
  uniform float uNearbyPulse;
  uniform float uSparkle;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  varying vec3 vLocalPos;

  ${RAMP_GLSL}

  void main() {
    float spatial = (vLocalPos.x * 0.56 + vLocalPos.y * 0.72 - vLocalPos.z * 0.56) * 0.85;
    float phase = spatial + uTime * uFlowSpeed;
    vec3 neonCol = sampleSkinRamp(phase, uColor0, uColor1, uColor2, uColor3);

    float pulse = 1.0 + sin(uTime * mix(3.2, 6.2, max(uHighlight, uNearbyPulse))) * mix(0.08, 0.2, max(uHighlight, uNearbyPulse));
    float cornerFactor = smoothstep(0.55, 0.82, length(vLocalPos));
    float spark = uSparkle * cornerFactor * (0.5 + 0.5 * sin(uTime * 7.2 + vLocalPos.x * 9.0 - vLocalPos.z * 7.0));

    vec3 col = neonCol * (1.16 + uHighlight * 0.28) * pulse + vec3(1.0, 0.98, 0.9) * (0.16 + spark * 0.55 + uHighlight * 0.22);
    float alpha = clamp(uOpacity * (0.9 + 0.1 * pulse) + uHighlight * 0.1, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

function buildFaceMaterial(skin, isHighlight) {
  const palette = isHighlight ? skin.highlightColors : skin.colors;
  const mat = new THREE.ShaderMaterial({
    vertexShader: GHOST_FACE_VERT,
    fragmentShader: GHOST_FACE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: isHighlight ? skin.flowSpeed * 1.45 : skin.flowSpeed },
      uFillOpacity: { value: isHighlight ? 0.56 : 0.26 },
      uEdgeOpacity: { value: isHighlight ? 0.98 : 0.92 },
      uHighlight: { value: isHighlight ? 1.0 : 0.0 },
      uNearbyPulse: { value: 0.0 },
      uSparkle: { value: skin.sparkle },
      uColor0: { value: new THREE.Color(palette[0]) },
      uColor1: { value: new THREE.Color(palette[1]) },
      uColor2: { value: new THREE.Color(palette[2]) },
      uColor3: { value: new THREE.Color(palette[3]) },
      uFillTint: { value: new THREE.Color(isHighlight ? palette[0] : skin.fillTint) },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  mat.userData.skinId = skin.id;
  mat.userData.isBlueprintSkinMat = true;
  mat.userData.isHighlight = isHighlight;
  return mat;
}

function buildLineMaterial(skin, isHighlight) {
  const palette = isHighlight ? skin.highlightColors : skin.colors;
  const mat = new THREE.ShaderMaterial({
    vertexShader: GHOST_LINE_VERT,
    fragmentShader: GHOST_LINE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: isHighlight ? skin.flowSpeed * 1.45 : skin.flowSpeed },
      uOpacity: { value: isHighlight ? 1.0 : 0.96 },
      uHighlight: { value: isHighlight ? 1.0 : 0.0 },
      uNearbyPulse: { value: 0.0 },
      uSparkle: { value: skin.sparkle },
      uColor0: { value: new THREE.Color(palette[0]) },
      uColor1: { value: new THREE.Color(palette[1]) },
      uColor2: { value: new THREE.Color(palette[2]) },
      uColor3: { value: new THREE.Color(palette[3]) },
    },
    transparent: true,
    depthWrite: false,
  });
  mat.userData.skinId = skin.id;
  mat.userData.isBlueprintSkinMat = true;
  mat.userData.isHighlight = isHighlight;
  return mat;
}

/**
 * Creates the 4 standardized ghost materials for any blueprint skin ID:
 * { ghostNormal, ghostHighlight, ghostLineNormal, ghostLineHighlight }
 */
export function createBlueprintSkinMaterialSet(skinId = DEFAULT_BLUEPRINT_SKIN) {
  const skin = getBlueprintSkinById(skinId);
  return {
    skinId: skin.id,
    ghostNormal: buildFaceMaterial(skin, false),
    ghostHighlight: buildFaceMaterial(skin, true),
    ghostLineNormal: buildLineMaterial(skin, false),
    ghostLineHighlight: buildLineMaterial(skin, true),
  };
}

/**
 * Updates an existing blueprint skin material set in-place to a new skinId
 * with zero geometry rebuilds and zero material re-allocations!
 */
export function applyBlueprintSkinToMaterials(mats, skinId = DEFAULT_BLUEPRINT_SKIN) {
  if (!mats) return;
  const skin = getBlueprintSkinById(skinId);

  const syncUniforms = (mat, isHighlight) => {
    if (!mat || !mat.uniforms) return;
    const palette = isHighlight ? skin.highlightColors : skin.colors;
    const u = mat.uniforms;
    if (u.uFlowSpeed) u.uFlowSpeed.value = isHighlight ? skin.flowSpeed * 1.45 : skin.flowSpeed;
    if (u.uSparkle) u.uSparkle.value = skin.sparkle;
    if (u.uColor0) u.uColor0.value.set(palette[0]);
    if (u.uColor1) u.uColor1.value.set(palette[1]);
    if (u.uColor2) u.uColor2.value.set(palette[2]);
    if (u.uColor3) u.uColor3.value.set(palette[3]);
    if (u.uFillTint) u.uFillTint.value.set(isHighlight ? palette[0] : skin.fillTint);
    mat.userData.skinId = skin.id;
  };

  syncUniforms(mats.ghostNormal, false);
  syncUniforms(mats.ghostHighlight, true);
  syncUniforms(mats.ghostLineNormal, false);
  syncUniforms(mats.ghostLineHighlight, true);
  mats.blueprintSkinId = skin.id;
}

/**
 * Per-frame O(1) uniform update driving animated RGB Prism / Solar Gold / Jade / Ruby glow
 * and subtle pulse boost when dragging a finished block nearby.
 */
export function updateBlueprintSkinUniforms(mats, elapsed, { isDraggingFinished = false } = {}) {
  if (!mats) return;
  const nearby = isDraggingFinished ? 1.0 : 0.0;
  const targets = [
    mats.ghostNormal,
    mats.ghostHighlight,
    mats.ghostLineNormal,
    mats.ghostLineHighlight,
  ];
  for (let i = 0; i < targets.length; i++) {
    const m = targets[i];
    if (m && m.uniforms) {
      if (m.uniforms.uTime) m.uniforms.uTime.value = elapsed;
      if (m.uniforms.uNearbyPulse) {
        m.uniforms.uNearbyPulse.value = THREE.MathUtils.lerp(
          m.uniforms.uNearbyPulse.value,
          nearby,
          0.18
        );
      }
    }
  }
}

/**
 * Lightweight shared 3D blueprint ghost block generator supporting any dimensions & skinId.
 * Produces a Group lifted +0.02 cleanly above foundations with neon-bordered glass (renderOrder: 5)
 * and animated vertex-colored/shader LineSegments (renderOrder: 6).
 */
export function createBlueprintGhostMesh(
  width = 0.96,
  height = 0.64,
  depth = 0.96,
  skinId = DEFAULT_BLUEPRINT_SKIN,
  { liftY = 0.02, sharedMats = null } = {}
) {
  const mats = sharedMats || createBlueprintSkinMaterialSet(skinId);
  const ownsMats = !sharedMats;

  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(width, height, depth);
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);

  const ghostMesh = new THREE.Mesh(boxGeo, mats.ghostNormal);
  ghostMesh.renderOrder = 5;
  ghostMesh.position.y = liftY;

  const ghostLines = new THREE.LineSegments(edgesGeo, mats.ghostLineNormal);
  ghostLines.renderOrder = 6;
  ghostLines.position.y = liftY;

  group.add(ghostMesh);
  group.add(ghostLines);

  group.userData = {
    ghostMesh,
    ghostLines,
    mats,
    ownsMats,
    setSkin(nextSkinId) {
      applyBlueprintSkinToMaterials(mats, nextSkinId);
    },
    setHighlight(active) {
      ghostMesh.material = active ? mats.ghostHighlight : mats.ghostNormal;
      ghostLines.material = active ? mats.ghostLineHighlight : mats.ghostLineNormal;
    },
    update(elapsed, opts) {
      updateBlueprintSkinUniforms(mats, elapsed, opts);
    },
    dispose() {
      boxGeo.dispose();
      edgesGeo.dispose();
      if (ownsMats) {
        mats.ghostNormal.dispose();
        mats.ghostHighlight.dispose();
        mats.ghostLineNormal.dispose();
        mats.ghostLineHighlight.dispose();
      }
    },
  };

  return group;
}
