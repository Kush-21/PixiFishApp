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
  body { margin: 0; overflow: hidden; background-color: #1099bb; touch-action: none; }
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
  KeyA:'left',  ArrowLeft:'left',
  KeyS:'down',  ArrowDown:'down',
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
    const now = Date.now();
    this.keys[k].doubleTap = this.keys[k].doubleTap || now - this.keys[k].timestamp < 300;
    this.keys[k].pressed = true;
  }
  _ku(e) {
    const k = keyMap[e.code]; if (!k) return;
    this.keys[k].pressed = false;
    if (this.keys[k].doubleTap) this.keys[k].doubleTap = false;
    else this.keys[k].timestamp = Date.now();
  }
  // Called every frame from the joystick logic
  applyJoystick(dx, dy, active) {
    const WALK = 0.25, RUN = 0.65;
    if (!active) {
      this.keys.left.pressed = this.keys.right.pressed = this.keys.down.pressed = false;
      this.keys.left.doubleTap = this.keys.right.doubleTap = false;
      return;
    }
    if (dx < -WALK) {
      this.keys.left.pressed    = true;  this.keys.right.pressed   = false;
      this.keys.left.doubleTap  = dx < -RUN; this.keys.right.doubleTap = false;
    } else if (dx > WALK) {
      this.keys.right.pressed   = true;  this.keys.left.pressed    = false;
      this.keys.right.doubleTap = dx > RUN;  this.keys.left.doubleTap  = false;
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

    const bgTex  = Texture.from('background');
    const mgTex  = Texture.from('midground');
    const plTex  = Texture.from('platform');
    const maxH   = plTex.height;
    const plH    = Math.min(maxH, height * 0.4);
    const scale  = (this.scale = plH / maxH);
    const base   = { tileScale:{x:scale,y:scale}, anchor:{x:0,y:1}, applyAnchorToTexture:true };

    this.background = new TilingSprite({ texture:bgTex,  width, height:bgTex.height*scale, ...base });
    this.midground  = new TilingSprite({ texture:mgTex,  width, height:mgTex.height*scale, ...base });
    this.platform   = new TilingSprite({ texture:plTex,  width, height:plH,               ...base });

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
  idle:  { name:'idle',       loop:true  },
  walk:  { name:'walk',       loop:true  },
  run:   { name:'run',        loop:true  },
  jump:  { name:'jump',       timeScale:1.5 },
  hover: { name:'hoverboard', loop:true  },
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
  spawn()  { this.spine.state.setAnimation(0, anim.spawn.name); }
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
    else                       this.playAnimation(anim.idle);
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

  // ── Virtual Joystick UI ──────────────────────────────────────────────────
  const JR = 65;   // joystick base radius (px)
  const HR = 28;   // handle radius (px)

  let jActive = false, jOriginX = 0, jOriginY = 0;
  let jDX = 0, jDY = 0, jTouchId = null;
  let jumpTouchId = null;

  // Root overlay
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;';

  // ── Left half: joystick touch zone ──────────────────────────────────────
  const jZone = document.createElement('div');
  jZone.style.cssText = 'position:absolute;left:0;bottom:0;width:50%;height:55%;pointer-events:auto;';

  // Static hint ring (always visible, faint)
  const jHint = document.createElement('div');
  jHint.style.cssText =
    'position:absolute;left:30%;top:55%;' +
    'width:' + (JR*2) + 'px;height:' + (JR*2) + 'px;' +
    'border-radius:50%;' +
    'background:rgba(255,255,255,0.06);' +
    'border:2px solid rgba(255,255,255,0.2);' +
    'transform:translate(-50%,-50%);' +
    'box-sizing:border-box;';

  const jBase = document.createElement('div');
  jBase.style.cssText =
    'position:absolute;display:none;' +
    'width:' + (JR*2) + 'px;height:' + (JR*2) + 'px;' +
    'border-radius:50%;' +
    'background:rgba(255,255,255,0.13);' +
    'border:3px solid rgba(255,255,255,0.45);' +
    'transform:translate(-50%,-50%);' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.35);' +
    'box-sizing:border-box;';

  const jHandle = document.createElement('div');
  jHandle.style.cssText =
    'position:absolute;' +
    'width:' + (HR*2) + 'px;height:' + (HR*2) + 'px;' +
    'border-radius:50%;' +
    'background:rgba(255,255,255,0.85);' +
    'transform:translate(-50%,-50%);' +
    'box-shadow:0 3px 10px rgba(0,0,0,0.4);' +
    'transition:background 0.1s;' +
    'top:50%;left:50%;';

  jBase.appendChild(jHandle);
  jZone.appendChild(jHint);
  jZone.appendChild(jBase);

  // ── Right half: jump button ─────────────────────────────────────────────
  const jumpZone = document.createElement('div');
  jumpZone.style.cssText =
    'position:absolute;right:0;bottom:0;width:50%;height:55%;' +
    'pointer-events:auto;' +
    'display:flex;align-items:flex-end;justify-content:flex-end;' +
    'padding:32px;box-sizing:border-box;';

  const jumpBtn = document.createElement('div');
  jumpBtn.innerHTML = '<span style="font-size:22px;line-height:1;">&#9651;</span>';
  jumpBtn.style.cssText =
    'width:76px;height:76px;border-radius:50%;' +
    'background:rgba(255,255,255,0.16);' +
    'border:3px solid rgba(255,255,255,0.5);' +
    'display:flex;align-items:center;justify-content:center;' +
    'color:rgba(255,255,255,0.88);' +
    'box-shadow:0 4px 18px rgba(0,0,0,0.3);' +
    'user-select:none;' +
    'transition:background 0.1s,transform 0.08s;';

  // Label under jump button
  const jumpLabel = document.createElement('div');
  jumpLabel.textContent = 'JUMP';
  jumpLabel.style.cssText =
    'font-family:sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;' +
    'color:rgba(255,255,255,0.5);text-align:center;margin-top:6px;';

  const jumpWrap = document.createElement('div');
  jumpWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
  jumpWrap.appendChild(jumpBtn);
  jumpWrap.appendChild(jumpLabel);
  jumpZone.appendChild(jumpWrap);

  ui.appendChild(jZone);
  ui.appendChild(jumpZone);
  document.body.appendChild(ui);

  // ── Joystick touch events ─────────────────────────────────────────────────
  jZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (jTouchId !== null) return;
    const t = e.changedTouches[0];
    jTouchId = t.identifier;
    jActive  = true;
    const r = jZone.getBoundingClientRect();
    jOriginX = t.clientX - r.left;
    jOriginY = t.clientY - r.top;
    jDX = jDY = 0;
    jBase.style.left    = jOriginX + 'px';
    jBase.style.top     = jOriginY + 'px';
    jBase.style.display = 'block';
    jHandle.style.left  = '50%';
    jHandle.style.top   = '50%';
  }, { passive:false });

  jZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== jTouchId) continue;
      const r    = jZone.getBoundingClientRect();
      const dx   = (t.clientX - r.left) - jOriginX;
      const dy   = (t.clientY - r.top)  - jOriginY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const cl   = Math.min(dist, JR);
      const ang  = Math.atan2(dy, dx);
      jDX = (cl/JR) * Math.cos(ang);
      jDY = (cl/JR) * Math.sin(ang);
      jHandle.style.left = (jOriginX + cl * Math.cos(ang)) + 'px';
      jHandle.style.top  = (jOriginY + cl * Math.sin(ang)) + 'px';
      jHandle.style.background = Math.abs(jDX) > 0.65
        ? 'rgba(100,210,255,0.95)' : 'rgba(255,255,255,0.85)';
    }
  }, { passive:false });

  const endJoystick = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== jTouchId) continue;
      jActive = false; jTouchId = null; jDX = jDY = 0;
      jBase.style.display = 'none';
      jHandle.style.background = 'rgba(255,255,255,0.85)';
    }
  };
  jZone.addEventListener('touchend',    endJoystick, { passive:false });
  jZone.addEventListener('touchcancel', endJoystick, { passive:false });

  // ── Jump button touch events ──────────────────────────────────────────────
  jumpZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (jumpTouchId !== null) return;
    const t  = e.changedTouches[0];
    const br = jumpBtn.getBoundingClientRect();
    if (t.clientX < br.left || t.clientX > br.right ||
        t.clientY < br.top  || t.clientY > br.bottom) return;
    jumpTouchId = t.identifier;
    controller.keys.space.pressed = true;
    jumpBtn.style.background = 'rgba(100,210,255,0.45)';
    jumpBtn.style.transform  = 'scale(0.90)';
  }, { passive:false });

  const endJump = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== jumpTouchId) continue;
      jumpTouchId = null;
      controller.keys.space.pressed = false;
      jumpBtn.style.background = 'rgba(255,255,255,0.16)';
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
    spineBoy.state.jump = controller.keys.space.pressed;

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