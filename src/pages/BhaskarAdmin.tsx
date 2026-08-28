import { ArrowLeft, Download, LockKeyhole, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearBarParticipants, getBarParticipants, getBarPrizes, saveBarPrizes, type BarParticipant, type BarPrize } from "@/lib/barGameDb";
import { hasBarAdminPin, setBarAdminPin, verifyBarAdminPin } from "@/lib/barAdminPin";

export default function BhaskarAdmin() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [prizes, setPrizes] = useState<BarPrize[]>([]);
  const [participants, setParticipants] = useState<BarParticipant[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { void hasBarAdminPin().then(setHasPin); }, []);
  useEffect(() => {
    if (!authed) return;
    void Promise.all([getBarPrizes(), getBarParticipants()]).then(([nextPrizes, nextParticipants]) => {
      setPrizes(nextPrizes);
      setParticipants(nextParticipants);
    });
  }, [authed]);

  const enter = async () => {
    setError("");
    try {
      if (!hasPin) {
        if (pin !== confirm) throw new Error("Os PINs não conferem.");
        await setBarAdminPin(pin);
        setHasPin(true);
        setAuthed(true);
      } else if (await verifyBarAdminPin(pin)) setAuthed(true);
      else setError("PIN incorreto.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível entrar."); }
  };

  const save = async () => {
    if (!prizes.some((prize) => prize.enabled && prize.weight > 0)) return setMessage("Ative ao menos um prêmio com chance maior que zero.");
    await saveBarPrizes(prizes);
    setMessage("Prêmios salvos no banco offline.");
  };

  const exportCsv = () => {
    const rows = [["nome", "telefone", "cadastro"], ...participants.map((participant) => [participant.name, participant.phone, participant.createdAt])];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bhaskar-participantes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (hasPin === null) return <main className="fixed inset-0 grid place-items-center bg-[#160c08] text-amber-100">Carregando...</main>;
  if (!authed) return (
    <main className="fixed inset-0 grid place-items-center bg-[#160c08] p-6 text-white">
      <section className="w-full max-w-sm rounded-md border border-amber-400/40 bg-black/60 p-6 text-center">
        <LockKeyhole className="mx-auto mb-3 text-amber-400" size={36} />
        <h1 className="text-2xl font-black uppercase">Admin Bhaskar</h1>
        <p className="mt-2 text-sm text-amber-100">{hasPin ? "Informe o PIN administrativo." : "Crie o PIN administrativo deste aparelho."}</p>
        <input autoFocus inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="mt-5 w-full rounded-md border border-amber-400 bg-white p-3 text-center text-2xl font-black tracking-[.4em] text-black" placeholder="PIN" />
        {!hasPin && <input inputMode="numeric" maxLength={6} value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, ""))} className="mt-3 w-full rounded-md border border-amber-400 bg-white p-3 text-center text-2xl font-black tracking-[.4em] text-black" placeholder="CONFIRMAR" />}
        {error && <p className="mt-3 text-sm font-bold text-red-400">{error}</p>}
        <button onClick={enter} className="mt-5 min-h-12 w-full rounded-md bg-amber-500 font-black uppercase text-black">Entrar</button>
        <button onClick={() => navigate("/bar-game")} className="mt-3 text-sm text-amber-200">Voltar ao jogo</button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#160c08] p-4 text-white sm:p-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <button onClick={() => navigate("/bar-game")} className="rounded-md border border-white/20 p-3" title="Voltar"><ArrowLeft /></button>
        <div className="text-center"><p className="text-xs font-black uppercase text-amber-400">Painel offline</p><h1 className="text-2xl font-black uppercase">Bhaskar</h1></div>
        <button onClick={exportCsv} className="rounded-md border border-white/20 p-3" title="Exportar CSV"><Download /></button>
      </header>

      <div className="mx-auto mt-7 grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-md border border-amber-400/25 bg-black/35 p-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black uppercase">Prêmios da roleta</h2><button onClick={() => setPrizes((items) => [...items, { id: `${Date.now()}`, name: "Novo prêmio", description: "", weight: 10, enabled: true }])} title="Adicionar prêmio" className="p-2"><Plus /></button></div>
          <div className="mt-4 space-y-3">
            {prizes.map((prize, index) => (
              <div key={prize.id} className="rounded-md bg-white/5 p-2">
                <div className="grid grid-cols-[auto_1fr_70px_auto] items-center gap-2">
                  <input type="checkbox" checked={prize.enabled} onChange={(event) => setPrizes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} />
                  <input value={prize.name} onChange={(event) => setPrizes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} className="min-w-0 rounded border border-white/15 bg-[#2b211c] p-2 text-amber-50 outline-none focus:border-amber-400" />
                  <input type="number" min="0" value={prize.weight} onChange={(event) => setPrizes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, weight: Number(event.target.value) } : item))} className="rounded border border-white/15 bg-[#2b211c] p-2 text-amber-50 outline-none focus:border-amber-400" title="Peso" />
                  <button onClick={() => setPrizes((items) => items.filter((_, itemIndex) => itemIndex !== index))} title="Remover"><Trash2 size={18} /></button>
                </div>
                <textarea value={prize.description} onChange={(event) => setPrizes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} rows={2} placeholder="Descrição exibida ao ganhador" className="mt-2 w-full resize-y rounded border border-white/15 bg-[#2b211c] p-2 text-sm text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-400" />
              </div>
            ))}
          </div>
          <button onClick={save} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500 font-black uppercase text-black"><Save size={18} /> Salvar</button>
          {message && <p className="mt-3 text-sm text-amber-200">{message}</p>}
        </section>

        <section className="rounded-md border border-amber-400/25 bg-black/35 p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-black uppercase">Participantes</h2><p className="text-sm text-amber-200">{participants.length} pessoa(s) neste aparelho</p></div><button onClick={async () => { if (window.confirm("Apagar todos os participantes?")) { await clearBarParticipants(); setParticipants([]); } }} className="p-2 text-red-300" title="Limpar participantes"><Trash2 /></button></div>
          <div className="mt-4 max-h-[65vh] overflow-auto">
            <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-[#160c08] text-amber-300"><tr><th className="p-2">Nome</th><th className="p-2">Telefone</th><th className="p-2">Cadastro</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant.id} className="border-t border-white/10"><td className="p-2">{participant.name}</td><td className="whitespace-nowrap p-2">{participant.phone}</td><td className="p-2">{new Date(participant.createdAt).toLocaleString("pt-BR")}</td></tr>)}</tbody></table>
          </div>
        </section>
      </div>
    </main>
  );
}
