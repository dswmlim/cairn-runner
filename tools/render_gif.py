#!/usr/bin/env python3
"""
Headless gameplay-GIF renderer.

This faithfully re-implements the game's physics constants, collision model,
camera, renderer look, and the scripted demo input from src/, then rasterizes
frames with Pillow and writes docs/gameplay.gif.

It is NOT a screen recording (no browser available here); it's a deterministic
re-render of the same engine logic so the README has a representative GIF.

Run from the repo root:  python3 tools/render_gif.py
"""

import math
import os
import re
from PIL import Image, ImageDraw

# ---- constants (mirror src/engine/constants.js) ----
TILE = 32
VIEW_W, VIEW_H = 640, 360
FPS = 60
DT = 1.0 / FPS
GRAVITY = 2200.0
MOVE_ACCEL = 2600.0
MOVE_MAX = 280.0
FRICTION = 1900.0
JUMP_VELOCITY = -720.0
COYOTE_TIME = 0.08
JUMP_BUFFER = 0.10
ENEMY_SPEED = 60.0
MAX_FALL = 1200.0

SOLID = {'#', '='}

# ---- level 1: parsed from the real src/levels/level1.js so they never drift ----
def load_level1():
    here = os.path.dirname(os.path.abspath(__file__))
    src = open(os.path.join(here, '..', 'src', 'levels', 'level1.js')).read()
    return re.findall(r"'([.#=CEPKF^]+)'", src)


LEVEL1 = load_level1()


