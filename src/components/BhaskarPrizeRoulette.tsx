import { Gift, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBarPrizes, type BarPrize } from "@/lib/barGameDb";

interface Props {
  score: number;
  onPrize: (prize: BarPrize) => void;
  onFinish: () => void;
}

function pickPrize(prizes: BarPrize[]) {
  const total = prizes.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
  let value = Math.random() * total;
  return prizes.find((prize) => (value -= Math.max(0, prize.weight)) <= 0) ?? prizes[prizes.length - 1];
}

export default function BhaskarPrizeRoulette({ score, onPrize, onFinish }: Props) {
  const [prizes, setPrizes] = useState<BarPrize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [chosen, setChosen] = useState<BarPrize | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    void getBarPrizes().then((items) => setPrizes(items.filter((item) => item.enabled && item.weight > 0)));
  }, []);

  const wheel = useMemo(() => {
    const count = Math.max(1, prizes.length);
    const colors = ["#112d46", "#4b1820", "#173c25", "#25152f", "#4a2c0d", "#0f3a32", "#451923", "#16304e"];
    return `conic-gradient(${Array.from({ length: count }, (_, index) => {
      const start = (index / count) * 100;
      const end = ((index + 1) / count) * 100;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    }).join(",")})`;
  }, [prizes]);

  const spin = () => {
    if (spinning || decided.current || !prizes.length) return;
    decided.current = true;
    setSpinning(true);
    const prize = pickPrize(prizes);
    const index = prizes.findIndex((item) => item.id === prize.id);
    const slice = 360 / prizes.length;
    setRotation(360 * 8 + (360 - (index * slice + slice / 2)));
    window.setTimeout(() => {
      setChosen(prize);
      setSpinning(false);
      onPrize(prize);
    }, 4200);
  };

  return (
    <section className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#170d08] px-5 text-center text-white">
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.22)),url('/bar-game/roulette-background.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="relative z-10 mb-4">
        <span className="rounded-md border border-amber-400/50 bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-amber-200">Fim de jogo · {score} pontos</span>
      </div>

      <div className="relative z-10 my-3 h-[min(78vw,330px)] w-[min(78vw,330px)]">
        <div className="absolute left-1/2 top-[-10px] z-20 h-0 w-0 -translate-x-1/2 border-x-[15px] border-t-[28px] border-x-transparent border-t-white drop-shadow-lg" />
        <div
          className="h-full w-full rounded-full border-[10px] border-amber-300 shadow-[0_0_0_5px_#713f12,0_16px_38px_rgba(0,0,0,.55)] transition-transform"
          style={{ background: wheel, transform: `rotate(${rotation}deg)`, transitionDuration: "4200ms", transitionTimingFunction: "cubic-bezier(.12,.72,.12,1)" }}
        >
          {prizes.map((prize, index) => {
            const angle = (index + 0.5) * (360 / prizes.length);
            return (
              <span key={prize.id} className="absolute left-1/2 top-1/2 w-[43%] origin-left text-left text-[8px] font-black uppercase leading-tight text-amber-100 drop-shadow-md" style={{ transform: `rotate(${angle - 90}deg) translateX(28%)` }}>
                {prize.name}
              </span>
            );
          })}
        </div>
        <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-amber-200 bg-[#2b1308] shadow-lg"><Gift className="text-amber-300" /></div>
      </div>

      <div className="relative z-10 mt-5 min-h-24 w-full max-w-sm">
        {chosen ? (
          <div>
            <p className="text-xs font-black uppercase text-amber-300">Seu prêmio</p>
            <strong className="mt-1 block text-2xl font-black uppercase">{chosen.name}</strong>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-snug text-amber-50">{chosen.description}</p>
            <button onClick={onFinish} className="mt-5 inline-flex min-h-14 items-center gap-2 rounded-md border-2 border-amber-300 bg-amber-500 px-8 text-lg font-black uppercase text-[#241107] shadow-[0_5px_0_#92400e] active:translate-y-1 active:shadow-none"><RotateCcw /> Voltar ao início</button>
          </div>
        ) : (
          <button disabled={spinning || !prizes.length} onClick={spin} className="min-h-16 rounded-md border-2 border-amber-300 bg-red-700 px-12 text-xl font-black uppercase shadow-[0_6px_0_#450a0a] disabled:opacity-60 active:translate-y-1 active:shadow-none">
            {spinning ? "Girando..." : prizes.length ? "Girar roleta" : "Carregando..."}
          </button>
        )}
      </div>
    </section>
  );
}
