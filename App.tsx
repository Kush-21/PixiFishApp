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
<!-- Load PixiJS and Spine globally to avoid ES module CORS issues in Android WebView -->
<script src="https://pixijs.download/release/pixi.min.js"></script>
<script src="https://unpkg.com/@esotericsoftware/spine-pixi-v8@4.2.106/dist/iife/spine-pixi-v8.js"></script>
</head>
<body>
<script>
// Mock the ES Module imports using the global variables.
const { Application, Assets, Container, TilingSprite } = PIXI;
const { Spine } = spine;

// --- Controller ---
class Controller {
  constructor() {
    this.keys = {
      left: { pressed: false, doubleTap: false, timestamp: 0 },
      right: { pressed: false, doubleTap: false, timestamp: 0 },
      down: { pressed: false },
      space: { pressed: false },
    };
    
    const handleKey = (e, isDown) => {
      const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ' ': 'space' };
      const key = keyMap[e.key];
      if (key) {
        if (isDown && !this.keys[key].pressed) {
          const now = performance.now();
          if (now - this.keys[key].timestamp < 300) {
            this.keys[key].doubleTap = true;
          }
          this.keys[key].timestamp = now;
        }
        this.keys[key].pressed = isDown;
        if (!isDown) {
          this.keys[key].doubleTap = false;
        }
      }
    };
    
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    // Touch controls for mobile preview
    let touchStartX = 0;
    window.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      this.keys.space.pressed = true;
    });
    window.addEventListener('touchmove', (e) => {
      let x = e.touches[0].clientX;
      if (x < touchStartX - 30) { this.keys.left.pressed = true; this.keys.right.pressed = false; }
      else if (x > touchStartX + 30) { this.keys.right.pressed = true; this.keys.left.pressed = false; }
    });
    window.addEventListener('touchend', () => {
      this.keys.space.pressed = false;
      this.keys.left.pressed = false;
      this.keys.right.pressed = false;
    });
  }
}

// --- Scene ---
class Scene {
  constructor(width, height) {
    this.view = new Container();
    this.scale = height > 0 ? height / 1080 : 1;
    this.floorHeight = 150 * this.scale;
    this._positionX = 0;

    const createTilingSprite = (alias) => {
      const texture = Assets.get(alias);
      const sprite = new TilingSprite({ texture, width: width / this.scale + 100, height: 1080 });
      sprite.scale.set(this.scale);
      sprite.y = -sprite.height * this.scale;
      this.view.addChild(sprite);
      return sprite;
    };

    this.rawSky = createTilingSprite('sky');
    this.rawBackground = createTilingSprite('background');
    this.rawMidground = createTilingSprite('midground');
    this.rawPlatform = createTilingSprite('platform');
  }

  get positionX() { return this._positionX; }
  set positionX(value) {
    this._positionX = value;
    this.rawBackground.tilePosition.x = value * 0.1;
    this.rawMidground.tilePosition.x = value * 0.3;
    this.rawPlatform.tilePosition.x = value * 0.8;
  }
}

// --- SpineBoy ---
class SpineBoy {
  constructor() {
    this.view = new Container();
    this.spine = Spine.from({ skeleton: 'spineSkeleton', atlas: 'spineAtlas' });
    this.view.addChild(this.spine);

    this.state = { walk: false, run: false, hover: false, jump: false };
    this.direction = 1;
    this._isSpawning = true;
    this.currentAnim = null;

    this.spine.state.setAnimation(0, 'portal', false);
    this.spine.state.addAnimation(0, 'idle', true, 0);

    this.spine.state.addListener({
      complete: (entry) => {
        if (entry.animation.name === 'portal') {
          this._isSpawning = false;
        }
      }
    });

    this.spine.eventMode = 'static';
    this.spine.on('pointerdown', () => {
      this.state.jump = true;
      setTimeout(() => this.state.jump = false, 150);
    });
  }

  isSpawning() { return this._isSpawning; }

  spawn() {
    this._isSpawning = true;
    this.spine.state.setAnimation(0, 'portal', false);
    this.spine.state.addAnimation(0, 'idle', true, 0);
  }

  update() {
    let anim = 'idle';
    if (this.state.hover) anim = 'hoverboard';
    else if (this.state.jump) anim = 'jump';
    else if (this.state.run) anim = 'run';
    else if (this.state.walk) anim = 'walk';

    if (this.currentAnim !== anim) {
      this.spine.state.setAnimation(0, anim, true);
      this.currentAnim = anim;
    }

    this.spine.scale.x = Math.abs(this.spine.scale.x) * this.direction;
  }
}

// Asynchronous IIFE (from user setup)
(async () => {
  // Create a PixiJS application.
  const app = new Application();

  // Intialize the application.
  await app.init({ background: '#1099bb', resizeTo: window });

  // Then adding the application's canvas to the DOM body.
  document.body.appendChild(app.canvas);

  // Load the assets.
  await Assets.load([
    {
      alias: 'spineSkeleton',
      src: 'https://raw.githubusercontent.com/pixijs/spine-v8/main/examples/assets/spineboy-pro.skel',
    },
    {
      alias: 'spineAtlas',
      src: 'https://raw.githubusercontent.com/pixijs/spine-v8/main/examples/assets/spineboy-pma.atlas',
    },
    {
      alias: 'sky',
      src: 'https://pixijs.com/assets/tutorials/spineboy-adventure/sky.png',
    },
    {
      alias: 'background',
      src: 'https://pixijs.com/assets/tutorials/spineboy-adventure/background.png',
    },
    {
      alias: 'midground',
      src: 'https://pixijs.com/assets/tutorials/spineboy-adventure/midground.png',
    },
    {
      alias: 'platform',
      src: 'https://pixijs.com/assets/tutorials/spineboy-adventure/platform.png',
    },
  ]);

  // Create a controller that handles keyboard inputs.
  const controller = new Controller();

  // Create a scene that holds the environment.
  const scene = new Scene(app.screen.width, app.screen.height);

  // Create our character
  const spineBoy = new SpineBoy();

  // Adjust views' transformation.
  scene.view.y = app.screen.height;
  spineBoy.view.x = app.screen.width / 2;
  spineBoy.view.y = app.screen.height - scene.floorHeight;
  spineBoy.spine.scale.set(scene.scale * 0.32);

  // Add scene and character to the stage.
  app.stage.addChild(scene.view, spineBoy.view);

  // Trigger character's spawn animation.
  spineBoy.spawn();

  // Animate the scene and the character based on the controller's input.
  app.ticker.add(() => {
    // Ignore the update loops while the character is doing the spawn animation.
    if (spineBoy.isSpawning()) return;

    // Update character's state based on the controller's input.
    spineBoy.state.walk = controller.keys.left.pressed || controller.keys.right.pressed;
    if (spineBoy.state.run && spineBoy.state.walk) spineBoy.state.run = true;
    else spineBoy.state.run = controller.keys.left.doubleTap || controller.keys.right.doubleTap;
    spineBoy.state.hover = controller.keys.down.pressed;
    if (controller.keys.left.pressed) spineBoy.direction = -1;
    else if (controller.keys.right.pressed) spineBoy.direction = 1;
    spineBoy.state.jump = controller.keys.space.pressed;

    // Update character's animation based on the latest state.
    spineBoy.update();

    // Determine the scene's horizontal scrolling speed based on the character's state.
    let speed = 1.25;

    if (spineBoy.state.hover) speed = 7.5;
    else if (spineBoy.state.run) speed = 3.75;

    // Shift the scene's position based on the character's facing direction, if in a movement state.
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