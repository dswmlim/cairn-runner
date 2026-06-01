// Centralised input. Exposes a small "actions" state object the game reads each
// frame, plus edge-triggered helpers (justPressed) for menu/jump logic.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  Enter: 'start', KeyR: 'restart',
  KeyM: 'mute', KeyP: 'pause',
};

export class Input {
  constructor() {
    this.down = {};        // currently held
    this._pressed = {};    // pressed since last poll (edge)
    this._bind();
  }

  _set(action, isDown) {
    if (isDown && !this.down[action]) this._pressed[action] = true;
    this.down[action] = isDown;
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      // Stop arrows/space from scrolling the page.
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this._set(a, true);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this._set(a, false);
    });

    // On-screen touch buttons (data-key="left|right|jump").
    document.querySelectorAll('.tc').forEach((btn) => {
      const action = btn.dataset.key;
      const on = (e) => { e.preventDefault(); this._set(action, true); };
      const off = (e) => { e.preventDefault(); this._set(action, false); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
    });
  }

  // True once per physical press.
  justPressed(action) {
    return !!this._pressed[action];
  }

  // Call at the END of each frame to clear edge state.
  postUpdate() {
    this._pressed = {};
  }
}
