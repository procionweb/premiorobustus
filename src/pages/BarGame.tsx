import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Wine } from "lucide-react";

type Screen = "start" | "playing" | "finished";
type FallingItem = { x: number; y: number; speed: number; kind: "drink" | "water" | "medicine" | "glucose"; spin: number };

const GAME_SECONDS = 45;
const ITEM_EFFECT = { drink: 9, water: -10, medicine: -16, glucose: -22 } as const;

export default function BarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const drunkPoseRefs = useRef<Record<string, HTMLImageElement>>({});
  const backgroundPeopleRefs = useRef<Record<string, HTMLImageElement>>({});
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
    sprite.src = "/bar-game/personagem-sprites-transparente.png";
    spriteRef.current = sprite;
    const poses = {
      forward: "/bar-game/personagem-tombando-frente.png",
    };
    Object.entries(poses).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      drunkPoseRefs.current[key] = image;
    });
    const people = {
      woman: "/bar-game/figurantes-mulher.png",
      men: "/bar-game/figurantes-homens.png",
    };
    Object.entries(people).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      backgroundPeopleRefs.current[key] = image;
    });
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
    let velocityX = 0;
    let dragging = false;
    let celebrateUntil = 0;
    const keys = new Set<string>();
    const items: FallingItem[] = [];

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

    const moveTarget = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetX = Math.max(45, Math.min(width - 45, event.clientX - rect.left));
    };
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      moveTarget(event);
    };
    const pointerMove = (event: PointerEvent) => {
      if (dragging || event.pointerType === "mouse") moveTarget(event);
    };
    const pointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) {
        event.preventDefault();
        keys.add(event.key.toLowerCase());
      }
    };
    const keyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const drawItem = (item: FallingItem) => {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.spin);
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 2;
      if (item.kind === "medicine") {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.roundRect(-16, -9, 32, 18, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.fillRect(0, -8, 1.5, 16);
      } else if (item.kind === "glucose") {
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.roundRect(-13, -18, 26, 36, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(-6, -7, 12, 14);
        ctx.fillStyle = "white";
        ctx.fillRect(-10, -24, 20, 7);
      } else {
        ctx.fillStyle = item.kind === "water" ? "#38bdf8" : "#e76f51";
        ctx.beginPath();
        ctx.roundRect(-11, -20, 22, 40, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = item.kind === "water" ? "#e0f2fe" : "#d8b36c";
        ctx.fillRect(-6, -29, 12, 11);
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.fillRect(-6, -3, 12, 10);
      }
      ctx.restore();
    };

    const drawBackgroundPerson = (
      image: HTMLImageElement | undefined,
      column: number,
      columns: number,
      x: number,
      celebrating: boolean,
    ) => {
      if (!image?.complete || !image.naturalWidth) return;
      const cellW = image.naturalWidth / columns;
      const cellH = image.naturalHeight / 2;
      const sourceY = celebrating ? cellH : 0;
      const drawH = Math.min(height * 0.24, 190);
      const drawW = drawH * (cellW / cellH);
      const floorY = height * 0.47;
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(image, column * cellW, sourceY, cellW, cellH, x - drawW / 2, floorY - drawH, drawW, drawH);
      ctx.restore();
    };

    const drawBackgroundPeople = (celebrating: boolean) => {
      drawBackgroundPerson(backgroundPeopleRefs.current.men, 0, 2, width * 0.2, celebrating);
      drawBackgroundPerson(backgroundPeopleRefs.current.woman, 1, 3, width * 0.5, celebrating);
      drawBackgroundPerson(backgroundPeopleRefs.current.men, 1, 2, width * 0.8, celebrating);
    };

    const drawPlayer = (x: number, y: number, moving: boolean) => {
      const sprite = spriteRef.current;
      if (!sprite?.complete) return;
      ctx.save();
      ctx.translate(x, 0);
      if (facing === "right") ctx.scale(-1, 1);
      const drunkRock = Math.sin(elapsed * 3.1) * Math.min(0.09, localDrunk * 0.0009);
      ctx.translate(0, y);
      ctx.rotate(drunkRock);

      if (localDrunk >= 68) {
        const pose = drunkPoseRefs.current.forward;
        const drawH = Math.min(height * 0.48, 390);
        const drawW = drawH * (pose.naturalWidth / pose.naturalHeight);
        ctx.drawImage(pose, -drawW / 2, -drawH * 0.8, drawW, drawH);
      } else if (localDrunk >= 45) {
        const pose = drunkPoseRefs.current.forward;
        const drawH = Math.min(height * 0.48, 390);
        const drawW = drawH * (pose.naturalWidth / pose.naturalHeight);
        ctx.drawImage(pose, -drawW / 2, -drawH * 0.82, drawW, drawH);
      } else {
        const cellW = sprite.naturalWidth / 5;
        const cellH = sprite.naturalHeight / 2;
        const frame = moving ? 1 + (Math.floor(frameClock / 0.14) % 3) : 0;
        const drawH = Math.min(height * 0.48, 390);
        const drawW = drawH * (cellW / cellH);
        ctx.drawImage(sprite, frame * cellW, 0, cellW, cellH, -drawW / 2, -drawH, drawW, drawH);
      }
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
      const previousX = playerX;
      const keyboardDirection = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      if (keyboardDirection !== 0) {
        targetX = Math.max(45, Math.min(width - 45, targetX + keyboardDirection * 330 * dt));
      }
      const delayedTarget = targetX + Math.sin(elapsed * (3 + intoxication * 5)) * 38 * intoxication;
      const response = Math.max(2.4, 10 - intoxication * 7);
      const desiredVelocity = (delayedTarget - playerX) * response;
      const maxSpeed = Math.max(90, 520 - intoxication * 300);
      const clampedVelocity = Math.max(-maxSpeed, Math.min(maxSpeed, desiredVelocity));
      const acceleration = keyboardDirection !== 0 ? 12 : 8;
      velocityX += (clampedVelocity - velocityX) * Math.min(1, dt * acceleration);
      playerX += velocityX * dt;
      playerX = Math.max(42, Math.min(width - 42, playerX));
      const movement = playerX - previousX;
      if (movement > 0.2) facing = "right";
      else if (movement < -0.2) facing = "left";

      const interval = Math.max(0.34, 0.72 - elapsed * 0.005);
      if (spawnClock >= interval) {
        spawnClock = 0;
        const roll = Math.random();
        const kind: FallingItem["kind"] = roll < 0.72 ? "drink" : roll < 0.83 ? "water" : roll < 0.92 ? "medicine" : "glucose";
        items.push({ x: 30 + Math.random() * (width - 60), y: -35, speed: 150 + Math.random() * 95, kind, spin: 0 });
      }

      const playerY = height - 22;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.speed * dt;
        item.spin += dt * 2;
        if (item.y > playerY - 135 && item.y < playerY - 15 && Math.abs(item.x - playerX) < 52) {
          items.splice(i, 1);
          localScore += item.kind === "drink" ? 10 : 5;
          localDrunk = Math.max(0, Math.min(100, localDrunk + ITEM_EFFECT[item.kind]));
          if (item.kind === "drink") celebrateUntil = elapsed + 1.15;
          setScore(localScore);
          setDrunk(localDrunk);
        } else if (item.y > height + 40) {
          items.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, width, height);
      const bg = backgroundRef.current;
      if (bg?.complete) ctx.drawImage(bg, 0, 0, width, height);
      drawBackgroundPeople(elapsed < celebrateUntil);
      ctx.save();
      const sway = Math.sin(elapsed * 2.4) * intoxication * 8;
      ctx.translate(sway, Math.cos(elapsed * 1.8) * intoxication * 3);
      items.forEach(drawItem);
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
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
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
