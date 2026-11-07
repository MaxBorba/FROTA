import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter None
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);

  // PNG header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

// Icon drawer: elegant deep blue gradient background (#1e3a8a -> #0f172a) with white car silhouette and amber accents
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (x - cx) / (w / 2);
  const dy = (y - cy) / (h / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background gradient: Navy blue (#1e3a8a) to deep midnight (#0f172a)
  const t = y / h;
  let r = Math.round(30 * (1 - t) + 15 * t);
  let g = Math.round(58 * (1 - t) + 23 * t);
  let b = Math.round(138 * (1 - t) + 42 * t);
  let a = 255;

  // Outer circular glow / badge rim
  if (dist > 0.82 && dist < 0.88) {
    r = Math.min(255, r + 60);
    g = Math.min(255, g + 80);
    b = Math.min(255, b + 120);
  }

  // Draw central stylized Car / Fleet vehicle icon
  // Normalized coords inside [-1, 1] relative to center
  const nx = (x - cx) / (w * 0.35);
  const ny = (y - cy) / (h * 0.35);

  // Car roof & windshield
  const isCabin = (ny >= -0.65 && ny <= -0.15) && (Math.abs(nx) <= 0.65 - (ny + 0.65) * 0.3);
  // Car lower body
  const isBody = (ny >= -0.15 && ny <= 0.45) && (Math.abs(nx) <= 0.9);
  // Wheels cutouts
  const isLeftWheel = Math.hypot(nx + 0.55, ny - 0.45) < 0.22;
  const isRightWheel = Math.hypot(nx - 0.55, ny - 0.45) < 0.22;
  const isLeftWheelTire = isLeftWheel && Math.hypot(nx + 0.55, ny - 0.45) > 0.10;
  const isRightWheelTire = isRightWheel && Math.hypot(nx - 0.55, ny - 0.45) > 0.10;
  const isWheelHub = (Math.hypot(nx + 0.55, ny - 0.45) <= 0.10) || (Math.hypot(nx - 0.55, ny - 0.45) <= 0.10);

  // Headlights (Amber #f59e0b)
  const isRightHeadlight = (ny >= 0.05 && ny <= 0.2) && (nx >= 0.75 && nx <= 0.9);
  const isLeftTaillight = (ny >= 0.05 && ny <= 0.2) && (nx <= -0.75 && nx >= -0.9);

  if (isLeftWheelTire || isRightWheelTire) {
    return [30, 41, 59, 255]; // Dark slate tire
  } else if (isWheelHub) {
    return [245, 158, 11, 255]; // Amber hub
  } else if (isRightHeadlight) {
    return [245, 158, 11, 255]; // Golden headlight
  } else if (isLeftTaillight) {
    return [239, 68, 68, 255]; // Red taillight
  } else if ((isCabin || isBody) && !isLeftWheel && !isRightWheel) {
    // Window cutout
    const isWindow = (ny >= -0.55 && ny <= -0.18) && (Math.abs(nx) <= 0.55 - (ny + 0.55) * 0.25);
    if (isWindow) {
      return [186, 230, 253, 255]; // Light sky blue glass
    }
    return [255, 255, 255, 255]; // Clean white body
  }

  return [r, g, b, a];
}

const pwa192 = createPNG(192, 192, drawIcon);
const pwa512 = createPNG(512, 512, drawIcon);

fs.writeFileSync('public/pwa-192x192.png', pwa192);
fs.writeFileSync('public/pwa-512x512.png', pwa512);
fs.writeFileSync('public/pwa-maskable-512x512.png', pwa512);
fs.writeFileSync('public/apple-touch-icon.png', pwa192);
console.log('Successfully generated PWA icons in /public');
