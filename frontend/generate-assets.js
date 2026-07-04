const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[n] = c;
}

function calculateCrc(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = crcTable[(c ^ buf[n]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(calculateCrc(typeAndData), 0);

  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

function generateSolidPng(width, height, r, g, b) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;     // Bit depth
  ihdrData[9] = 2;     // Color type: RGB
  ihdrData[10] = 0;    // Compression method
  ihdrData[11] = 0;    // Filter method
  ihdrData[12] = 0;    // Interlace method
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanline pixel data: each scanline starts with filter byte 0, followed by width * 3 bytes of RGB
  const scanlineLength = 1 + width * 3;
  const rawPixelData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    rawPixelData[offset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = offset + 1 + x * 3;
      rawPixelData[pixelOffset] = r;
      rawPixelData[pixelOffset + 1] = g;
      rawPixelData[pixelOffset + 2] = b;
    }
  }

  // Compress pixel data
  const compressed = zlib.deflateSync(rawPixelData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
  console.log('Created assets directory.');
}

// Generate icon (1024x1024, Brand Indigo)
console.log('Generating icon.png...');
const iconBuf = generateSolidPng(1024, 1024, 99, 102, 241);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconBuf);

// Generate adaptive icon (1024x1024, Brand Indigo)
console.log('Generating adaptive-icon.png...');
const adaptiveIconBuf = generateSolidPng(1024, 1024, 99, 102, 241);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptiveIconBuf);

// Generate splash screen (1242x2436, Dark Slate)
console.log('Generating splash.png...');
const splashBuf = generateSolidPng(1242, 2436, 15, 23, 42);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashBuf);

// Generate generic favicon (48x48, Brand Indigo)
console.log('Generating favicon.png...');
const faviconBuf = generateSolidPng(48, 48, 99, 102, 241);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconBuf);

console.log('All image assets created successfully!');
