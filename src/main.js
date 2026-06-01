// Entry point. Owns the game state machine (title → play → win/lose), the fixed
// timestep loop, and the glue between input, physics, entities and renderer.

import { DT, TILE, START_LIVES, LEVEL_TIME, COIN_SCORE, STOMP_SCORE } from './engine/constants.js';
import { Input } from './engine/input.js';
import { DemoInput } from './engine/demo.js';
import { Audio } from './engine/audio.js';
import { Renderer } from './engine/renderer.js';
import { Level } from './engine/levels.js';
import { Player, Enemy } from './engine/entities.js';
import { aabb } from './engine/physics.js';
import L1 from './levels/level1.js';
import L2 from './levels/level2.js';

const LEVEL_DEFS = [L1, L2];
const DEMO = new URLSearchParams(location.search).has('demo');

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const audio = new Audio();
const input = DEMO ? new DemoInput() : new Input();

const state = {
  mode: 'title',       // title | play | dead | win
  levelIndex: 0,
  score: 0,
  coins: 0,
  lives: START_LIVES,
  time: LEVEL_TIME,
  levelName: '',
  paused: false,
};

let level, player, enemies, checkpoint;

function loadLevel(i) {
  level = new Level(LEVEL_DEFS[i]);
  player = new Player(level.playerSpawn.x, level.playerSpawn.y);
  enemies = level.enemySpawns.map((s) => new Enemy(s.x, s.y));
  checkpoint = { ...level.playerSpawn };
  state.time = LEVEL_TIME;
  state.levelName = level.name;
  renderer.cam.x = 0; renderer.cam.y = 0;
}

function startGame() {
  state.mode = 'play';
  state.levelIndex = 0;
  state.score = 0; state.coins = 0; state.lives = START_LIVES;
  loadLevel(0);
  audio.start();
}

function respawn() {
  player.reset(checkpoint.x, checkpoint.y);
  player.vx = 0; player.vy = 0;
}

function loseLife() {
  state.lives -= 1;
  audio.hurt();
  if (state.lives <= 0) { state.mode = 'dead'; }
  else respawn();
}

function nextLevel() {
  if (state.levelIndex < LEVEL_DEFS.length - 1) {
    state.levelIndex += 1;
    loadLevel(state.levelIndex);
  } else {
    state.mode = 'win';
    audio.win();
  }
}

// ---- Update (fixed dt) ----
function update(dt) {
  if (DEMO) input.update(dt, player, level);
  renderer.t += dt;

  // Global toggles
  if (input.justPressed('mute')) updateMuteIcon(audio.toggleMute());
  if (input.justPressed('pause') && state.mode === 'play') togglePause();

  if (state.mode === 'title') {
    if (input.justPressed('start') || input.justPressed('jump') || DEMO) startGame();
    return;
  }
  if (state.mode === 'dead' || state.mode === 'win') {
    if (input.justPressed('restart') || input.justPressed('start')) startGame();
    return;
  }
  if (state.paused) return;

  // Timer
  state.time -= dt;
  if (state.time <= 0) { state.time = 0; loseLife(); if (state.mode !== 'play') return; }

  player.update(dt, input, level, audio);
  for (const e of enemies) e.update(dt, level);

  handleCollisions();

  // Fell into a pit?
  if (player.y > level.heightPx + 80) loseLife();

  renderer.follow(player, level);
}

function handleCollisions() {
  // Coins
  for (const coin of level.coins) {
    if (coin.taken) continue;
    if (aabb(player, { x: coin.x - 8, y: coin.y - 8, w: 16, h: 16 })) {
      coin.taken = true;
      state.coins += 1;
      state.score += COIN_SCORE;
      audio.coin();
    }
  }

  // Checkpoints
  for (const k of level.checkpoints) {
    if (k.reached) continue;
    if (aabb(player, { x: k.x, y: k.y - TILE, w: TILE, h: TILE * 2 })) {
      k.reached = true;
      checkpoint = { x: k.x, y: k.y - player.h };
      audio.checkpoint();
    }
  }

  // Spikes
  for (const s of level.spikes) {
    if (aabb(player, { x: s.x + 2, y: s.y + 12, w: TILE - 4, h: TILE - 12 })) {
      loseLife();
      return;
    }
  }

  // Enemies: stomp if falling onto them, else take damage.
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!aabb(player, e)) continue;
    const falling = player.vy > 0 && (player.y + player.h) - e.y < 16;
    if (falling) {
      e.alive = false;
      player.vy = -460; // bounce
      state.score += STOMP_SCORE;
      audio.stomp();
    } else {
      loseLife();
      return;
    }
  }

  // End flag
  if (level.flag && aabb(player, { x: level.flag.x, y: level.flag.y - TILE * 2, w: TILE, h: TILE * 3 })) {
    state.score += Math.ceil(state.time) * 5; // time bonus
    nextLevel();
  }
}

// ---- Render ----
function render() {
  renderer.clearSky(level || { sky: '#5ec5ff', hill: '#2e9e5b' });
  if (level) {
    renderer.world(level);
    renderer.entities(player, enemies);
    renderer.hud(state);
  }
  if (state.mode === 'title') {
    renderer.centerText('CAIRN RUNNER', 'Press SPACE / ENTER to start', 'Arrows·WASD move · Space jump · M mute · P pause');
  } else if (state.mode === 'dead') {
    renderer.centerText('GAME OVER', `Score ${state.score}`, 'Press R / ENTER to try again');
  } else if (state.mode === 'win') {
    renderer.centerText('YOU WIN!', `Final score ${state.score}`, 'Press R / ENTER to play again');
  } else if (state.paused) {
    renderer.centerText('PAUSED', 'Press P to resume', '');
  }
}

// ---- Fixed-timestep main loop ----
let last = performance.now();
let acc = 0;
function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25; // clamp after tab-switch to avoid spiral
  acc += elapsed;

  try {
    while (acc >= DT) {
      update(DT);
      input.postUpdate();
      acc -= DT;
    }
    render();
  } catch (err) {
    // Basic error handling/logging — keep the loop alive but surface problems.
    console.error('[game loop error]', err);
  }
  requestAnimationFrame(frame);
}

// ---- Lifecycle / DOM wiring ----
function togglePause() {
  state.paused = !state.paused;
  document.getElementById('btn-pause').textContent = state.paused ? '▶' : '⏸';
}
function updateMuteIcon(muted) {
  document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
}

document.getElementById('btn-mute').addEventListener('click', () => updateMuteIcon(audio.toggleMute()));
document.getElementById('btn-pause').addEventListener('click', () => { if (state.mode === 'play') togglePause(); });

// Pause automatically when the tab loses focus.
window.addEventListener('blur', () => { if (state.mode === 'play' && !state.paused) togglePause(); });

// Resize handling (canvas resolution stays fixed; CSS scales it).
window.addEventListener('resize', () => renderer.resize());

renderer.resize();
loadLevel(0); // load so the title screen has a backdrop
requestAnimationFrame(frame);
