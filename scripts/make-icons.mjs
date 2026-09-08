/**
 * Generate PWA icons from public/kufli-logo.png.
 *
 *   node scripts/make-icons.mjs
 *
 * The source crest fills its canvas edge to edge, so Android's adaptive-icon
 * mask clips the "KUFLI" text and the shield points. This bakes the crest onto
 * the brand navy with safe-zone padding and writes:
 *   - kufli-maskable-512.png / kufli-maskable-192.png  (manifest, purpose "maskable")
 *   - kufli-apple-touch.png   180x180                  (iOS home-screen icon)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [6, 20, 27]; // #06141b — manifest background_color / theme_color

const src = PNG.sync.read(fs.readFileSync(path.join(pub, 'kufli-logo.png')));

/** Premultiply alpha so downscaling doesn't bleed transparent-pixel colour in. */
const pre = Buffer.alloc(src.data.length);
for (let i = 0; i < src.data.length; i += 4) {
  const a = src.data[i + 3];
  pre[i] = (src.data[i] * a) / 255;
  pre[i + 1] = (src.data[i + 1] * a) / 255;
  pre[i + 2] = (src.data[i + 2] * a) / 255;
  pre[i + 3] = a;
}

/** Area-average (box) resample of premultiplied RGBA — clean at any downscale. */
function resample(buf, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy0 = (y * sh) / dh;
    const sy1 = ((y + 1) * sh) / dh;
    for (let x = 0; x < dw; x++) {
      const sx0 = (x * sw) / dw;
      const sx1 = ((x + 1) * sw) / dw;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) {
        const fh = Math.min(sy1, yy + 1) - Math.max(sy0, yy);
        if (fh <= 0) continue;
        for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) {
          const fw = Math.min(sx1, xx + 1) - Math.max(sx0, xx);
          if (fw <= 0) continue;
          const w = fw * fh;
          const si = (yy * sw + xx) * 4;
          r += buf[si] * w;
          g += buf[si + 1] * w;
          b += buf[si + 2] * w;
          a += buf[si + 3] * w;
          area += w;
        }
      }
      const di = (y * dw + x) * 4;
      out[di] = Math.round(r / area);
      out[di + 1] = Math.round(g / area);
      out[di + 2] = Math.round(b / area);
      out[di + 3] = Math.round(a / area);
    }
  }
  return out;
}

/** Crest at `scale` of the canvas, centred, composited over opaque navy. */
function build(size, scale, file) {
  const inner = Math.round(size * scale);
  const logo = resample(pre, src.width, src.height, inner, inner);
  const off = Math.round((size - inner) / 2);

  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const di = (y * size + x) * 4;
      let r = BG[0];
      let g = BG[1];
      let b = BG[2];
      const lx = x - off;
      const ly = y - off;
      if (lx >= 0 && lx < inner && ly >= 0 && ly < inner) {
        const li = (ly * inner + lx) * 4;
        const a = logo[li + 3] / 255; // premultiplied: out = fg + bg*(1-a)
        r = logo[li] + r * (1 - a);
        g = logo[li + 1] + g * (1 - a);
        b = logo[li + 2] + b * (1 - a);
      }
      png.data[di] = Math.round(r);
      png.data[di + 1] = Math.round(g);
      png.data[di + 2] = Math.round(b);
      png.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(pub, file), PNG.sync.write(png));
  console.log(`wrote ${file} (${size}px, crest @ ${Math.round(scale * 100)}%)`);
}

build(512, 0.7, 'kufli-maskable-512.png');
build(192, 0.7, 'kufli-maskable-192.png');
build(180, 0.84, 'kufli-apple-touch.png');
