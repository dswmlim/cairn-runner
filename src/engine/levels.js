// Parses a level definition (array of equal-length strings) into a structured
// object: solid grid, dimensions, and spawn coordinates for dynamic entities.

import { TILE, T } from './constants.js';

export class Level {
  constructor(def) {
    this.name = def.name || 'Level';
    this.sky = def.sky || '#5ec5ff';
    this.hill = def.hill || '#2e9e5b';
    this.rows = def.map.length;
    this.cols = def.map[0].length;
    this.widthPx = this.cols * TILE;
    this.heightPx = this.rows * TILE;

    // grid holds only static tiles; dynamic things become entities.
    this.grid = def.map.map((row) => row.split(''));

    this.playerSpawn = { x: 1 * TILE, y: 1 * TILE };
    this.enemySpawns = [];
    this.coins = [];
    this.checkpoints = [];
    this.flag = null;
    this.spikes = [];

    this._scan();
  }

  _scan() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        switch (ch) {
          case T.PLAYER:
            this.playerSpawn = { x, y };
            this.grid[r][c] = T.EMPTY;
            break;
          case T.ENEMY:
            this.enemySpawns.push({ x, y });
            this.grid[r][c] = T.EMPTY;
            break;
          case T.COIN:
            this.coins.push({ x: x + TILE / 2, y: y + TILE / 2, taken: false });
            this.grid[r][c] = T.EMPTY;
            break;
          case T.CHECKPOINT:
            this.checkpoints.push({ x, y, reached: false });
            this.grid[r][c] = T.EMPTY;
            break;
          case T.FLAG:
            this.flag = { x, y };
            this.grid[r][c] = T.EMPTY;
            break;
          case T.SPIKE:
            this.spikes.push({ x, y });
            // keep '^' in grid for rendering convenience? No—render from list.
            this.grid[r][c] = T.EMPTY;
            break;
          default:
            break;
        }
      }
    }
  }
}
