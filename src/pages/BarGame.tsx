import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Wine } from "lucide-react";

type Screen = "start" | "playing" | "finished";
type Bottle = { x: number; y: number; speed: number; kind: number; spin: number };

const GAME_SECONDS = 45;
const BOTTLE_COLORS = ["#e9c46a", "#2a9d8f", "#e76f51", "#8ecae6"];

export default function BarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const cleanSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef(0);
  const [screen, setScreen] = useState<Screen>("start");
  const [score, setScore] = useState(0);
  const [drunk, setDrunk] = useState(0);
  const [remaining, setRemaining] = useState(GAME_SECONDS);

  const startGame = useCallback(() => {
    setScore(0);
    setDrunk(0);
    setRemaining(GAME_SECONDS);
    setScreen("playing");
  }, []);

  useEffect(() => {
    const bg = new Image();
    bg.src = "/bar-game/bar-background.png";
    backgroundRef.current = bg;
    const sprite = new Image();
    sprite.src = "/bar-game/personagem-sprites.png";
    spriteRef.current = sprite;
    sprite.onload = () => {
      const clean = document.createElement("canvas");
      clean.width = sprite.naturalWidth;
      clean.height = sprite.naturalHeight;
      const cleanCtx = clean.getContext("2d", { willReadFrequently: true });
      if (!cleanCtx) return;
      cleanCtx.drawImage(sprite, 0, 0);
      const image = cleanCtx.getImageData(0, 0, clean.width, clean.height);
      const { data } = image;
      const total = clean.width * clean.height;
      const visited = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;

      const isBackdrop = (index: number) => {
        const offset = index * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        return Math.min(r, g, b) > 218 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
      };
      const enqueue = (index: number) => {
        if (index < 0 || index >= total || visited[index] || !isBackdrop(index)) return;
        visited[index] = 1;
        queue[tail++] = index;
      };

      for (let x = 0; x < clean.width; x++) {
        enqueue(x);
        enqueue((clean.height - 1) * clean.width + x);
      }
      for (let y = 0; y < clean.height; y++) {
        enqueue(y * clean.width);
        enqueue(y * clean.width + clean.width - 1);
      }
      while (head < tail) {
        const index = queue[head++];
        const x = index % clean.width;
        if (x > 0) enqueue(index - 1);
        if (x < clean.width - 1) enqueue(index + 1);
        enqueue(index - clean.width);
        enqueue(index + clean.width);
      }
      for (let index = 0; index < total; index++) {
        if (visited[index]) data[index * 4 + 3] = 0;
      }
      cleanCtx.putImageData(image, 0, 0);
      cleanSpriteRef.current = clean;
    };
  }, []);

  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let playerX = 0;
    let targetX = 0;
    let elapsed = 0;
    let spawnClock = 0;
    let last = performance.now();
    let localScore = 0;
    let localDrunk = 0;
    let frameClock = 0;
    let facing: "left" | "right" = "right";
    const bottles: Bottle[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!playerX) playerX = targetX = width / 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetX = Math.max(45, Math.min(width - 45, event.clientX - rect.left));
    };
    canvas.addEventListener("pointerdown", move);
    canvas.addEventListener("pointermove", move);

    const drawBottle = (b: Bottle) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = BOTTLE_COLORS[b.kind];
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-11, -20, 22, 40, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#d8b36c";
      ctx.fillRect(-6, -29, 12, 11);
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.fillRect(-6, -3, 12, 10);
      ctx.restore();
    };

    const drawPlayer = (x: number, y: number, moving: boolean) => {
      const sprite = cleanSpriteRef.current;
      if (!sprite) return;
      const cellW = sprite.width / 5;
      const cellH = sprite.height / 2;
      const frame = moving ? 1 + (Math.floor(frameClock / 0.14) % 3) : 0;
      const drawH = Math.min(height * 0.47, 360);
      const drawW = drawH * (cellW / cellH);
      ctx.save();
      ctx.translate(x, 0);
      if (facing === "right") ctx.scale(-1, 1);
      ctx.drawImage(sprite, frame * cellW, 0, cellW, cellH, -drawW / 2, y - drawH, drawW, drawH);
      ctx.restore();
    };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      elapsed += dt;
      spawnClock += dt;
      frameClock += dt;
      const secondsLeft = Math.max(0, GAME_SECONDS - elapsed);
      setRemaining(Math.ceil(secondsLeft));

      const intoxication = localDrunk / 100;
      const delayedTarget = targetX + Math.sin(elapsed * (3 + intoxication * 5)) * 42 * intoxication;
      const response = Math.max(2.2, 11 - intoxication * 8);
      const previousX = playerX;
      playerX += (delayedTarget - playerX) * Math.min(1, dt * response);
      playerX = Math.max(42, Math.min(width - 42, playerX));
      const movement = playerX - previousX;
      if (movement > 0.2) facing = "right";
      else if (movement < -0.2) facing = "left";

      const interval = Math.max(0.34, 0.72 - elapsed * 0.005);
      if (spawnClock >= interval) {
        spawnClock = 0;
        bottles.push({ x: 30 + Math.random() * (width - 60), y: -35, speed: 150 + Math.random() * 95, kind: Math.floor(Math.random() * 4), spin: 0 });
      }

      const playerY = height - 22;
      for (let i = bottles.length - 1; i >= 0; i--) {
        const b = bottles[i];
        b.y += b.speed * dt;
        b.spin += dt * 2;
        if (b.y > playerY - 120 && b.y < playerY - 20 && Math.abs(b.x - playerX) < 45) {
          bottles.splice(i, 1);
          localScore += 10;
          localDrunk = Math.min(100, localDrunk + 9);
          setScore(localScore);
          setDrunk(localDrunk);
        } else if (b.y > height + 40) {
          bottles.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, width, height);
      const bg = backgroundRef.current;
      if (bg?.complete) ctx.drawImage(bg, 0, 0, width, height);
      ctx.save();
      const sway = Math.sin(elapsed * 2.4) * intoxication * 8;
      ctx.translate(sway, Math.cos(elapsed * 1.8) * intoxication * 3);
      bottles.forEach(drawBottle);
      drawPlayer(playerX, playerY, Math.abs(playerX - previousX) > 0.25);
      ctx.restore();

      if (secondsLeft <= 0) {
        setScreen("finished");
        return;
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", move);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("resize", resize);
    };
  }, [screen]);

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#21140d] bg-cover bg-center text-white select-none touch-none"
      style={{ backgroundImage: "url('/bar-game/bar-background.png')" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ filter: screen === "playing" ? `blur(${Math.max(0, drunk - 18) * 0.045}px) saturate(${1 + drunk * 0.004})` : undefined }}
      />

      {screen === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-3 pt-[max(12px,env(safe-area-inset-top))]">
          <div className="min-w-24 rounded-md border border-white/20 bg-black/65 px-3 py-2 text-center shadow-lg">
            <span className="block text-[10px] font-bold uppercase text-amber-300">Pontos</span>
            <strong className="text-xl">{score}</strong>
          </div>
          <div className="flex-1 rounded-md border border-white/20 bg-black/65 px-3 py-2 shadow-lg">
            <div className="mb-1 flex justify-between text-[10px] font-bold uppercase"><span>Nível de embriaguez</span><span>{drunk}%</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 transition-[width]" style={{ width: `${drunk}%` }} /></div>
          </div>
          <div className="min-w-20 rounded-md border border-white/20 bg-black/65 px-3 py-2 text-center shadow-lg">
            <span className="block text-[10px] font-bold uppercase text-amber-300">Tempo</span>
            <strong className="text-xl">{remaining}s</strong>
          </div>
        </div>
      )}

      {screen !== "playing" && (
        <section className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 px-6 text-center backdrop-blur-[2px]">
          <Wine className="mb-4 h-14 w-14 text-amber-400" />
          <h1 className="text-4xl font-black uppercase leading-none sm:text-6xl">Desafio do Bar</h1>
          <p className="mt-3 max-w-md text-base font-semibold text-white/85 sm:text-xl">
            {screen === "start" ? "Pegue as bebidas e tente manter o controle." : `Fim de jogo! Você marcou ${score} pontos.`}
          </p>
          <button onClick={startGame} className="mt-8 flex min-h-14 items-center gap-3 rounded-md bg-orange-500 px-9 py-4 text-xl font-black uppercase shadow-[0_6px_0_#9a3412] active:translate-y-1 active:shadow-none">
            {screen === "start" ? <Play className="h-6 w-6 fill-current" /> : <RotateCcw className="h-6 w-6" />}
            {screen === "start" ? "Jogar" : "Jogar novamente"}
          </button>
        </section>
      )}
    </main>
  );
}
