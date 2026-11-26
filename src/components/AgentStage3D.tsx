import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAgentModel } from '../three/buildAgentModel';
import { createParticleSprite } from '../three/proceduralTextures';
import { AgentControlsState, AgentMode } from '../types/agent';

interface AgentStage3DProps {
  controlsState: AgentControlsState;
  controlsOpen: boolean;
  resetCameraSignal: number;
  onToggleControls: () => void;
  onAgentInteract?: () => void;
}

// Pre-allocated math helpers (zero per-frame GC allocations)
const _ndc = new THREE.Vector2(0, 0);
const _raycaster = new THREE.Raycaster();
const _gazePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3.0);
const _gazeWorld = new THREE.Vector3(0, 1.76, 3.0);
const _localTarget = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _defaultCamPos = new THREE.Vector3(0, 1.24, 6.45);
const _defaultTarget = new THREE.Vector3(0, 1.04, 0);
const _emissiveColor = new THREE.Color();
const _coreHintWorld = new THREE.Vector3();
const _coreWorldPos = new THREE.Vector3();
const _coreForward = new THREE.Vector3();
const _coreQuat = new THREE.Quaternion();

const MODE_CONFIGS: Record<
  AgentMode,
  {
    emissiveHex: number;
    emissiveIntensity: number;
    lidOpen: number;
    pupilScale: number;
    haloSpeed: number;
  }
> = {
  standby: {
    emissiveHex: 0x2563eb,
    emissiveIntensity: 2.1,
    lidOpen: 0.88,
    pupilScale: 1.0,
    haloSpeed: 0.35,
  },
  analyzing: {
    emissiveHex: 0x38bdf8,
    emissiveIntensity: 2.8,
    lidOpen: 0.46,
    pupilScale: 0.72,
    haloSpeed: 1.35,
  },
  focused: {
    emissiveHex: 0x60a5fa,
    emissiveIntensity: 3.4,
    lidOpen: 1.0,
    pupilScale: 1.25,
    haloSpeed: 0.75,
  },
  sleep: {
    emissiveHex: 0x1e3a8a,
    emissiveIntensity: 0.45,
    lidOpen: 0.0,
    pupilScale: 0.9,
    haloSpeed: 0.08,
  },
};

