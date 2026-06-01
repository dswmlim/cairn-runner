// Sprite picker overlay (debug aid). Enable with ?pick=tiles or ?pick=chars in
// the URL. It draws the chosen spritesheet as a labelled grid so you can read
// off the (col,row) of any sprite and plug it into TILES/CHARS in assets.js.
//
// This exists because the exact cell positions depend on which art pack you
// drop in. Find the cell you want, note its "c,r" label, edit assets.js, done.

import { SHEET } from './assets.js';

export function drawSpritePicker(ctx, assets, which, canvas) {
  const def = SHEET[which];
  const img = assets.images[which];
  ctx.fillStyle = '#101327';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!img) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`No '${which}' sheet loaded. Put it in /assets first.`, 16, 30);
    return;
  }
  // Fit the sheet to the canvas with a margin, scaled up, grid + labels.
  const margin = 30;
  const scale = Math.min(
    (canvas.width - margin * 2) / img.width,
    (canvas.height - margin * 2) / img.height
  );
  const ox = margin, oy = margin;
  const dw = img.width * scale, dh = img.height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, ox, oy, dw, dh);

  ctx.strokeStyle = 'rgba(0,255,200,0.5)';
  ctx.fillStyle = '#7CFFD4';
  ctx.font = '9px monospace';
  const cs = def.cell * scale;
  for (let r = 0; r < def.rows; r++) {
    for (let c = 0; c < def.cols; c++) {
      const x = ox + c * cs, y = oy + r * cs;
      ctx.strokeRect(x, y, cs, cs);
      ctx.fillText(`${c},${r}`, x + 1, y + 9);
    }
  }
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Sprite picker: '${which}'  (cell ${def.cell}px, ${def.cols}x${def.rows}) — read c,r and edit assets.js`, 16, canvas.height - 12);
}
