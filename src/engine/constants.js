// All tunable game constants live here so behaviour is easy to adjust.

export const TILE = 32;            // tile size in px (world units)
export const VIEW_W = 640;         // internal canvas resolution (logical px)
export const VIEW_H = 360;
export const FPS = 60;
export const DT = 1 / FPS;         // fixed-timestep delta (seconds)

// Physics (units = px/sec, px/sec^2). Tuned to feel snappy, not floaty.
export const GRAVITY = 2200;
export const MOVE_ACCEL = 2600;
export const MOVE_MAX = 280;
export const FRICTION = 1900;
export const JUMP_VELOCITY = -720;
export const COYOTE_TIME = 0.08;   // grace period to jump after leaving ground
export const JUMP_BUFFER = 0.10;   // remember a jump press briefly before landing
export const ENEMY_SPEED = 60;
export const MAX_FALL = 1200;

// Gameplay
export const START_LIVES = 3;
export const COIN_SCORE = 100;
export const STOMP_SCORE = 200;
export const LEVEL_TIME = 90;      // seconds per level

// Tile legend used by the string-based level maps (see src/levels/*).
// '.' empty  '#' solid ground  '='  one-way/solid platform
// 'C' coin   'E' enemy spawn   'P' player spawn   'F' end flag
// 'K' checkpoint  '^' spikes (instant damage)
export const T = {
  EMPTY: '.',
  SOLID: '#',
  PLATFORM: '=',
  COIN: 'C',
  ENEMY: 'E',
  PLAYER: 'P',
  FLAG: 'F',
  CHECKPOINT: 'K',
  SPIKE: '^',
};

export const SOLID_TILES = new Set([T.SOLID, T.PLATFORM]);
