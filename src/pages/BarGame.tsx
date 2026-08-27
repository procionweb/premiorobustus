import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capacitor-community/native-audio";

type Screen = "start" | "selection" | "playing";
type Character = "jackson" | "ginaldo";
type FallingItem = { x: number; y: number; speed: number; kind: "drink" | "water" | "medicine" | "glucose"; spin: number; variant: number };

const GAME_SECONDS = 30;
const ITEM_EFFECT = { water: -10, medicine: -16, glucose: -22 } as const;
const USE_NATIVE_MUSIC = Capacitor.isNativePlatform();
const NATIVE_MENU_ID = "bhaskar-menu-music";
const NATIVE_GAME_ID = "bhaskar-game-music";

export default function BarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerSpriteRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const playerFramesRef = useRef<Record<Character, HTMLCanvasElement[]>>({ jackson: [], ginaldo: [] });
  const drunkPoseRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const backgroundPeopleRefs = useRef<Record<string, HTMLImageElement>>({});
  const backgroundPeopleFrames = useRef<Record<string, HTMLCanvasElement>>({});
  const backgroundCastRef = useRef([0, 1, 2, 3]);
  const backgroundDeckRef = useRef<number[]>([]);
  const walkerSpriteRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const walkerFramesRef = useRef<Record<Character, HTMLCanvasElement[]>>({ jackson: [], ginaldo: [] });
  const bottleFramesRef = useRef<HTMLImageElement[]>([]);
  const remedyImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const fallenPlayerRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const gameStartingRef = useRef(false);
  const activeEffectsRef = useRef<Set<HTMLAudioElement>>(new Set());
  const musicShouldPlayRef = useRef(false);
  const nativeMusicReadyRef = useRef<Promise<void> | null>(null);
  const nativeMusicModeRef = useRef<"menu" | "game" | "stopped">("stopped");
  const [screen, setScreen] = useState<Screen>("start");
  const [selectedCharacter, setSelectedCharacter] = useState<Character>("jackson");
  const [gameRun, setGameRun] = useState(0);
  const [score, setScore] = useState(0);
  const [drunk, setDrunk] = useState(0);
  const [remaining, setRemaining] = useState(GAME_SECONDS);

  const ensureNativeMusic = useCallback(() => {
    if (!USE_NATIVE_MUSIC) return Promise.resolve();
    if (!nativeMusicReadyRef.current) {
      nativeMusicReadyRef.current = Promise.all([
        NativeAudio.preload({
          assetId: NATIVE_MENU_ID,
          assetPath: "public/bar-game/audio/musica-menu.mp3",
          audioChannelNum: 1,
          isUrl: false,
          volume: 0.2,
        }),
        NativeAudio.preload({
          assetId: NATIVE_GAME_ID,
          assetPath: "public/bar-game/audio/musica-fundo.mp3",
          audioChannelNum: 1,
          isUrl: false,
          volume: 0.18,
        }),
      ]).then(() => undefined);
    }
    return nativeMusicReadyRef.current;
  }, []);

  const switchNativeMusic = useCallback((mode: "menu" | "game" | "stopped") => {
    if (!USE_NATIVE_MUSIC) return;
    if (nativeMusicModeRef.current === mode) return;
    nativeMusicModeRef.current = mode;
    void ensureNativeMusic().then(async () => {
      if (nativeMusicModeRef.current !== mode) return;
      await Promise.allSettled([
        NativeAudio.stop({ assetId: NATIVE_MENU_ID }),
        NativeAudio.stop({ assetId: NATIVE_GAME_ID }),
      ]);
      if (mode === "stopped" || nativeMusicModeRef.current !== mode) return;
      const assetId = mode === "menu" ? NATIVE_MENU_ID : NATIVE_GAME_ID;
      await NativeAudio.play({ assetId });
      await NativeAudio.loop({ assetId });
    }).catch((error) => console.error("Falha ao iniciar musica nativa", error));
  }, [ensureNativeMusic]);

  const playUiSound = useCallback((kind: "button" | "select") => {
    const audio = audioRefs.current[kind === "button" ? "uiButton" : "uiSelect"];
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch {}
    void audio.play().catch(() => {});
  }, []);

  const startGame = useCallback(() => {
    if (gameStartingRef.current) return;
    gameStartingRef.current = true;
    musicShouldPlayRef.current = false;
    ["cheer", "music", "menu", "burp", "drink"].forEach((key) => {
      const audio = audioRefs.current[key];
      if (!audio) return;
      try { audio.pause(); audio.currentTime = 0; } catch {}
    });
    activeEffectsRef.current.forEach((audio) => audio.pause());
    activeEffectsRef.current.clear();
    if (backgroundDeckRef.current.length < 4) {
      const used = new Set(backgroundDeckRef.current);
      const refill = Array.from({ length: 13 }, (_, index) => index).filter((index) => !used.has(index));
      for (let index = refill.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [refill[index], refill[swapIndex]] = [refill[swapIndex], refill[index]];
      }
      backgroundDeckRef.current.push(...refill);
    }
    const nextCast = backgroundDeckRef.current.splice(0, 4);
    backgroundCastRef.current = nextCast;
    setScore(0);
    setDrunk(0);
    setRemaining(GAME_SECONDS);
    setGameRun((run) => run + 1);
    setScreen("playing");
    const music = audioRefs.current.music;
    if (USE_NATIVE_MUSIC) {
      musicShouldPlayRef.current = true;
      switchNativeMusic("game");
    } else if (music) {
      musicShouldPlayRef.current = true;
      music.currentTime = 0;
      void music.play().catch(() => {});
    }
  }, [switchNativeMusic]);

  useEffect(() => {
    const bg = new Image();
    bg.src = "/bar-game/bar-background.png";
    backgroundRef.current = bg;
    ["jackson", "ginaldo"].forEach((character) => {
      const selection = new Image();
      selection.src = `/bar-game/selecao-${character}.png`;
    });
    const players: Record<Character, string> = {
      jackson: "/bar-game/personagem-sprites-transparente.png",
      ginaldo: "/bar-game/ginaldo-sprites.png",
    };
    Object.entries(players).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      playerSpriteRefs.current[key as Character] = image;
    });
    const poses: Record<Character, string> = {
      jackson: "/bar-game/personagem-tombando-frente.png",
      ginaldo: "/bar-game/ginaldo-tombando.png",
    };
    Object.entries(poses).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      drunkPoseRefs.current[key as Character] = image;
    });
    const fallen: Record<Character, string> = {
      jackson: "/bar-game/jackson-caido.png",
      ginaldo: "/bar-game/ginaldo-caido.png",
    };
    Object.entries(fallen).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      fallenPlayerRefs.current[key as Character] = image;
    });
    const people = Array.from({ length: 13 }, (_, index) => `/bar-game/figurante-${index + 1}.png`);
    const isolatePerson = (image: HTMLImageElement, column: number, columns: number, row: number, widthScale = 1, rows = 2, heightScale = 1) => {
      const baseCellW = image.naturalWidth / columns;
      const cellW = Math.floor(baseCellW * widthScale);
      const baseCellH = image.naturalHeight / rows;
      const cellH = Math.min(image.naturalHeight - Math.floor(row * baseCellH), Math.floor(baseCellH * heightScale));
      const sourceX = Math.max(0, Math.min(image.naturalWidth - cellW, column * baseCellW + (baseCellW - cellW) / 2));
      const frame = document.createElement("canvas");
      frame.width = cellW;
      frame.height = cellH;
      const frameCtx = frame.getContext("2d", { willReadFrequently: true });
      if (!frameCtx) return frame;
      frameCtx.drawImage(image, sourceX, row * baseCellH, cellW, cellH, 0, 0, cellW, cellH);
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
    (Object.keys(players) as Character[]).forEach((character) => {
      const image = playerSpriteRefs.current[character];
      const prepareFrames = () => {
        playerFramesRef.current[character] = [0, 1, 2, 3, 4].map((column) => isolatePerson(image, column, 5, 0));
      };
      if (image.complete && image.naturalWidth) prepareFrames();
      else image.addEventListener("load", prepareFrames, { once: true });
    });
    people.forEach((src, index) => {
      const image = new Image();
      image.src = src;
      backgroundPeopleRefs.current[`person${index}`] = image;
      image.onload = () => {
        backgroundPeopleFrames.current[`person${index}Idle`] = isolatePerson(image, 0, 2, 0, 1, 1);
        backgroundPeopleFrames.current[`person${index}Cheer`] = isolatePerson(image, 1, 2, 0, 1, 1);
      };
    });
    const jackson = new Image();
    jackson.src = "/bar-game/jackson-sprites.png";
    walkerSpriteRefs.current.jackson = jackson;
    jackson.onload = () => {
      walkerFramesRef.current.jackson = [1, 2, 3, 4].map((column) => isolatePerson(jackson, column, 6, 0, 1.42));
    };
    const ginaldoWalker = new Image();
    ginaldoWalker.src = "/bar-game/eduardo-walker-sprites-v4.png";
    walkerSpriteRefs.current.ginaldo = ginaldoWalker;
    ginaldoWalker.onload = () => {
      walkerFramesRef.current.ginaldo = [0, 1].flatMap((row) =>
        Array.from({ length: 15 }, (_, column) =>
          isolatePerson(ginaldoWalker, column, 15, row, row === 1 ? 1.1 : 1.04, 2, 1),
        ),
      );
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
      music: new Audio("/bar-game/audio/musica-fundo.mp3?v=android-audio-2"),
      menu: new Audio("/bar-game/audio/musica-menu.mp3?v=android-audio-2"),
      uiButton: new Audio("/bar-game/audio/botao.mp3"),
      uiSelect: new Audio("/bar-game/audio/select.wav"),
      burp: new Audio("/bar-game/audio/arroto.mp3"),
      drink: new Audio("/bar-game/audio/bebida.mp3"),
    };
    audio.music.loop = true;
    audio.music.volume = 0.18;
    audio.menu.loop = true;
    audio.menu.volume = 0.2;
    audio.uiButton.volume = 0.75;
    audio.uiSelect.volume = 0.72;
    audio.cheer.volume = 0.2;
    audio.burp.volume = 0.95;
    audio.drink.volume = 0.95;
    const resumeActiveMusic = () => {
      if (USE_NATIVE_MUSIC) return;
      if (document.hidden) return;
      if (musicShouldPlayRef.current && audio.music.paused) void audio.music.play().catch(() => {});
      if (!musicShouldPlayRef.current && audio.menu.paused) void audio.menu.play().catch(() => {});
    };
    const resumeTimer = window.setInterval(resumeActiveMusic, 900);
    document.addEventListener("visibilitychange", resumeActiveMusic);
    Object.values(audio).forEach((item) => { item.preload = "auto"; item.load(); });
    audioRefs.current = audio;
    return () => {
      musicShouldPlayRef.current = false;
      window.clearInterval(resumeTimer);
      document.removeEventListener("visibilitychange", resumeActiveMusic);
      Object.values(audio).forEach((item) => item.pause());
      activeEffectsRef.current.forEach((item) => item.pause());
      activeEffectsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (USE_NATIVE_MUSIC) {
      switchNativeMusic(screen === "playing" ? "game" : "menu");
      return;
    }
    const menu = audioRefs.current.menu;
    if (!menu) return;
    if (screen === "playing") {
      menu.pause();
      menu.currentTime = 0;
      return;
    }
    const startMenuMusic = () => {
      if (screen !== "playing" && menu.paused) void menu.play().catch(() => {});
    };
    startMenuMusic();
    window.addEventListener("pointerdown", startMenuMusic, { once: true });
    window.addEventListener("keydown", startMenuMusic, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startMenuMusic);
      window.removeEventListener("keydown", startMenuMusic);
    };
  }, [screen, switchNativeMusic]);

  useEffect(() => {
    if (!USE_NATIVE_MUSIC) return;
    void ensureNativeMusic().catch((error) => console.error("Falha ao carregar musica nativa", error));
    return () => {
      nativeMusicModeRef.current = "stopped";
      void Promise.allSettled([
        NativeAudio.unload({ assetId: NATIVE_MENU_ID }),
        NativeAudio.unload({ assetId: NATIVE_GAME_ID }),
      ]);
      nativeMusicReadyRef.current = null;
    };
  }, [ensureNativeMusic]);

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
    let balance = 0;
    let balanceVelocity = 0;
    let balancePush = (Math.random() < 0.5 ? -1 : 1) * 0.08;
    let nextBalanceShift = 1.2;
    let balanceActivatedAt = -1;
    let balanceDangerTime = 0;
    let fellAt = -1;
    const keys = new Set<string>();
    const items: FallingItem[] = [];
    const playAudio = (key: "cheer" | "burp" | "drink") => {
      const source = audioRefs.current[key];
      if (!source) return;
      if (key === "drink") {
        try { source.pause(); source.currentTime = 0; } catch {}
        void source.play().catch(() => {});
        return;
      }
      const audio = source.cloneNode(true) as HTMLAudioElement;
      audio.volume = source.volume;
      activeEffectsRef.current.add(audio);
      audio.addEventListener("ended", () => activeEffectsRef.current.delete(audio), { once: true });
      void audio.play().catch(() => activeEffectsRef.current.delete(audio));
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
      targetX = playerX;
      velocityX = 0;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) {
        event.preventDefault();
        keys.add(event.key.toLowerCase());
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
      const stillMoving = keys.has("arrowleft") || keys.has("arrowright") || keys.has("a") || keys.has("d");
      if (!stillMoving) {
        targetX = playerX;
        velocityX = 0;
      }
    };
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
      let drawH = Math.min(height * 0.225, 182);
      let drawW = drawH * (frame.width / frame.height);
      const maxWidth = width * 0.235;
      if (drawW > maxWidth) {
        drawH *= maxWidth / drawW;
        drawW = maxWidth;
      }
      const floorY = height * 0.475;
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(frame, x - drawW / 2, floorY - drawH, drawW, drawH);
      ctx.restore();
    };

    const drawBackgroundPeople = (celebrating: boolean) => {
      const suffix = celebrating ? "Cheer" : "Idle";
      [0.2, 0.4, 0.6, 0.8].forEach((position, index) => {
        const characterIndex = backgroundCastRef.current[index];
        drawBackgroundPerson(backgroundPeopleFrames.current[`person${characterIndex}${suffix}`], width * position);
      });
    };

    const drawWalker = () => {
      const sprite = walkerSpriteRefs.current[selectedCharacter];
      if (!sprite?.complete || !sprite.naturalWidth) return;
      const frames = walkerFramesRef.current[selectedCharacter];
      if (!frames.length) return;
      const halfTrip = selectedCharacter === "ginaldo" ? 5.6 : 8.5;
      const cycle = elapsed % (halfTrip * 2);
      const goingRight = cycle < halfTrip;
      const progress = goingRight ? cycle / halfTrip : (cycle - halfTrip) / halfTrip;
      const drawH = Math.min(height * 0.32, 260);
      const drawW = drawH * (frames[0].width / frames[0].height);
      const startX = -drawW * 0.7;
      const endX = width + drawW * 0.7;
      const interactionStart = 5 / 15;
      const interactionEnd = 11 / 15;
      const travelProgress = progress < interactionStart
        ? (progress / interactionStart) * 0.5
        : progress < interactionEnd
          ? 0.5
          : 0.5 + ((progress - interactionEnd) / (1 - interactionEnd)) * 0.5;
      const x = selectedCharacter === "ginaldo"
        ? goingRight
          ? startX + (endX - startX) * travelProgress
          : endX - (endX - startX) * travelProgress
        : goingRight
          ? startX + (endX - startX) * progress
          : endX - (endX - startX) * progress;
      const floorY = height * 0.67;
      const framePosition = selectedCharacter === "ginaldo" ? progress * 15 : frameClock / 0.14;
      const frameOffset = selectedCharacter === "ginaldo" && !goingRight ? 15 : 0;
      const directionFrameCount = selectedCharacter === "ginaldo" ? 15 : frames.length;
      const frameIndex = frameOffset + Math.min(directionFrameCount - 1, Math.floor(framePosition) % directionFrameCount);
      const walkWave = Math.sin(framePosition * Math.PI);
      const bob = Math.abs(walkWave) * (selectedCharacter === "ginaldo" ? 2.5 : 3);
      const bodySway = selectedCharacter === "ginaldo" ? Math.sin(framePosition * Math.PI) * 0.006 : 0;

      ctx.save();
      ctx.translate(x, bob);
      if (!goingRight && selectedCharacter !== "ginaldo") ctx.scale(-1, 1);
      ctx.rotate(bodySway);
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
        ctx.fillText(`Vai ${selectedCharacter === "jackson" ? "Jackson" : "Ginaldo"}!!`, bubbleX + bubbleW / 2, bubbleY + bubbleH / 2);
        ctx.restore();
      }
    };

    const drawPlayer = (x: number, y: number, moving: boolean) => {
      const sprite = playerSpriteRefs.current[selectedCharacter];
      if (!sprite?.complete) return;
      ctx.save();
      ctx.translate(x, 0);
      if (facing === "right") ctx.scale(-1, 1);
      const drunkRock = Math.sin(elapsed * 3.1) * Math.min(0.09, localDrunk * 0.0009);
      ctx.translate(0, y);
      ctx.rotate(drunkRock);

      const drawStanding = (alpha: number) => {
        const frame = moving ? 1 + (Math.floor(frameClock / 0.14) % 3) : 0;
        const frameImage = playerFramesRef.current[selectedCharacter][frame];
        if (!frameImage) return;
        const drawH = Math.min(height * 0.48, 390);
        const drawW = drawH * (frameImage.width / frameImage.height);
        ctx.globalAlpha = alpha;
        ctx.drawImage(frameImage, -drawW / 2, -drawH, drawW, drawH);
      };
      const drawLeaning = (alpha: number) => {
        const pose = drunkPoseRefs.current[selectedCharacter];
        if (!pose?.complete || !pose.naturalWidth) return;
        const baseDrawH = Math.min(height * 0.48, 390);
        const naturalWidth = baseDrawH * (pose.naturalWidth / pose.naturalHeight);
        const maxWidth = baseDrawH * 0.8;
        const drawH = baseDrawH * Math.min(1, maxWidth / naturalWidth);
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

    const drawFallenPlayer = () => {
      const image = fallenPlayerRefs.current[selectedCharacter];
      if (!image?.complete || !image.naturalWidth) return;
      const maxW = width * 0.88;
      const maxH = height * 0.43;
      const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
      const drawW = image.naturalWidth * scale;
      const drawH = image.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (elapsed - fellAt) * 4);
      ctx.drawImage(image, width / 2 - drawW / 2, height - 18 - drawH, drawW, drawH);
      ctx.restore();
    };

    const drawBalanceBar = () => {
      const barW = Math.min(280, width * 0.68);
      const barH = 18;
      const x = (width - barW) / 2;
      const y = 102;
      ctx.save();
      ctx.fillStyle = "rgba(10,8,6,.82)";
      ctx.strokeStyle = "rgba(255,255,255,.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 8, y - 25, barW + 16, 53, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = "800 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EQUILIBRIO", width / 2, y - 10);
      const gradient = ctx.createLinearGradient(x, 0, x + barW, 0);
      gradient.addColorStop(0, "#dc2626");
      gradient.addColorStop(0.28, "#f59e0b");
      gradient.addColorStop(0.5, "#22c55e");
      gradient.addColorStop(0.72, "#f59e0b");
      gradient.addColorStop(1, "#dc2626");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 6);
      ctx.fill();
      const markerX = x + ((balance + 1) / 2) * barW;
      ctx.fillStyle = "white";
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(markerX, y - 7);
      ctx.lineTo(markerX - 8, y + barH + 7);
      ctx.lineTo(markerX + 8, y + barH + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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
      const pointerDirection = Math.abs(targetX - playerX) > 8 ? Math.sign(targetX - playerX) : 0;
      const controlDirection = keyboardDirection || pointerDirection;
      const balanceActive = localDrunk >= 45;
      if (!balanceActive) {
        balance = 0;
        balanceVelocity = 0;
        balanceDangerTime = 0;
        balanceActivatedAt = -1;
      } else if (balanceActivatedAt < 0) {
        balanceActivatedAt = elapsed;
        nextBalanceShift = elapsed + 1.1;
      }
      if (fellAt < 0 && balanceActive) {
        const activationRamp = Math.min(1, (elapsed - balanceActivatedAt) / 2.6);
        if (elapsed >= nextBalanceShift) {
          balancePush = (Math.random() * 2 - 1) * (0.04 + intoxication * 0.13);
          nextBalanceShift = elapsed + 1.4 + Math.random() * 1.5;
        }
        const instability = (0.025 + intoxication * 0.08) * activationRamp;
        balanceVelocity += (balancePush * activationRamp + balance * instability) * dt;
        balanceVelocity *= Math.pow(0.12, dt);
        balanceVelocity = Math.max(-0.2, Math.min(0.2, balanceVelocity));
        balance += balanceVelocity * dt - controlDirection * 1.12 * dt;
        balance = Math.max(-1.05, Math.min(1.05, balance));
        balanceDangerTime = Math.abs(balance) >= 0.97 ? balanceDangerTime + dt : 0;
        if (balanceDangerTime >= 0.65) fellAt = elapsed;
      }
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
          const drunkChange = item.kind === "drink" ? 10 : ITEM_EFFECT[item.kind];
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
      ctx.save();
      const twist = intoxication < 0.5 ? 0 : 0.12 + ((intoxication - 0.5) / 0.5) * 0.88;
      const pulse = 1.025 + twist * (0.035 + Math.sin(elapsed * 1.7) * 0.012);
      ctx.translate(width / 2, height / 2);
      ctx.rotate(Math.sin(elapsed * 1.35) * twist * 0.018);
      ctx.transform(1, Math.sin(elapsed * 1.9) * twist * 0.026, Math.cos(elapsed * 1.55) * twist * 0.022, 1, 0, 0);
      ctx.scale(pulse, pulse);
      ctx.translate(-width / 2, -height / 2);
      const bg = backgroundRef.current;
      if (bg?.complete) ctx.drawImage(bg, 0, 0, width, height);
      drawBackgroundPeople(elapsed < celebrateUntil);
      drawWalker();
      ctx.save();
      const sway = Math.sin(elapsed * 2.4) * intoxication * 8;
      ctx.translate(sway, Math.cos(elapsed * 1.8) * intoxication * 3);
      items.forEach(drawItem);
      if (fellAt < 0) drawPlayer(playerX, playerY, Math.abs(playerX - previousX) > 0.25);
      else drawFallenPlayer();
      ctx.restore();
      ctx.restore();
      drawBalanceBar();

      if (secondsLeft <= 0 || (fellAt >= 0 && elapsed - fellAt >= 1.35)) {
        musicShouldPlayRef.current = false;
        if (USE_NATIVE_MUSIC) switchNativeMusic("menu");
        ["cheer", "music", "burp", "drink"].forEach((key) => {
          const audio = audioRefs.current[key];
          if (!audio) return;
          try { audio.pause(); audio.currentTime = 0; } catch {}
        });
        activeEffectsRef.current.forEach((audio) => audio.pause());
        activeEffectsRef.current.clear();
        setScore(0);
        setDrunk(0);
        setRemaining(GAME_SECONDS);
        gameStartingRef.current = false;
        setScreen("start");
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
  }, [screen, gameRun, selectedCharacter, switchNativeMusic]);

  useEffect(() => {
    if (screen !== "selection") return;
    const handleSelectionKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "a" || key === "enter") {
        playUiSound("button");
        window.setTimeout(startGame, 140);
      }
      else if (key === "b" || key === "escape") setScreen("start");
      else if (key === "arrowleft") {
        playUiSound("select");
        setSelectedCharacter("ginaldo");
      } else if (key === "arrowright") {
        playUiSound("select");
        setSelectedCharacter("jackson");
      }
    };
    window.addEventListener("keydown", handleSelectionKey);
    return () => window.removeEventListener("keydown", handleSelectionKey);
  }, [screen, startGame, playUiSound]);

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#21140d] bg-cover bg-center text-white select-none touch-none"
      style={{ backgroundImage: "url('/bar-game/bar-background.png')" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ filter: screen === "playing" ? `saturate(${1 + drunk * 0.003})` : undefined }}
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

      {screen === "start" && (
        <section className="absolute inset-0 z-20 overflow-hidden text-center">
          <img src="/bar-game/home-background.jpg" alt="Bhaskar Licores" className="absolute inset-0 h-full w-full object-cover object-center" />
          <button
            onClick={() => {
              playUiSound("button");
              const menu = audioRefs.current.menu;
              if (!USE_NATIVE_MUSIC && menu?.paused) void menu.play().catch(() => {});
              setScreen("selection");
            }}
            className="absolute bottom-[max(34px,calc(env(safe-area-inset-bottom)+22px))] left-1/2 z-10 flex min-h-16 -translate-x-1/2 items-center gap-3 rounded-md border-2 border-amber-300 bg-[#101827]/95 px-12 py-4 text-xl font-black uppercase text-amber-100 shadow-[0_0_0_3px_#713f12,0_7px_0_#422006,0_0_28px_rgba(37,99,235,0.75)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-[0_0_0_3px_#713f12,0_2px_0_#422006]"
          >
            <Play className="h-7 w-7 fill-amber-300 text-amber-300" />
            Jogar
          </button>
        </section>
      )}

      {screen === "selection" && (
        <section className="absolute inset-0 z-30 overflow-hidden bg-[linear-gradient(to_bottom,#f4e4b8_0%,#f4e4b8_62%,#0874df_62%,#0757bb_100%)]">
          <div
            className="absolute left-1/2 top-1/2 overflow-hidden -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "min(100vw, calc(100vh * 941 / 1672))",
              height: "min(100vh, calc(100vw * 1672 / 941))",
            }}
          >
            <img src={`/bar-game/selecao-${selectedCharacter}.png`} alt="Seleção de personagem" className="absolute inset-0 h-full w-full" />
            <button aria-label="Selecionar Ginaldo" onClick={() => { playUiSound("select"); setSelectedCharacter("ginaldo"); }} className="absolute bottom-[6%] left-[8%] h-[25%] w-[41%]" />
            <button aria-label="Selecionar Jackson" onClick={() => { playUiSound("select"); setSelectedCharacter("jackson"); }} className="absolute bottom-[6%] right-[8%] h-[25%] w-[41%]" />
            <button aria-label="Confirmar personagem" onClick={() => { playUiSound("button"); window.setTimeout(startGame, 140); }} className="absolute bottom-0 left-[11%] h-[7%] w-[34%]" />
            <button aria-label="Voltar" onClick={() => { playUiSound("button"); setScreen("start"); }} className="absolute bottom-0 right-[11%] h-[7%] w-[34%]" />
          </div>
        </section>
      )}

    </main>
  );
}
