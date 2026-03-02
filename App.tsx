import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

const pixiHTML: string = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{overflow:hidden;background:#1099bb;touch-action:none;font-family:sans-serif}
  #hud{position:fixed;top:0;left:0;right:0;display:flex;justify-content:center;
       padding:10px;pointer-events:none;z-index:20}
  #score-box{background:rgba(0,0,0,.30);border-radius:20px;padding:4px 22px;text-align:center;color:#fff;
             text-shadow:0 1px 4px rgba(0,0,0,.5)}
  #score-lbl{font-size:9px;letter-spacing:2px;opacity:.75;text-transform:uppercase}
  #score-val{font-size:26px;font-weight:900;line-height:1.15}
  #go{position:fixed;inset:0;background:rgba(0,0,0,.78);display:none;flex-direction:column;
      align-items:center;justify-content:center;gap:14px;z-index:100}
  #go.show{display:flex}
  #go h1{font-size:48px;font-weight:900;color:#ff4455;letter-spacing:5px;
          text-shadow:0 0 28px rgba(255,60,80,.8)}
  #go p{font-size:16px;color:rgba(255,255,255,.7);letter-spacing:1px;text-transform:uppercase}
  #go-score{font-size:28px;color:#fff;font-weight:700}
  #restart{margin-top:10px;padding:14px 46px;border-radius:40px;border:none;
            background:linear-gradient(135deg,#ff5566,#ff2233);
            color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;
            cursor:pointer;box-shadow:0 4px 22px rgba(255,50,70,.55);pointer-events:auto}
</style>
<script src="https://pixijs.download/release/pixi.min.js"></script>
<script src="https://unpkg.com/@esotericsoftware/spine-pixi-v8@4.2.106/dist/iife/spine-pixi-v8.js"></script>
</head>
<body>

<div id="hud">
  <div id="score-box">
    <div id="score-lbl">SCORE</div>
    <div id="score-val">0</div>
  </div>
</div>

<div id="go">
  <h1>GAME OVER</h1>
  <p>Your score</p>
  <div id="go-score">0</div>
  <button id="restart">&#9654; PLAY AGAIN</button>
</div>

<script>
const { Application, Assets, Container, Sprite, Texture, TilingSprite, Graphics } = PIXI;
const { Spine } = spine;

// ── Controller ────────────────────────────────────────────────────────────────
const keyMap={Space:'space',KeyW:'up',ArrowUp:'up',KeyA:'left',ArrowLeft:'left',
               KeyS:'down',ArrowDown:'down',KeyD:'right',ArrowRight:'right'};
class Controller {
  constructor(){
    this.keys={up:{p:false},left:{p:false},down:{p:false},right:{p:false},space:{p:false}};
    window.addEventListener('keydown',e=>{const k=keyMap[e.code];if(k)this.keys[k].p=true});
    window.addEventListener('keyup',  e=>{const k=keyMap[e.code];if(k)this.keys[k].p=false});
  }
  applyJoy(dx,dy,active){
    if(!active){this.keys.left.p=this.keys.right.p=this.keys.down.p=false;return}
    this.keys.left.p=dx<-0.25; this.keys.right.p=dx>0.25; this.keys.down.p=dy>0.25;
  }
}

// ── Scene ─────────────────────────────────────────────────────────────────────
class Scene {
  constructor(w,h){
    this.view=new Container();
    this.sky=Sprite.from('sky');this.sky.anchor.set(0,1);this.sky.width=w;this.sky.height=h;
    const bt=Texture.from('background'),mt=Texture.from('midground'),pt=Texture.from('platform');
    const pH=Math.min(pt.height,h*0.4),sc=(this.scale=pH/pt.height);
    const base={tileScale:{x:sc,y:sc},anchor:{x:0,y:1},applyAnchorToTexture:true};
    this.background=new TilingSprite({texture:bt,width:w,height:bt.height*sc,...base});
    this.midground =new TilingSprite({texture:mt,width:w,height:mt.height*sc,...base});
    this.platform  =new TilingSprite({texture:pt,width:w,height:pH,...base});
    this.floorHeight=pH*0.43;
    this.background.y=this.midground.y=-this.floorHeight;
    this.view.addChild(this.sky,this.background,this.midground,this.platform);
  }
  get positionX(){return this.platform.tilePosition.x}
  set positionX(v){
    this.background.tilePosition.x=v*0.1;
    this.midground.tilePosition.x=v*0.25;
    this.platform.tilePosition.x=v;
  }
}

