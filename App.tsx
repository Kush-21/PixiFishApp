import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

const pixiHTML: string = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin: 0; overflow: hidden; background-color: transparent; }
</style>
<!-- Load PixiJS as a global script to avoid Android WebView ES Module CORS issues -->
<script src="https://pixijs.download/release/pixi.min.js"></script>
</head>
<body>
<script>
// Mock the ES Module import by destructuring the global PIXI object
const { Application, Assets, Sprite, Container, TilingSprite, DisplacementFilter, Texture } = PIXI;

// Create a PixiJS application.
const app = new Application();

// Store an array of fish sprites for animation.
const fishes = [];

async function setup() {
  // Intialize the application.
  await app.init({ background: '#1099bb', resizeTo: window });

  // Then adding the application's canvas to the DOM body.
  document.body.appendChild(app.canvas);
}

async function preload() {
  // Create an array of asset data to load.
  const assets = [
    { alias: 'background', src: 'https://pixijs.com/assets/tutorials/fish-pond/pond_background.jpg' },
    { alias: 'fish1', src: 'https://pixijs.com/assets/tutorials/fish-pond/fish1.png' },
    { alias: 'fish2', src: 'https://pixijs.com/assets/tutorials/fish-pond/fish2.png' },
    { alias: 'fish3', src: 'https://pixijs.com/assets/tutorials/fish-pond/fish3.png' },
    { alias: 'fish4', src: 'https://pixijs.com/assets/tutorials/fish-pond/fish4.png' },
    { alias: 'fish5', src: 'https://pixijs.com/assets/tutorials/fish-pond/fish5.png' },
    { alias: 'overlay', src: 'https://pixijs.com/assets/tutorials/fish-pond/wave_overlay.png' },
    { alias: 'displacement', src: 'https://pixijs.com/assets/tutorials/fish-pond/displacement_map.png' },
  ];

  // Load the assets defined above.
  await Assets.load(assets);
}

function addBackground(app) {
  const bg = Sprite.from('background');
  bg.width = app.screen.width;
  bg.height = app.screen.height;
  app.stage.addChild(bg);
}

function addFishes(app, fishes) {
  const fishContainer = new Container();
  app.stage.addChild(fishContainer);
  const fishCount = 20;
  const fishAssets = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5'];
  
  for (let i = 0; i < fishCount; i++) {
    const fishAsset = fishAssets[i % fishAssets.length];
    const fish = Sprite.from(fishAsset);
    
    fish.anchor.set(0.5);
    fish.direction = Math.random() * Math.PI * 2;
    fish.speed = 2 + Math.random() * 2;
    fish.turnSpeed = Math.random() - 0.8;
    fish.x = Math.random() * app.screen.width;
    fish.y = Math.random() * app.screen.height;
    fish.scale.set(0.5 + Math.random() * 0.2);
    
    fishContainer.addChild(fish);
    fishes.push(fish);
  }
}

function animateFishes(app, fishes, time) {
  const delta = time.deltaTime;
  const stagePadding = 100;
  const boundWidth = app.screen.width + stagePadding * 2;
  const boundHeight = app.screen.height + stagePadding * 2;

  fishes.forEach((fish) => {
    fish.direction += fish.turnSpeed * 0.01;
    fish.x += Math.sin(fish.direction) * fish.speed;
    fish.y += Math.cos(fish.direction) * fish.speed;
    fish.rotation = -fish.direction - Math.PI / 2;

    if (fish.x < -stagePadding) {
      fish.x += boundWidth;
    }
    if (fish.x > app.screen.width + stagePadding) {
      fish.x -= boundWidth;
    }
    if (fish.y < -stagePadding) {
      fish.y += boundHeight;
    }
    if (fish.y > app.screen.height + stagePadding) {
      fish.y -= boundHeight;
    }
  });
}

function addWaterOverlay(app) {
  const texture = Texture.from('overlay');
  const water = new TilingSprite({
    texture,
    width: app.screen.width,
    height: app.screen.height,
  });
  water.blendMode = 'add';
  app.stage.addChild(water);
  app.waterOverlay = water;
}

function animateWaterOverlay(app, time) {
  app.waterOverlay.tilePosition.x -= time.deltaTime;
  app.waterOverlay.tilePosition.y -= time.deltaTime;
}

function addDisplacementEffect(app) {
  const displacementSprite = Sprite.from('displacement');
  displacementSprite.texture.baseTexture.wrapMode = 'repeat';
  const displacementFilter = new DisplacementFilter({
    sprite: displacementSprite,
    scale: 50,
  });
  
  app.stage.addChild(displacementSprite);
  app.stage.filters = [displacementFilter];
}

// Asynchronous IIFE
(async () => {
  await setup();
  await preload();

  addBackground(app);
  addFishes(app, fishes);
  addWaterOverlay(app);
  addDisplacementEffect(app);

  // Add the animation callbacks to the application's ticker.
  app.ticker.add((time) => {
    animateFishes(app, fishes, time);
    animateWaterOverlay(app, time);
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