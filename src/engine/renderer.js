// Rendering. Uses Kenney sprite art when assets/ is present, and gracefully
// falls back to the original procedural shapes per-element when a sheet is
// missing — so the game looks good with art and still runs without it.
//
// The renderer owns the camera transform, the HUD, and the parallax background.

import { TILE, VIEW_W, VIEW_H, T } from './constants.js';
import { TILES, CHARS } from './assets.js';

export class Renderer {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets || null;
    this.cam = { x: 0, y: 0 };
    this.t = 0; // animation clock
    this.ctx.imageSmoothingEnabled = false; // crisp pixel-art scaling
  }

  resize() {
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.ctx.imageSmoothingEnabled = false;
  }

  _tiles() { return this.assets && this.assets.has('tiles'); }
  _chars() { return this.assets && this.assets.has('chars'); }

  follow(target, level) {
    const goalX = target.x + target.w / 2 - VIEW_W / 2;
    const goalY = target.y + target.h / 2 - VIEW_H / 2;
    this.cam.x += (goalX - this.cam.x) * 0.15;
    this.cam.y += (goalY - this.cam.y) * 0.15;
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, level.widthPx - VIEW_W));
    this.cam.y = clamp(this.cam.y, 0, Math.max(0, level.heightPx - VIEW_H));
  }

  // ---- Background: layered parallax (procedural; reads well behind sprites) ----
  clearSky(level) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, level.sky);
    g.addColorStop(0.7, lighten(level.sky, 30));
    g.addColorStop(1, '#eaf6ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    this._clouds(this.cam.x * 0.15);
    drawRange(ctx, this.cam.x * 0.25, 210, 95, shade(level.hill, -45), 0.006);
    drawRange(ctx, this.cam.x * 0.45, 255, 80, shade(level.hill, -20), 0.009);
    drawHills(ctx, this.cam.x * 0.6, 295, level.hill);
  }

  _clouds(offset) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 6; i++) {
      const span = VIEW_W + 240;
      const cx = (((i * 240 - offset) % span) + span) % span - 120;
      const cy = 50 + (i % 3) * 26;
      cloud(ctx, cx, cy, 1 + (i % 2) * 0.4);
    }
    ctx.restore();
  }

  // ---- World tiles + collectibles ----
  world(level) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    const c0 = Math.max(0, Math.floor(this.cam.x / TILE));
    const c1 = Math.min(level.cols - 1, Math.ceil((this.cam.x + VIEW_W) / TILE));
    const r0 = Math.max(0, Math.floor(this.cam.y / TILE));
    const r1 = Math.min(level.rows - 1, Math.ceil((this.cam.y + VIEW_H) / TILE));

    const useTiles = this._tiles();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = level.grid[r][c];
        if (ch !== T.SOLID && ch !== T.PLATFORM) continue;
        const x = c * TILE, y = r * TILE;
        if (useTiles) {
          const above = r > 0 ? level.grid[r - 1][c] : '.';
          const isSurface = above !== T.SOLID && above !== T.PLATFORM;
          if (ch === T.PLATFORM) {
            this.assets.draw(ctx, 'tiles', TILES.platformMid, x, y, TILE, TILE);
          } else {
            this.assets.draw(ctx, 'tiles', isSurface ? TILES.grassTop : TILES.dirt, x, y, TILE, TILE);
          }
        } else if (ch === T.SOLID) {
          this.tileBlock(x, y, '#6b4a2b', '#8a6238');
        } else {
          this.tileBlock(x, y, '#3a7d44', '#57a866');
        }
      }
    }

    // Spikes
    for (const s of level.spikes) {
      if (useTiles) {
        this.assets.draw(ctx, 'tiles', TILES.spike, s.x, s.y, TILE, TILE);
      } else {
        ctx.fillStyle = '#c9ccd6';
        for (let i = 0; i < TILE; i += 8) {
          ctx.beginPath();
          ctx.moveTo(s.x + i, s.y + TILE);
          ctx.lineTo(s.x + i + 4, s.y + TILE - 12);
          ctx.lineTo(s.x + i + 8, s.y + TILE);
          ctx.fill();
        }
      }
    }

    // Checkpoints
    for (const k of level.checkpoints) {
      if (useTiles) {
        ctx.save();
        if (!k.reached) ctx.globalAlpha = 0.6;
        this.assets.draw(ctx, 'tiles', TILES.flag, k.x + 6, k.y - TILE, TILE, TILE);
        ctx.restore();
      } else {
        ctx.fillStyle = '#555';
        ctx.fillRect(k.x + TILE / 2 - 2, k.y - TILE, 4, TILE * 2);
        ctx.fillStyle = k.reached ? '#54e08a' : '#9aa0b5';
        ctx.fillRect(k.x + TILE / 2 + 2, k.y - TILE, 16, 12);
      }
    }

    // Coins (bob + spin)
    for (const coin of level.coins) {
      if (coin.taken) continue;
      const bob = Math.sin(this.t * 4 + coin.x) * 2;
      const sx = Math.abs(Math.cos(this.t * 4 + coin.x));
      if (useTiles) {
        const w = Math.max(2, TILE * 0.7 * sx);
        this.assets.draw(ctx, 'tiles', TILES.coin,
          coin.x - w / 2, coin.y - TILE * 0.35 + bob, w, TILE * 0.7);
      } else {
        ctx.save();
        ctx.translate(coin.x, coin.y + bob);
        ctx.scale(sx, 1);
        ctx.fillStyle = '#ffd34e';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#caa017';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // End flag
    if (level.flag) {
      const f = level.flag;
      if (useTiles) {
        this.assets.draw(ctx, 'tiles', TILES.flag, f.x, f.y - TILE * 2, TILE, TILE * 2 + 8);
      } else {
        ctx.fillStyle = '#444';
        ctx.fillRect(f.x + 4, f.y - TILE * 2, 4, TILE * 3);
        ctx.fillStyle = '#ff5470';
        ctx.beginPath();
        ctx.moveTo(f.x + 8, f.y - TILE * 2);
        ctx.lineTo(f.x + 30, f.y - TILE * 2 + 8);
        ctx.lineTo(f.x + 8, f.y - TILE * 2 + 16);
        ctx.fill();
      }
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

  // ---- Entities ----
  entities(player, enemies) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    const useChars = this._chars();

    for (const e of enemies) {
      if (!e.alive) continue;
      if (useChars) {
        const frame = Math.floor(this.t * 6) % 2 === 0 ? CHARS.enemyA : CHARS.enemyB;
        const flip = e.vx > 0;
        this.assets.draw(ctx, 'chars', frame, e.x - 4, e.y - 4, 32, 32, flip);
      } else {
        ctx.fillStyle = '#b5471f';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x + 4, e.y + 6, 5, 5);
        ctx.fillRect(e.x + e.w - 9, e.y + 6, 5, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x + 6, e.y + 8, 2, 2);
        ctx.fillRect(e.x + e.w - 7, e.y + 8, 2, 2);
      }
    }

    const p = player;
    if (useChars) {
      let frame = CHARS.playerIdle;
      if (!p.onGround) frame = CHARS.playerJump;
      else if (Math.abs(p.vx) > 20) {
        frame = Math.floor(this.t * 10) % 2 === 0 ? CHARS.playerWalkA : CHARS.playerWalkB;
      }
      const flip = p.facing < 0;
      this.assets.draw(ctx, 'chars', frame, p.x - 5, p.y - 4, 32, 32, flip);
    } else {
      ctx.fillStyle = '#2f6dff';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#ffd9b3';
      ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, 8);
      ctx.fillStyle = '#000';
      const ex = p.facing > 0 ? p.x + p.w - 8 : p.x + 4;
      ctx.fillRect(ex, p.y + 5, 3, 3);
    }
    ctx.restore();
  }

  // ---- HUD ----
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

function cloud(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const r = 16 * scale;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r, y + 4, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x - r, y + 4, r * 0.8, 0, Math.PI * 2);
  ctx.arc(x + r * 0.5, y - r * 0.4, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawRange(ctx, offset, baseY, amp, color, freq) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 12) {
    const y = baseY + Math.sin((x + offset) * freq) * amp * 0.4
                    + Math.sin((x + offset) * freq * 2.3) * amp * 0.18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function drawHills(ctx, offset, baseY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 16) {
    const y = baseY + Math.sin((x + offset) * 0.01) * 28;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex, amt) { return shade(hex, amt); }
