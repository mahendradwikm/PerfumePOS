// Minimal PNG bar-chart renderer (no native deps).
// Draws a simple, styled bar chart into a raw RGBA buffer and returns PNG bytes.
const W = 900;
const H = 420;
const PAD_L = 110;
const PAD_R = 30;
const PAD_T = 60;
const PAD_B = 70;

type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const GRID: RGB = [226, 232, 240];
const TEXT: RGB = [100, 116, 139];
const BAR: RGB = [99, 102, 241];
const BAR_TOP: RGB = [79, 70, 229];

function makeCanvas(w: number, h: number, bg: RGB) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

function setPx(data: Buffer, w: number, x: number, y: number, c: RGB) {
  if (x < 0 || y < 0 || x >= w || y >= H) return;
  const i = (y * w + x) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = 255;
}

function rect(data: Buffer, w: number, x0: number, y0: number, x1: number, y1: number, c: RGB) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      setPx(data, w, x, y, c);
    }
  }
}

// 3x5 pixel font for digits/letters used in labels
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ".": ["000", "000", "000", "000", "010"],
  ",": ["000", "000", "000", "010", "100"],
  "-": ["000", "000", "111", "000", "000"],
  "/": ["001", "001", "010", "100", "100"],
  " ": ["000", "000", "000", "000", "000"],
  k: ["101", "101", "110", "101", "101"],
  R: ["110", "101", "110", "101", "101"],
  p: ["000", "111", "101", "111", "000"],
  s: ["000", "111", "110", "001", "111"],
  a: ["000", "111", "101", "101", "111"],
  h: ["100", "111", "101", "101", "101"],
  b: ["110", "101", "111", "101", "111"],
  c: ["000", "111", "100", "100", "111"],
  d: ["001", "111", "101", "101", "111"],
  e: ["000", "111", "110", "100", "111"],
  f: ["011", "110", "111", "110", "110"],
  g: ["000", "111", "101", "111", "001"],
  i: ["010", "000", "110", "010", "111"],
  j: ["001", "000", "011", "001", "110"],
  l: ["110", "010", "010", "010", "111"],
  m: ["000", "111", "111", "101", "101"],
  n: ["000", "111", "101", "101", "101"],
  o: ["000", "111", "101", "101", "111"],
  q: ["000", "111", "101", "111", "001"],
  r: ["000", "110", "101", "100", "100"],
  t: ["110", "010", "010", "010", "011"],
  u: ["000", "101", "101", "101", "111"],
  v: ["000", "101", "101", "101", "010"],
  w: ["000", "101", "101", "111", "111"],
  x: ["000", "101", "010", "101", "000"],
  y: ["000", "101", "101", "111", "001"],
  z: ["000", "111", "010", "100", "111"],
  T: ["111", "010", "010", "010", "010"],
  P: ["110", "101", "110", "100", "100"],
  J: ["001", "001", "001", "101", "111"],
  L: ["100", "100", "100", "100", "111"],
  N: ["101", "111", "111", "111", "101"],
  U: ["101", "101", "101", "101", "111"],
  M: ["101", "111", "111", "101", "101"],
  S: ["111", "100", "111", "001", "111"],
  A: ["111", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  K: ["101", "101", "110", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  Y: ["101", "101", "010", "010", "010"],
};

function drawText(data: Buffer, w: number, text: string, x: number, y: number, c: RGB, scale = 2) {
  let cx = x;
  for (const raw of text.toLowerCase()) {
    const g = GLYPHS[raw];
    if (!g) {
      cx += 4 * scale;
      continue;
    }
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (g[gy][gx] === "1") {
          rect(data, w, cx + gx * scale, y + gy * scale, cx + (gx + 1) * scale, y + (gy + 1) * scale, c);
        }
      }
    }
    cx += 4 * scale;
  }
  return cx - x;
}

function textWidth(text: string, scale = 2) {
  return text.length * 4 * scale;
}

// CRC32 for PNG chunk
const crcTable: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(data: Buffer, w: number, h: number) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }

  const idat = chunk("IDAT", require("zlib").deflateSync(raw));
  return Buffer.concat([sig, chunk("IHDR", ihdr), idat, chunk("IEND", Buffer.alloc(0))]);
}

function shortNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "m";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "jt";
  if (n >= 1000) return Math.round(n / 1000) + "k";
  return String(Math.round(n));
}

export function renderTrendChart(labels: string[], values: number[], title: string): Buffer {
  const data = makeCanvas(W, H, WHITE);

  // Title
  drawText(data, W, title, Math.max(20, (W - textWidth(title, 3)) / 2), 20, TEXT, 3);

  const plotX0 = PAD_L;
  const plotX1 = W - PAD_R;
  const plotY0 = PAD_T;
  const plotY1 = H - PAD_B;

  const max = Math.max(1, ...values);
  const niceMax = Math.ceil(max / 100000) * 100000 || max;
  const steps = 5;

  // Grid + y labels
  for (let i = 0; i <= steps; i++) {
    const y = plotY1 - ((plotY1 - plotY0) / steps) * i;
    rect(data, W, plotX0, y, plotX1, y + 1, GRID);
    const lbl = shortNum((niceMax / steps) * i);
    drawText(data, W, lbl, plotX0 - 8 - textWidth(lbl, 2), y - 5, TEXT, 2);
  }

  // Axes
  rect(data, W, plotX0, plotY0, plotX0 + 2, plotY1 + 1, [203, 213, 225]);
  rect(data, W, plotX0, plotY1, plotX1, plotY1 + 2, [203, 213, 225]);

  // Bars
  const n = Math.max(1, values.length);
  const slot = (plotX1 - plotX0) / n;
  const barW = Math.max(6, Math.min(56, slot * 0.6));
  labels.forEach((lbl, i) => {
    const v = values[i] || 0;
    const barH = Math.round(((plotY1 - plotY0) * v) / niceMax);
    const x0 = Math.round(plotX0 + slot * i + (slot - barW) / 2);
    const y0 = plotY1 - barH;
    rect(data, W, x0, y0, x0 + barW, plotY1, BAR);
    rect(data, W, x0, y0, x0 + barW, y0 + 3, BAR_TOP);
    // x label
    const lw = textWidth(lbl, 2);
    drawText(data, W, lbl, Math.round(plotX0 + slot * i + slot / 2 - lw / 2), plotY1 + 12, TEXT, 2);
    // value label (above bar, or inside bar when the bar reaches the top)
    const vs = shortNum(v);
    const vx = Math.round(plotX0 + slot * i + slot / 2 - textWidth(vs, 2) / 2);
    if (y0 - 18 >= plotY0) {
      drawText(data, W, vs, vx, y0 - 18, BAR_TOP, 2);
    } else {
      drawText(data, W, vs, vx, y0 + 6, WHITE, 2);
    }
  });

  return encodePng(data, W, H);
}