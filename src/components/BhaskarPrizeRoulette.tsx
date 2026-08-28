import { RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBarPrizes, type BarPrize } from "@/lib/barGameDb";

interface Props { score: number; onPrize: (prize: BarPrize) => void; onFinish: () => void; }

function pickPrize(prizes: BarPrize[]) {
  const total = prizes.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
  let value = Math.random() * total;
  return prizes.find((prize) => (value -= Math.max(0, prize.weight)) <= 0) ?? prizes[prizes.length - 1];
}

function PrizeFace({ prize }: { prize: BarPrize | undefined }) {
  if (!prize) return <span className="text-lg font-black text-[#174b42]">...</span>;
  const percentage = prize.name.match(/\d+%/)?.[0];
  const hasBottle = ["dupla", "leve-4", "off-275", "super-275"].includes(prize.id) || /garrafa|275 ml/i.test(prize.name);
  if (hasBottle) {
    return <div className="flex h-full w-full flex-col items-center justify-center gap-0.5"><img src="/bar-game/bottles/manga-maracuja.png" alt="" className="h-[62%] max-w-[45%] object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,.42)]" /><span className="line-clamp-2 px-1 text-[clamp(7px,2vw,10px)] font-black uppercase leading-none text-[#173f37]">{prize.name}</span></div>;
  }
  if (percentage) {
    return <div className="flex flex-col items-center justify-center"><strong className="text-[clamp(22px,7vw,34px)] font-black leading-none text-[#174c42] [text-shadow:0_2px_0_#fff]">{percentage}</strong><span className="mt-1 text-[8px] font-black uppercase tracking-wide text-[#8b3d21]">desconto</span></div>;
  }
  return <span className="line-clamp-3 px-1 text-[clamp(8px,2.2vw,11px)] font-black uppercase leading-tight text-[#174b42]">{prize.name}</span>;
}

