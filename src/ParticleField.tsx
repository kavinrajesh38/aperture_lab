import { useEffect, useRef } from "react";

interface Particle {
  // Spherical coordinates: theta (azimuth) + phi (polar)
  theta: number;
  phi: number;
  radius: number; // distance from center in 3D space
  // Per-particle rotation rates (rad/frame)
  dTheta: number;
  dPhi: number;
  baseSize: number;
  hue: number;
  baseAlpha: number;
  // Hover repulsion offsets in screen space, decaying back to zero
  ox: number;
  oy: number;
  vx: number;
  vy: number;
}

const TEXT_SELECTORS =
  "[data-particle-avoid], h1, h2, h3, h4, h5, h6, button, a, p, span, label, input";

// Camera distance — controls perspective strength.
const CAMERA_Z = 900;

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;
    let cx = w / 2;
    let cy = h / 2;
    // Sphere wraps past the screen diagonal so corners get well covered
    let sphereRadius = Math.hypot(w, h) * 0.62;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cx = w / 2;
      cy = h / 2;
      sphereRadius = Math.hypot(w, h) * 0.62;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Massive count — denser galaxy feel
    const count = Math.max(3500, Math.min(4500, Math.floor((w * h) / 540)));

    const particles: Particle[] = Array.from({ length: count }, () => {
      // Uniform random direction on sphere: theta uniform, phi via acos(1-2u)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // Uniform volume distribution: radius ∝ cbrt(u) so points don't cluster at center or shell
      const radius = sphereRadius * Math.cbrt(Math.random());
      return {
        theta,
        phi,
        radius,
        dTheta: 0.0028 + Math.random() * 0.0016, // base rotation around Y (faster)
        dPhi: (Math.random() - 0.5) * 0.0006, // gentle wobble around X
        baseSize: 0.6 + Math.random() * 1.8,
        hue: Math.random() < 0.8 ? 180 : 0,
        baseAlpha: 0.45 + Math.random() * 0.45,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
      };
    });

    // Cache text rectangles to avoid drawing through copy/UI
    let textRects: DOMRect[] = [];
    const refreshTextRects = () => {
      const els = document.querySelectorAll<HTMLElement>(TEXT_SELECTORS);
      const rects: DOMRect[] = [];
      els.forEach((el) => {
        if (el === canvas) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        if (r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) return;
        rects.push(new DOMRect(r.left - 10, r.top - 6, r.width + 20, r.height + 12));
      });
      textRects = rects;
    };
    refreshTextRects();
    const rectsTimer = window.setInterval(refreshTextRects, 600);

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };
    const onLeave = () => (mouseRef.current.active = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", resize);

    const textVisibility = (px: number, py: number) => {
      let pen = 0;
      for (const r of textRects) {
        if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
          const dx = Math.min(px - r.left, r.right - px);
          const dy = Math.min(py - r.top, r.bottom - py);
          const p = Math.min(dx, dy);
          if (p > pen) pen = p;
        }
      }
      if (pen === 0) return 1;
      return Math.max(0, 1 - pen / 18);
    };

    // For drawing: we project, then sort back-to-front so front particles overlap rear
    interface Projected {
      x: number;
      y: number;
      size: number;
      alpha: number;
      hue: number;
      depth: number; // 0..1, 1 = closest
    }
    const projected: Projected[] = new Array(particles.length);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);

      // Subtle vignette
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 1.2);
      grad.addColorStop(0, "rgba(20, 8, 40, 0.35)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const m = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Advance spherical coords
        p.theta += p.dTheta;
        p.phi += p.dPhi;
        // Keep phi in (0, π)
        if (p.phi < 0.05) p.phi = 0.05;
        if (p.phi > Math.PI - 0.05) p.phi = Math.PI - 0.05;

        // Spherical -> Cartesian (Y up)
        const sinPhi = Math.sin(p.phi);
        const x3 = p.radius * sinPhi * Math.cos(p.theta);
        const yRaw = p.radius * Math.cos(p.phi);
        const zRaw = p.radius * sinPhi * Math.sin(p.theta);
        // Tilt rotation axis ~65° so the orbit clearly arcs through depth —
        // particles visibly sweep forward toward the camera as they pass front.
        const TILT_COS = 0.4226; // cos(65°)
        const TILT_SIN = 0.9063; // sin(65°)
        const y3 = yRaw * TILT_COS - zRaw * TILT_SIN;
        const z3 = yRaw * TILT_SIN + zRaw * TILT_COS;

        // Perspective projection — clamp denom so particles behind camera don't invert
        const persp = CAMERA_Z / Math.max(CAMERA_Z + z3, 1);
        let px = cx + x3 * persp + p.ox;
        let py = cy + y3 * persp + p.oy;

        // Hover ripple — gentle nudge outward from cursor
        if (m.active) {
          const dx = px - m.x;
          const dy = py - m.y;
          const dist = Math.hypot(dx, dy);
          const radius = 200;
          if (dist < radius && dist > 0.1) {
            const force = (1 - dist / radius) * 1.0;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Apply + decay velocity offset (faster decay = quicker settle)
        p.ox += p.vx;
        p.oy += p.vy;
        p.vx *= 0.86;
        p.vy *= 0.86;
        p.ox *= 0.88;
        p.oy *= 0.88;
        px = cx + x3 * persp + p.ox;
        py = cy + y3 * persp + p.oy;

        // Depth -> 1 = front, 0 = back
        const depth = (z3 + p.radius) / (p.radius * 2);

        projected[i] = {
          x: px,
          y: py,
          size: Math.max(0.1, p.baseSize * (0.4 + persp * 1.6)),
          alpha: Math.max(0, Math.min(1, p.baseAlpha * (0.25 + depth * 0.85))),
          hue: p.hue,
          depth,
        };
      }

      // Sort back-to-front so closer particles paint on top
      projected.sort((a, b) => a.depth - b.depth);

      for (const q of projected) {
        if (q.x < -30 || q.x > w + 30 || q.y < -30 || q.y > h + 30) continue;

        const visibility = textVisibility(q.x, q.y);
        if (visibility <= 0) continue;

        const a = q.alpha * visibility;
        // Front particles glow brighter — feels like they "come to camera"
        const glow = q.depth > 0.7 ? 14 : 8;

        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        // If hue is 0, we make it white (100% lightness). 
        // If it's 180, it's Cyan.
        ctx.fillStyle = q.hue === 0 
            ? `rgba(255, 255, 255, ${a})` 
            : `hsla(${q.hue}, 100%, 50%, ${a})`;
        ctx.shadowColor = q.hue === 0 
        ? `rgba(255, 255, 255, ${0.5 * visibility})` 
        : `hsla(${q.hue}, 100%, 60%, ${0.6 * visibility * q.depth})`;
        ctx.shadowBlur = glow;
        ctx.shadowColor = `hsla(${q.hue}, 92%, 65%, ${0.6 * visibility * q.depth})`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(rectsTimer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
      aria-hidden="true"
    >
      <div
        className="absolute -left-64 top-0 h-[60vh] w-[60vh] rounded-full opacity-10 blur-[120px]"
        style={{ background: "radial-gradient(circle, #00ffff, transparent 70%)" }}
      />
      <div
        className="absolute -right-32 bottom-0 h-[60vh] w-[60vh] rounded-full opacity-10 blur-[120px]"
        style={{ background: "rradial-gradient(circle, #ffffff, transparent 70%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