export function AgentStage3D({
  controlsState,
  controlsOpen,
  resetCameraSignal,
  onToggleControls,
  onAgentInteract,
}: AgentStage3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const coreHintRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<AgentControlsState>(controlsState);
  const controlsOpenRef = useRef<boolean>(controlsOpen);
  const toggleCallbackRef = useRef(onToggleControls);
  const interactCallbackRef = useRef(onAgentInteract);
  const resetGoalRef = useRef(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [sceneRevision, setSceneRevision] = useState(0);

  stateRef.current = controlsState;
  controlsOpenRef.current = controlsOpen;
  toggleCallbackRef.current = onToggleControls;
  interactCallbackRef.current = onAgentInteract;

  useEffect(() => {
    if (resetCameraSignal > 0) {
      resetGoalRef.current = true;
    }
  }, [resetCameraSignal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth || 1;
    const height = container.clientHeight || window.innerHeight || 1;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070e);
    scene.fog = new THREE.FogExp2(0x04070e, 0.042);

    // Studio environment reflections (PMREM + RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    camera.position.copy(_defaultCamPos);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.copy(_defaultTarget);
    orbit.enablePan = false;
    orbit.enableZoom = false; // Keep page scroll smooth
    orbit.enableDamping = !isSoftwareGl;
    orbit.dampingFactor = 0.06;
    orbit.minPolarAngle = Math.PI * 0.3;
    orbit.maxPolarAngle = Math.PI * 0.62;
    orbit.minAzimuthAngle = -Math.PI * 0.42;
    orbit.maxAzimuthAngle = Math.PI * 0.42;
    orbit.update();
    // Override OrbitControls' touchAction='none' so vertical touch swipes scroll the page while horizontal swipes still orbit
    renderer.domElement.style.touchAction = 'pan-y';

    const onOrbitStart = () => {
      resetGoalRef.current = false;
    };
    orbit.addEventListener('start', onOrbitStart);

    // 3-point blue-tinted studio lighting rig
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x050814, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xeef6ff, 2.1);
    keyLight.position.set(3.5, 5.2, 4.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -3.2;
    keyLight.shadow.camera.right = 3.2;
    keyLight.shadow.camera.top = 3.6;
    keyLight.shadow.camera.bottom = -1.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const cobaltRimLight = new THREE.DirectionalLight(0x2563eb, 2.6);
    cobaltRimLight.position.set(-4.2, 3.0, -3.5);
    scene.add(cobaltRimLight);

    const iceRimLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    iceRimLight.position.set(3.8, 2.2, -3.8);
    scene.add(iceRimLight);

    const faceFillLight = new THREE.PointLight(0x38bdf8, 1.4, 8, 2);
    faceFillLight.position.set(0, 1.7, 2.4);
    scene.add(faceFillLight);

    const underGlowLight = new THREE.PointLight(0x2563eb, 1.8, 5, 2);
    underGlowLight.position.set(0, 0.25, 0);
    scene.add(underGlowLight);

    const particleSprite = createParticleSprite();
    const spaceDisposables: Array<{ dispose: () => void }> = [];

    // 1. Subtle soft cobalt depth glow behind Consy (keeps exact #04070E theme)
    const nebulaSpecs = [
      { pos: [-3.8, 2.1, -11] as const, scale: 11, color: 0x1d4ed8, opacity: 0.16 },
      { pos: [4.2, 0.2, -12] as const, scale: 12, color: 0x2563eb, opacity: 0.14 },
      { pos: [0.0, 1.1, -9.5] as const, scale: 8.5, color: 0x0284c7, opacity: 0.13 },
    ];
    for (const spec of nebulaSpecs) {
      const mat = new THREE.SpriteMaterial({
        map: particleSprite,
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      sprite.scale.set(spec.scale * 1.35, spec.scale, 1);
      scene.add(sprite);
      spaceDisposables.push(mat);
    }

    // 2. Clean pinpoint blue starfield concentrated in the camera hemisphere
    const deepStarCount = 480;
    const deepStarGeo = new THREE.BufferGeometry();
    const deepPositions = new Float32Array(deepStarCount * 3);
    const deepColors = new Float32Array(deepStarCount * 3);
    const starPalette = [
      new THREE.Color(0x93c5fd),
      new THREE.Color(0x60a5fa),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xdbeafe),
    ];
    for (let i = 0; i < deepStarCount; i++) {
      const forwardBias = i < deepStarCount * 0.78;
      const r = 14 + Math.random() * 16;
      const theta = forwardBias
        ? -Math.PI * 0.92 + Math.random() * Math.PI * 0.84
        : Math.random() * Math.PI * 2;
      const phi = forwardBias
        ? Math.PI * 0.22 + Math.random() * Math.PI * 0.56
        : Math.acos(2 * Math.random() - 1);
      deepPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      deepPositions[i * 3 + 1] = r * Math.cos(phi) + 1.0;
      deepPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 1.5;

      const c = starPalette[i % starPalette.length];
      const dim = 0.5 + Math.random() * 0.5;
      deepColors[i * 3] = c.r * dim;
      deepColors[i * 3 + 1] = c.g * dim;
      deepColors[i * 3 + 2] = c.b * dim;
    }
    deepStarGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(deepPositions, 3),
    );
    deepStarGeo.setAttribute('color', new THREE.BufferAttribute(deepColors, 3));
    const deepStarMat = new THREE.PointsMaterial({
      size: 0.11,
      map: particleSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const deepStars = new THREE.Points(deepStarGeo, deepStarMat);
    scene.add(deepStars);
    spaceDisposables.push(deepStarGeo, deepStarMat);

    // 3. Minimalist broken orbital telemetry arcs sweeping around Consy in open space
    const spaceOrbitGroup = new THREE.Group();
    spaceOrbitGroup.position.set(0, 1.04, 0);
    scene.add(spaceOrbitGroup);

    const arcConfigs = [
      {
        radius: 3.65,
        tube: 0.008,
        arc: Math.PI * 0.75,
        rot: [Math.PI * 0.42, 0.32, -0.25] as const,
        color: 0x38bdf8,
        opacity: 0.22,
      },
      {
        radius: 4.95,
        tube: 0.009,
        arc: Math.PI * 0.62,
        rot: [-Math.PI * 0.36, -0.28, 1.65] as const,
        color: 0x2563eb,
        opacity: 0.24,
      },
      {
        radius: 6.3,
        tube: 0.008,
        arc: Math.PI * 0.85,
        rot: [Math.PI * 0.52, -0.18, 3.1] as const,
        color: 0x60a5fa,
        opacity: 0.14,
      },
    ];
    const spaceArcs: THREE.Mesh[] = [];
    for (const cfg of arcConfigs) {
      const geo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 6, 96, cfg.arc);
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        depthWrite: false,
      });
      const arcMesh = new THREE.Mesh(geo, mat);
      arcMesh.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
      spaceOrbitGroup.add(arcMesh);
      spaceArcs.push(arcMesh);
      spaceDisposables.push(geo, mat);
    }

    // 4. Floating minimalist blue octahedral micro-shards suspended around Consy
    const shardCount = 26;
    const shardGeo = new THREE.OctahedronGeometry(0.055, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      emissive: 0x2563eb,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.85,
      transparent: true,
      opacity: 0.78,
    });
    const spaceShards = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    const shardDummy = new THREE.Object3D();
    for (let i = 0; i < shardCount; i++) {
      const r = 2.8 + Math.random() * 5.6;
      const theta = Math.random() * Math.PI * 2;
      const y = -1.35 + Math.random() * 3.1;
      shardDummy.position.set(Math.cos(theta) * r, y, Math.sin(theta) * r - 1.2);
      shardDummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      const s = 0.6 + Math.random() * 0.95;
      shardDummy.scale.set(s, s * 1.45, s);
      shardDummy.updateMatrix();
      spaceShards.setMatrixAt(i, shardDummy.matrix);
    }
    spaceShards.instanceMatrix.needsUpdate = true;
    spaceOrbitGroup.add(spaceShards);
    spaceDisposables.push(shardGeo, shardMat);

    // 5. Midground drifting spatial dust specks
    const particleCount = 160;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 1.9 + Math.random() * 8.5;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = -0.8 + Math.random() * 5.2;
      positions[i * 3 + 2] = Math.sin(theta) * r - 1.2;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      map: particleSprite,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Build centered minimalist levitating 3D AI Agent (Consy)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const agent = buildAgentModel(isSoftwareGl, maxAniso);
    agent.root.scale.setScalar(0.72);
    agent.applyFinish(stateRef.current.finish);
    scene.add(agent.root);

    const syncCoreHint = () => {
      const hintEl = coreHintRef.current;
      if (!hintEl) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      agent.chestButtonGroup.updateWorldMatrix(true, false);
      agent.chestButtonGroup.getWorldPosition(_coreWorldPos);
      agent.chestButtonGroup.getWorldQuaternion(_coreQuat);

      _coreHintWorld.set(0, -0.37, 0.08);
      agent.chestButtonGroup.localToWorld(_coreHintWorld);
      _coreHintWorld.project(camera);

      const sx = (_coreHintWorld.x * 0.5 + 0.5) * w;
      const sy = (-_coreHintWorld.y * 0.5 + 0.5) * h;

      _coreForward.set(0, 0, 1).applyQuaternion(_coreQuat);
      _camDir.subVectors(camera.position, _coreWorldPos).normalize();
      const facingCamera = _coreForward.dot(_camDir) > 0.15 && _coreHintWorld.z < 1;

      hintEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, 0)`;
      hintEl.style.opacity = facingCamera ? '1' : '0';
      hintEl.style.visibility = facingCamera ? 'visible' : 'hidden';
    };

    orbit.update();
    camera.updateMatrixWorld();
    syncCoreHint();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Tracked pointer and animation state
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    let lastAppliedFinish = stateRef.current.finish;

    let currentExplode = stateRef.current.explode;
    let currentLidOpen = MODE_CONFIGS[stateRef.current.mode].lidOpen;
    let currentPupilScale = MODE_CONFIGS[stateRef.current.mode].pupilScale;
    let currentEmissive = MODE_CONFIGS[stateRef.current.mode].emissiveIntensity;

    let eyeYawL = 0;
    let eyePitchL = 0;
    let eyeYawR = 0;
    let eyePitchR = 0;
    let headYaw = 0;
    let headPitch = 0;
    let torsoYaw = 0;

    let nextBlinkTime = 2.8;
    let blinkAmount = 0;
    let blinkTimer = -1;
    let nodImpulse = 0;
    let flareImpulse = 0;
    let buttonPressImpulse = 0;
    let isHoveringCore = false;
    let lastHoverCheck = 0;
    let downX = 0;
    let downY = 0;

    // Global cursor tracking across entire viewport + throttled core hover check
    const onPointerMove = (e: PointerEvent) => {
      if (disposed || contextLost) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointerX = THREE.MathUtils.clamp(nx, -1.4, 1.4);
      pointerY = THREE.MathUtils.clamp(ny, -1.2, 1.2);
      pointerActive = true;

      // Only check hover when pointer is over the canvas itself
      if (e.target === renderer.domElement) {
        const now = performance.now();
        if (now - lastHoverCheck >= 50) {
          lastHoverCheck = now;
          _ndc.set(nx, ny);
          _raycaster.setFromCamera(_ndc, camera);
          const coreHits = _raycaster.intersectObject(
            agent.chestButtonGroup,
            true,
          );
          const hovering = coreHits.length > 0;
          if (hovering !== isHoveringCore) {
            isHoveringCore = hovering;
            renderer.domElement.style.cursor = hovering ? 'pointer' : 'grab';
          }
        }
      } else if (isHoveringCore) {
        isHoveringCore = false;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onCanvasClick = (e: MouseEvent) => {
      if (disposed || contextLost) return;
      // Ignore orbit drag releases
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);

      const coreHits = _raycaster.intersectObject(agent.chestButtonGroup, true);
      if (coreHits.length > 0) {
        buttonPressImpulse = -0.055;
        flareImpulse = 2.0;
        blinkTimer = 0;
        toggleCallbackRef.current();
        return;
      }

      const hits = _raycaster.intersectObject(agent.root, true);
      if (hits.length > 0) {
        blinkTimer = 0;
        nodImpulse = 0.22;
        flareImpulse = 1.6;
        interactCallbackRef.current?.();
      }
    };

    const clock = new THREE.Clock();
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;
    let contextLost = false;

    const cancelScheduledFrames = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = 0;
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelScheduledFrames();
      if (!disposed) {
        setWebglUnavailable(true);
      }
    };

    const onContextRestored = () => {
      contextLost = false;
      if (!disposed) {
        setWebglUnavailable(false);
        setSceneRevision((rev) => rev + 1);
      }
    };

    const onPointerLeave = () => {
      pointerActive = false;
      if (isHoveringCore) {
        isHoveringCore = false;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
    renderer.domElement.addEventListener('pointerdown', onPointerDown, {
      passive: true,
    });
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      onContextRestored,
    );

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w <= 0 || h <= 0) continue;
        renderer.setPixelRatio(
          isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
        );
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        syncCoreHint();
      }
    });
    resizeObserver.observe(container);

    // Helper to compute clamped local eye yaw/pitch toward _gazeWorld
    const computeEyeAngles = (
      eyePivot: THREE.Group,
    ): { yaw: number; pitch: number } => {
      eyePivot.parent!.updateWorldMatrix(true, false);
      _localTarget.copy(_gazeWorld);
      eyePivot.parent!.worldToLocal(_localTarget);
      const dx = _localTarget.x;
      const dy = _localTarget.y;
      const dz = Math.max(0.6, _localTarget.z);
      const yaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -0.52, 0.52);
      const pitch = THREE.MathUtils.clamp(
        -Math.atan2(dy, Math.hypot(dx, dz)),
        -0.36,
        0.36,
      );
      return { yaw, pitch };
    };

    function afterDraw(cb: () => void) {
      if (disposed || contextLost) return;
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || gl.isContextLost() || typeof gl.fenceSync !== 'function') {
        timeoutId = window.setTimeout(() => {
          timeoutId = 0;
          if (!disposed && !contextLost) cb();
        }, 80);
        return;
      }

      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        timeoutId = window.setTimeout(() => {
          timeoutId = 0;
          if (!disposed && !contextLost) cb();
        }, 80);
        return;
      }

      gl.flush();
      const poll = () => {
        timeoutId = 0;
        if (disposed || contextLost || gl.isContextLost()) {
          if (!gl.isContextLost() && typeof gl.deleteSync === 'function') {
            gl.deleteSync(sync);
          }
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          timeoutId = window.setTimeout(() => {
            timeoutId = 0;
            if (!disposed && !contextLost) cb();
          }, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    function tick() {
      rafId = 0;
      if (disposed || contextLost) return;
      const gl = renderer.getContext();
      if (gl && gl.isContextLost()) return;
      const delta = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();
      const current = stateRef.current;
      const modeCfg = MODE_CONFIGS[current.mode];

      if (current.finish !== lastAppliedFinish) {
        agent.applyFinish(current.finish);
        lastAppliedFinish = current.finish;
      }

      // Smooth camera reset if requested
      if (resetGoalRef.current) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _defaultCamPos.x,
          6,
          delta,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _defaultCamPos.y,
          6,
          delta,
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _defaultCamPos.z,
          6,
          delta,
        );
        orbit.target.x = THREE.MathUtils.damp(
          orbit.target.x,
          _defaultTarget.x,
          6,
          delta,
        );
        orbit.target.y = THREE.MathUtils.damp(
          orbit.target.y,
          _defaultTarget.y,
          6,
          delta,
        );
        orbit.target.z = THREE.MathUtils.damp(
          orbit.target.z,
          _defaultTarget.z,
          6,
          delta,
        );
        if (camera.position.distanceTo(_defaultCamPos) < 0.015) {
          camera.position.copy(_defaultCamPos);
          orbit.target.copy(_defaultTarget);
          resetGoalRef.current = false;
        }
      }
      orbit.update();

      // Update gaze plane facing the camera ~3.0 units in front of Consy
      camera.getWorldDirection(_camDir);
      _gazePlane.setFromNormalAndCoplanarPoint(
        _camDir.negate(),
        _gazeWorld.set(0, 1.76, 2.8),
      );

      // Compute 3D world gaze target from cursor NDC
      const isAwake = current.mode !== 'sleep';
      let targetHeadYaw = 0;
      let targetHeadPitch = 0;
      let targetTorsoYaw = 0;

      if (isAwake && current.trackCursor && pointerActive) {
        _ndc.set(pointerX, pointerY);
        _raycaster.setFromCamera(_ndc, camera);
        const hit = _raycaster.ray.intersectPlane(_gazePlane, _gazeWorld);
        if (!hit) {
          _gazeWorld.set(pointerX * 3.0, 1.76 + pointerY * 1.7, 3.0);
        }
        // Derive subtle head and torso orientation toward cursor
        targetHeadYaw = THREE.MathUtils.clamp(pointerX * 0.34, -0.34, 0.34);
        targetHeadPitch = THREE.MathUtils.clamp(-pointerY * 0.22, -0.2, 0.2);
        targetTorsoYaw = THREE.MathUtils.clamp(pointerX * 0.11, -0.11, 0.11);
      } else if (isAwake && !prefersReducedMotion) {
        // Gentle idle scan when cursor tracking is paused or before first move
        const scanX = Math.sin(elapsed * 0.55) * 0.55;
        const scanY = Math.cos(elapsed * 0.38) * 0.22;
        _gazeWorld.set(scanX, 1.76 + scanY, 3.0);
        targetHeadYaw = scanX * 0.14;
        targetHeadPitch = -scanY * 0.12;
      } else {
        // Sleep posture: head bowed slightly
        _gazeWorld.set(0, 1.3, 3.0);
        targetHeadPitch = 0.22;
      }

      // Click nod & optical flare decay
      nodImpulse = THREE.MathUtils.damp(nodImpulse, 0, 8, delta);
      flareImpulse = THREE.MathUtils.damp(flareImpulse, 0, 6, delta);

      // Smooth damped torso, head & zero-gravity levitation buoyancy
      const motionScale = prefersReducedMotion ? 0.15 : 1.0;
      const hoverWave = Math.sin(elapsed * 1.45) * 0.095 * motionScale;
      const baseHoverY = isAwake ? 0.68 : 0.48;
      agent.hoverGroup.position.y = THREE.MathUtils.damp(
        agent.hoverGroup.position.y,
        baseHoverY + hoverWave,
        5.5,
        delta,
      );
      agent.hoverGroup.rotation.z =
        Math.sin(elapsed * 0.92) * 0.024 * motionScale;
      agent.hoverGroup.rotation.x =
        Math.cos(elapsed * 1.1) * 0.016 * motionScale;

      // Inverse detached shadow & repulsor projection scale/opacity as Consy rises
      const normalizedRise = (agent.hoverGroup.position.y - 0.48) / 0.3;
      const shadowScale = THREE.MathUtils.clamp(1.06 - normalizedRise * 0.22, 0.72, 1.1);
      agent.contactShadow.scale.setScalar(shadowScale);
      (agent.contactShadow.material as THREE.MeshBasicMaterial).opacity =
        THREE.MathUtils.clamp(0.58 - normalizedRise * 0.16, 0.25, 0.62);
      agent.hoverProjectionRing.scale.setScalar(0.92 + normalizedRise * 0.14);
      (agent.hoverProjectionRing.material as THREE.MeshBasicMaterial).opacity =
        isAwake ? THREE.MathUtils.clamp(0.28 - normalizedRise * 0.08, 0.1, 0.3) : 0.08;

      // Counter-oscillating lower magnetic repulsor rings under floating chassis
      if (!prefersReducedMotion) {
        agent.lowerRingOuter.rotation.x =
          Math.PI / 2 + Math.sin(elapsed * 1.6) * 0.09;
        agent.lowerRingOuter.rotation.y = Math.cos(elapsed * 1.2) * 0.09;
        agent.lowerRingInner.rotation.x =
          Math.PI / 2 - Math.cos(elapsed * 2.1) * 0.12;
        agent.lowerRingInner.rotation.y = -Math.sin(elapsed * 1.5) * 0.12;
      }

      torsoYaw = THREE.MathUtils.damp(torsoYaw, targetTorsoYaw, 4.2, delta);
      headYaw = THREE.MathUtils.damp(headYaw, targetHeadYaw, 7.5, delta);
      headPitch = THREE.MathUtils.damp(
        headPitch,
        targetHeadPitch + nodImpulse,
        7.5,
        delta,
      );

      agent.torsoPivot.rotation.y = torsoYaw;
      agent.headPivot.rotation.y = headYaw;
      agent.headPivot.rotation.x = headPitch;

      // Update world matrices before computing exact eye convergence angles
      agent.headPivot.updateWorldMatrix(true, false);

      const leftTarget = isAwake
        ? computeEyeAngles(agent.leftEye.pivot)
        : { yaw: 0, pitch: 0.15 };
      const rightTarget = isAwake
        ? computeEyeAngles(agent.rightEye.pivot)
        : { yaw: 0, pitch: 0.15 };

      const eyeLambda = prefersReducedMotion ? 5 : 16;
      eyeYawL = THREE.MathUtils.damp(eyeYawL, leftTarget.yaw, eyeLambda, delta);
      eyePitchL = THREE.MathUtils.damp(
        eyePitchL,
        leftTarget.pitch,
        eyeLambda,
        delta,
      );
      eyeYawR = THREE.MathUtils.damp(eyeYawR, rightTarget.yaw, eyeLambda, delta);
      eyePitchR = THREE.MathUtils.damp(
        eyePitchR,
        rightTarget.pitch,
        eyeLambda,
        delta,
      );

      agent.leftEye.pivot.rotation.set(eyePitchL, eyeYawL, 0);
      agent.rightEye.pivot.rotation.set(eyePitchR, eyeYawR, 0);

      // Natural periodic blink & mode-specific eyelid aperture
      if (isAwake && !prefersReducedMotion) {
        if (elapsed > nextBlinkTime && blinkTimer < 0) {
          blinkTimer = 0;
          nextBlinkTime = elapsed + 3.4 + Math.random() * 2.8;
        }
        if (blinkTimer >= 0) {
          blinkTimer += delta;
          const blinkDur = 0.22;
          if (blinkTimer >= blinkDur) {
            blinkAmount = 0;
            blinkTimer = -1;
          } else {
            blinkAmount = Math.sin((blinkTimer / blinkDur) * Math.PI);
          }
        }
      } else {
        blinkAmount = 0;
      }

      currentLidOpen = THREE.MathUtils.damp(
        currentLidOpen,
        modeCfg.lidOpen,
        9,
        delta,
      );
      const effectiveLid = currentLidOpen * (1 - blinkAmount);
      const upperAngle = -0.88 * effectiveLid;
      const lowerAngle = Math.PI + 0.88 * effectiveLid;

      agent.leftEye.upperLid.rotation.x = upperAngle;
      agent.leftEye.lowerLid.rotation.x = lowerAngle;
      agent.rightEye.upperLid.rotation.x = upperAngle;
      agent.rightEye.lowerLid.rotation.x = lowerAngle;

      // Pupil dilation & emissive pulse
      currentPupilScale = THREE.MathUtils.damp(
        currentPupilScale,
        modeCfg.pupilScale,
        8,
        delta,
      );
      agent.leftEye.pupilMesh.scale.setScalar(currentPupilScale);
      agent.rightEye.pupilMesh.scale.setScalar(currentPupilScale);

      const pulse = prefersReducedMotion
        ? 0
        : Math.sin(elapsed * (current.mode === 'analyzing' ? 5.2 : 2.1)) * 0.28;
      currentEmissive = THREE.MathUtils.damp(
        currentEmissive,
        modeCfg.emissiveIntensity + pulse + flareImpulse,
        8,
        delta,
      );
      _emissiveColor.setHex(modeCfg.emissiveHex);
      agent.materials.emissiveAccent.emissive.lerp(_emissiveColor, 0.12);
      agent.materials.emissiveAccent.emissiveIntensity = currentEmissive;

      // Stomach core button hover scale & tactile click depression
      buttonPressImpulse = THREE.MathUtils.damp(buttonPressImpulse, 0, 14, delta);
      const targetBtnScale = isHoveringCore ? 1.13 : controlsOpenRef.current ? 1.06 : 1.0;
      const nextBtnScale = THREE.MathUtils.damp(
        agent.chestButtonGroup.scale.x,
        targetBtnScale,
        12,
        delta,
      );
      agent.chestButtonGroup.scale.setScalar(nextBtnScale);
      agent.chestButtonGroup.position.z = 0.7 + buttonPressImpulse;

      // Exploded chassis layers smooth damping
      currentExplode = THREE.MathUtils.damp(
        currentExplode,
        current.explode,
        8,
        delta,
      );
      for (const part of agent.explodables) {
        part.object.position
          .copy(part.basePosition)
          .addScaledVector(part.explodeOffset, currentExplode);
      }

      // Orbital neural rings & clean spatial background drift
      if (!prefersReducedMotion) {
        agent.outerHalo.rotation.y += delta * modeCfg.haloSpeed;
        agent.innerHalo.rotation.y -= delta * modeCfg.haloSpeed * 1.45;
        particles.rotation.y = elapsed * 0.03;
        deepStars.rotation.y = elapsed * 0.006;
        spaceArcs[0].rotation.z += delta * 0.045;
        spaceArcs[1].rotation.z -= delta * 0.032;
        spaceArcs[2].rotation.z += delta * 0.024;
        spaceShards.rotation.y = -elapsed * 0.022;
      }

      if (disposed || contextLost) return;
      renderer.render(scene, camera);
      syncCoreHint();

      if (disposed || contextLost) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelScheduledFrames();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onContextRestored,
      );
      orbit.removeEventListener('start', onOrbitStart);
      orbit.dispose();
      agent.dispose();
      particleGeo.dispose();
      particleSprite.dispose();
      particleMat.dispose();
      for (const item of spaceDisposables) {
        item.dispose();
      }
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [sceneRevision]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-pan-y"
        aria-label="Interactive 3D AI agent Consy whose eyes follow your cursor"
      />
      {!webglUnavailable && (
        <div
          ref={coreHintRef}
          style={{ opacity: 0, visibility: 'hidden' }}
          className="pointer-events-none absolute left-0 top-0 z-10 will-change-transform transition-opacity duration-200"
        >
          <button
            type="button"
            onClick={() => toggleCallbackRef.current()}
            aria-label="Click stomach button for Consy controls"
            tabIndex={controlsOpen ? -1 : 0}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium tracking-wide text-sky-200/85 hover:text-white transition-opacity duration-200 whitespace-nowrap select-none drop-shadow-[0_1px_6px_rgba(4,7,14,0.98)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
              controlsOpen
                ? 'opacity-0 pointer-events-none'
                : 'opacity-100 pointer-events-auto cursor-pointer'
            }`}
          >
            <span aria-hidden="true" className="h-1.5 w-px bg-sky-300/65" />
            <span>Click for controls</span>
          </button>
        </div>
      )}
      {webglUnavailable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04070E] px-6 text-center">
          <div className="w-32 h-32 rounded-full border border-sky-500/30 bg-[#0B1220] flex items-center justify-center gap-4 mb-6">
            <span className="w-5 h-5 rounded-full bg-sky-400 shadow-[0_0_20px_#38bdf8]" />
            <span className="w-5 h-5 rounded-full bg-sky-400 shadow-[0_0_20px_#38bdf8]" />
          </div>
          <p className="font-display text-lg font-semibold text-slate-100">
            Interactive 3D Viewport Standby
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            WebGL rendering is currently paused or unavailable on this browser session.
          </p>
        </div>
      )}
    </div>
  );
}