export default function BhaskarPrizeRoulette({ score, onPrize, onFinish }: Props) {
  const [prizes, setPrizes] = useState<BarPrize[]>([]);
  const [reels, setReels] = useState([0, 0, 0]);
  const [reelDurations, setReelDurations] = useState([0, 0, 0]);
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<BarPrize | null>(null);
  const timers = useRef<number[]>([]);
  const wheelAudio = useRef<HTMLAudioElement | null>(null);
  const prizeAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void getBarPrizes().then((items) => setPrizes(items.filter((item) => item.enabled && item.weight > 0)));
    const audio = new Audio("/bar-game/audio/roleta.mp3");
    audio.preload = "auto";
    audio.volume = 0.9;
    audio.load();
    wheelAudio.current = audio;
    const winnerAudio = new Audio("/bar-game/audio/premio.mp3");
    winnerAudio.preload = "auto";
    winnerAudio.volume = 0.95;
    winnerAudio.load();
    prizeAudio.current = winnerAudio;
    return () => {
      timers.current.forEach(window.clearTimeout);
      audio.pause();
      audio.currentTime = 0;
      winnerAudio.pause();
      winnerAudio.currentTime = 0;
    };
  }, []);

  const strip = useMemo(() => Array.from({ length: prizes.length * 12 }, (_, index) => prizes[index % prizes.length]), [prizes]);

  const spin = () => {
    if (spinning || chosen || !prizes.length) return;
    setSpinning(true);
    const audio = wheelAudio.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    }
    const winner = pickPrize(prizes);
    const winnerIndex = prizes.findIndex((prize) => prize.id === winner.id);
    const stopTimes = [3200, 3700, 4200];
    const targets = stopTimes.map((_, reelIndex) => (8 + reelIndex) * prizes.length + winnerIndex);
    setReelDurations(stopTimes);
    timers.current.push(window.setTimeout(() => setReels(targets), 30));
    timers.current.push(window.setTimeout(() => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setChosen(winner);
      setSpinning(false);
      const winnerSound = prizeAudio.current;
      if (winnerSound) {
        winnerSound.pause();
        winnerSound.currentTime = 0;
        void winnerSound.play().catch(() => {});
      }
      onPrize(winner);
    }, stopTimes[2] + 100));
  };

  return (
    <section className="absolute inset-0 z-50 min-h-[100dvh] overflow-hidden bg-[#f9b719] text-center text-[#153f38]">
      <style>{`@keyframes bhaskar-prize-flash { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.9) saturate(1.35); box-shadow: 0 0 24px 8px rgba(255,255,190,.95), inset 0 0 18px rgba(255,255,255,.9); } }`}</style>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#269d88_0_14%,transparent_14%_87%,#197c79_87%_100%),repeating-conic-gradient(from_245deg_at_50%_48%,rgba(255,255,255,.14)_0deg_8deg,transparent_8deg_18deg),linear-gradient(155deg,#ffd83d,#ff9d13)]" />
      <div className="relative z-10 mx-auto flex h-full min-h-[100dvh] w-full max-w-[430px] flex-col items-center overflow-hidden px-[clamp(14px,4vw,20px)] py-[clamp(12px,2dvh,18px)]">
        <header className="relative flex w-[92%] shrink-0 flex-col items-center justify-center rounded-md border-[3px] border-white bg-[linear-gradient(180deg,#42c1a5,#188a80)] px-4 py-[clamp(8px,1.4dvh,13px)] shadow-[0_0_0_3px_#174b4d,0_6px_0_#0d6662,0_9px_18px_rgba(0,0,0,.25)]">
          <h1 className="font-sans text-[clamp(26px,7.5vw,38px)] font-black uppercase tracking-[0.04em] text-white [text-shadow:0_3px_0_#154d4c]">Super Prêmio</h1>
          <span className="mt-1 whitespace-nowrap rounded-full bg-[#155d59] px-4 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#fff2a4]">Fim de jogo · {score} pontos</span>
        </header>

        <button type="button" onClick={spin} disabled={spinning || !!chosen || !prizes.length} className="relative mt-[clamp(108px,15dvh,142px)] w-full select-none rounded-md border-[4px] border-white bg-[linear-gradient(180deg,#42b99d,#16847c)] p-2.5 shadow-[0_0_0_4px_#19615e,0_9px_0_#0d615d,0_14px_26px_rgba(74,47,0,.35)] disabled:cursor-default">
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[32%] w-[calc(100%+14px)] -translate-x-1/2 -translate-y-1/2 border-y-[3px] border-white bg-[#ffe86b]/12 shadow-[0_0_0_2px_#f49422,0_0_16px_rgba(255,245,142,.85)]" />
          <div className="grid h-[min(61vw,264px)] grid-cols-3 gap-2 overflow-hidden rounded-sm bg-[#135e5b] p-2 shadow-[inset_0_0_15px_rgba(0,0,0,.38)]">
            {reels.map((centerIndex, reelIndex) => (
              <div key={reelIndex} className="relative overflow-hidden rounded-sm border-[3px] border-white bg-[#dff4d3] shadow-[0_0_0_2px_#f39a21,inset_0_0_10px_rgba(0,0,0,.2)]" style={chosen ? { animation: `bhaskar-prize-flash 360ms ease-in-out ${4 + reelIndex}` } : undefined}>
                <div
                  className="absolute left-0 top-1/3 w-full will-change-transform"
                  style={{
                    height: `${strip.length * 100 / 3}%`,
                    transform: `translateY(-${strip.length ? centerIndex * 100 / strip.length : 0}%)`,
                    transition: reelDurations[reelIndex] ? `transform ${reelDurations[reelIndex]}ms cubic-bezier(.12,.58,.1,1)` : "none",
                  }}
                >
                  {strip.map((prize, itemIndex) => (
                    <div key={`${prize?.id ?? "loading"}-${itemIndex}`} className={`flex items-center justify-center border-y-2 border-[#74b756] px-1 ${itemIndex % 2 ? "bg-[linear-gradient(180deg,#f8fff1,#bfe98d)]" : "bg-[linear-gradient(180deg,#fff9d1,#f4c95b)]"}`} style={{ height: `${100 / strip.length}%` }}>
                      <PrizeFace prize={prize} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!chosen && <div className="mt-3 flex items-center justify-center gap-2 rounded-sm bg-[#155f5b] py-2 font-sans text-[11px] font-black uppercase tracking-[0.12em] text-white [text-shadow:0_1px_2px_#174f4c]"><Sparkles size={15} />{spinning ? "Sorteando..." : prizes.length ? "Toque para sortear" : "Carregando prêmios..."}</div>}
        </button>

        <div className="mt-auto flex w-full flex-col items-center justify-end pt-3">
          {chosen && <div className="mb-[clamp(8px,1.4dvh,14px)] w-[calc(100%-14px)] max-w-[365px] rounded-md border-[3px] border-white bg-[linear-gradient(180deg,#fff7b8,#ffd34d)] px-4 py-3 text-[#174b42] shadow-[0_0_0_3px_#1b6762,0_7px_0_#0d5b58,0_11px_22px_rgba(0,0,0,.28)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a34821]">Você ganhou</p>
            <strong className="mt-1 block font-sans text-xl font-black uppercase tracking-wide text-[#174b42] drop-shadow-[0_2px_0_#fff]">{chosen.name}</strong>
            <p className="mx-auto mt-1.5 max-w-[310px] text-xs font-bold leading-snug text-[#653817]">{chosen.description}</p>
            <button onClick={(event) => { event.stopPropagation(); onFinish(); }} className="mt-3 inline-flex min-h-10 w-[68%] max-w-[230px] items-center justify-center gap-2 rounded-md border-2 border-white bg-[#218f83] px-3 font-sans text-[13px] font-black uppercase text-white shadow-[0_4px_0_#0d5d59] active:translate-y-0.5 active:shadow-none"><RotateCcw size={16} /> Voltar ao início</button>
          </div>}
        </div>
      </div>
    </section>
  );
}