// ── SpineBoy ──────────────────────────────────────────────────────────────────
const AM={idle:{name:'idle',loop:true},walk:{name:'walk',loop:true},run:{name:'run',loop:true},
          jump:{name:'jump',timeScale:1.5},hover:{name:'hoverboard',loop:true},spawn:{name:'portal'}};
class SpineBoy {
  constructor(){
    this.state={walk:false,run:false,hover:false,jump:false};
    this.view=new Container();this.dv=new Container();
    this.spine=Spine.from({skeleton:'spineSkeleton',atlas:'spineAtlas'});
    this.dv.addChild(this.spine);this.view.addChild(this.dv);
    this.spine.state.data.defaultMix=0.2;
  }
  spawn(){this.spine.state.setAnimation(0,AM.spawn.name)}
  play({name,loop=false,timeScale=1}){
    if(this.cur===name)return;
    this.spine.state.setAnimation(0,name,loop).timeScale=timeScale;
  }
  update(){
    if(this.state.jump)this.play(AM.jump);
    if(this.isPlaying(AM.jump))return;
    if(this.state.hover)      this.play(AM.hover);
    else if(this.state.run)   this.play(AM.run);
    else if(this.state.walk)  this.play(AM.walk);
    else                       this.play(AM.idle);
  }
  isSpawning(){return this.isPlaying(AM.spawn)}
  isPlaying({name}){return this.cur===name&&!this.spine.state.getCurrent(0).isComplete()}
  get cur(){return this.spine.state.getCurrent(0)?.animation.name}
  get direction(){return this.dv.scale.x>0?1:-1}
  set direction(v){this.dv.scale.x=v}
}

// ── Traffic Cone ──────────────────────────────────────────────────────────────
// Returns a PIXI Container + hitbox metadata.
// view.x = center of cone base; view.y = groundY (feet level)
function makeCone() {
  const g = new Graphics();
  // Main orange body — smaller cone
  g.poly([-15, 0, 15, 0, 0, -45]).fill({ color: 0xff6600 });
  // White reflective stripe
  g.rect(-9, -22, 18, 6).fill({ color: 0xffffff });
  // Dark base
  g.rect(-18, 0, 36, 6).fill({ color: 0xcc4400 });

  const c = new Container();
  c.addChild(g);
  return {
    view: c,
    hw: 20,    // narrow hit-width for fairness
    hh: 40,    // hit height (shorter than visual so tip is forgiven)
    offX: -10, // hitbox left relative to view.x
    offY: -44, // hitbox top  relative to view.y
  };
}

