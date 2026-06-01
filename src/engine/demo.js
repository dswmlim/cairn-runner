// "Recording mode": a fake Input for ?demo=1 that auto-plays the level so a
// gameplay capture is consistent every run. Instead of fragile hand-timed
// keyframes (which break whenever a level is edited), it reads the live player
// and level each frame and decides to walk right / jump using the same gap- and
// wall-detection logic as tools/render_gif.py. This keeps the in-browser demo
// and the headless preview behaving identically.

import { TILE, SOLID_TILES } from './constants.js';

function solidAt(level, px, py) {
  const c = Math.floor(px / TILE);
  const r = Math.floor(py / TILE);
  if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return false;
  return SOLID_TILES.has(level.grid[r][c]);
}

export class DemoInput {
  constructor() {
    this.down = {};
    this._pressed = {};
    this._prevJump = false;
  }

  // main.js calls this each fixed step with the current player + level.
  update(dt, player, level) {
    let jump = false;

    if (player && level && player.onGround) {
      const lead = player.x + player.w;
      const footY = player.y + player.h + 4;
      const bodyY = player.y + player.h / 2;

      // Gap starting just ahead? Jump a touch early so the arc clears it.
      let gapSoon = false;
      for (const d of [TILE * 0.5, TILE * 0.9, TILE * 1.3]) {
        if (!solidAt(level, lead + d, footY) && !solidAt(level, lead + d, footY + TILE)) {
          gapSoon = true; break;
        }
      }
      const wallAhead = solidAt(level, lead + 2, bodyY);

      // Hop for a coin that's just ahead and within jump height.
      let coinAbove = false;
      for (const coin of level.coins) {
        if (coin.taken) continue;
        const dx = coin.x - (player.x + player.w / 2);
        const dy = (player.y + player.h / 2) - coin.y;
        if (dx > 0 && dx < TILE * 1.4 && dy > TILE * 0.4 && dy < TILE * 2.6) {
          coinAbove = true; break;
        }
      }
      jump = gapSoon || wallAhead || coinAbove;
    }

    this.down = { left: false, right: true, jump };
    this._pressed = {};
    if (jump && !this._prevJump) this._pressed.jump = true;
    this._prevJump = jump;
  }

  justPressed(a) { return !!this._pressed[a]; }
  postUpdate() { /* handled in update() */ }
}
