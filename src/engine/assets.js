// Sprite system for the Kenney "Pixel Platformer" CC0 pack.
//
// HOW ASSETS ARE LOADED
// ---------------------
// Download kenney_pixel-platformer.zip from https://kenney.nl/assets/pixel-platformer
// (CC0 1.0 — no attribution required), unzip it, and copy these two sheets into
// the repo's /assets folder, renamed as below:
//
//   assets/tiles.png        <- "Tilemap/tilemap_packed.png"          (20 cols x 9 rows of 18px tiles)
//   assets/characters.png   <- "Tilemap/tilemap-characters_packed.png" (9 cols x 3 rows of 24px tiles)
//
// The pack ships 18x18 tile cells (no spacing) and 24x24 character cells.
// If the files are absent, the renderer falls back to the original shape art,
// so the game ALWAYS runs — assets just make it look good.
//
// Sprite indices below are (col, row) into each sheet. They target Kenney's
// current packed sheets; if a future version shifts them, adjust here only.

export const SHEET = {
  tiles: { src: 'assets/tiles.png', cell: 18, cols: 20, rows: 9 },
  chars: { src: 'assets/characters.png', cell: 24, cols: 9, rows: 3 },
};

// Named tile regions (col, row) on tiles.png. Chosen for a grassy overworld.
export const TILES = {
  grassTop:    [0, 0],   // grass-topped dirt (surface)
  grassLeft:   [1, 0],
  grassRight:  [2, 0],
  dirt:        [1, 1],   // solid earth (interior/underground)
  dirtTop:     [0, 0],
  platformMid: [6, 0],   // stone/wood platform middle (one-way look)
  coin:        [4, 5],   // gold coin
  flag:        [13, 0],  // checkpoint/end flag
  spike:       [8, 1],   // hazard
  bush:        [5, 1],   // decorative
};

// Character sprite cells on characters.png. Kenney's sheet packs each character
// across a row; we use one character's idle/walk/jump-ish frames.
export const CHARS = {
  playerIdle: [0, 0],
  playerWalkA: [1, 0],
  playerWalkB: [0, 1],
  playerJump: [1, 1],
  enemyA: [3, 0],   // a walker (e.g. slimey/snail-ish)
  enemyB: [4, 0],
};

export class Assets {
  constructor() {
    this.images = {};
    this.ready = false;
    this.loaded = { tiles: false, chars: false };
  }

  // Loads all sheets. Resolves even if some fail (we fall back per-sheet).
  load() {
    const jobs = Object.entries(SHEET).map(([key, def]) =>
      this._loadImage(def.src).then(
        (img) => { this.images[key] = img; this.loaded[key] = true; },
        () => { this.loaded[key] = false; /* missing -> fallback */ }
      )
    );
    return Promise.all(jobs).then(() => { this.ready = true; });
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('missing ' + src));
      img.src = src;
    });
  }

  has(sheet) { return this.loaded[sheet]; }

  // Draw sprite cell [col,row] from a sheet to ctx at dest x,y,w,h.
  draw(ctx, sheet, cell, dx, dy, dw, dh, flip = false) {
    const def = SHEET[sheet];
    const img = this.images[sheet];
    if (!img) return false;
    const [c, r] = cell;
    const s = def.cell;
    ctx.save();
    if (flip) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, c * s, r * s, s, s, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, c * s, r * s, s, s, dx, dy, dw, dh);
    }
    ctx.restore();
    return true;
  }
}