// ── AABB ──────────────────────────────────────────────────────────────────────
function overlaps(ax,ay,aw,ah, bx,by,bw,bh){
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async()=>{
  const app=new Application();
  await app.init({background:'#1099bb',resizeTo:window});
  document.body.appendChild(app.canvas);

  await Assets.load([
    {alias:'spineSkeleton',src:'https://raw.githubusercontent.com/pixijs/spine-v8/main/examples/assets/spineboy-pro.skel'},
    {alias:'spineAtlas',   src:'https://raw.githubusercontent.com/pixijs/spine-v8/main/examples/assets/spineboy-pma.atlas'},
    {alias:'sky',       src:'https://pixijs.com/assets/tutorials/spineboy-adventure/sky.png'},
    {alias:'background',src:'https://pixijs.com/assets/tutorials/spineboy-adventure/background.png'},
    {alias:'midground', src:'https://pixijs.com/assets/tutorials/spineboy-adventure/midground.png'},
    {alias:'platform',  src:'https://pixijs.com/assets/tutorials/spineboy-adventure/platform.png'},
  ]);

  const ctrl=new Controller();
  const scene=new Scene(app.screen.width,app.screen.height);
  const sb=new SpineBoy();

  const SCROLL_SPEED = 3.75; // matches original "run" speed
  const groundY = app.screen.height - scene.floorHeight;

  scene.view.y    = app.screen.height;
  sb.view.x       = app.screen.width / 2;
  sb.view.y       = groundY;
  sb.spine.scale.set(scene.scale * 0.32);
  sb.direction    = 1;

  app.stage.addChild(scene.view, sb.view);
  sb.spawn();

  // ── Jump physics (low arc, long hang-time) ─────────────────────────────────
  // Peak ≈ 90px above ground; airtime ≈ 75 frames so it covers lots of ground.
  const JUMP_V   = -5.2;   // initial upward velocity (pixels / frame)
  const GRAVITY  =  0.10;  // low gravity = long hang-time for horizontal clearance
  let vy=0, grounded=true, jumpConsumed=false;

  // ── Game state ─────────────────────────────────────────────────────────────
  let score=0, gameOver=false, frameN=0;
  const cones=[];
  let spawnIn=80; // frames until next cone

  const scoreEl=document.getElementById('score-val');
  const goEl   =document.getElementById('go');
  const goScore=document.getElementById('go-score');

  function triggerGameOver(){
    gameOver=true;
    goScore.textContent=Math.floor(score);
    goEl.classList.add('show');
  }

  function resetGame(){
    score=0; gameOver=false; frameN=0; spawnIn=80;
    vy=0; grounded=true; jumpConsumed=false;
    sb.view.y=groundY; sb.view.alpha=1;
    cones.forEach(o=>app.stage.removeChild(o.view));
    cones.length=0;
    scoreEl.textContent='0';
    goEl.classList.remove('show');
  }

  document.getElementById('restart').addEventListener('click',resetGame);

  // ── Buttons UI ────────────────────────────────────────────────────────────
  let boostActive=false, boostTouchId=null, jumpTouchId=null;

  const ui=document.createElement('div');
  ui.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:10;';

  // ── BOOST button (bottom-left) ────────────────────────────────────────────
  const boostZone=document.createElement('div');
  boostZone.style.cssText='position:absolute;left:0;top:0;width:45%;height:100%;pointer-events:auto;';

  const boostBtn=document.createElement('div');
  boostBtn.style.cssText=
    'position:absolute;left:32px;bottom:32px;width:80px;height:80px;'+
    'border-radius:50%;'+
    'background:rgba(255,200,20,0.18);'+
    'border:2.5px solid rgba(255,210,40,0.60);'+
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;'+
    'box-shadow:0 4px 20px rgba(0,0,0,.28);user-select:none;'+
    'transition:background .1s,transform .08s,box-shadow .1s;';

  const boostIcon=document.createElement('div');
  boostIcon.textContent='⚡';
  boostIcon.style.cssText='font-size:26px;line-height:1;';

  const boostLbl=document.createElement('div');
  boostLbl.textContent='BOOST';
  boostLbl.style.cssText=
    'font-size:9px;font-weight:700;letter-spacing:1.5px;'+
    'color:rgba(255,230,80,0.90);font-family:sans-serif;';

  boostBtn.appendChild(boostIcon); boostBtn.appendChild(boostLbl);
  boostZone.appendChild(boostBtn);

  // ── JUMP button (bottom-right) ────────────────────────────────────────────
  const jumpZone=document.createElement('div');
  jumpZone.style.cssText='position:absolute;right:0;top:0;width:55%;height:100%;pointer-events:auto;';

  const jumpBtn=document.createElement('div');
  jumpBtn.style.cssText=
    'position:absolute;right:32px;bottom:32px;width:80px;height:80px;'+
    'border-radius:50%;'+
    'background:rgba(255,255,255,0.14);'+
    'border:2.5px solid rgba(255,255,255,0.45);'+
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;'+
    'box-shadow:0 4px 18px rgba(0,0,0,.28);user-select:none;'+
    'transition:background .1s,transform .08s;';

  const jumpIcon=document.createElement('div');
  jumpIcon.style.cssText=
    'width:0;height:0;border-left:11px solid transparent;'+
    'border-right:11px solid transparent;border-bottom:18px solid rgba(255,255,255,0.88);';

  const jumpLbl=document.createElement('div');
  jumpLbl.textContent='JUMP';
  jumpLbl.style.cssText=
    'font-size:9px;font-weight:700;letter-spacing:1.5px;'+
    'color:rgba(255,255,255,0.80);font-family:sans-serif;margin-top:4px;';

  jumpBtn.appendChild(jumpIcon); jumpBtn.appendChild(jumpLbl);
  jumpZone.appendChild(jumpBtn);

  ui.appendChild(boostZone); ui.appendChild(jumpZone);
  document.body.appendChild(ui);

  // ── BOOST touch events ────────────────────────────────────────────────────
  boostZone.addEventListener('touchstart',e=>{
    e.preventDefault();if(boostTouchId!==null)return;
    const t=e.changedTouches[0];
    const br=boostBtn.getBoundingClientRect();
    if(t.clientX<br.left||t.clientX>br.right||t.clientY<br.top||t.clientY>br.bottom)return;
    boostTouchId=t.identifier; boostActive=true;
    boostBtn.style.background='rgba(255,200,20,0.50)';
    boostBtn.style.boxShadow='0 0 24px rgba(255,200,20,0.70)';
    boostBtn.style.transform='scale(0.93)';
  },{passive:false});
  const endBoost=e=>{
    for(const t of e.changedTouches){
      if(t.identifier!==boostTouchId)continue;
      boostTouchId=null; boostActive=false;
      boostBtn.style.background='rgba(255,200,20,0.18)';
      boostBtn.style.boxShadow='0 4px 20px rgba(0,0,0,.28)';
      boostBtn.style.transform='scale(1)';
    }
  };
  boostZone.addEventListener('touchend',endBoost,{passive:false});
  boostZone.addEventListener('touchcancel',endBoost,{passive:false});

  // ── JUMP touch events ─────────────────────────────────────────────────────
  jumpZone.addEventListener('touchstart',e=>{
    e.preventDefault();if(jumpTouchId!==null)return;
    const t=e.changedTouches[0];
    const br=jumpBtn.getBoundingClientRect();
    if(t.clientX<br.left||t.clientX>br.right||t.clientY<br.top||t.clientY>br.bottom)return;
    jumpTouchId=t.identifier; ctrl.keys.space.p=true;
    jumpBtn.style.background='rgba(100,210,255,.40)';
    jumpBtn.style.transform='scale(0.90)';
  },{passive:false});
  const endJump=e=>{for(const t of e.changedTouches){if(t.identifier!==jumpTouchId)continue;jumpTouchId=null;ctrl.keys.space.p=false;jumpBtn.style.background='rgba(255,255,255,.14)';jumpBtn.style.transform='scale(1)'}};
  jumpZone.addEventListener('touchend',endJump,{passive:false});
  jumpZone.addEventListener('touchcancel',endJump,{passive:false});

  // ── Game ticker ────────────────────────────────────────────────────────────
  app.ticker.add(()=>{
    if(sb.isSpawning())return;
    if(gameOver)return;

    // Boost doubles the scroll speed
    const spd = boostActive ? SCROLL_SPEED * 2.0 : SCROLL_SPEED;

    frameN++;
    score += spd * 0.04;
    scoreEl.textContent = Math.floor(score);

    // Keyboard 'S' / down also triggers boost
    if(ctrl.keys.down.p) boostActive=true; // keyboard support

    scene.positionX -= spd * scene.scale;

    // Character animation
    sb.state.walk  = true;
    sb.state.run   = !boostActive;   // run anim when not boosting
    sb.state.hover = boostActive;    // hoverboard anim when boosting
    sb.state.jump  = !grounded;
    sb.direction   = 1;
    sb.update();

    // Jump – one-shot trigger per press
    if(ctrl.keys.space.p && grounded && !jumpConsumed){
      vy=JUMP_V; grounded=false; jumpConsumed=true;
    }
    if(!ctrl.keys.space.p) jumpConsumed=false;

    // Physics
    vy += GRAVITY;
    sb.view.y += vy;
    if(sb.view.y>=groundY){ sb.view.y=groundY; vy=0; grounded=true; }

    // Spawn cone
    spawnIn--;
    if(spawnIn<=0){
      const cone=makeCone();
      cone.view.x=app.screen.width+60;
      cone.view.y=groundY;
      cones.push(cone);
      app.stage.addChild(cone.view);
      // Large random gap between cones: 200–480 frames (~3–8 seconds at 60fps)
      spawnIn=200+Math.floor(Math.random()*280);
    }

    // Move cones + collision
    const CHAR_HW=26, CHAR_HH=110;
    for(let i=cones.length-1;i>=0;i--){
      const cone=cones[i];
      cone.view.x-=spd*scene.scale;

      // Remove once off-screen left
      if(cone.view.x<-80){ app.stage.removeChild(cone.view); cones.splice(i,1); continue; }

      // AABB collision
      const ox=cone.view.x+cone.offX, oy=cone.view.y+cone.offY;
      const cx=sb.view.x-CHAR_HW,      cy=sb.view.y-CHAR_HH;
      if(overlaps(cx,cy,CHAR_HW*2,CHAR_HH, ox,oy,cone.hw,cone.hh)){
        triggerGameOver();
        return;
      }
    }
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
  container: { flex: 1 },
});