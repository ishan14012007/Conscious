import * as THREE from 'three';
import { AgentFinish } from '../types/agent';
import {
  createContactShadowTexture,
  createIrisTexture,
} from './proceduralTextures';

export interface ExplodablePart {
  object: THREE.Object3D;
  basePosition: THREE.Vector3;
  explodeOffset: THREE.Vector3;
}

export interface EyeRig {
  pivot: THREE.Group;
  pupilMesh: THREE.Mesh;
  irisGlowRing: THREE.Mesh;
  upperLid: THREE.Mesh;
  lowerLid: THREE.Mesh;
  baseLocalPos: THREE.Vector3;
}

export interface AgentRig {
  root: THREE.Group;
  hoverGroup: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  leftEye: EyeRig;
  rightEye: EyeRig;
  outerHalo: THREE.Group;
  innerHalo: THREE.Group;
  lowerRingOuter: THREE.Mesh;
  lowerRingInner: THREE.Mesh;
  contactShadow: THREE.Mesh;
  hoverProjectionRing: THREE.Mesh;
  haloNodes: THREE.InstancedMesh;
  chestCore: THREE.Mesh;
  chestButtonGroup: THREE.Group;
  explodables: ExplodablePart[];
  materials: {
    armorPrimary: THREE.MeshPhysicalMaterial;
    armorSecondary: THREE.MeshStandardMaterial;
    trimMetal: THREE.MeshPhysicalMaterial;
    visorGlass: THREE.MeshPhysicalMaterial;
    emissiveAccent: THREE.MeshStandardMaterial;
    irisMaterial: THREE.MeshBasicMaterial;
    corneaMaterial: THREE.MeshPhysicalMaterial;
  };
  applyFinish: (finish: AgentFinish) => void;
  dispose: () => void;
}

const FINISH_PALETTES: Record<
  AgentFinish,
  {
    primary: number;
    secondary: number;
    trim: number;
    roughness: number;
    metalness: number;
  }
> = {
  obsidian: {
    primary: 0x0b1220,
    secondary: 0x162238,
    trim: 0x4b6587,
    roughness: 0.28,
    metalness: 0.86,
  },
  cobalt: {
    primary: 0x0f254a,
    secondary: 0x17376b,
    trim: 0x60a5fa,
    roughness: 0.22,
    metalness: 0.88,
  },
  alloy: {
    primary: 0x263244,
    secondary: 0x131c2b,
    trim: 0x93c5fd,
    roughness: 0.2,
    metalness: 0.92,
  },
};

function createArmorWingShape(width: number, height: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -height * 0.5);
  s.lineTo(width * 0.72, -height * 0.34);
  s.lineTo(width, 0.08 * height);
  s.lineTo(width * 0.55, height * 0.5);
  s.lineTo(0, height * 0.42);
  s.closePath();
  return s;
}

function createCheekPlateShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.34, -0.32);
  s.lineTo(0.28, -0.44);
  s.lineTo(0.42, -0.1);
  s.lineTo(0.32, 0.28);
  s.lineTo(-0.18, 0.34);
  s.lineTo(-0.4, 0.04);
  s.closePath();
  return s;
}

