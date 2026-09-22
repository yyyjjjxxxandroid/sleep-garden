// Extra distance cues for StoryWorld.  This module deliberately only depends on
// the small public surface supplied by StoryWorld: scene, place, groundHeight,
// inPond and pathX.

const makeRandom = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function paintCloudTexture(T) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const puff = (x, y, rx, ry, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const gradient = ctx.createRadialGradient(0, 0, rx * .08, 0, 0, rx);
    gradient.addColorStop(0, `rgba(255,255,246,${alpha})`);
    gradient.addColorStop(.45, `rgba(255,255,246,${alpha * .72})`);
    gradient.addColorStop(1, 'rgba(255,255,246,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Several overlapping soft puffs make one cloud mass, rather than a sphere
  // or a single stamped circle.  Its transparent edge keeps the horizon airy.
  [[88, 145, 77, 38, .62], [148, 117, 92, 51, .72], [226, 125, 105, 57, .74],
   [306, 105, 86, 47, .67], [377, 137, 98, 42, .62], [423, 154, 66, 30, .48],
   [243, 165, 168, 42, .30]].forEach(args => puff(...args));
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function placeForest(world) {
  const random = makeRandom(0x5f3759df);
  const names = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_5'];
  const trees = [];
  const safe = (x, z) => {
    const onPond = world.inPond?.(x, z);
    const pathDistance = world.pathX ? Math.abs(x - world.pathX(z)) : Infinity;
    return !onPond && pathDistance > 3.4 && Math.hypot(x + 1, z - 3) > 12;
  };
  const add = (x, z, layer) => {
    if (!safe(x, z)) return false;
    const height = 8.0 + random() * 5.8 - layer * .42;
    const root = world.place(names[Math.floor(random() * names.length)], x, z, height, random() * Math.PI * 2, {
      width: .88 + random() * .35,
    });
    trees.push(root);
    return true;
  };

  // Three irregular, offset bands read as a continuous woodland from the
  // garden, while their changing heights leave a non-mechanical skyline.
  const backBands = [
    { z: -43, count: 19, spread: 98 },
    { z: -52, count: 18, spread: 112 },
    { z: -62, count: 17, spread: 126 },
  ];
  backBands.forEach(({ z, count, spread }, layer) => {
    for (let i = 0; i < count; i++) {
      const x = -spread / 2 + (i + .5) * spread / count + (random() - .5) * 4.6;
      add(x, z + (random() - .5) * 5.2, layer);
    }
  });

  // Side clumps turn the bands into a forest edge without blocking the pond,
  // lawn, or the main approach along the path.
  const sideClusters = [[-48, -24], [47, -27], [-42, 13], [44, 9]];
  for (const [cx, cz] of sideClusters) {
    for (let i = 0; i < 3; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 4 + random() * 8;
      add(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius, 1);
    }
  }
  return trees;
}

function makeClouds(world, T) {
  const texture = paintCloudTexture(T);
  const clouds = [];
  const random = makeRandom(0xc10d5); // Stable but separate from tree placement.
  for (let i = 0; i < 7; i++) {
    const material = new T.SpriteMaterial({
      map: texture,
      color: '#fff9e8',
      transparent: true,
      opacity: .7,
      depthWrite: false,
      fog: false,
    });
    const cloud = new T.Sprite(material);
    // Kept below the top of the initial downward-looking camera framing.
    const z = -54 - random() * 15;
    const baseY = 21 + random() * 5.2;
    const offset = i * 23 + random() * 7;
    cloud.position.set(-82 + offset, baseY, z);
    const width = 28 + random() * 20;
    cloud.scale.set(width, width * (.29 + random() * .13), 1);
    cloud.renderOrder = -1;
    world.scene.add(cloud);
    clouds.push({ cloud, baseY, offset, z, speed: .35 + random() * .32, phase: random() * Math.PI * 2 });
  }
  return clouds;
}

/**
 * Adds the far forest and world-space procedural clouds to a loaded StoryWorld.
 * Call after populateGarden() and before batchScenery().
 */
export function installAtmosphere(world, T) {
  if (!world?.place || !world?.scene) throw new Error('installAtmosphere requires loaded StoryWorld assets');
  const trees = placeForest(world);
  const clouds = makeClouds(world, T);
  return {
    update(dt = 0, t = 0, night = 0) {
      const daylight = Math.pow(Math.max(0, 1 - night), 1.35);
      clouds.forEach(({ cloud, baseY, offset, z, speed, phase }) => {
        const travel = (t * speed + offset) % 170;
        cloud.position.x = -82 + travel;
        cloud.position.z = z + Math.sin(t * .09 + phase) * 2.2;
        cloud.position.y = baseY + Math.sin(t * .17 + phase) * .24;
        cloud.material.opacity = daylight * (.76 + .12 * Math.sin(t * .07 + phase));
        cloud.material.color.set(night > .45 ? '#8fa6b4' : '#fff9e8');
      });
    },
    trees,
    clouds: clouds.map(entry => entry.cloud),
  };
}
