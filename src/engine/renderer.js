// All drawing. Everything is generated from shapes/gradients — no image assets.
// The renderer owns the camera transform and the HUD.

import { TILE, VIEW_W, VIEW_H, T } from './constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0 };
    this.t = 0; // animation clock
  }

  // Keep internal resolution fixed; CSS scales the canvas to fit the frame.
  resize() {
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
  }

  follow(target, level) {
    // Smooth-ish camera centred on the player, clamped to level bounds.
    const goalX = target.x + target.w / 2 - VIEW_W / 2;
    const goalY = target.y + target.h / 2 - VIEW_H / 2;
    this.cam.x += (goalX - this.cam.x) * 0.15;
    this.cam.y += (goalY - this.cam.y) * 0.15;
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, level.widthPx - VIEW_W));
    this.cam.y = clamp(this.cam.y, 0, Math.max(0, level.heightPx - VIEW_H));
  }

  clearSky(level) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, level.sky);
    g.addColorStop(1, '#bfeaff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Parallax hills (cheap: two sine bands tied to camera x).
    const px = this.cam.x * 0.4;
    ctx.fillStyle = shade(level.hill, -10);
    drawHills(ctx, px * 0.6, 250, 70, level.hill);
    ctx.fillStyle = level.hill;
    drawHills(ctx, px, 280, 90, level.hill);
  }

  world(level) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    // Only draw tiles within the viewport (culling) for performance.
    const c0 = Math.max(0, Math.floor(this.cam.x / TILE));
    const c1 = Math.min(level.cols - 1, Math.ceil((this.cam.x + VIEW_W) / TILE));
    const r0 = Math.max(0, Math.floor(this.cam.y / TILE));
    const r1 = Math.min(level.rows - 1, Math.ceil((this.cam.y + VIEW_H) / TILE));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = level.grid[r][c];
        if (ch === T.SOLID) this.tileBlock(c * TILE, r * TILE, '#6b4a2b', '#8a6238');
        else if (ch === T.PLATFORM) this.tileBlock(c * TILE, r * TILE, '#3a7d44', '#57a866');
      }
    }

    // Spikes
    ctx.fillStyle = '#c9ccd6';
    for (const s of level.spikes) {
      for (let i = 0; i < TILE; i += 8) {
        ctx.beginPath();
        ctx.moveTo(s.x + i, s.y + TILE);
        ctx.lineTo(s.x + i + 4, s.y + TILE - 12);
        ctx.lineTo(s.x + i + 8, s.y + TILE);
        ctx.fill();
      }
    }

    // Checkpoints (flag posts)
    for (const k of level.checkpoints) {
      ctx.fillStyle = '#555';
      ctx.fillRect(k.x + TILE / 2 - 2, k.y - TILE, 4, TILE * 2);
      ctx.fillStyle = k.reached ? '#54e08a' : '#9aa0b5';
      ctx.fillRect(k.x + TILE / 2 + 2, k.y - TILE, 16, 12);
    }

    // Coins (spin via scaleX)
    for (const coin of level.coins) {
      if (coin.taken) continue;
      const sx = Math.abs(Math.cos(this.t * 4 + coin.x));
      ctx.save();
      ctx.translate(coin.x, coin.y);
      ctx.scale(sx, 1);
      ctx.fillStyle = '#ffd34e';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#caa017';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // End flag
    if (level.flag) {
      const f = level.flag;
      ctx.fillStyle = '#444';
      ctx.fillRect(f.x + 4, f.y - TILE * 2, 4, TILE * 3);
      ctx.fillStyle = '#ff5470';
      ctx.beginPath();
      ctx.moveTo(f.x + 8, f.y - TILE * 2);
      ctx.lineTo(f.x + 30, f.y - TILE * 2 + 8);
      ctx.lineTo(f.x + 8, f.y - TILE * 2 + 16);
      ctx.fill();
    }
    ctx.restore();
  }

  tileBlock(x, y, dark, light) {
    const ctx = this.ctx;
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, TILE, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + TILE - 4, TILE, 4);
  }

  entities(player, enemies) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    for (const e of enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = '#b5471f';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + 4, e.y + 6, 5, 5);
      ctx.fillRect(e.x + e.w - 9, e.y + 6, 5, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x + 6, e.y + 8, 2, 2);
      ctx.fillRect(e.x + e.w - 7, e.y + 8, 2, 2);
    }

    // Player
    const p = player;
    ctx.fillStyle = '#2f6dff';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#ffd9b3';
    ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, 8); // face band
    ctx.fillStyle = '#000';
    const ex = p.facing > 0 ? p.x + p.w - 8 : p.x + 4;
    ctx.fillRect(ex, p.y + 5, 3, 3);
    ctx.restore();
  }

  hud(state) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(13,16,33,0.55)';
    ctx.fillRect(0, 0, VIEW_W, 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SCORE ${pad(state.score, 6)}`, 10, 14);
    ctx.fillText(`COINS ${pad(state.coins, 2)}`, 180, 14);
    ctx.fillText(`LIVES ${state.lives}`, 320, 14);
    ctx.fillText(`TIME ${Math.ceil(state.time)}`, 440, 14);
    ctx.fillText(state.levelName, 540, 14);
  }

  centerText(title, sub, sub2) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(13,16,33,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34e';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 30);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '18px "Courier New", monospace';
    if (sub) ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 12);
    if (sub2) ctx.fillText(sub2, VIEW_W / 2, VIEW_H / 2 + 40);
    ctx.textAlign = 'left';
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pad(n, len) { return String(n).padStart(len, '0'); }

function drawHills(ctx, offset, baseY, amp, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 16) {
    const y = baseY + Math.sin((x + offset) * 0.01) * amp * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function shade(hex, amt) {
  // crude lighten/darken for parallax band
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return `rgb(${r},${g},${b})`;
}
