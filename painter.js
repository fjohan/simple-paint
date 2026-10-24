/** A small, browser-only, coarse-to-fine brush renderer. No photo filters or APIs. */
class Painter {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.generation = 0;
  }

  cancel() {
    this.generation++;
    cancelAnimationFrame(this.frame);
    if (this.resolvePending) this.resolvePending(false);
    this.resolvePending = null;
  }

  async paint(source, { style = 'oil', detail = 50, duration = 5000, onProgress = () => {} } = {}) {
    this.cancel();
    const generation = this.generation;
    const { width, height } = source;
    const isTexturedSkagen = style === 'textured-skagen';
    const isSkagen = style === 'skagen' || isTexturedSkagen;
    const isTexturedOil = style === 'textured-oil';
    const isOil = style === 'oil' || isTexturedOil;
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.context;
    ctx.fillStyle = isSkagen ? '#e8e7de' : '#f4efe2';
    ctx.fillRect(0, 0, width, height);
    onProgress(0, 'Laying down the first colors', null);

    // Yield so the fresh canvas and progress state appear before analysis starts.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (generation !== this.generation) return false;

    const pixels = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const fieldCanvas = document.createElement('canvas');
    const scale = Math.max(width, height);
    const fieldWidth = Math.max(1, Math.round(width / scale * 180));
    const fieldHeight = Math.max(1, Math.round(height / scale * 180));
    fieldCanvas.width = fieldWidth;
    fieldCanvas.height = fieldHeight;
    const fieldContext = fieldCanvas.getContext('2d', { willReadFrequently: true });
    fieldContext.filter = isSkagen ? 'blur(1.5px)' : 'blur(1px)';
    fieldContext.drawImage(source, 0, 0, fieldWidth, fieldHeight);
    const field = fieldContext.getImageData(0, 0, fieldWidth, fieldHeight).data;
    const luminance = (x, y) => {
      const i = (Math.max(0, Math.min(fieldHeight - 1, y)) * fieldWidth + Math.max(0, Math.min(fieldWidth - 1, x))) * 4;
      return field[i] * .299 + field[i + 1] * .587 + field[i + 2] * .114;
    };
    const gradients = new Float32Array(fieldWidth * fieldHeight * 3);
    for (let y = 0; y < fieldHeight; y++) {
      for (let x = 0; x < fieldWidth; x++) {
        const gx = luminance(x + 1, y) - luminance(x - 1, y);
        const gy = luminance(x, y + 1) - luminance(x, y - 1);
        const i = (y * fieldWidth + x) * 3;
        gradients[i] = Math.atan2(gy, gx) + Math.PI / 2;
        gradients[i + 1] = Math.hypot(gx, gy);
        gradients[i + 2] = luminance(x, y);
      }
    }
    const gradientAt = (x, y) => {
      const fx = Math.max(0, Math.min(fieldWidth - 1, Math.floor(x / width * fieldWidth)));
      const fy = Math.max(0, Math.min(fieldHeight - 1, Math.floor(y / height * fieldHeight)));
      return (fy * fieldWidth + fx) * 3;
    };

    const detailScale = 1.45 - detail / 125;
    const styleScale = isSkagen ? 1.12 : style === 'impressionist' ? 1.22 : style === 'watercolor' ? 1.18 : 1;
    const radii = [scale / 32, scale / 65, scale / 140, scale / 260].map((r, i) => Math.max(1.2, r * (i ? detailScale : 1) * styleScale));
    const strokes = [];
    const phaseNames = ['Laying down the first colors', 'Finding the shapes', 'Bringing the details to life', 'A few finishing touches'];

    for (let pass = 0; pass < radii.length; pass++) {
      const radius = radii[pass];
      const step = radius * (pass === 0 ? 1.15 : 1.65);
      const layer = [];
      for (let gy = -step / 2; gy < height + step; gy += step) {
        for (let gx = -step / 2; gx < width + step; gx += step) {
          const x = Math.max(0, Math.min(width - 1, gx + (Math.random() - .5) * step * .8));
          const y = Math.max(0, Math.min(height - 1, gy + (Math.random() - .5) * step * .8));
          const fi = gradientAt(x, y);
          // Keep quiet regions expressive; reserve the smallest marks for edges.
          if (pass === 2 && gradients[fi + 1] < (isSkagen ? 10 : 7) && Math.random() > (isSkagen ? .26 : .38)) continue;
          if (pass === 3 && (gradients[fi + 1] < (isSkagen ? 16 : 11) || Math.random() > (isSkagen ? .42 : .55))) continue;
          layer.push({ x, y, radius, pass, fi });
        }
      }
      for (let i = layer.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [layer[i], layer[j]] = [layer[j], layer[i]];
      }
      strokes.push(...layer);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const colorAt = (x, y) => {
      const i = (Math.max(0, Math.min(height - 1, Math.round(y))) * width + Math.max(0, Math.min(width - 1, Math.round(x)))) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2]];
    };
    const drawStroke = stroke => {
      const { x, y, radius, pass, fi } = stroke;
      let [r, g, b] = colorAt(x, y);
      const lightness = (r * .299 + g * .587 + b * .114) / 255;
      const warmSubject = r > g * 1.08 && g > b * 1.05;
      const jitter = (Math.random() - .5) * (isSkagen ? 12 : style === 'impressionist' ? 23 : 9);
      const average = (r + g + b) / 3;
      const saturation = isSkagen ? .88 : style === 'impressionist' ? 1.2 : 1.04;
      const paper = style === 'watercolor' ? .09 : 0;
      const pigment = value => Math.round(Math.max(0, Math.min(255, (average + (value - average) * saturation + jitter) * (1 - paper) + 245 * paper)));
      r = pigment(r); g = pigment(g); b = pigment(b);
      if (isSkagen) {
        // A Krøyer-inspired interpretation: pearl-colored air, cool shadows,
        // and warm light. Weight by tone, rather than tinting the whole photo blue.
        const shadow = Math.pow(1 - lightness, 1.6) * (warmSubject ? .45 : 1);
        const light = Math.pow(Math.max(0, (lightness - .45) / .55), 1.3);
        const clamp = value => Math.round(Math.max(0, Math.min(255, value)));
        r = clamp(r * .95 + 9 - shadow * 5 + light * 8);
        g = clamp(g * .95 + 10 + shadow * 2 + light * 6);
        b = clamp(b * .95 + 12 + shadow * 18 - light * 12);
      }
      const rgb = `rgb(${r},${g},${b})`;
      let angle = gradients[fi + 1] > 3 ? gradients[fi] : -.45;
      angle += (Math.random() - .5) * (isSkagen ? .35 : .65);
      if (style === 'impressionist') angle = Math.round(angle / .55) * .55;
      const length = radius * (isSkagen ? 2.6 : style === 'impressionist' ? 1.8 : style === 'watercolor' ? 3.3 : 3.2) * (.7 + Math.random() * .6);
      const points = [{ x: x - Math.cos(angle) * length * .45, y: y - Math.sin(angle) * length * .45 }];
      let px = points[0].x;
      let py = points[0].y;
      let direction = angle;
      for (let j = 1; j <= 4; j++) {
        const nextIndex = gradientAt(px, py);
        let nextAngle = gradients[nextIndex + 1] > 4 ? gradients[nextIndex] : direction;
        if (Math.cos(nextAngle - direction) < 0) nextAngle += Math.PI;
        let delta = Math.atan2(Math.sin(nextAngle - direction), Math.cos(nextAngle - direction));
        direction += Math.max(-.5, Math.min(.5, delta)) * .4;
        px += Math.cos(direction) * length / 4;
        py += Math.sin(direction) * length / 4;
        // Stop fine strokes where the photo's color changes sharply.
        if (pass > 0 && j > 1) {
          const c = colorAt(px, py);
          const start = colorAt(x, y);
          if (Math.abs(c[0] - start[0]) + Math.abs(c[1] - start[1]) + Math.abs(c[2] - start[2]) > (isSkagen ? 135 : 160)) break;
        }
        points.push({ x: px, y: py });
      }
      const path = (offset = 0) => {
        const ox = -Math.sin(angle) * offset;
        const oy = Math.cos(angle) * offset;
        ctx.beginPath();
        ctx.moveTo(points[0].x + ox, points[0].y + oy);
        for (let i = 1; i < points.length - 1; i++) {
          ctx.quadraticCurveTo(points[i].x + ox, points[i].y + oy, (points[i].x + points[i + 1].x) / 2 + ox, (points[i].y + points[i + 1].y) / 2 + oy);
        }
        const end = points[points.length - 1];
        ctx.lineTo(end.x + ox, end.y + oy);
        ctx.stroke();
      };
      ctx.strokeStyle = rgb;
      ctx.globalAlpha = style === 'watercolor' ? (pass === 0 ? .64 : .43) : isSkagen ? .84 : .91;
      ctx.lineWidth = radius * (1.75 + Math.random() * .45);
      const strokeWidth = ctx.lineWidth;
      if (isTexturedOil && radius >= 2.4) {
        const width = ctx.lineWidth;
        // A narrower body lets individual bristle ends define the silhouette.
        ctx.lineWidth = width * .8;
        path();
        const seed = Math.imul(Math.round(x * 16), 73856093) ^ Math.imul(Math.round(y * 16), 19349663) ^ (pass + 1);
        this.addOilBristles(points, width, [r, g, b], seed);
        return;
      }
      path();
      if (style !== 'watercolor') {
        ctx.globalAlpha = isOil ? .24 : isSkagen ? .12 : .16;
        ctx.lineWidth = Math.max(.6, radius * .16);
        ctx.strokeStyle = `rgb(${Math.min(255, r + 27)},${Math.min(255, g + 25)},${Math.min(255, b + 20)})`;
        path(-radius * .4);
        if (isOil && radius > 3) {
          ctx.globalAlpha = .15;
          ctx.strokeStyle = `rgb(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)})`;
          path(radius * .35);
        }
      }
      if (isTexturedSkagen && radius >= 3.5 && pass < 3) {
        // Keep the full Skagen stroke beneath soft ribbons. Quiet areas receive
        // much less texture; the smallest finishing marks remain undisturbed.
        const structure = Math.max(0, Math.min(1, (gradients[fi + 1] - 2) / 22));
        const seed = Math.imul(Math.round(x * 16), 73856093) ^ Math.imul(Math.round(y * 16), 19349663) ^ (pass + 1);
        this.addOilBristles(points, strokeWidth, [r, g, b], seed, { soft: true, strength: .2 + structure * .8 });
      }
    };

    let index = 0;
    const start = performance.now();
    return new Promise(resolve => {
      this.resolvePending = resolve;
      const frame = now => {
        if (generation !== this.generation) return resolve(false);
        const target = Math.min(strokes.length, Math.ceil((now - start) / duration * strokes.length));
        const deadline = performance.now() + 11;
        while (index < target && performance.now() < deadline) drawStroke(strokes[index++]);
        const latest = strokes[Math.max(0, index - 1)];
        onProgress(index / strokes.length, phaseNames[latest?.pass || 0], latest ? { x: latest.x / width, y: latest.y / height } : null);
        if (index < strokes.length) {
          this.frame = requestAnimationFrame(frame);
        } else {
          ctx.globalAlpha = 1;
          this.addPaperTexture(width, height);
          onProgress(1, 'A moment, made into art.', null);
          this.resolvePending = null;
          resolve({ strokes: strokes.length, seconds: (performance.now() - start) / 1000 });
        }
      };
      this.frame = requestAnimationFrame(frame);
    });
  }

  addOilBristles(points, width, color, seed, { soft = false, strength = 1 } = {}) {
    const ctx = this.context;
    // A separate random stream preserves oil's stroke plan, colors and timing:
    // changing the bristles must not change the next stroke's shape or pigment.
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const normals = points.map((point, i) => {
      const before = points[Math.max(0, i - 1)];
      const after = points[Math.min(points.length - 1, i + 1)];
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: -dy / length, y: dx / length };
    });
    // More ribbons on broad marks; cap the cost and keep fine marks simple.
    const count = Math.max(3, Math.min(soft ? 5 : 8, Math.round(width / 4)));
    const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
    for (let band = 0; band < count; band++) {
      const across = ((band + .5) / count - .5) + (random() - .5) * .3 / count;
      const offset = across * width * (soft ? .84 : .98);
      const ribbon = points.map((point, i) => ({
        x: point.x + normals[i].x * offset,
        y: point.y + normals[i].y * offset
      }));
      const last = ribbon.length - 1;
      const edge = Math.abs(across) * 2;
      const startTrim = (soft ? .03 + edge * .15 : .06 + edge * .4) * random();
      const endTrim = (soft ? .03 + edge * .15 : .06 + edge * .4) * random();
      ribbon[0].x += (ribbon[1].x - ribbon[0].x) * startTrim;
      ribbon[0].y += (ribbon[1].y - ribbon[0].y) * startTrim;
      ribbon[last].x += (ribbon[last - 1].x - ribbon[last].x) * endTrim;
      ribbon[last].y += (ribbon[last - 1].y - ribbon[last].y) * endTrim;
      const shade = (random() - .5) * (soft ? 16 : 44);
      ctx.strokeStyle = `rgb(${color.map(channel => clamp(channel + shade + (random() - .5) * (soft ? 2 : 5))).join(',')})`;
      ctx.globalAlpha = (soft ? .15 + random() * .15 : .5 + random() * .32) * strength;
      ctx.lineWidth = Math.max(.55, width / count * (soft ? .8 + random() * .25 : .65 + random() * .3));
      ctx.beginPath();
      ctx.moveTo(ribbon[0].x, ribbon[0].y);
      for (let i = 1; i < last; i++) {
        ctx.quadraticCurveTo(ribbon[i].x, ribbon[i].y, (ribbon[i].x + ribbon[i + 1].x) / 2, (ribbon[i].y + ribbon[i + 1].y) / 2);
      }
      ctx.lineTo(ribbon[last].x, ribbon[last].y);
      ctx.stroke();
    }
  }

  addPaperTexture(width, height) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 96;
    const tctx = tile.getContext('2d');
    const data = tctx.createImageData(96, 96);
    for (let i = 0; i < data.data.length; i += 4) {
      const shade = Math.random() > .45 ? 255 : 28;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = shade;
      data.data[i + 3] = Math.floor(Math.random() * 12);
    }
    tctx.putImageData(data, 0, 0);
    this.context.fillStyle = this.context.createPattern(tile, 'repeat');
    this.context.fillRect(0, 0, width, height);
  }
}
