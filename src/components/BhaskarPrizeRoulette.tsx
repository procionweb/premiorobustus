import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
    <section className="absolute inset-0 z-50 overflow-hidden bg-[#080808] text-center text-amber-100">
      <div className="absolute inset-0 bg-[url('/bar-game/roulette-background.png')] bg-cover bg-center" />
      <div className="absolute left-1/2 top-[15.5%] z-20 -translate-x-1/2">
        <span className="whitespace-nowrap rounded-md border border-amber-400/50 bg-[#03101c]/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-amber-200 shadow-[0_0_14px_rgba(245,158,11,.28)]">Fim de jogo · {score} pontos</span>
      </div>

      <div className="absolute left-1/2 top-[21.5%] z-10 h-[min(81vw,345px)] w-[min(81vw,345px)] -translate-x-1/2">
        <div className="absolute left-1/2 top-[-7px] z-30 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-[#f7df99] drop-shadow-[0_2px_3px_#000]" />
        <div
          role="slider" aria-label="Gire a roleta arrastando" aria-valuetext={spinning ? "Girando" : chosen ? chosen.name : "Pronta para girar"} tabIndex={0}
          onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}
          className={`relative h-full w-full select-none overflow-hidden rounded-full border-[3px] border-[#c88927] shadow-[0_0_0_3px_#3b2109,0_8px_24px_rgba(0,0,0,.65)] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ backgroundImage: "url('/bar-game/roulette-background.png')", backgroundPosition: "50% 38%", backgroundSize: "145% 257%", touchAction: "none", transform: `rotate(${rotation}deg)`, transition: duration ? `transform ${duration}ms cubic-bezier(.08,.66,.12,1)` : "none" }}
        >
          {prizes.map((prize, index) => {
            const angle = (index + 0.5) * (360 / prizes.length);
            return <span key={prize.id} className="absolute left-1/2 top-1/2 w-[39%] origin-left text-left text-[8px] font-black uppercase leading-tight text-[#ffe6a3] drop-shadow-[0_1px_2px_#000]" style={{ transform: `rotate(${angle - 90}deg) translateX(31%)` }}>{prize.name}</span>;
          })}
        </div>
      </div>

      {!chosen && <div className="absolute bottom-[9.5%] left-1/2 z-20 w-[78%] max-w-sm -translate-x-1/2 rounded-md border border-[#b87524] bg-[#03101c]/90 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#f5d98d] shadow-[0_0_18px_rgba(245,158,11,.2)]">{spinning ? "A roleta está girando..." : prizes.length ? "Arraste a roleta e solte" : "Carregando prêmios..."}</div>}

      {chosen && (
        <div className="absolute bottom-[3.2%] left-1/2 z-30 w-[88%] max-w-sm -translate-x-1/2 rounded-md border-2 border-[#c88927] bg-[linear-gradient(180deg,rgba(3,24,45,.97),rgba(4,12,24,.98))] px-4 py-3 shadow-[0_0_0_2px_#3b2109,0_0_24px_rgba(245,158,11,.28)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#dcae52]">Seu prêmio</p>
          <strong className="mt-1 block font-serif text-xl font-black uppercase tracking-wide text-[#f7d77c] drop-shadow-[0_2px_2px_#000]">{chosen.name}</strong>
          <p className="mx-auto mt-1.5 max-w-sm text-xs font-semibold leading-snug text-[#f7e7bd]">{chosen.description}</p>
          <button onClick={onFinish} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-[#e2b65b] bg-[#8b4d12] px-5 text-sm font-black uppercase text-[#fff0bd] shadow-[0_3px_0_#3b2109] active:translate-y-0.5 active:shadow-none"><RotateCcw size={18} /> Voltar ao início</button>
        </div>
      )}
    </section>
  );
}
