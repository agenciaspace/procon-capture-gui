// scripts/create-icon.js
// Gera assets/icon.png — 1024×1024 azul sólido (#2f81f7) sem dependências externas.
// Uso: node scripts/create-icon.js
const { writeFileSync, mkdirSync } = require('fs');
const { deflateSync } = require('zlib');

const W = 1024, H = 1024;
const R = 0x2f, G = 0x81, B = 0xf7; // #2f81f7

// Scanlines: 1 byte de filtro (0=Nenhum) + pixels RGB por linha
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const i = y * (1 + W * 3) + 1 + x * 3;
    raw[i] = R; raw[i + 1] = G; raw[i + 2] = B;
  }
}
const idat = deflateSync(raw);

function u32be(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  let v = 0xffffffff;
  for (const byte of buf) v = (t[(v ^ byte) & 0xff] ^ (v >>> 8)) >>> 0;
  return (v ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  return Buffer.concat([u32be(data.length), td, u32be(crc32(td))]);
}

// IHDR: width=1024, height=1024, bit depth=8, color type=2 (RGB)
const ihdr = Buffer.from([0x00,0x00,0x04,0x00, 0x00,0x00,0x04,0x00, 8, 2, 0, 0, 0]);

const png = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), // assinatura PNG
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', png);
console.log('✅ assets/icon.png criado (1024×1024 #2f81f7)');
