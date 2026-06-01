// Dynamic entities. Player handles input-driven movement with coyote-time and
// jump-buffering for a responsive feel. Enemy is a simple patrol that turns at
// walls and ledges.

import {
  TILE, GRAVITY, MOVE_ACCEL, MOVE_MAX, FRICTION, JUMP_VELOCITY,
  COYOTE_TIME, JUMP_BUFFER, ENEMY_SPEED, SOLID_TILES,
} from './constants.js';
import { moveAndCollide } from './physics.js';

export class Player {
  constructor(x, y) {
    this.spawnX = x; this.spawnY = y;
    this.reset(x, y);
    this.w = 22; this.h = 28;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this._coyote = 0;
    this._buffer = 0;
    this.dead = false;
  }

  update(dt, input, level, audio) {
    const left = input.down.left;
    const right = input.down.right;

    // Horizontal accel + friction.
    if (left && !right) { this.vx -= MOVE_ACCEL * dt; this.facing = -1; }
    else if (right && !left) { this.vx += MOVE_ACCEL * dt; this.facing = 1; }
    else {
      const f = FRICTION * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - f);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + f);
    }
    this.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, this.vx));

    // Coyote time + jump buffer for forgiving jumps.
    this._coyote = this.onGround ? COYOTE_TIME : Math.max(0, this._coyote - dt);
    if (input.justPressed('jump')) this._buffer = JUMP_BUFFER;
    else this._buffer = Math.max(0, this._buffer - dt);

    if (this._buffer > 0 && this._coyote > 0) {
      this.vy = JUMP_VELOCITY;
      this._buffer = 0; this._coyote = 0;
      audio.jump();
    }
    // Variable jump height: cut velocity if jump released while rising.
    if (!input.down.jump && this.vy < JUMP_VELOCITY * 0.4) {
      this.vy = JUMP_VELOCITY * 0.4;
    }

    this.vy += GRAVITY * dt;
    moveAndCollide(this, level, dt);
  }
}

export class Enemy {
  constructor(x, y) {
    this.x = x + 4; this.y = y + 4;
    this.w = 24; this.h = 28;
    this.vx = -ENEMY_SPEED;
    this.vy = 0;
    this.onGround = false;
    this.alive = true;
  }

  update(dt, level) {
    if (!this.alive) return;
    this.vy += GRAVITY * dt;

    // Turn around at a wall or before walking off a ledge.
    const aheadX = this.vx < 0 ? this.x - 1 : this.x + this.w + 1;
    const footY = this.y + this.h + 2;
    if (isSolid(level, aheadX, this.y + this.h / 2) ||
        !isSolid(level, aheadX, footY)) {
      this.vx = -this.vx;
    }
    moveAndCollide(this, level, dt);
    if (this.onGround === false && this.vy === 0) { /* landed mid-frame */ }
  }
}

function isSolid(level, px, py) {
  const c = Math.floor(px / TILE);
  const r = Math.floor(py / TILE);
  if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return false;
  return SOLID_TILES.has(level.grid[r][c]);
}
