import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getBarPrizes, type BarPrize } from "@/lib/barGameDb";

interface Props { score: number; onPrize: (prize: BarPrize) => void; onFinish: () => void; }
interface DragState { pointerId: number; previousAngle: number; previousTime: number; distance: number; velocity: number; }

function pickPrize(prizes: BarPrize[]) {
  const total = prizes.reduce((sum, prize) => sum + Math.max(0, prize.weight), 0);
  let value = Math.random() * total;
  return prizes.find((prize) => (value -= Math.max(0, prize.weight)) <= 0) ?? prizes[prizes.length - 1];
}

function pointerAngle(event: ReactPointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return Math.atan2(event.clientY - bounds.top - bounds.height / 2, event.clientX - bounds.left - bounds.width / 2) * 180 / Math.PI;
}

const shortestAngle = (value: number) => ((value + 540) % 360) - 180;
const positiveAngle = (value: number) => ((value % 360) + 360) % 360;

export default function BhaskarPrizeRoulette({ score, onPrize, onFinish }: Props) {
  const [prizes, setPrizes] = useState<BarPrize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chosen, setChosen] = useState<BarPrize | null>(null);
  const rotationRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const decided = useRef(false);

  useEffect(() => { void getBarPrizes().then((items) => setPrizes(items.filter((item) => item.enabled && item.weight > 0))); }, []);

  const wheelArt = useMemo(() => {
    const count = Math.max(1, prizes.length);
    const colors = ["#102f48", "#4b1721", "#16402e", "#321a3c", "#51300d", "#123b38", "#4c1828", "#17334d"];
    const sectors = Array.from({ length: count }, (_, index) => {
      const start = index * 360 / count;
      const end = (index + 1) * 360 / count;
      return `${colors[index % colors.length]} ${start}deg ${end}deg`;
    }).join(",");
    return `radial-gradient(circle at 36% 30%,rgba(255,222,142,.12),transparent 35%),radial-gradient(circle,transparent 0 20%,rgba(232,174,67,.9) 20.5% 21.5%,#160d05 22% 24%,transparent 24.5%),repeating-radial-gradient(circle,transparent 0 13px,rgba(246,198,92,.055) 14px 15px),repeating-conic-gradient(from -1deg,rgba(247,205,109,.9) 0deg 1.2deg,transparent 1.2deg ${360 / count}deg),conic-gradient(${sectors})`;
  }, [prizes]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (spinning || decided.current || !prizes.length) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, previousAngle: pointerAngle(event), previousTime: performance.now(), distance: 0, velocity: 0 };
    setDuration(0);
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || spinning) return;
    const now = performance.now();
    const angle = pointerAngle(event);
    const delta = shortestAngle(angle - drag.previousAngle);
    const elapsed = Math.max(8, now - drag.previousTime);
    drag.distance += Math.abs(delta);
    drag.velocity = drag.velocity * 0.55 + (delta / elapsed) * 0.45;
    drag.previousAngle = angle;
    drag.previousTime = now;
    rotationRef.current += delta;
    setRotation(rotationRef.current);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || spinning) return;
    dragRef.current = null;
    setDragging(false);
    if (drag.distance < 18) return;

    decided.current = true;
    setSpinning(true);
    const prize = pickPrize(prizes);
    const index = prizes.findIndex((item) => item.id === prize.id);
    const slice = 360 / prizes.length;
    const desired = positiveAngle(360 - (index * slice + slice / 2));
    const current = rotationRef.current;
    const direction = drag.velocity < -0.02 ? -1 : 1;
    const turns = Math.min(10, Math.max(5, 5 + Math.round(Math.abs(drag.velocity) * 6)));
    const extra = direction > 0 ? positiveAngle(desired - current) : positiveAngle(current - desired);
    const target = current + direction * (turns * 360 + extra);
    const spinDuration = Math.min(5400, Math.max(3900, 3900 + Math.abs(drag.velocity) * 700));
    rotationRef.current = target;
    setDuration(spinDuration);
    setRotation(target);
    window.setTimeout(() => { setChosen(prize); setSpinning(false); onPrize(prize); }, spinDuration + 80);
  };

  return (
    <section className="absolute inset-0 z-50 min-h-[100dvh] overflow-x-hidden overflow-y-hidden bg-[#080808] text-center text-amber-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,7,15,.12),rgba(0,4,10,.2)),url('/bar-game/roulette-scene-v3.png')] bg-cover bg-center" />
      <div className="relative z-10 mx-auto flex h-full min-h-[100dvh] w-full max-w-[430px] flex-col items-center overflow-hidden px-[clamp(18px,5vw,24px)] py-[clamp(12px,2dvh,18px)]">
        <header className="relative flex w-[88%] shrink-0 flex-col items-center justify-center rounded-md border-2 border-[#c58a2d] bg-[linear-gradient(180deg,rgba(8,28,48,.96),rgba(2,12,23,.98))] px-4 py-[clamp(8px,1.4dvh,13px)] shadow-[0_0_0_3px_#3e2309,0_0_0_5px_#8f571b,0_8px_24px_#000] before:absolute before:inset-[5px] before:rounded-sm before:border before:border-[#e0b352]/40">
          <span className="absolute -top-3 h-6 w-6 rotate-45 border-2 border-[#e1b552] bg-[#126fa5] shadow-[0_0_10px_#38bdf8]" />
          <h1 className="font-serif text-[clamp(28px,8vw,40px)] font-black uppercase tracking-[0.13em] text-[#efc76d] [text-shadow:0_2px_2px_#000,0_0_12px_rgba(217,154,50,.38)]">Roleta</h1>
          <span className="mt-1 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.16em] text-[#e9c36d] [text-shadow:0_1px_3px_#000]">Fim de jogo · {score} pontos</span>
        </header>

        <div className="relative mt-[clamp(16px,2.4dvh,22px)] h-[min(82vw,42dvh,350px)] w-[min(82vw,42dvh,350px)] shrink-0">
          <div className="absolute left-1/2 top-[-7px] z-30 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-[#f7df99] drop-shadow-[0_2px_3px_#000]" />
          <div
            role="slider" aria-label="Gire a roleta arrastando" aria-valuetext={spinning ? "Girando" : chosen ? chosen.name : "Pronta para girar"} tabIndex={0}
            onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}
            className={`relative h-full w-full select-none overflow-hidden rounded-full border-[7px] border-[#d7a33d] shadow-[0_0_0_3px_#4a2707,0_0_0_7px_#b66e14,0_0_0_10px_#241205,0_10px_28px_rgba(0,0,0,.72),inset_0_0_22px_#000] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ background: wheelArt, touchAction: "none", transform: `rotate(${rotation}deg)`, transition: duration ? `transform ${duration}ms cubic-bezier(.08,.66,.12,1)` : "none" }}
          >
            <div className="pointer-events-none absolute inset-[5%] rounded-full border-2 border-[#e4b952]/70 shadow-[inset_0_0_0_3px_#4a2707,inset_0_0_18px_#000]" />
            <div className="pointer-events-none absolute inset-[12%] rounded-full border border-[#e2b14d]/45" />
            {Array.from({ length: 24 }, (_, index) => {
              const angle = index * Math.PI / 12;
              return <i key={index} className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-[#efc463] shadow-[0_0_5px_#f59e0b]" style={{ left: `${50 + Math.sin(angle) * 43}%`, top: `${50 - Math.cos(angle) * 43}%` }} />;
            })}
            {prizes.map((prize, index) => {
              const angle = (index + 0.5) * (360 / prizes.length);
              return <span key={prize.id} className="absolute left-1/2 top-1/2 z-10 w-[30%] origin-left text-center font-serif text-[9px] font-black uppercase leading-[1.08] tracking-wide text-[#f5d47e]" style={{ transform: `rotate(${angle - 90}deg) translateX(63%)` }}><span className="inline-block max-w-full break-words [text-shadow:0_1px_1px_#000,0_0_3px_#000,0_0_5px_#000]">{prize.name}</span></span>;
            })}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[25%] w-[25%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#efc35c] bg-[radial-gradient(circle_at_38%_32%,#8ee8ff_0_5%,#1678bd_18%,#06395f_44%,#031321_70%)] shadow-[0_0_0_5px_#512b08,0_0_0_8px_#d99a32,0_0_22px_#139fe8,inset_0_0_12px_#000]">
              <span className="h-[42%] w-[42%] rotate-45 border-2 border-[#b6efff] bg-[#168dd1] shadow-[0_0_12px_#6ee7ff,inset_0_0_8px_#fff]" />
            </div>
          </div>
        </div>

        <div className="mt-auto flex w-full flex-col items-center justify-end pt-3">
          {!chosen ? <div className="mb-[clamp(12px,2dvh,20px)] w-[76%] rounded-md border border-[#b77a25] bg-[#03111f]/90 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#e9c36d] shadow-[0_0_0_2px_#321c08,0_6px_18px_#000] [text-shadow:0_1px_3px_#000]">{spinning ? "A roleta está girando..." : prizes.length ? "Arraste a roleta e solte" : "Carregando prêmios..."}</div> : <div className="mb-[clamp(8px,1.4dvh,14px)] w-[calc(100%-24px)] max-w-[350px] rounded-md border-2 border-[#c68a2e] bg-[linear-gradient(180deg,rgba(5,26,45,.97),rgba(2,12,23,.98))] px-4 py-3 shadow-[0_0_0_3px_#3b2108,0_0_0_5px_#8e561a,0_8px_24px_#000]">
            <div className="mx-auto max-w-[320px] px-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#dcae52]">Seu prêmio</p>
              <strong className="mt-1 block font-serif text-xl font-black uppercase tracking-wide text-[#f7d77c] drop-shadow-[0_2px_2px_#000]">{chosen.name}</strong>
              <p className="mx-auto mt-1.5 max-w-[290px] text-xs font-semibold leading-snug text-[#f7e7bd]">{chosen.description}</p>
            </div>
            <button onClick={onFinish} className="mt-3 inline-flex min-h-10 w-[68%] max-w-[230px] items-center justify-center gap-2 rounded-full border border-[#e2b65b] bg-[#8b4d12] px-3 font-serif text-[13px] font-black uppercase text-[#fff0bd] shadow-[0_3px_0_#3b2109] [text-shadow:0_1px_3px_#000] active:translate-y-0.5 active:shadow-none"><RotateCcw size={16} /> Voltar ao início</button>
          </div>}
        </div>
      </div>
    </section>
  );
}
