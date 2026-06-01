// AABB physics against a tile grid. We resolve X and Y axes separately, which is
// the standard robust approach: move on X, fix overlaps, then move on Y.

import { TILE, SOLID_TILES, MAX_FALL } from './constants.js';

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Is the tile at world pixel (px,py) solid?
function solidAt(level, px, py) {
  const c = Math.floor(px / TILE);
  const r = Math.floor(py / TILE);
  if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) {
    // Out of bounds: treat left/right/top as open, but everything below the
    // map as non-solid so the player falls into pits (death handled elsewhere).
    return false;
  }
  return SOLID_TILES.has(level.grid[r][c]);
}

// Move a body (has x,y,w,h,vx,vy, onGround) through the level for dt seconds.
export function moveAndCollide(body, level, dt) {
  body.onGround = false;

  // Clamp fall speed to keep tunneling impossible at our tile size / speeds.
  if (body.vy > MAX_FALL) body.vy = MAX_FALL;

  // --- X axis ---
  body.x += body.vx * dt;
  if (body.vx > 0) {
    const right = body.x + body.w;
    if (sideBlocked(level, right, body.y, body.h)) {
      body.x = Math.floor(right / TILE) * TILE - body.w - 0.01;
      body.vx = 0;
    }
  } else if (body.vx < 0) {
    const left = body.x;
    if (sideBlocked(level, left, body.y, body.h)) {
      body.x = (Math.floor(left / TILE) + 1) * TILE + 0.01;
      body.vx = 0;
    }
  }

  // --- Y axis ---
  body.y += body.vy * dt;
  if (body.vy > 0) {
    const bottom = body.y + body.h;
    if (vertBlocked(level, body.x, bottom, body.w)) {
      body.y = Math.floor(bottom / TILE) * TILE - body.h - 0.01;
      body.vy = 0;
      body.onGround = true;
    }
  } else if (body.vy < 0) {
    const top = body.y;
    if (vertBlocked(level, body.x, top, body.w)) {
      body.y = (Math.floor(top / TILE) + 1) * TILE + 0.01;
      body.vy = 0;
    }
  }
}

// Sample the vertical edge at x across the body's height (3 points).
function sideBlocked(level, x, y, h) {
  return solidAt(level, x, y + 1) ||
         solidAt(level, x, y + h / 2) ||
         solidAt(level, x, y + h - 1);
}

// Sample the horizontal edge at y across the body's width (3 points).
function vertBlocked(level, x, y, w) {
  return solidAt(level, x + 1, y) ||
         solidAt(level, x + w / 2, y) ||
         solidAt(level, x + w - 1, y);
}
