import * as THREE from 'three';

export function createIrisTexture(
  primaryHex: string,
  glowHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.48;

  ctx.fillStyle = '#02050c';
  ctx.fillRect(0, 0, size, size);

  // Deep sapphire radial iris field
  const irisGrad = ctx.createRadialGradient(cx, cy, radius * 0.14, cx, cy, radius);
  irisGrad.addColorStop(0.0, '#010308');
  irisGrad.addColorStop(0.24, '#e0f2fe');
  irisGrad.addColorStop(0.36, glowHex);
  irisGrad.addColorStop(0.62, primaryHex);
  irisGrad.addColorStop(0.86, '#07142e');
  irisGrad.addColorStop(1.0, '#02040a');

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);

  // Fine radial optical striations
  const fiberCount = 144;
  for (let i = 0; i < fiberCount; i++) {
    const angle = (i / fiberCount) * Math.PI * 2;
    const inner = radius * (0.27 + (i % 4) * 0.025);
    const outer = radius * (0.85 + (i % 5) * 0.02);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.strokeStyle =
      i % 6 === 0 ? 'rgba(224, 242, 254, 0.72)' : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = i % 12 === 0 ? 2.4 : 1.0;
    ctx.stroke();
  }

  // Segmented optical aperture ticks
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r0 = radius * 0.64;
    const r1 = radius * (i % 2 === 0 ? 0.74 : 0.69);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r0, Math.sin(angle) * r0);
    ctx.lineTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
    ctx.lineWidth = i % 2 === 0 ? 2.2 : 1.2;
    ctx.stroke();
  }

  // Concentric technical reticle rings
  const ringRadii = [0.34, 0.56, 0.78, 0.92];
  ringRadii.forEach((rFrac, idx) => {
    ctx.beginPath();
    ctx.arc(0, 0, radius * rFrac, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx === 0
        ? 'rgba(224, 242, 254, 0.92)'
        : 'rgba(96, 165, 250, 0.42)';
    ctx.lineWidth = idx === 0 ? 2.5 : 1.3;
    if (idx === 1) {
      ctx.setLineDash([12, 8]);
    } else if (idx === 2) {
      ctx.setLineDash([4, 8]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Twin specular optical catchlights for crystalline depth
  const catchGrad = ctx.createRadialGradient(
    -radius * 0.3,
    -radius * 0.3,
    2,
    -radius * 0.3,
    -radius * 0.3,
    radius * 0.24,
  );
  catchGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  catchGrad.addColorStop(0.45, 'rgba(186, 230, 253, 0.35)');
  catchGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = catchGrad;
  ctx.beginPath();
  ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createPlinthGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.49);
  bgGrad.addColorStop(0, 'rgba(37, 99, 235, 0.26)');
  bgGrad.addColorStop(0.42, 'rgba(15, 23, 42, 0.35)');
  bgGrad.addColorStop(0.84, 'rgba(4, 7, 14, 0.08)');
  bgGrad.addColorStop(1, 'rgba(4, 7, 14, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Astrolabe octagonal calibration frame
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = size * 0.39;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  // Concentric calibration rings
  const rings = [0.16, 0.25, 0.34, 0.45];
  rings.forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, size * r, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx === 1
        ? 'rgba(56, 189, 248, 0.34)'
        : 'rgba(96, 165, 250, 0.14)';
    ctx.lineWidth = idx === 1 ? 2 : 1.2;
    if (idx === 2) {
      ctx.setLineDash([12, 16]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Radial degree ticks
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const r0 = size * (isMajor ? 0.325 : 0.338);
    const r1 = size * 0.355;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.strokeStyle = isMajor
      ? 'rgba(125, 211, 252, 0.48)'
      : 'rgba(96, 165, 250, 0.18)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    12,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(1, 3, 8, 0.85)');
  grad.addColorStop(0.55, 'rgba(2, 6, 16, 0.45)');
  grad.addColorStop(1, 'rgba(4, 7, 14, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createParticleSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(186, 230, 253, 1)');
  grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.45)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
