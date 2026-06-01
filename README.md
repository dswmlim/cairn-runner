# assets

Sprite art goes here. The game runs without these files (it falls back to simple
shapes), but dropping them in turns on the full Kenney pixel-art look.

## What to download

**Kenney "Pixel Platformer"** — free, CC0 1.0 (no attribution required):
https://kenney.nl/assets/pixel-platformer

1. Download `kenney_pixel-platformer.zip` and unzip it.
2. From the unzipped `Tilemap/` folder, copy these two files here and **rename**:

   | Copy from pack                              | Rename to here          |
   |---------------------------------------------|-------------------------|
   | `Tilemap/tilemap_packed.png`                | `assets/tiles.png`      |
   | `Tilemap/tilemap-characters_packed.png`     | `assets/characters.png` |

3. Reload the game. That's it.

## Notes

- `tiles.png` is a grid of 18×18 tiles (20 columns × 9 rows).
- `characters.png` is a grid of 24×24 sprites.
- Sprite cell coordinates are mapped in `src/engine/assets.js` (the `TILES` and
  `CHARS` objects). If Kenney updates the sheet layout, tweak those (col,row)
  pairs — nothing else needs to change.
- Want different art? Any spritesheet works: match the cell sizes in
  `SHEET` (in `assets.js`) and remap `TILES`/`CHARS`, or supply your own sheet
  with the same grid and keep the mappings.

## License

The Kenney pack is CC0 1.0 Universal: usable in any project including commercial,
no permission or attribution required. Source: https://kenney.nl
