import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Wine } from "lucide-react";

type Screen = "start" | "playing" | "finished";
type FallingItem = { x: number; y: number; speed: number; kind: "drink" | "water" | "medicine" | "glucose"; spin: number; variant: number };

const GAME_SECONDS = 45;
const ITEM_EFFECT = { water: -10, medicine: -16, glucose: -22 } as const;

export default function BarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const drunkPoseRefs = useRef<Record<string, HTMLImageElement>>({});
  const backgroundPeopleRefs = useRef<Record<string, HTMLImageElement>>({});
  const backgroundPeopleFrames = useRef<Record<string, HTMLCanvasElement>>({});
  const jacksonSpriteRef = useRef<HTMLImageElement | null>(null);
  const jacksonFramesRef = useRef<HTMLCanvasElement[]>([]);
  const bottleFramesRef = useRef<HTMLImageElement[]>([]);
  const remedyImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const [screen, setScreen] = useState<Screen>("start");
  const [gameRun, setGameRun] = useState(0);
  const [score, setScore] = useState(0);
  const [drunk, setDrunk] = useState(0);
  const [remaining, setRemaining] = useState(GAME_SECONDS);

  const startGame = useCallback(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      try { audio.pause(); audio.currentTime = 0; } catch {}
    });
    setScore(0);
    setDrunk(0);
    setRemaining(GAME_SECONDS);
    setGameRun((run) => run + 1);
    setScreen("playing");
    const music = audioRefs.current.music;
    if (music) {
      music.currentTime = 0;
      void music.play().catch(() => {});
    }
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
    const isolatePerson = (image: HTMLImageElement, column: number, columns: number, row: number, widthScale = 1) => {
      const baseCellW = image.naturalWidth / columns;
      const cellW = Math.floor(baseCellW * widthScale);
      const cellH = Math.floor(image.naturalHeight / 2);
      const sourceX = Math.max(0, Math.min(image.naturalWidth - cellW, column * baseCellW + (baseCellW - cellW) / 2));
      const frame = document.createElement("canvas");
      frame.width = cellW;
      frame.height = cellH;
      const frameCtx = frame.getContext("2d", { willReadFrequently: true });
      if (!frameCtx) return frame;
      frameCtx.drawImage(image, sourceX, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      const pixels = frameCtx.getImageData(0, 0, cellW, cellH);
      const total = cellW * cellH;
      const labels = new Int32Array(total);
      const queue = new Int32Array(total);
      let label = 0;
      let largestLabel = 0;
      let largestSize = 0;
      for (let start = 0; start < total; start++) {
        if (labels[start] || pixels.data[start * 4 + 3] < 24) continue;
        label++;
        let head = 0;
        let tail = 0;
        let size = 0;
        labels[start] = label;
        queue[tail++] = start;
        while (head < tail) {
          const index = queue[head++];
          size++;
          const x = index % cellW;
          const visit = (next: number) => {
            if (next < 0 || next >= total || labels[next] || pixels.data[next * 4 + 3] < 24) return;
            labels[next] = label;
            queue[tail++] = next;
          };
          if (x > 0) visit(index - 1);
          if (x < cellW - 1) visit(index + 1);
          visit(index - cellW);
          visit(index + cellW);
        }
        if (size > largestSize) {
          largestSize = size;
          largestLabel = label;
        }
      }
      for (let index = 0; index < total; index++) {
        if (labels[index] !== largestLabel) pixels.data[index * 4 + 3] = 0;
      }
      frameCtx.putImageData(pixels, 0, 0);
      return frame;
    };
    Object.entries(people).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      backgroundPeopleRefs.current[key] = image;
      image.onload = () => {
        if (key === "woman") {
          backgroundPeopleFrames.current.womanIdle = isolatePerson(image, 1, 3, 0);
          backgroundPeopleFrames.current.womanCheer = isolatePerson(image, 1, 3, 1);
        } else {
          backgroundPeopleFrames.current.manLeftIdle = isolatePerson(image, 0, 2, 0);
          backgroundPeopleFrames.current.manLeftCheer = isolatePerson(image, 0, 2, 1);
          backgroundPeopleFrames.current.manRightIdle = isolatePerson(image, 1, 2, 0);
          backgroundPeopleFrames.current.manRightCheer = isolatePerson(image, 1, 2, 1);
        }
      };
    });
    const jackson = new Image();
    jackson.src = "/bar-game/jackson-sprites.png";
    jacksonSpriteRef.current = jackson;
    jackson.onload = () => {
      jacksonFramesRef.current = [1, 2, 3, 4].map((column) => isolatePerson(jackson, column, 6, 0, 1.42));
    };
    const bottleSources = [
      "cafe-fino.png", "cafe-trufado.png", "canela.png", "chocolate.png", "limoncello.png",
      "manga-maracuja.png", "maracuja.png", "mel.png", "pacoca.png",
    ];
    bottleFramesRef.current = new Array(bottleSources.length);
    bottleSources.forEach((filename, index) => {
      const image = new Image();
      image.src = `/bar-game/bottles/${filename}`;
      bottleFramesRef.current[index] = image;
    });
    const remedies = {
      water: "/bar-game/remedies/agua.png",
      medicine: "/bar-game/remedies/eno.png",
      glucose: "/bar-game/remedies/engov.png",
    };
    Object.entries(remedies).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      remedyImagesRef.current[key] = image;
    });
    const audio = {
      cheer: new Audio("/bar-game/audio/comemoracao.mp3"),
      music: new Audio("/bar-game/audio/musica-fundo.mp3"),
      burp: new Audio("/bar-game/audio/arroto.mp3"),
      drink: new Audio("/bar-game/audio/bebida.mp3"),
    };
    audio.music.loop = true;
    audio.music.volume = 0.18;
    audio.cheer.volume = 0.2;
    audio.burp.volume = 0.95;
    audio.drink.volume = 0.78;
    Object.values(audio).forEach((item) => { item.preload = "auto"; });
    audioRefs.current = audio;
    return () => Object.values(audio).forEach((item) => item.pause());
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
    const startedAt = performance.now();
    let animationFrame = 0;
    let stopped = false;
    let localScore = 0;
    let localDrunk = 0;
    let frameClock = 0;
    let facing: "left" | "right" = "right";
    let velocityX = 0;
    let dragging = false;
    let celebrateUntil = 0;
    let lastCheerAt = -3;
    let nextBurpAt = 4 + Math.random() * 3;
    const keys = new Set<string>();
    const items: FallingItem[] = [];
    const playAudio = (key: "cheer" | "burp" | "drink") => {
      const audio = audioRefs.current[key];
      if (!audio) return;
      try { audio.pause(); audio.currentTime = 0; } catch {}
      void audio.play().catch(() => {});
    };

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
      const drawRemedy = (image: HTMLImageElement | undefined, maxWidth: number, maxHeight: number) => {
        if (!image?.complete || !image.naturalWidth) return;
        const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        const drawW = image.naturalWidth * scale;
        const drawH = image.naturalHeight * scale;
        ctx.shadowColor = "rgba(0,0,0,.35)";
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 4;
        ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
      };
      if (item.kind === "drink") {
        const bottle = bottleFramesRef.current[item.variant % 9];
        if (bottle) {
          const drawH = 86;
          const drawW = drawH * (bottle.width / bottle.height);
          ctx.shadowColor = "rgba(0,0,0,.38)";
          ctx.shadowBlur = 7;
          ctx.shadowOffsetY = 4;
          ctx.drawImage(bottle, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.fillStyle = "#7c2d12";
          ctx.beginPath();
          ctx.roundRect(-10, -22, 20, 44, 6);
          ctx.fill();
        }
      } else if (item.kind === "medicine") {
        drawRemedy(remedyImagesRef.current.medicine, 44, 52);
      } else if (item.kind === "glucose") {
        drawRemedy(remedyImagesRef.current.glucose, 82, 48);
      } else {
        drawRemedy(remedyImagesRef.current.water, 46, 80);
      }
      ctx.restore();
    };

    const drawBackgroundPerson = (
      frame: HTMLCanvasElement | undefined,
      x: number,
    ) => {
      if (!frame) return;
      const drawH = Math.min(height * 0.24, 190);
      const drawW = drawH * (frame.width / frame.height);
      const floorY = height * 0.47;
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(frame, x - drawW / 2, floorY - drawH, drawW, drawH);
      ctx.restore();
    };

    const drawBackgroundPeople = (celebrating: boolean) => {
      const suffix = celebrating ? "Cheer" : "Idle";
      drawBackgroundPerson(backgroundPeopleFrames.current[`manLeft${suffix}`], width * 0.2);
      drawBackgroundPerson(backgroundPeopleFrames.current[`woman${suffix}`], width * 0.5);
      drawBackgroundPerson(backgroundPeopleFrames.current[`manRight${suffix}`], width * 0.8);
    };

    const drawJackson = () => {
      const sprite = jacksonSpriteRef.current;
      if (!sprite?.complete || !sprite.naturalWidth) return;
      const frames = jacksonFramesRef.current;
      if (frames.length !== 4) return;
      const halfTrip = 8.5;
      const cycle = elapsed % (halfTrip * 2);
      const goingRight = cycle < halfTrip;
      const progress = goingRight ? cycle / halfTrip : (cycle - halfTrip) / halfTrip;
      const drawH = Math.min(height * 0.32, 260);
      const drawW = drawH * (frames[0].width / frames[0].height);
      const startX = -drawW * 0.7;
      const endX = width + drawW * 0.7;
      const x = goingRight
        ? startX + (endX - startX) * progress
        : endX - (endX - startX) * progress;
      const floorY = height * 0.67;
      const walkingFrames = [1, 2, 3, 4];
      const frameIndex = Math.floor(frameClock / 0.16) % walkingFrames.length;

      ctx.save();
      ctx.translate(x, 0);
      if (!goingRight) ctx.scale(-1, 1);
      ctx.drawImage(frames[frameIndex], -drawW / 2, floorY - drawH, drawW, drawH);
      ctx.restore();

      const centerDistance = Math.abs(x - width / 2);
      const bubbleAlpha = Math.max(0, Math.min(1, 1 - centerDistance / (width * 0.2)));
      if (bubbleAlpha > 0) {
        const bubbleW = Math.min(142, width * 0.38);
        const bubbleH = 42;
        const bubbleX = Math.max(8, Math.min(width - bubbleW - 8, x - bubbleW / 2));
        const bubbleY = Math.max(76, floorY - drawH - 48);
        ctx.save();
        ctx.globalAlpha = bubbleAlpha;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 12);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 8, bubbleY + bubbleH);
        ctx.lineTo(x + 2, bubbleY + bubbleH + 12);
        ctx.lineTo(x + 12, bubbleY + bubbleH);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#172033";
        ctx.font = "900 17px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Vai Jackson!!", bubbleX + bubbleW / 2, bubbleY + bubbleH / 2);
        ctx.restore();
      }
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

      const drawStanding = (alpha: number) => {
        const cellW = sprite.naturalWidth / 5;
        const cellH = sprite.naturalHeight / 2;
        const frame = moving ? 1 + (Math.floor(frameClock / 0.14) % 3) : 0;
        const drawH = Math.min(height * 0.48, 390);
        const drawW = drawH * (cellW / cellH);
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, frame * cellW, 0, cellW, cellH, -drawW / 2, -drawH, drawW, drawH);
      };
      const drawLeaning = (alpha: number) => {
        const pose = drunkPoseRefs.current.forward;
        if (!pose?.complete || !pose.naturalWidth) return;
        const drawH = Math.min(height * 0.48, 390);
        const drawW = drawH * (pose.naturalWidth / pose.naturalHeight);
        ctx.globalAlpha = alpha;
        ctx.drawImage(pose, -drawW / 2, -drawH, drawW, drawH);
      };

      if (localDrunk >= 45) {
        const wave = (Math.sin(elapsed * 2.15) + 1) / 2;
        const blend = wave * wave * (3 - 2 * wave);
        drawStanding(1 - blend);
        drawLeaning(blend);
      } else {
        drawStanding(1);
      }
      ctx.restore();
    };

    const render = (now: number) => {
      if (stopped) return;
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.04));
      last = now;
      elapsed = Math.max(0, (now - startedAt) / 1000);
      spawnClock += dt;
      frameClock += dt;
      const secondsLeft = Math.max(0, Math.min(GAME_SECONDS, GAME_SECONDS - elapsed));
      setRemaining(Math.ceil(secondsLeft));

      const intoxication = localDrunk / 100;
      if (localDrunk >= 30 && elapsed >= nextBurpAt) {
        playAudio("burp");
        nextBurpAt = elapsed + 4 + Math.random() * 5;
      }
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
        const kind: FallingItem["kind"] = roll < 0.84 ? "drink" : roll < 0.91 ? "water" : roll < 0.96 ? "medicine" : "glucose";
        items.push({ x: 30 + Math.random() * (width - 60), y: -40, speed: 150 + Math.random() * 95, kind, spin: 0, variant: Math.floor(Math.random() * 9) });
      }

      const playerY = height - 22;
      const playerHeight = Math.min(height * 0.48, 390);
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.speed * dt;
        item.spin += dt * 2;
        if (item.y > playerY - playerHeight && item.y < playerY && Math.abs(item.x - playerX) < 82) {
          items.splice(i, 1);
          localScore += item.kind === "drink" ? 10 : 5;
          const drunkChange = item.kind === "drink"
            ? (item.variant % 2 === 0 ? 5 : 10)
            : ITEM_EFFECT[item.kind];
          localDrunk = Math.max(0, Math.min(100, localDrunk + drunkChange));
          if (item.kind === "drink") {
            celebrateUntil = elapsed + 1.15;
            playAudio("drink");
            if (elapsed - lastCheerAt >= 3) {
              playAudio("cheer");
              lastCheerAt = elapsed;
            }
          }
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
      drawJackson();
      ctx.save();
      const sway = Math.sin(elapsed * 2.4) * intoxication * 8;
      ctx.translate(sway, Math.cos(elapsed * 1.8) * intoxication * 3);
      items.forEach(drawItem);
      drawPlayer(playerX, playerY, Math.abs(playerX - previousX) > 0.25);
      ctx.restore();

      if (secondsLeft <= 0) {
        audioRefs.current.music?.pause();
        setScreen("finished");
        return;
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", resize);
    };
  }, [screen, gameRun]);

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
