import { RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBarPrizes, type BarPrize } from "@/lib/barGameDb";

interface Props { score: number; onPrize: (prize: BarPrize) => void; onFinish: () => void; }

function pickPrize(prizes: BarPrize[]) {
  const total = prizes.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
  let value = Math.random() * total;
  return prizes.find((prize) => (value -= Math.max(0, prize.weight)) <= 0) ?? prizes[prizes.length - 1];
}

export default function BhaskarPrizeRoulette({ score, onPrize, onFinish }: Props) {
  const [prizes, setPrizes] = useState<BarPrize[]>([]);
  const [reels, setReels] = useState([0, 1, 2]);
  const [reelDurations, setReelDurations] = useState([0, 0, 0]);
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<BarPrize | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    void getBarPrizes().then((items) => setPrizes(items.filter((item) => item.enabled && item.weight > 0)));
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const strip = useMemo(() => Array.from({ length: prizes.length * 12 }, (_, index) => prizes[index % prizes.length]), [prizes]);

  const spin = () => {
    if (spinning || chosen || !prizes.length) return;
    setSpinning(true);
    const winner = pickPrize(prizes);
    const winnerIndex = prizes.findIndex((prize) => prize.id === winner.id);
    const stopTimes = [3200, 3700, 4200];
    const targets = stopTimes.map((_, reelIndex) => (8 + reelIndex) * prizes.length + winnerIndex);
    setReelDurations(stopTimes);
    timers.current.push(window.setTimeout(() => setReels(targets), 30));
    timers.current.push(window.setTimeout(() => {
      setChosen(winner);
      setSpinning(false);
      onPrize(winner);
    }, stopTimes[2] + 100));
  };

  return (
    <section className="absolute inset-0 z-50 min-h-[100dvh] overflow-hidden bg-[#05080c] text-center text-amber-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,8,16,.18),rgba(0,5,12,.32)),url('/bar-game/roulette-scene-v3.png')] bg-cover bg-center" />
      <div className="relative z-10 mx-auto flex h-full min-h-[100dvh] w-full max-w-[430px] flex-col items-center overflow-hidden px-[clamp(16px,4.5vw,22px)] py-[clamp(12px,2dvh,18px)]">
        <header className="relative flex w-[90%] shrink-0 flex-col items-center justify-center rounded-md border-2 border-[#c58a2d] bg-[linear-gradient(180deg,rgba(8,28,48,.97),rgba(2,12,23,.99))] px-4 py-[clamp(8px,1.4dvh,13px)] shadow-[0_0_0_3px_#3e2309,0_0_0_5px_#8f571b,0_8px_24px_#000] before:absolute before:inset-[5px] before:rounded-sm before:border before:border-[#e0b352]/40">
          <span className="absolute -top-3 h-6 w-6 rotate-45 border-2 border-[#e1b552] bg-[#126fa5] shadow-[0_0_10px_#38bdf8]" />
          <h1 className="font-serif text-[clamp(27px,7.5vw,38px)] font-black uppercase tracking-[0.09em] text-[#efc76d] [text-shadow:0_2px_2px_#000,0_0_12px_rgba(217,154,50,.38)]">Prêmios</h1>
          <span className="mt-1 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.16em] text-[#e9c36d] [text-shadow:0_1px_3px_#000]">Fim de jogo · {score} pontos</span>
        </header>

        <button type="button" onClick={spin} disabled={spinning || !!chosen || !prizes.length} className="relative mt-[clamp(46px,7dvh,68px)] w-full select-none rounded-md border-[3px] border-[#d29a3b] bg-[linear-gradient(180deg,#0b2438,#061522)] p-2 shadow-[0_0_0_3px_#3b2109,0_0_0_6px_#8d5518,0_12px_30px_#000,inset_0_0_24px_rgba(30,144,190,.18)] disabled:cursor-default">
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[31%] w-[calc(100%+18px)] -translate-x-1/2 -translate-y-1/2 border-y-2 border-[#f1c65e] bg-[#c9a13b]/10 shadow-[0_0_12px_rgba(246,199,91,.55),inset_0_0_12px_rgba(255,212,94,.2)]" />
          <div className="grid h-[min(63vw,278px)] grid-cols-3 gap-2 overflow-hidden rounded-sm bg-[#02080d] p-2 shadow-[inset_0_0_20px_#000]">
            {reels.map((centerIndex, reelIndex) => (
              <div key={reelIndex} className="relative overflow-hidden rounded-sm border-2 border-[#a86d1d] bg-[#071623] shadow-[inset_0_0_14px_#000]">
                <div
                  className="absolute left-0 top-1/3 w-full will-change-transform"
                  style={{
                    height: `${strip.length * 100 / 3}%`,
                    transform: `translateY(-${strip.length ? centerIndex * 100 / strip.length : 0}%)`,
                    transition: reelDurations[reelIndex] ? `transform ${reelDurations[reelIndex]}ms cubic-bezier(.12,.58,.1,1)` : "none",
                  }}
                >
                  {strip.map((prize, itemIndex) => (
                    <div key={`${prize?.id ?? "loading"}-${itemIndex}`} className={`flex items-center justify-center border-y border-[#d4a443]/35 px-1.5 ${itemIndex % 2 ? "bg-[linear-gradient(180deg,#123044,#091c2c)]" : "bg-[linear-gradient(180deg,#194b41,#0d302d)]"}`} style={{ height: `${100 / strip.length}%` }}>
                      <span className="line-clamp-3 font-sans text-[clamp(8px,2.35vw,11px)] font-black uppercase leading-[1.08] text-[#ffe49a] [text-shadow:0_1px_3px_#000]">{prize?.name ?? "..."}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!chosen && <div className="mt-3 flex items-center justify-center gap-2 py-1 font-sans text-[11px] font-black uppercase tracking-[0.12em] text-[#efd17d] [text-shadow:0_1px_3px_#000]"><Sparkles size={15} />{spinning ? "Sorteando..." : prizes.length ? "Toque para sortear" : "Carregando prêmios..."}</div>}
        </button>

        <div className="mt-auto flex w-full flex-col items-center justify-end pt-3">
          {chosen && <div className="mb-[clamp(8px,1.4dvh,14px)] w-[calc(100%-14px)] max-w-[365px] rounded-md border-2 border-[#c68a2e] bg-[linear-gradient(180deg,rgba(5,26,45,.98),rgba(2,12,23,.99))] px-4 py-3 shadow-[0_0_0_3px_#3b2108,0_0_0_5px_#8e561a,0_8px_24px_#000]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#dcae52]">Seu prêmio</p>
            <strong className="mt-1 block font-serif text-xl font-black uppercase tracking-wide text-[#f7d77c] drop-shadow-[0_2px_2px_#000]">{chosen.name}</strong>
            <p className="mx-auto mt-1.5 max-w-[310px] text-xs font-semibold leading-snug text-[#f7e7bd]">{chosen.description}</p>
            <button onClick={(event) => { event.stopPropagation(); onFinish(); }} className="mt-3 inline-flex min-h-10 w-[68%] max-w-[230px] items-center justify-center gap-2 rounded-full border border-[#e2b65b] bg-[#8b4d12] px-3 font-serif text-[13px] font-black uppercase text-[#fff0bd] shadow-[0_3px_0_#3b2109] [text-shadow:0_1px_3px_#000] active:translate-y-0.5 active:shadow-none"><RotateCcw size={16} /> Voltar ao início</button>
          </div>}
        </div>
      </div>
    </section>
  );
}