export function buildAgentModel(
  isSoftwareGl: boolean,
  maxAnisotropy: number,
): AgentRig {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const explodables: ExplodablePart[] = [];

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Materials calibrated for PBR studio reflections & cobalt-blue contrast
  const armorPrimary = track(
    new THREE.MeshPhysicalMaterial({
      color: FINISH_PALETTES.obsidian.primary,
      roughness: FINISH_PALETTES.obsidian.roughness,
      metalness: FINISH_PALETTES.obsidian.metalness,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
    }),
  );

  const armorSecondary = track(
    new THREE.MeshStandardMaterial({
      color: FINISH_PALETTES.obsidian.secondary,
      roughness: 0.58,
      metalness: 0.55,
    }),
  );

  const trimMetal = track(
    new THREE.MeshPhysicalMaterial({
      color: FINISH_PALETTES.obsidian.trim,
      roughness: 0.16,
      metalness: 0.94,
      anisotropy: 0.7,
    }),
  );

  const carbonMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.72,
      metalness: 0.25,
    }),
  );

  const visorGlass = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x09162e,
      roughness: 0.06,
      metalness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.78,
      transparent: true,
      opacity: isSoftwareGl ? 0.28 : 0.92,
      ior: 1.52,
      thickness: 0.35,
      attenuationColor: new THREE.Color(0x1d4ed8),
      attenuationDistance: 1.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    }),
  );

  const emissiveAccent = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x2563eb,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.3,
    }),
  );

  const irisTex = track(
    createIrisTexture('#2563eb', '#38bdf8', maxAnisotropy),
  );
  const irisMaterial = track(
    new THREE.MeshBasicMaterial({
      map: irisTex,
      color: 0xe0f2fe,
    }),
  );

  const corneaMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      roughness: 0.04,
      metalness: 0.0,
      transparent: true,
      opacity: 0.26,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      depthWrite: false,
    }),
  );

  const scleraMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x050914,
      roughness: 0.22,
      metalness: 0.7,
    }),
  );

  const pupilMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0x02040a,
    }),
  );

  // 1. Detached Volumetric Shadow & Faint Repulsor Projection in Air Beneath Consy
  // (Zero solid floor or pedestal so the bot visibly levitates in open space)
  const contactTex = track(createContactShadowTexture());
  const contactGeo = track(new THREE.PlaneGeometry(3.4, 3.4));
  const contactMat = track(
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const contactShadow = new THREE.Mesh(contactGeo, contactMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -0.16;
  root.add(contactShadow);

  const projRingGeo = track(new THREE.RingGeometry(0.68, 0.72, 64));
  const projRingMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const hoverProjectionRing = new THREE.Mesh(projRingGeo, projRingMat);
  hoverProjectionRing.rotation.x = -Math.PI / 2;
  hoverProjectionRing.position.y = -0.15;
  root.add(hoverProjectionRing);

  // 2. Levitating Bot Body Group (suspended smoothly above y = 0)
  const hoverGroup = new THREE.Group();
  hoverGroup.position.set(0, 0.68, 0);
  root.add(hoverGroup);

  // Torso & Tapered Anti-Gravity Underside Keel
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0, 0);
  hoverGroup.add(torsoPivot);

  const torsoLathePoints = [
    new THREE.Vector2(0.0, -0.26), // Tapered lower repulsor tip
    new THREE.Vector2(0.24, -0.18),
    new THREE.Vector2(0.56, 0.05),
    new THREE.Vector2(0.84, 0.36),
    new THREE.Vector2(0.98, 0.78),
    new THREE.Vector2(0.88, 1.05),
    new THREE.Vector2(0.46, 1.18),
    new THREE.Vector2(0.0, 1.18),
  ];
  const torsoGeo = track(new THREE.LatheGeometry(torsoLathePoints, 32));
  const torsoCore = new THREE.Mesh(torsoGeo, armorPrimary);
  torsoCore.scale.set(1.12, 1.0, 0.74);
  torsoCore.castShadow = true;
  torsoCore.receiveShadow = true;
  torsoPivot.add(torsoCore);

  // Glowing Lower Anti-Gravity Thruster Emitter at bottom tip of floating torso
  const emitterCoreGeo = track(new THREE.SphereGeometry(0.16, 24, 16));
  const emitterCore = new THREE.Mesh(emitterCoreGeo, emissiveAccent);
  emitterCore.scale.set(1.1, 0.5, 0.9);
  emitterCore.position.set(0, -0.24, 0);
  torsoPivot.add(emitterCore);

  // Two Suspended Magnetic Repulsor Rings hovering beneath the chassis
  const lowerRingOuterGeo = track(new THREE.TorusGeometry(0.62, 0.014, 12, 56));
  const lowerRingOuter = new THREE.Mesh(lowerRingOuterGeo, trimMetal);
  lowerRingOuter.rotation.x = Math.PI / 2;
  lowerRingOuter.position.set(0, -0.34, 0);
  hoverGroup.add(lowerRingOuter);

  const lowerRingInnerGeo = track(new THREE.TorusGeometry(0.42, 0.011, 12, 48));
  const lowerRingInner = new THREE.Mesh(lowerRingInnerGeo, emissiveAccent);
  lowerRingInner.rotation.x = Math.PI / 2;
  lowerRingInner.position.set(0, -0.46, 0);
  hoverGroup.add(lowerRingInner);

  // Chest sternum/stomach interactive control core button
  const chestButtonGroup = new THREE.Group();
  chestButtonGroup.position.set(0, 0.68, 0.7);
  torsoPivot.add(chestButtonGroup);

  const chestHousingGeo = track(new THREE.CylinderGeometry(0.26, 0.31, 0.14, 32));
  const chestHousing = new THREE.Mesh(chestHousingGeo, trimMetal);
  chestHousing.rotation.x = Math.PI / 2;
  chestButtonGroup.add(chestHousing);

  const chestCoreGeo = track(new THREE.SphereGeometry(0.18, 28, 28));
  const chestCore = new THREE.Mesh(chestCoreGeo, emissiveAccent);
  chestCore.scale.set(1, 1, 0.55);
  chestCore.position.z = 0.04;
  chestButtonGroup.add(chestCore);

  const chestBezelGeo = track(new THREE.TorusGeometry(0.24, 0.026, 16, 48));
  const chestBezel = new THREE.Mesh(chestBezelGeo, armorSecondary);
  chestBezel.position.z = 0.06;
  chestButtonGroup.add(chestBezel);

  // Subtle outer halo ring around the stomach button for clean hover feedback
  const chestHoverRingGeo = track(new THREE.TorusGeometry(0.295, 0.01, 12, 48));
  const chestHoverRing = new THREE.Mesh(chestHoverRingGeo, emissiveAccent);
  chestHoverRing.position.z = 0.05;
  chestButtonGroup.add(chestHoverRing);

  // Invisible generous hit proxy so clicking the stomach core button always registers cleanly
  const chestHitGeo = track(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 24));
  const chestHitMat = track(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const chestHitProxy = new THREE.Mesh(chestHitGeo, chestHitMat);
  chestHitProxy.rotation.x = Math.PI / 2;
  chestHitProxy.position.z = 0.05;
  chestButtonGroup.add(chestHitProxy);

  // Armored Shoulder Pauldrons (explodable)
  const pauldronShape = createArmorWingShape(0.88, 0.72);
  const pauldronGeo = track(
    new THREE.ExtrudeGeometry(pauldronShape, {
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 3,
    }),
  );
  pauldronGeo.center();

  const leftPauldron = new THREE.Mesh(pauldronGeo, armorPrimary);
  leftPauldron.position.set(-1.12, 0.9, 0.02);
  leftPauldron.rotation.set(0.1, 0.28, -0.22);
  leftPauldron.scale.x = -1;
  leftPauldron.castShadow = true;
  torsoPivot.add(leftPauldron);
  explodables.push({
    object: leftPauldron,
    basePosition: leftPauldron.position.clone(),
    explodeOffset: new THREE.Vector3(-0.75, 0.15, 0.0),
  });

  const rightPauldron = new THREE.Mesh(pauldronGeo, armorPrimary);
  rightPauldron.position.set(1.12, 0.9, 0.02);
  rightPauldron.rotation.set(0.1, -0.28, 0.22);
  rightPauldron.castShadow = true;
  torsoPivot.add(rightPauldron);
  explodables.push({
    object: rightPauldron,
    basePosition: rightPauldron.position.clone(),
    explodeOffset: new THREE.Vector3(0.75, 0.15, 0.0),
  });

  // Collar energy conduits
  const collarArcGeo = track(new THREE.TorusGeometry(0.56, 0.03, 14, 48, Math.PI));
  const collarArc = new THREE.Mesh(collarArcGeo, emissiveAccent);
  collarArc.rotation.set(Math.PI * 0.46, 0, Math.PI);
  collarArc.position.set(0, 1.16, 0.18);
  torsoPivot.add(collarArc);

  // 3. Articulated Neck Gimbal
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 1.18, 0);
  torsoPivot.add(neckGroup);

  const neckCollarGeo = track(new THREE.CylinderGeometry(0.32, 0.38, 0.36, 24));
  const neckCollar = new THREE.Mesh(neckCollarGeo, carbonMat);
  neckCollar.position.y = 0.16;
  neckGroup.add(neckCollar);

  for (let i = 0; i < 3; i++) {
    const ringGeo = track(new THREE.TorusGeometry(0.34 - i * 0.015, 0.024, 12, 32));
    const ring = new THREE.Mesh(ringGeo, trimMetal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08 + i * 0.1;
    neckGroup.add(ring);
  }

  // 4. Head / Cranium Assembly (Cursor-Guided Head Pivot)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.56, 0.04);
  neckGroup.add(headPivot);

  // Inner dark optical chassis core
  const innerHeadGeo = track(new THREE.SphereGeometry(0.68, 36, 32));
  const innerHead = new THREE.Mesh(innerHeadGeo, carbonMat);
  innerHead.scale.set(1.06, 0.96, 0.98);
  innerHead.castShadow = true;
  headPivot.add(innerHead);

  // Sculpted Upper Cranial Crown Helmet (explodable upward)
  const crownGroup = new THREE.Group();
  headPivot.add(crownGroup);

  const crownGeo = track(
    new THREE.SphereGeometry(0.74, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.52),
  );
  const crownMesh = new THREE.Mesh(crownGeo, armorPrimary);
  crownMesh.scale.set(1.08, 0.98, 1.06);
  crownMesh.rotation.x = -0.18;
  crownMesh.position.set(0, 0.08, -0.02);
  crownMesh.castShadow = true;
  crownGroup.add(crownMesh);

  // Central cranial crest fin
  const crestCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.55, 0.52),
    new THREE.Vector3(0, 0.8, 0.05),
    new THREE.Vector3(0, 0.66, -0.58),
  ]);
  const crestGeo = track(new THREE.TubeGeometry(crestCurve, 32, 0.045, 12, false));
  const crestMesh = new THREE.Mesh(crestGeo, trimMetal);
  crownGroup.add(crestMesh);

  const crestStripGeo = track(new THREE.TubeGeometry(crestCurve, 32, 0.018, 10, false));
  const crestStrip = new THREE.Mesh(crestStripGeo, emissiveAccent);
  crestStrip.position.y = 0.028;
  crownGroup.add(crestStrip);

  explodables.push({
    object: crownGroup,
    basePosition: crownGroup.position.clone(),
    explodeOffset: new THREE.Vector3(0, 0.58, 0),
  });

  // Sculpted Left & Right Cheek/Jaw Plates (explodable outward)
  const cheekShape = createCheekPlateShape();
  const cheekGeo = track(
    new THREE.ExtrudeGeometry(cheekShape, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 3,
    }),
  );
  cheekGeo.center();

  const leftCheek = new THREE.Mesh(cheekGeo, armorPrimary);
  leftCheek.position.set(-0.48, -0.26, 0.34);
  leftCheek.rotation.set(0.18, -0.62, 0.14);
  leftCheek.castShadow = true;
  headPivot.add(leftCheek);
  explodables.push({
    object: leftCheek,
    basePosition: leftCheek.position.clone(),
    explodeOffset: new THREE.Vector3(-0.55, -0.15, 0.25),
  });

  const rightCheek = new THREE.Mesh(cheekGeo, armorPrimary);
  rightCheek.position.set(0.48, -0.26, 0.34);
  rightCheek.rotation.set(0.18, 0.62, -0.14);
  rightCheek.scale.x = -1;
  rightCheek.castShadow = true;
  headPivot.add(rightCheek);
  explodables.push({
    object: rightCheek,
    basePosition: rightCheek.position.clone(),
    explodeOffset: new THREE.Vector3(0.55, -0.15, 0.25),
  });

  // Chin mandible plate
  const chinGeo = track(new THREE.CylinderGeometry(0.28, 0.2, 0.32, 24));
  const chinPlate = new THREE.Mesh(chinGeo, armorSecondary);
  chinPlate.scale.set(1.15, 1, 0.85);
  chinPlate.position.set(0, -0.45, 0.44);
  chinPlate.rotation.x = 0.28;
  headPivot.add(chinPlate);
  explodables.push({
    object: chinPlate,
    basePosition: chinPlate.position.clone(),
    explodeOffset: new THREE.Vector3(0, -0.42, 0.32),
  });

  // Lateral Acoustic / Sensor Ear Pods
  const earPodGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 28));
  const earRingGeo = track(new THREE.TorusGeometry(0.18, 0.02, 12, 36));

  const leftEar = new THREE.Group();
  leftEar.position.set(-0.76, 0.02, -0.02);
  const leftEarBody = new THREE.Mesh(earPodGeo, trimMetal);
  leftEarBody.rotation.z = Math.PI / 2;
  const leftEarGlow = new THREE.Mesh(earRingGeo, emissiveAccent);
  leftEarGlow.rotation.y = Math.PI / 2;
  leftEarGlow.position.x = -0.085;
  leftEar.add(leftEarBody, leftEarGlow);
  headPivot.add(leftEar);
  explodables.push({
    object: leftEar,
    basePosition: leftEar.position.clone(),
    explodeOffset: new THREE.Vector3(-0.55, 0, 0),
  });

  const rightEar = new THREE.Group();
  rightEar.position.set(0.76, 0.02, -0.02);
  const rightEarBody = new THREE.Mesh(earPodGeo, trimMetal);
  rightEarBody.rotation.z = Math.PI / 2;
  const rightEarGlow = new THREE.Mesh(earRingGeo, emissiveAccent);
  rightEarGlow.rotation.y = Math.PI / 2;
  rightEarGlow.position.x = 0.085;
  rightEar.add(rightEarBody, rightEarGlow);
  headPivot.add(rightEar);
  explodables.push({
    object: rightEar,
    basePosition: rightEar.position.clone(),
    explodeOffset: new THREE.Vector3(0.55, 0, 0),
  });

  // 5. Recessed Eye Sockets & Cursor-Tracking 3D Optical Eyes
  const buildEye = (xOffset: number): EyeRig => {
    const socketGroup = new THREE.Group();
    const baseLocalPos = new THREE.Vector3(xOffset, 0.05, 0.56);
    socketGroup.position.copy(baseLocalPos);
    headPivot.add(socketGroup);

    // Fixed machined titanium socket bezel
    const socketGeo = track(new THREE.TorusGeometry(0.225, 0.024, 16, 40));
    const socketRing = new THREE.Mesh(socketGeo, trimMetal);
    socketRing.position.z = 0.08;
    socketGroup.add(socketRing);

    // Rotating eye pivot (steered smoothly toward cursor)
    const pivot = new THREE.Group();
    socketGroup.add(pivot);

    // Dark mechanical sclera sphere
    const scleraGeo = track(new THREE.SphereGeometry(0.2, 32, 28));
    const sclera = new THREE.Mesh(scleraGeo, scleraMaterial);
    pivot.add(sclera);

    // Crisp procedural radial blue iris facing +Z
    const irisGeo = track(new THREE.CircleGeometry(0.145, 48));
    const irisMesh = new THREE.Mesh(irisGeo, irisMaterial);
    irisMesh.position.z = 0.175;
    pivot.add(irisMesh);

    // Emissive inner iris halo ring
    const irisGlowGeo = track(new THREE.TorusGeometry(0.068, 0.0085, 12, 36));
    const irisGlowRing = new THREE.Mesh(irisGlowGeo, emissiveAccent);
    irisGlowRing.position.z = 0.181;
    pivot.add(irisGlowRing);

    // Deep obsidian pupil center (scales dynamically by mode)
    const pupilGeo = track(new THREE.CircleGeometry(0.054, 32));
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMaterial);
    pupilMesh.position.z = 0.183;
    pivot.add(pupilMesh);

    // Glossy convex cornea lens over the iris
    const corneaGeo = track(
      new THREE.SphereGeometry(0.205, 32, 24, 0, Math.PI * 2, 0, 0.85),
    );
    const cornea = new THREE.Mesh(corneaGeo, corneaMaterial);
    cornea.rotation.x = Math.PI / 2;
    cornea.renderOrder = 4;
    pivot.add(cornea);

    // Upper & Lower mechanical eyelids (hemisphere shells around the eye)
    const lidGeo = track(
      new THREE.SphereGeometry(0.214, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
    );
    const upperLid = new THREE.Mesh(lidGeo, armorSecondary);
    upperLid.rotation.x = -0.85;
    socketGroup.add(upperLid);

    const lowerLid = new THREE.Mesh(lidGeo, armorSecondary);
    lowerLid.rotation.x = Math.PI + 0.85;
    socketGroup.add(lowerLid);

    return {
      pivot,
      pupilMesh,
      irisGlowRing,
      upperLid,
      lowerLid,
      baseLocalPos,
    };
  };

  const leftEye = buildEye(-0.3);
  const rightEye = buildEye(0.3);

  // Curved Optical Visor Glass Shield (explodable forward)
  const visorGeo = track(
    new THREE.CylinderGeometry(
      0.735,
      0.715,
      0.46,
      40,
      1,
      true,
      -Math.PI * 0.34,
      Math.PI * 0.68,
    ),
  );
  const visorShield = new THREE.Mesh(visorGeo, visorGlass);
  visorShield.position.set(0, 0.03, 0.04);
  visorShield.renderOrder = 6;
  headPivot.add(visorShield);
  explodables.push({
    object: visorShield,
    basePosition: visorShield.position.clone(),
    explodeOffset: new THREE.Vector3(0, 0.04, 0.65),
  });

  // 6. Dual Orbital Neural Halo Rings + Instanced Telemetry Nodes (inside hoverGroup)
  const outerHalo = new THREE.Group();
  outerHalo.position.set(0, 1.7, -0.05);
  outerHalo.rotation.set(0.36, 0, -0.18);
  hoverGroup.add(outerHalo);

  const outerRingGeo = track(new THREE.TorusGeometry(1.48, 0.016, 14, 96));
  const outerRing = new THREE.Mesh(outerRingGeo, trimMetal);
  outerRing.rotation.x = Math.PI / 2;
  outerHalo.add(outerRing);

  const nodeGeo = track(new THREE.OctahedronGeometry(0.042, 0));
  const nodeCount = 24;
  const haloNodes = new THREE.InstancedMesh(nodeGeo, emissiveAccent, nodeCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 1.48, 0, Math.sin(angle) * 1.48);
    dummy.rotation.set(0, -angle, 0);
    const s = i % 3 === 0 ? 1.25 : 0.78;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    haloNodes.setMatrixAt(i, dummy.matrix);
  }
  haloNodes.instanceMatrix.needsUpdate = true;
  haloNodes.computeBoundingSphere();
  outerHalo.add(haloNodes);

  const innerHalo = new THREE.Group();
  innerHalo.position.set(0, 1.7, -0.05);
  innerHalo.rotation.set(-0.42, 0.2, 0.24);
  hoverGroup.add(innerHalo);

  const innerRingGeo = track(new THREE.TorusGeometry(1.18, 0.012, 12, 80));
  const innerRing = new THREE.Mesh(innerRingGeo, emissiveAccent);
  innerRing.rotation.x = Math.PI / 2;
  innerHalo.add(innerRing);

  const applyFinish = (finish: AgentFinish) => {
    const pal = FINISH_PALETTES[finish];
    armorPrimary.color.setHex(pal.primary);
    armorPrimary.roughness = pal.roughness;
    armorPrimary.metalness = pal.metalness;
    armorSecondary.color.setHex(pal.secondary);
    trimMetal.color.setHex(pal.trim);
  };

  const dispose = () => {
    for (const item of disposables) {
      item.dispose();
    }
  };

  return {
    root,
    hoverGroup,
    torsoPivot,
    headPivot,
    leftEye,
    rightEye,
    outerHalo,
    innerHalo,
    lowerRingOuter,
    lowerRingInner,
    contactShadow,
    hoverProjectionRing,
    haloNodes,
    chestCore,
    chestButtonGroup,
    explodables,
    materials: {
      armorPrimary,
      armorSecondary,
      trimMetal,
      visorGlass,
      emissiveAccent,
      irisMaterial,
      corneaMaterial,
    },
    applyFinish,
    dispose,
  };
}
