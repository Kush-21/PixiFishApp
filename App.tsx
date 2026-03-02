import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

const pixiHTML: string = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { overflow: hidden; background: #1099bb; touch-action: none; }
</style>
<script src="https://pixijs.download/release/pixi.min.js"></script>
<script src="https://unpkg.com/@esotericsoftware/spine-pixi-v8@4.2.106/dist/iife/spine-pixi-v8.js"></script>
</head>
<body>
<script>
const { Application, Assets, Container, Sprite, Texture, TilingSprite } = PIXI;
const { Spine } = spine;

// ── Controller ────────────────────────────────────────────────────────────────
const keyMap = {
  Space:'space', KeyW:'up', ArrowUp:'up',
  KeyA:'left', ArrowLeft:'left',
  KeyS:'down', ArrowDown:'down',
  KeyD:'right', ArrowRight:'right',
};

class Controller {
  constructor() {
    this.keys = {
      up:    { pressed:false, doubleTap:false, timestamp:0 },
      left:  { pressed:false, doubleTap:false, timestamp:0 },
      down:  { pressed:false, doubleTap:false, timestamp:0 },
      right: { pressed:false, doubleTap:false, timestamp:0 },
      space: { pressed:false, doubleTap:false, timestamp:0 },
    };
    window.addEventListener('keydown', e => this._kd(e));
    window.addEventListener('keyup',   e => this._ku(e));
  }
  _kd(e) {
    const k = keyMap[e.code]; if (!k) return;
    this.keys[k].doubleTap = this.keys[k].doubleTap || Date.now() - this.keys[k].timestamp < 300;
    this.keys[k].pressed = true;
  }
  _ku(e) {
    const k = keyMap[e.code]; if (!k) return;
    this.keys[k].pressed = false;
    if (this.keys[k].doubleTap) this.keys[k].doubleTap = false;
    else this.keys[k].timestamp = Date.now();
  }
  applyJoystick(dx, dy, active) {
    const WALK = 0.22, RUN = 0.60;
    if (!active) {
      this.keys.left.pressed = this.keys.right.pressed = this.keys.down.pressed = false;
      this.keys.left.doubleTap = this.keys.right.doubleTap = false;
      return;
    }
    if (dx < -WALK) {
      this.keys.left.pressed = true;  this.keys.right.pressed = false;
      this.keys.left.doubleTap = dx < -RUN; this.keys.right.doubleTap = false;
    } else if (dx > WALK) {
      this.keys.right.pressed = true; this.keys.left.pressed = false;
      this.keys.right.doubleTap = dx > RUN; this.keys.left.doubleTap = false;
    } else {
      this.keys.left.pressed = this.keys.right.pressed = false;
      this.keys.left.doubleTap = this.keys.right.doubleTap = false;
    }
    this.keys.down.pressed = dy > WALK;
  }
}

// ── Scene ─────────────────────────────────────────────────────────────────────
class Scene {
  constructor(width, height) {
    this.view = new Container();
    this.sky  = Sprite.from('sky');
    this.sky.anchor.set(0, 1);
    this.sky.width = width; this.sky.height = height;
    const bgTex = Texture.from('background');
    const mgTex = Texture.from('midground');
    const plTex = Texture.from('platform');
    const maxH  = plTex.height;
    const plH   = Math.min(maxH, height * 0.4);
    const scale = (this.scale = plH / maxH);
    const base  = { tileScale:{x:scale,y:scale}, anchor:{x:0,y:1}, applyAnchorToTexture:true };
    this.background = new TilingSprite({ texture:bgTex, width, height:bgTex.height*scale, ...base });
    this.midground  = new TilingSprite({ texture:mgTex, width, height:mgTex.height*scale, ...base });
    this.platform   = new TilingSprite({ texture:plTex, width, height:plH, ...base });
    this.floorHeight = plH * 0.43;
    this.background.y = this.midground.y = -this.floorHeight;
    this.view.addChild(this.sky, this.background, this.midground, this.platform);
  }
  get positionX() { return this.platform.tilePosition.x; }
  set positionX(v) {
    this.background.tilePosition.x = v * 0.1;
    this.midground.tilePosition.x  = v * 0.25;
    this.platform.tilePosition.x   = v;
  }
}

// ── SpineBoy ──────────────────────────────────────────────────────────────────
const anim = {
  idle:  { name:'idle',       loop:true },
  walk:  { name:'walk',       loop:true },
  run:   { name:'run',        loop:true },
  jump:  { name:'jump',       timeScale:1.5 },
  hover: { name:'hoverboard', loop:true },
  spawn: { name:'portal' },
};

class SpineBoy {
  constructor() {
    this.state = { walk:false, run:false, hover:false, jump:false };
    this.view            = new Container();
    this.directionalView = new Container();
    this.spine = Spine.from({ skeleton:'spineSkeleton', atlas:'spineAtlas' });
    this.directionalView.addChild(this.spine);
    this.view.addChild(this.directionalView);
    this.spine.state.data.defaultMix = 0.2;
  }
  spawn() { this.spine.state.setAnimation(0, anim.spawn.name); }
  playAnimation({ name, loop=false, timeScale=1 }) {
    if (this.currentAnimationName === name) return;
    this.spine.state.setAnimation(0, name, loop).timeScale = timeScale;
  }
  update() {
    if (this.state.jump) this.playAnimation(anim.jump);
    if (this.isAnimationPlaying(anim.jump)) return;
    if      (this.state.hover) this.playAnimation(anim.hover);
    else if (this.state.run)   this.playAnimation(anim.run);
    else if (this.state.walk)  this.playAnimation(anim.walk);
    else                        this.playAnimation(anim.idle);
  }
  isSpawning() { return this.isAnimationPlaying(anim.spawn); }
  isAnimationPlaying({ name }) {
    return this.currentAnimationName === name && !this.spine.state.getCurrent(0).isComplete();
  }
  get currentAnimationName() { return this.spine.state.getCurrent(0)?.animation.name; }
  get direction()  { return this.directionalView.scale.x > 0 ? 1 : -1; }
  set direction(v) { this.directionalView.scale.x = v; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const app = new Application();
  await app.init({ background:'#1099bb', resizeTo:window });
  document.body.appendChild(app.canvas);

  await Assets.load([
    { alias:'spineSkeleton', src:'https://raw.githubusercontent.com/pixijs/spine-v8/main/examples/assets/spineboy-pro.skel' },
    { alias:'spineAtlas',    src:'https://raw.githubusercontent.com/pixijs/spine-v8/main/examples/assets/spineboy-pma.atlas' },
    { alias:'sky',        src:'https://pixijs.com/assets/tutorials/spineboy-adventure/sky.png' },
    { alias:'background', src:'https://pixijs.com/assets/tutorials/spineboy-adventure/background.png' },
    { alias:'midground',  src:'https://pixijs.com/assets/tutorials/spineboy-adventure/midground.png' },
    { alias:'platform',   src:'https://pixijs.com/assets/tutorials/spineboy-adventure/platform.png' },
  ]);

  const controller = new Controller();
  const scene      = new Scene(app.screen.width, app.screen.height);
  const spineBoy   = new SpineBoy();

  scene.view.y    = app.screen.height;
  spineBoy.view.x = app.screen.width / 2;
  spineBoy.view.y = app.screen.height - scene.floorHeight;
  spineBoy.spine.scale.set(scene.scale * 0.32);

  app.stage.addChild(scene.view, spineBoy.view);
  spineBoy.spawn();

  // ── Virtual Joystick UI ───────────────────────────────────────────────────
  const JR = 60;  // joystick base radius
  const HR = 24;  // handle radius

  let jActive = false, jDX = 0, jDY = 0, jTouchId = null;
  let jumpTouchId = null;

  // ── Overlay root ──────────────────────────────────────────────────────────
  const ui = document.createElement('div');
  ui.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:10;';
  document.body.appendChild(ui);

  // ── Joystick: fixed base always visible at bottom-left ───────────────────
  // Touch zone covers the whole left 45% of the screen
  const jZone = document.createElement('div');
  jZone.style.cssText =
    'position:absolute;left:0;top:0;width:45%;height:100%;pointer-events:auto;';

  // The visible base ring – anchored 20% from left, 75% from top
  const jBase = document.createElement('div');
  jBase.style.cssText =
    'position:absolute;' +
    'left:50%;top:72%;' +             // center of zone
    'transform:translate(-50%,-50%);' +
    'width:'  + (JR*2) + 'px;' +
    'height:' + (JR*2) + 'px;' +
    'border-radius:50%;' +
    'background:rgba(255,255,255,0.10);' +
    'border:2.5px solid rgba(255,255,255,0.38);';

  // The movable handle – child of jBase, centered by default
  const jHandle = document.createElement('div');
  jHandle.style.cssText =
    'position:absolute;' +
    'left:50%;top:50%;' +
    'transform:translate(-50%,-50%);' +
    'width:'  + (HR*2) + 'px;' +
    'height:' + (HR*2) + 'px;' +
    'border-radius:50%;' +
    'background:rgba(255,255,255,0.80);' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.45);' +
    'transition:background 0.12s;';

  jBase.appendChild(jHandle);
  jZone.appendChild(jBase);
  ui.appendChild(jZone);

  // ── Jump button: bottom-right corner ─────────────────────────────────────
  const jumpZone = document.createElement('div');
  jumpZone.style.cssText =
    'position:absolute;right:0;top:0;width:55%;height:100%;pointer-events:auto;';

  const jumpBtn = document.createElement('div');
  jumpBtn.style.cssText =
    'position:absolute;' +
    'right:32px;bottom:32px;' +
    'width:72px;height:72px;' +
    'border-radius:50%;' +
    'background:rgba(255,255,255,0.14);' +
    'border:2.5px solid rgba(255,255,255,0.45);' +
    'display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 4px 18px rgba(0,0,0,0.28);' +
    'user-select:none;' +
    'transition:background 0.1s,transform 0.08s;';

  // Up-arrow icon
  const jumpIcon = document.createElement('div');
  jumpIcon.style.cssText =
    'width:0;height:0;' +
    'border-left:12px solid transparent;' +
    'border-right:12px solid transparent;' +
    'border-bottom:20px solid rgba(255,255,255,0.85);' +
    'margin-bottom:4px;';

  jumpBtn.appendChild(jumpIcon);
  jumpZone.appendChild(jumpBtn);
  ui.appendChild(jumpZone);

  // ── Joystick helpers ──────────────────────────────────────────────────────
  // Get the center of jBase in viewport coords (called once touch starts)
  function getBaseCenter() {
    const r = jBase.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  // Move handle within base using base-local coordinates (origin = base center)
  function setHandle(localX, localY) {
    // localX/Y are already clamped to JR
    // Map to jBase's own coordinate space: top-left of jBase = 0,0
    jHandle.style.left = (JR + localX) + 'px';
    jHandle.style.top  = (JR + localY) + 'px';
    jHandle.style.transform = 'translate(-50%,-50%)';
  }

  function resetHandle() {
    jHandle.style.left      = '50%';
    jHandle.style.top       = '50%';
    jHandle.style.transform = 'translate(-50%,-50%)';
    jHandle.style.background = 'rgba(255,255,255,0.80)';
  }

  let baseCX = 0, baseCY = 0;

  jZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (jTouchId !== null) return;
    const t  = e.changedTouches[0];
    jTouchId = t.identifier;
    jActive  = true;
    const bc = getBaseCenter();
    baseCX = bc.cx; baseCY = bc.cy;
    jDX = jDY = 0;
    setHandle(0, 0);
  }, { passive:false });

  jZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== jTouchId) continue;
      const rawX = t.clientX - baseCX;
      const rawY = t.clientY - baseCY;
      const dist = Math.sqrt(rawX*rawX + rawY*rawY);
      const cl   = Math.min(dist, JR);
      const ang  = Math.atan2(rawY, rawX);
      const lx   = cl * Math.cos(ang);
      const ly   = cl * Math.sin(ang);
      jDX = lx / JR;
      jDY = ly / JR;
      setHandle(lx, ly);
      jHandle.style.background = Math.abs(jDX) > 0.60
        ? 'rgba(100,210,255,0.92)'
        : 'rgba(255,255,255,0.80)';
    }
  }, { passive:false });

  const endJoystick = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== jTouchId) continue;
      jTouchId = null; jActive = false; jDX = jDY = 0;
      resetHandle();
    }
  };
  jZone.addEventListener('touchend',    endJoystick, { passive:false });
  jZone.addEventListener('touchcancel', endJoystick, { passive:false });

  // ── Jump button ───────────────────────────────────────────────────────────
  jumpZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (jumpTouchId !== null) return;
    const t  = e.changedTouches[0];
    const br = jumpBtn.getBoundingClientRect();
    if (t.clientX < br.left || t.clientX > br.right ||
        t.clientY < br.top  || t.clientY > br.bottom) return;
    jumpTouchId = t.identifier;
    controller.keys.space.pressed = true;
    jumpBtn.style.background = 'rgba(100,210,255,0.40)';
    jumpBtn.style.transform  = 'scale(0.90)';
  }, { passive:false });

  const endJump = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== jumpTouchId) continue;
      jumpTouchId = null;
      controller.keys.space.pressed = false;
      jumpBtn.style.background = 'rgba(255,255,255,0.14)';
      jumpBtn.style.transform  = 'scale(1)';
    }
  };
  jumpZone.addEventListener('touchend',    endJump, { passive:false });
  jumpZone.addEventListener('touchcancel', endJump, { passive:false });

  // ── Game ticker ───────────────────────────────────────────────────────────
  app.ticker.add(() => {
    controller.applyJoystick(jDX, jDY, jActive);

    if (spineBoy.isSpawning()) return;

    spineBoy.state.walk = controller.keys.left.pressed || controller.keys.right.pressed;
    if (spineBoy.state.run && spineBoy.state.walk) spineBoy.state.run = true;
    else spineBoy.state.run = controller.keys.left.doubleTap || controller.keys.right.doubleTap;
    spineBoy.state.hover = controller.keys.down.pressed;
    if (controller.keys.left.pressed)       spineBoy.direction = -1;
    else if (controller.keys.right.pressed) spineBoy.direction =  1;
    spineBoy.state.jump  = controller.keys.space.pressed;

    spineBoy.update();

    let speed = 1.25;
    if (spineBoy.state.hover) speed = 7.5;
    else if (spineBoy.state.run) speed = 3.75;

    if (spineBoy.state.walk) scene.positionX -= speed * scene.scale * spineBoy.direction;
  });
})();
</script>
</body>
</html>
`;

const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      <WebView
        originWhitelist={['*']}
        source={{ html: pixiHTML }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
      />
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});