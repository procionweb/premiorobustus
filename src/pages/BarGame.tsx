import { Settings, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capacitor-community/native-audio";
import { useNavigate } from "react-router-dom";
import BhaskarPrizeRoulette from "@/components/BhaskarPrizeRoulette";
import { createBarParticipantId, createBarResultId, saveBarParticipant, type BarGameResult, type BarPrize } from "@/lib/barGameDb";

type Screen = "start" | "register" | "selection" | "playing" | "thanks" | "roulette";
type Character = "jackson" | "ginaldo";
type FallingItem = { x: number; y: number; speed: number; spin: number; variant: number };
type BagDrop = { startX: number; startY: number; startedAt: number; variant: number };

const GAME_SECONDS = 30;
const THANK_YOU_MS = 3000;
const USE_NATIVE_MUSIC = Capacitor.isNativePlatform();
const NATIVE_MENU_ID = "bhaskar-menu-music";
const NATIVE_GAME_ID = "bhaskar-game-music";

export default function BarGame() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerSpriteRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const playerFramesRef = useRef<Record<Character, HTMLCanvasElement[]>>({ jackson: [], ginaldo: [] });
  const bagOpenRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const bagOpenFramesRef = useRef<Record<Character, HTMLCanvasElement[]>>({ jackson: [], ginaldo: [] });
  const backgroundPeopleRefs = useRef<Record<string, HTMLImageElement>>({});
  const backgroundPeopleFrames = useRef<Record<string, HTMLCanvasElement>>({});
  const backgroundCastRef = useRef([0, 1, 2, 3]);
  const backgroundDeckRef = useRef<number[]>([]);
  const walkerSpriteRefs = useRef<Record<Character, HTMLImageElement>>({} as Record<Character, HTMLImageElement>);
  const walkerFramesRef = useRef<Record<Character, HTMLCanvasElement[]>>({ jackson: [], ginaldo: [] });
  const bottleFramesRef = useRef<HTMLImageElement[]>([]);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const backgroundImagesRef = useRef<HTMLImageElement[]>([]);
  const currentBackgroundRef = useRef(-1);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const gameStartingRef = useRef(false);
  const activeEffectsRef = useRef<Set<HTMLAudioElement>>(new Set());
  const musicShouldPlayRef = useRef(false);
  const nativeMusicReadyRef = useRef<Promise<void> | null>(null);
  const nativeMusicModeRef = useRef<"menu" | "game" | "stopped">("stopped");
  const [screen, setScreen] = useState<Screen>("start");
  const screenRef = useRef<Screen>("start");
  const [selectedCharacter, setSelectedCharacter] = useState<Character>("jackson");
  const [gameRun, setGameRun] = useState(0);
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(GAME_SECONDS);
  const [finalResult, setFinalResult] = useState<BarGameResult | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [participantPhone, setParticipantPhone] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [savingParticipant, setSavingParticipant] = useState(false);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const submitParticipant = async () => {
    const name = participantName.trim().replace(/\s+/g, " ");
    const phone = participantPhone.replace(/\D/g, "");
    if (!name || !phone) {
      setRegisterError("Preencha o nome e o telefone para continuar.");
      return;
    }
    setSavingParticipant(true);
    setRegisterError("");
    try {
      await saveBarParticipant({ id: createBarParticipantId(), name, phone: formatPhone(phone), createdAt: new Date().toISOString() });
      setScreen("selection");
    } catch (error) {
      console.error("Falha ao salvar participante offline", error);
      setRegisterError("Não foi possível salvar neste aparelho. Tente novamente.");
    } finally {
      setSavingParticipant(false);
    }
  };

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
    ["cheer", "music", "menu", "drink"].forEach((key) => {
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
    const backgrounds = backgroundImagesRef.current;
    if (backgrounds.length) {
      let nextBackground = Math.floor(Math.random() * backgrounds.length);
      if (backgrounds.length > 1 && nextBackground === currentBackgroundRef.current) nextBackground = (nextBackground + 1) % backgrounds.length;
      currentBackgroundRef.current = nextBackground;
      backgroundRef.current = backgrounds[nextBackground];
    }
    setScore(0);
    setRemaining(GAME_SECONDS);
    setFinalResult(null);
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
    const backgroundSources = [
      "/bar-game/bar-background.png",
      "/bar-game/bar-background-2.png",
      "/bar-game/bar-background-3.png",
      "/bar-game/bar-background-4.png",
    ];
    backgroundImagesRef.current = backgroundSources.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    backgroundRef.current = backgroundImagesRef.current[0];
    ["jackson", "ginaldo"].forEach((character) => {
      const selection = new Image();
      selection.src = `/bar-game/selecao-${character}.png`;
    });
    const players: Record<Character, string> = {
      jackson: "/bar-game/jackson-bag-walk-sprites.png",
      ginaldo: "/bar-game/ginaldo-bag-walk-sprites.png",
    };
    Object.entries(players).forEach(([key, src]) => {
      const image = new Image();
      image.src = src;
      playerSpriteRefs.current[key as Character] = image;
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
    const isolateOpenBagPose = (image: HTMLImageElement, column: number) => {
      const cellW = Math.floor(image.naturalWidth / 2);
      const frame = document.createElement("canvas");
      frame.width = cellW;
      frame.height = image.naturalHeight;
      const frameCtx = frame.getContext("2d", { willReadFrequently: true });
      if (!frameCtx) return frame;
      frameCtx.drawImage(image, column * cellW, 0, cellW, image.naturalHeight, 0, 0, cellW, image.naturalHeight);
      const pixels = frameCtx.getImageData(0, 0, cellW, image.naturalHeight);
      const total = cellW * image.naturalHeight;
      const visited = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;
      const enqueue = (index: number) => {
        if (visited[index]) return;
        const p = index * 4;
        const r = pixels.data[p];
        const g = pixels.data[p + 1];
        const b = pixels.data[p + 2];
        // The source sheet uses a neutral preview matte. Flood only that matte
        // from the canvas edges so light clothes remain intact behind the outline.
        if (r < 175 || g < 175 || b < 175 || Math.max(r, g, b) - Math.min(r, g, b) > 35) return;
        visited[index] = 1;
        queue[tail++] = index;
      };
      for (let x = 0; x < cellW; x++) {
        enqueue(x);
        enqueue((image.naturalHeight - 1) * cellW + x);
      }
      for (let y = 0; y < image.naturalHeight; y++) {
        enqueue(y * cellW);
        enqueue(y * cellW + cellW - 1);
      }
      while (head < tail) {
        const index = queue[head++];
        const x = index % cellW;
        if (x > 0) enqueue(index - 1);
        if (x < cellW - 1) enqueue(index + 1);
        if (index >= cellW) enqueue(index - cellW);
        if (index < total - cellW) enqueue(index + cellW);
      }
      for (let index = 0; index < total; index++) {
        if (visited[index]) pixels.data[index * 4 + 3] = 0;
      }
      frameCtx.putImageData(pixels, 0, 0);
      return frame;
    };
    (Object.keys(players) as Character[]).forEach((character) => {
      const image = playerSpriteRefs.current[character];
      const prepareFrames = () => {
        playerFramesRef.current[character] = [0, 1, 2, 3, 4].map((column) =>
          isolatePerson(image, column, 5, 0, character === "ginaldo" ? 1.35 : 1),
        );
      };
      if (image.complete && image.naturalWidth) prepareFrames();
      else image.addEventListener("load", prepareFrames, { once: true });
    });
    const openBagSources: Record<Character, string> = {
      jackson: "/bar-game/jackson-bag-open-sprites.png",
      ginaldo: "/bar-game/ginaldo-bag-open-sprites.png",
    };
    (Object.keys(openBagSources) as Character[]).forEach((character) => {
      const image = new Image();
      image.src = openBagSources[character];
      bagOpenRefs.current[character] = image;
      image.onload = () => {
        bagOpenFramesRef.current[character] = character === "jackson"
          ? [0, 1].map((column) => isolateOpenBagPose(image, column))
          : [0, 1].map((column) => isolatePerson(image, column, 2, 0, 1, 1, 1));
      };
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
    ginaldoWalker.src = "/bar-game/eduardo-walker-sprites-v5.png";
    walkerSpriteRefs.current.ginaldo = ginaldoWalker;
    ginaldoWalker.onload = () => {
      walkerFramesRef.current.ginaldo = [1, 2, 3, 4].map((column) =>
        isolatePerson(ginaldoWalker, column, 5, 0, 1.42, 2, 1.14),
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
    const audio = {
      cheer: new Audio("/bar-game/audio/comemoracao.mp3"),
      music: new Audio("/bar-game/audio/musica-fundo.mp3?v=android-audio-2"),
      menu: new Audio("/bar-game/audio/musica-menu.mp3?v=android-audio-2"),
      uiButton: new Audio("/bar-game/audio/botao.mp3"),
      uiSelect: new Audio("/bar-game/audio/select.wav"),
      drink: new Audio("/bar-game/audio/bebida.mp3"),
    };
    audio.music.loop = true;
    audio.music.volume = 0.18;
    audio.menu.loop = true;
    audio.menu.volume = 0.2;
    audio.uiButton.volume = 0.75;
    audio.uiSelect.volume = 0.72;
    audio.cheer.volume = 0.2;
    audio.drink.volume = 0.95;
    const resumeActiveMusic = () => {
      if (USE_NATIVE_MUSIC) return;
      if (document.hidden) return;
      if (screenRef.current === "playing" && audio.music.paused) void audio.music.play().catch(() => {});
      if (["start", "register", "selection"].includes(screenRef.current) && audio.menu.paused) void audio.menu.play().catch(() => {});
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
      switchNativeMusic(screen === "playing" ? "game" : ["thanks", "roulette"].includes(screen) ? "stopped" : "menu");
      return;
    }
    const menu = audioRefs.current.menu;
    if (!menu) return;
    if (["playing", "thanks", "roulette"].includes(screen)) {
      menu.pause();
      menu.currentTime = 0;
      return;
    }
    const startMenuMusic = () => {
      if (["start", "register", "selection"].includes(screen) && menu.paused) void menu.play().catch(() => {});
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
    if (screen !== "thanks" || !finalResult) return;
    const timer = window.setTimeout(() => setScreen("roulette"), THANK_YOU_MS);
    return () => window.clearTimeout(timer);
  }, [screen, finalResult]);

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
    let frameClock = 0;
    let facing: "left" | "right" = "right";
    let velocityX = 0;
    let dragging = false;
    let celebrateUntil = 0;
    let bagOpenUntil = 0;
    let bagDrop: BagDrop | null = null;
    let lastCheerAt = -3;
    const keys = new Set<string>();
    const items: FallingItem[] = [];
    const playAudio = (key: "cheer" | "drink") => {
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
      const bottle = bottleFramesRef.current[item.variant % 9];
      if (bottle) {
        const drawH = 94;
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
      const framePosition = frameClock / 0.14;
      const frameIndex = Math.floor(framePosition) % frames.length;
      const walkWave = Math.sin(framePosition * Math.PI);
      const bob = Math.abs(walkWave) * (selectedCharacter === "ginaldo" ? 2.5 : 3);
      const bodySway = selectedCharacter === "ginaldo" ? Math.sin(framePosition * Math.PI) * 0.006 : 0;

      ctx.save();
      ctx.translate(x, bob);
      if (!goingRight) ctx.scale(-1, 1);
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
      ctx.translate(0, y);
      const openBagFrames = bagOpenFramesRef.current[selectedCharacter];
      const useOpenBag = elapsed < bagOpenUntil && openBagFrames.length;
      const frameImage = useOpenBag
        ? openBagFrames[facing === "right" ? 1 : 0]
        : playerFramesRef.current[selectedCharacter][moving ? 1 + (Math.floor(frameClock / 0.14) % 3) : 0];
      if (frameImage) {
        const drawH = Math.min(height * 0.57, width * 1.32, 560);
        const drawW = drawH * (frameImage.width / frameImage.height);
        ctx.drawImage(frameImage, -drawW / 2, -drawH, drawW, drawH);
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

      const previousX = playerX;
      const keyboardDirection = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      const pointerDirection = Math.abs(targetX - playerX) > 8 ? Math.sign(targetX - playerX) : 0;
      if (keyboardDirection !== 0) {
        targetX = Math.max(45, Math.min(width - 45, targetX + keyboardDirection * 330 * dt));
      }
      const delayedTarget = targetX;
      const response = 10;
      const desiredVelocity = (delayedTarget - playerX) * response;
      const maxSpeed = 520;
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
        items.push({ x: 30 + Math.random() * (width - 60), y: -40, speed: 150 + Math.random() * 95, spin: 0, variant: Math.floor(Math.random() * 9) });
      }

      const playerY = height - (selectedCharacter === "ginaldo" ? 58 : 28);
      const playerHeight = Math.min(height * 0.57, width * 1.32, 560);
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.speed * dt;
        item.spin += dt * 2;
        if (item.y > playerY - playerHeight && item.y < playerY && Math.abs(item.x - playerX) < 82) {
          items.splice(i, 1);
          localScore += 10;
          bagDrop = { startX: item.x, startY: item.y, startedAt: elapsed, variant: item.variant };
          bagOpenUntil = elapsed + 0.8;
          celebrateUntil = elapsed + 1.15;
          playAudio("drink");
          if (elapsed - lastCheerAt >= 3) {
            playAudio("cheer");
            lastCheerAt = elapsed;
          }
          setScore(localScore);
        } else if (item.y > height + 40) {
          items.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, width, height);
      const bg = backgroundRef.current;
      if (bg?.complete) ctx.drawImage(bg, 0, 0, width, height);
      drawBackgroundPeople(elapsed < celebrateUntil);
      drawWalker();
      items.forEach(drawItem);
      if (bagDrop) {
        const progress = Math.min(1, (elapsed - bagDrop.startedAt) / 0.48);
        const eased = 1 - Math.pow(1 - progress, 3);
        const bagMouthX = playerX + (facing === "right" ? 58 : -58);
        const bagMouthY = playerY - playerHeight * 0.55;
        drawItem({
          x: bagDrop.startX + (bagMouthX - bagDrop.startX) * eased,
          y: bagDrop.startY + (bagMouthY - bagDrop.startY) * eased,
          speed: 0,
          spin: progress * Math.PI * 1.5,
          variant: bagDrop.variant,
        });
        if (progress >= 1) bagDrop = null;
      }
      drawPlayer(playerX, playerY, Math.abs(playerX - previousX) > 0.25 && elapsed >= bagOpenUntil);

      if (secondsLeft <= 0) {
        stopped = true;
        musicShouldPlayRef.current = false;
        if (USE_NATIVE_MUSIC) switchNativeMusic("stopped");
        ["cheer", "music", "drink"].forEach((key) => {
          const audio = audioRefs.current[key];
          if (!audio) return;
          try { audio.pause(); audio.currentTime = 0; } catch {}
        });
        activeEffectsRef.current.forEach((audio) => audio.pause());
        activeEffectsRef.current.clear();
        const result: BarGameResult = {
          id: createBarResultId(),
          playedAt: new Date().toISOString(),
          character: selectedCharacter,
          score: localScore,
          drunk: 0,
          outcome: "time",
          prizeId: null,
          prizeName: null,
        };
        setScore(localScore);
        setRemaining(0);
        setFinalResult(result);
        gameStartingRef.current = false;
        setScreen("thanks");
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
      />

      {screen === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 pt-[max(16px,env(safe-area-inset-top))]">
          <div className="min-w-32 rounded-md border border-white/25 bg-black/70 px-5 py-3 text-center shadow-lg">
            <span className="block text-[10px] font-bold uppercase text-amber-300">Pontos</span>
            <strong className="text-3xl">{score}</strong>
          </div>
          <div className="min-w-32 rounded-md border border-white/25 bg-black/70 px-5 py-3 text-center shadow-lg">
            <span className="block text-[10px] font-bold uppercase text-amber-300">Tempo</span>
            <strong className="text-3xl">{remaining}s</strong>
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
              setParticipantName("");
              setParticipantPhone("");
              setRegisterError("");
              setScreen("register");
            }}
            className="absolute bottom-[max(34px,calc(env(safe-area-inset-bottom)+22px))] left-1/2 z-10 flex min-h-16 -translate-x-1/2 items-center gap-3 rounded-md border-2 border-amber-300 bg-[#101827]/95 px-12 py-4 text-xl font-black uppercase text-amber-100 shadow-[0_0_0_3px_#713f12,0_7px_0_#422006,0_0_28px_rgba(37,99,235,0.75)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-[0_0_0_3px_#713f12,0_2px_0_#422006]"
          >
            <Play className="h-7 w-7 fill-amber-300 text-amber-300" />
            Jogar
          </button>
          <button onClick={() => navigate("/bar-game/admin")} aria-label="Abrir administração" className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-20 rounded-md border border-white/25 bg-black/45 p-3 text-white/70 backdrop-blur-sm" title="Administração"><Settings /></button>
        </section>
      )}

      {screen === "register" && (
        <section className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-[radial-gradient(circle_at_50%_12%,rgba(180,105,25,.26),transparent_35%),linear-gradient(180deg,#24130b,#100806)] p-5 pt-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] touch-pan-y">
          <form
            onSubmit={(event) => { event.preventDefault(); void submitParticipant(); }}
            className="w-full max-w-md rounded-md border-2 border-amber-500/70 bg-[#160d09]/95 p-6 shadow-[0_0_0_4px_rgba(70,35,10,.9),0_24px_70px_rgba(0,0,0,.65)]"
          >
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[.28em] text-amber-400">Bhaskar Licores</p>
              <h1 className="mt-2 text-3xl font-black uppercase text-amber-100">Antes de jogar</h1>
              <p className="mt-2 text-sm text-amber-100/75">Preencha seus dados para continuar.</p>
            </div>

            <label className="mt-7 block text-sm font-black uppercase text-amber-300" htmlFor="participant-name">Nome</label>
            <input
              id="participant-name"
              autoFocus
              autoComplete="name"
              maxLength={80}
              value={participantName}
              onChange={(event) => { setParticipantName(event.target.value); setRegisterError(""); }}
              className="mt-2 min-h-14 w-full rounded-md border border-amber-400/55 bg-[#2b211c] px-4 text-lg text-amber-50 outline-none placeholder:text-amber-100/30 focus:border-amber-300 focus:ring-2 focus:ring-amber-400/25"
              placeholder="Digite seu nome"
            />

            <label className="mt-5 block text-sm font-black uppercase text-amber-300" htmlFor="participant-phone">Telefone</label>
            <input
              id="participant-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={participantPhone}
              onChange={(event) => { setParticipantPhone(formatPhone(event.target.value)); setRegisterError(""); }}
              className="mt-2 min-h-14 w-full rounded-md border border-amber-400/55 bg-[#2b211c] px-4 text-lg text-amber-50 outline-none placeholder:text-amber-100/30 focus:border-amber-300 focus:ring-2 focus:ring-amber-400/25"
              placeholder="(00) 00000-0000"
            />

            {registerError && <p role="alert" className="mt-4 rounded-md border border-red-400/35 bg-red-950/50 p-3 text-center text-sm font-bold text-red-200">{registerError}</p>}

            <button
              type="submit"
              disabled={savingParticipant || !participantName.trim() || !participantPhone.replace(/\D/g, "")}
              className="mt-7 min-h-14 w-full rounded-md border-2 border-amber-200 bg-gradient-to-b from-amber-400 to-amber-600 text-lg font-black uppercase text-[#271207] shadow-[0_5px_0_#713f12] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingParticipant ? "Salvando..." : "Continuar"}
            </button>
            <button type="button" onClick={() => setScreen("start")} className="mt-4 min-h-11 w-full text-sm font-bold uppercase text-amber-200/75">Voltar</button>
          </form>
        </section>
      )}

      {screen === "selection" && (
        <section className="absolute inset-0 z-30 overflow-hidden bg-[linear-gradient(to_bottom,#f4e4b8_0%,#f4e4b8_62%,#0874df_62%,#0757bb_100%)]">
          <div
            className="absolute left-1/2 top-1/2 overflow-hidden -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "min(100vw, calc(100vh * 853 / 1844))",
              height: "min(100vh, calc(100vw * 1844 / 853))",
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

      {screen === "thanks" && finalResult && (
        <section className="absolute inset-0 z-40 overflow-hidden bg-[#071d1b] text-center">
          <style>{`
            @keyframes thanks-character-in { from { opacity: 0; transform: translate(-50%, 8%) scale(.9); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
            @keyframes thanks-copy-in { from { opacity: 0; transform: translateY(-18px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
          <img src="/bar-game/bar-background.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-5 top-[max(7dvh,env(safe-area-inset-top))] z-10 animate-[thanks-copy-in_.55s_ease-out_both]">
            <p className="text-[clamp(12px,2.5vw,18px)] font-black uppercase tracking-[.3em] text-amber-300">Bhaskar Licores</p>
            <h1 className="mx-auto mt-3 max-w-[620px] font-sans text-[clamp(36px,9vw,68px)] font-black uppercase leading-[.98] text-white [text-shadow:0_4px_0_#154d4c,0_8px_24px_rgba(0,0,0,.75)]">
              Obrigado por jogar nosso jogo!
            </h1>
            <p className="mt-4 text-[clamp(15px,3.5vw,22px)] font-black uppercase tracking-[.12em] text-[#fff0a6]">Aguarde seu prêmio</p>
          </div>
          <div className="absolute bottom-0 left-1/2 h-[72dvh] w-[min(96vw,720px)] animate-[thanks-character-in_.6s_.12s_ease-out_both]">
            <img
              src={`/bar-game/thanks-${selectedCharacter}.png`}
              alt={selectedCharacter === "jackson" ? "Jackson agradecendo" : "Ginaldo agradecendo"}
              className={`h-full w-full object-contain object-bottom ${selectedCharacter === "ginaldo" ? "origin-bottom scale-[1.68]" : ""}`}
            />
          </div>
        </section>
      )}

      {screen === "roulette" && finalResult && (
        <BhaskarPrizeRoulette
          score={finalResult.score}
          onPrize={(prize: BarPrize) => {
            const updated = { ...finalResult, prizeId: prize.id, prizeName: prize.name };
            setFinalResult(updated);
          }}
          onFinish={() => {
            setScore(0);
            setRemaining(GAME_SECONDS);
            setFinalResult(null);
            setParticipantName("");
            setParticipantPhone("");
            setScreen("start");
          }}
        />
      )}

    </main>
  );
}