class Level:
    def __init__(self, rows):
        self.grid = [list(r) for r in rows]
        self.rows = len(rows)
        self.cols = len(rows[0])
        self.w = self.cols * TILE
        self.h = self.rows * TILE
        self.coins, self.spikes, self.checkpoints = [], [], []
        self.flag = None
        self.player = (TILE, TILE)
        self.enemies = []
        for r in range(self.rows):
            for c in range(self.cols):
                ch = self.grid[r][c]
                x, y = c * TILE, r * TILE
                if ch == 'P':
                    self.player = (x, y); self.grid[r][c] = '.'
                elif ch == 'E':
                    self.enemies.append((x, y)); self.grid[r][c] = '.'
                elif ch == 'C':
                    self.coins.append([x + TILE / 2, y + TILE / 2, False]); self.grid[r][c] = '.'
                elif ch == 'K':
                    self.checkpoints.append([x, y, False]); self.grid[r][c] = '.'
                elif ch == 'F':
                    self.flag = (x, y); self.grid[r][c] = '.'
                elif ch == '^':
                    self.spikes.append((x, y)); self.grid[r][c] = '.'

    def solid_at(self, px, py):
        c = int(px // TILE); r = int(py // TILE)
        if r < 0 or c < 0 or r >= self.rows or c >= self.cols:
            return False
        return self.grid[r][c] in SOLID


def side_blocked(level, x, y, h):
    return level.solid_at(x, y + 1) or level.solid_at(x, y + h / 2) or level.solid_at(x, y + h - 1)


def vert_blocked(level, x, y, w):
    return level.solid_at(x + 1, y) or level.solid_at(x + w / 2, y) or level.solid_at(x + w - 1, y)


def move_and_collide(b, level, dt):
    b['onGround'] = False
    if b['vy'] > MAX_FALL:
        b['vy'] = MAX_FALL
    # X
    b['x'] += b['vx'] * dt
    if b['vx'] > 0:
        right = b['x'] + b['w']
        if side_blocked(level, right, b['y'], b['h']):
            b['x'] = math.floor(right / TILE) * TILE - b['w'] - 0.01; b['vx'] = 0
    elif b['vx'] < 0:
        left = b['x']
        if side_blocked(level, left, b['y'], b['h']):
            b['x'] = (math.floor(left / TILE) + 1) * TILE + 0.01; b['vx'] = 0
    # Y
    b['y'] += b['vy'] * dt
    if b['vy'] > 0:
        bottom = b['y'] + b['h']
        if vert_blocked(level, b['x'], bottom, b['w']):
            b['y'] = math.floor(bottom / TILE) * TILE - b['h'] - 0.01; b['vy'] = 0; b['onGround'] = True
    elif b['vy'] < 0:
        top = b['y']
        if vert_blocked(level, b['x'], top, b['w']):
            b['y'] = (math.floor(top / TILE) + 1) * TILE + 0.01; b['vy'] = 0


def auto_input(player, level):
    """Deterministic AI for the capture: walk right; jump when grounded and a
    gap or wall is ahead. Robust to the exact layout (no fragile keyframes)."""
    inp = {'left': False, 'right': True, 'jump': False}
    if not player['onGround']:
        return inp
    foot_y = player['y'] + player['h'] + 4
    body_y = player['y'] + player['h'] / 2
    # Scan a short distance ahead of the player's leading edge for the start of
    # a gap; jump a touch before reaching the edge so the full arc clears it.
    lead = player['x'] + player['w']
    gap_soon = False
    for d in (TILE * 0.5, TILE * 0.9, TILE * 1.3):
        if (not level.solid_at(lead + d, foot_y)
                and not level.solid_at(lead + d, foot_y + TILE)):
            gap_soon = True
            break
    wall_ahead = level.solid_at(lead + 2, body_y)
    # Also hop for a coin that's just ahead and within a jump's height.
    coin_above = False
    for c in level.coins:
        if c[2]:
            continue
        dx = c[0] - (player['x'] + player['w'] / 2)
        dy = (player['y'] + player['h'] / 2) - c[1]   # positive => coin above
        if 0 < dx < TILE * 1.4 and TILE * 0.4 < dy < TILE * 2.6:
            coin_above = True
            break
    if gap_soon or wall_ahead or coin_above:
        inp['jump'] = True
    return inp


def lerp(a, b, k):
    return a + (b - a) * k


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def draw_hills(d, offset, base_y, color):
    pts = [(0, VIEW_H)]
    x = 0
    while x <= VIEW_W:
        y = base_y + math.sin((x + offset) * 0.01) * 27
        pts.append((x, y)); x += 16
    pts.append((VIEW_W, VIEW_H))
    d.polygon(pts, fill=color)


def render_frame(level, player, enemies, cam, t, hud):
    img = Image.new('RGB', (VIEW_W, VIEW_H), (94, 197, 255))
    d = ImageDraw.Draw(img)
    # sky gradient (cheap vertical bands)
    for y in range(0, VIEW_H, 4):
        k = y / VIEW_H
        r = int(lerp(94, 191, k)); g = int(lerp(197, 234, k)); b = int(lerp(255, 255, k))
        d.rectangle([0, y, VIEW_W, y + 4], fill=(r, g, b))
    # parallax hills
    px = cam[0] * 0.4
    draw_hills(d, px * 0.6, 250, (38, 142, 81))
    draw_hills(d, px, 280, (46, 158, 91))

    ox, oy = -round(cam[0]), -round(cam[1])

    # tiles (cull to viewport)
    c0 = max(0, int(cam[0] // TILE)); c1 = min(level.cols - 1, int((cam[0] + VIEW_W) // TILE) + 1)
    r0 = max(0, int(cam[1] // TILE)); r1 = min(level.rows - 1, int((cam[1] + VIEW_H) // TILE) + 1)
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            ch = level.grid[r][c]
            x = c * TILE + ox; y = r * TILE + oy
            if ch == '#':
                d.rectangle([x, y, x + TILE, y + TILE], fill=(107, 74, 43))
                d.rectangle([x, y, x + TILE, y + 6], fill=(138, 98, 56))
            elif ch == '=':
                d.rectangle([x, y, x + TILE, y + TILE], fill=(58, 125, 68))
                d.rectangle([x, y, x + TILE, y + 6], fill=(87, 168, 102))

    # spikes
    for sx, sy in level.spikes:
        i = 0
        while i < TILE:
            d.polygon([(sx + i + ox, sy + TILE + oy),
                       (sx + i + 4 + ox, sy + TILE - 12 + oy),
                       (sx + i + 8 + ox, sy + TILE + oy)], fill=(201, 204, 214))
            i += 8

    # checkpoints
    for cx, cy, reached in level.checkpoints:
        d.rectangle([cx + TILE / 2 - 2 + ox, cy - TILE + oy, cx + TILE / 2 + 2 + ox, cy + TILE + oy], fill=(85, 85, 85))
        flagcol = (84, 224, 138) if reached else (154, 160, 181)
        d.rectangle([cx + TILE / 2 + 2 + ox, cy - TILE + oy, cx + TILE / 2 + 18 + ox, cy - TILE + 12 + oy], fill=flagcol)

    # coins (spin via width)
    for coin in level.coins:
        if coin[2]:
            continue
        sx = abs(math.cos(t * 4 + coin[0])) * 8 + 1
        cx = coin[0] + ox; cy = coin[1] + oy
        d.ellipse([cx - sx, cy - 8, cx + sx, cy + 8], fill=(255, 211, 78))

    # flag
    if level.flag:
        fx, fy = level.flag
        d.rectangle([fx + 4 + ox, fy - TILE * 2 + oy, fx + 8 + ox, fy + TILE + oy], fill=(68, 68, 68))
        d.polygon([(fx + 8 + ox, fy - TILE * 2 + oy),
                   (fx + 30 + ox, fy - TILE * 2 + 8 + oy),
                   (fx + 8 + ox, fy - TILE * 2 + 16 + oy)], fill=(255, 84, 112))

    # enemies
    for e in enemies:
        if not e['alive']:
            continue
        ex = e['x'] + ox; ey = e['y'] + oy
        d.rectangle([ex, ey, ex + e['w'], ey + e['h']], fill=(181, 71, 31))
        d.rectangle([ex + 4, ey + 6, ex + 9, ey + 11], fill=(255, 255, 255))
        d.rectangle([ex + e['w'] - 9, ey + 6, ex + e['w'] - 4, ey + 11], fill=(255, 255, 255))

    # player
    p = player
    pxp = p['x'] + ox; pyp = p['y'] + oy
    d.rectangle([pxp, pyp, pxp + p['w'], pyp + p['h']], fill=(47, 109, 255))
    d.rectangle([pxp + 3, pyp + 3, pxp + p['w'] - 3, pyp + 11], fill=(255, 217, 179))
    eye = pxp + p['w'] - 8 if p['facing'] > 0 else pxp + 4
    d.rectangle([eye, pyp + 5, eye + 3, pyp + 8], fill=(0, 0, 0))

    # HUD
    d.rectangle([0, 0, VIEW_W, 28], fill=(13, 16, 33))
    d.text((10, 8), f"SCORE {hud['score']:06d}", fill=(255, 255, 255))
    d.text((180, 8), f"COINS {hud['coins']:02d}", fill=(255, 255, 255))
    d.text((320, 8), f"LIVES {hud['lives']}", fill=(255, 255, 255))
    d.text((440, 8), f"TIME {math.ceil(hud['time'])}", fill=(255, 255, 255))
    d.text((560, 8), "L1", fill=(255, 211, 78))
    return img


def aabb(ax, ay, aw, ah, bx, by, bw, bh):
    return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by


def _banner(img, title, sub):
    """Draw a centred translucent 'level clear' overlay onto a frame."""
    d = ImageDraw.Draw(img, 'RGBA')
    d.rectangle([0, 0, VIEW_W, VIEW_H], fill=(13, 16, 33, 180))
    # crude centring (default PIL font ~6px/char)
    tw = len(title) * 6
    d.text((VIEW_W / 2 - tw, VIEW_H / 2 - 16), title, fill=(255, 211, 78))
    sw = len(sub) * 3
    d.text((VIEW_W / 2 - sw, VIEW_H / 2 + 4), sub, fill=(232, 236, 255))


def main():
    level = Level(LEVEL1)
    player = {'x': level.player[0], 'y': level.player[1], 'w': 22, 'h': 28,
              'vx': 0.0, 'vy': 0.0, 'onGround': False, 'facing': 1,
              '_coyote': 0.0, '_buffer': 0.0}
    enemies = [{'x': ex + 4, 'y': ey + 4, 'w': 24, 'h': 28, 'vx': -ENEMY_SPEED,
                'vy': 0.0, 'onGround': False, 'alive': True} for ex, ey in level.enemies]
    cam = [0.0, 0.0]
    hud = {'score': 0, 'coins': 0, 'lives': 3, 'time': 90.0}

    frames = []
    duration = 16.0            # max seconds to simulate (we stop at flag+hold)
    sim_steps = int(duration / DT)
    capture_every = 4          # 60fps sim -> 15fps gif
    prev_jump = False
    cleared = False
    clear_hold = 0

    for i in range(sim_steps):
        t = i * DT
        # Once cleared, stop steering and let the banner hold, then end.
        if cleared:
            inp = {'left': False, 'right': False, 'jump': False}
        else:
            inp = auto_input(player, level)
        jump_pressed = inp['jump'] and not prev_jump
        prev_jump = inp['jump']

        # player physics (mirror entities.js Player.update)
        if inp['left'] and not inp['right']:
            player['vx'] -= MOVE_ACCEL * DT; player['facing'] = -1
        elif inp['right'] and not inp['left']:
            player['vx'] += MOVE_ACCEL * DT; player['facing'] = 1
        else:
            f = FRICTION * DT
            if player['vx'] > 0:
                player['vx'] = max(0, player['vx'] - f)
            elif player['vx'] < 0:
                player['vx'] = min(0, player['vx'] + f)
        player['vx'] = clamp(player['vx'], -MOVE_MAX, MOVE_MAX)

        player['_coyote'] = COYOTE_TIME if player['onGround'] else max(0, player['_coyote'] - DT)
        if jump_pressed:
            player['_buffer'] = JUMP_BUFFER
        else:
            player['_buffer'] = max(0, player['_buffer'] - DT)
        if player['_buffer'] > 0 and player['_coyote'] > 0:
            player['vy'] = JUMP_VELOCITY; player['_buffer'] = 0; player['_coyote'] = 0
        if not inp['jump'] and player['vy'] < JUMP_VELOCITY * 0.4:
            player['vy'] = JUMP_VELOCITY * 0.4

        player['vy'] += GRAVITY * DT
        move_and_collide(player, level, DT)

        # enemies (mirror entities.js Enemy.update)
        for e in enemies:
            if not e['alive']:
                continue
            e['vy'] += GRAVITY * DT
            ahead = e['x'] - 1 if e['vx'] < 0 else e['x'] + e['w'] + 1
            foot = e['y'] + e['h'] + 2
            if level.solid_at(ahead, e['y'] + e['h'] / 2) or not level.solid_at(ahead, foot):
                e['vx'] = -e['vx']
            move_and_collide(e, level, DT)

        # collisions
        for coin in level.coins:
            if coin[2]:
                continue
            if aabb(player['x'], player['y'], player['w'], player['h'],
                    coin[0] - 8, coin[1] - 8, 16, 16):
                coin[2] = True; hud['coins'] += 1; hud['score'] += 100
        for k in level.checkpoints:
            if k[2]:
                continue
            if aabb(player['x'], player['y'], player['w'], player['h'],
                    k[0], k[1] - TILE, TILE, TILE * 2):
                k[2] = True
        for e in enemies:
            if not e['alive']:
                continue
            if aabb(player['x'], player['y'], player['w'], player['h'],
                    e['x'], e['y'], e['w'], e['h']):
                falling = player['vy'] > 0 and (player['y'] + player['h']) - e['y'] < 16
                if falling:
                    e['alive'] = False; player['vy'] = -460; hud['score'] += 200

        hud['time'] = max(0, hud['time'] - DT)

        # Pit fall -> respawn at spawn (keeps the capture clean if a jump misses)
        if player['y'] > level.h + 80:
            player['x'], player['y'] = level.player
            player['vx'] = player['vy'] = 0.0

        # Reached the end flag? Add a time bonus and trigger the clear banner.
        if (not cleared and level.flag and
                aabb(player['x'], player['y'], player['w'], player['h'],
                     level.flag[0], level.flag[1] - TILE * 2, TILE, TILE * 3)):
            cleared = True
            hud['score'] += math.ceil(hud['time']) * 5
            clear_hold = int(1.6 / DT)   # hold the banner ~1.6s

        # camera (mirror renderer.follow)
        gx = player['x'] + player['w'] / 2 - VIEW_W / 2
        gy = player['y'] + player['h'] / 2 - VIEW_H / 2
        cam[0] = lerp(cam[0], gx, 0.15)
        cam[1] = lerp(cam[1], gy, 0.15)
        cam[0] = clamp(cam[0], 0, max(0, level.w - VIEW_W))
        cam[1] = clamp(cam[1], 0, max(0, level.h - VIEW_H))

        if i % capture_every == 0:
            img = render_frame(level, player, enemies, cam, t, hud)
            if cleared:
                _banner(img, 'LEVEL CLEAR!', f"Score {hud['score']}")
            frames.append(img)

        if cleared:
            clear_hold -= 1
            if clear_hold <= 0:
                break

    os.makedirs('docs', exist_ok=True)
    out = 'docs/gameplay.gif'
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=int(1000 / (FPS / capture_every)), loop=0, optimize=True)
    print(f"Wrote {out}  ({len(frames)} frames, {len(frames)/(FPS/capture_every):.1f}s)")


if __name__ == '__main__':
    main()
