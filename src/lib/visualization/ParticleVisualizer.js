// ParticleVisualizer: simple canvas particle animation reacting to level (0..1)
// Designed for readability and maintainability.

export class ParticleVisualizer {
  constructor(canvas, { particleCount = 60, onLog = () => {} } = {}) {
    if (!canvas) {
      throw new Error('ParticleVisualizer requires a canvas element');
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onLog = onLog;
    this.particleCount = particleCount;
    this.particles = [];
    this.level = 0;
    this.rafId = null;
    this.resizeObserver = null;
    this.initParticles();
    this.loop = this.loop.bind(this);
    this.observeResize();
  }

  initParticles() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = Array.from({ length: this.particleCount }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1 + Math.random() * 2
    }));
  }

  observeResize() {
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.initParticles();
    };
    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.canvas);
  }

  setLevel(level) {
    this.level = Math.max(0, Math.min(1, level));
  }

  loop() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // particle speed scales with level
    const speedScale = 0.5 + this.level * 2.0;

    for (const p of this.particles) {
      p.x += p.vx * speedScale;
      p.y += p.vy * speedScale;
      // bounce
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + this.level * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 170, 255, ${0.2 + this.level * 0.6})`;
      ctx.fill();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  start() {
    if (this.rafId) return;
    this.loop();
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy() {
    this.stop();
    try { if (this.resizeObserver) this.resizeObserver.disconnect(); } catch {}
  }
}

export default ParticleVisualizer;
