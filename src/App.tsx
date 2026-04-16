import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "prio_history";

type HistoryEntry = {
  ref: string;
  valeur: number;
  risque: number;
  total: number;
  date: string;
};

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is HistoryEntry =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as HistoryEntry).ref === "string" &&
        typeof (x as HistoryEntry).valeur === "number" &&
        typeof (x as HistoryEntry).risque === "number" &&
        typeof (x as HistoryEntry).total === "number" &&
        typeof (x as HistoryEntry).date === "string",
    );
  } catch {
    return [];
  }
}

function priorityTier(finalScore: number): {
  label: string;
  scoreClass: string;
} {
  if (finalScore >= 25) {
    return { label: "🚨 Priorité Critique - Immédiat", scoreClass: "score-critical" };
  }
  if (finalScore >= 18) {
    return { label: "🟠 Priorité Haute - Prochain Sprint", scoreClass: "score-high" };
  }
  if (finalScore >= 10) {
    return { label: "🟡 Priorité Moyenne - Backlog", scoreClass: "score-medium" };
  }
  return { label: "🟢 Priorité Basse - Nice to Have", scoreClass: "score-low" };
}

export default function App() {
  const [ticketRef, setTicketRef] = useState("");
  const [critTicket, setCritTicket] = useState(3);
  const [usageMetier, setUsageMetier] = useState(3);
  const [riskImpact, setRiskImpact] = useState(2);
  const [riskProb, setRiskProb] = useState(2);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const { valeurMetier, scoreRisque, finalScore } = useMemo(() => {
    const valeur = critTicket * usageMetier;
    const risque = riskImpact * riskProb;
    return { valeurMetier: valeur, scoreRisque: risque, finalScore: valeur + risque };
  }, [critTicket, usageMetier, riskImpact, riskProb]);

  const { label: priorityLabel, scoreClass } = priorityTier(finalScore);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  }, [history]);

  useEffect(() => {
    if (!clearModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClearModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clearModalOpen]);

  const saveCalculation = () => {
    const ref = ticketRef.trim() || "Ticket sans nom";
    const entry: HistoryEntry = {
      ref,
      valeur: valeurMetier,
      risque: scoreRisque,
      total: finalScore,
      date: new Date().toLocaleTimeString(),
    };
    setHistory((h) => [...h, entry].sort((a, b) => b.total - a.total));
    setTicketRef("");
  };

  const openClearModal = () => {
    if (history.length === 0) return;
    setClearModalOpen(true);
  };

  const closeClearModal = () => setClearModalOpen(false);

  const confirmClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setClearModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between border-b pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800">
              Calculateur de priorité
            </h1>
            <p className="italic text-slate-500">
              Outil d&apos;arbitrage AMOA &amp; QA : Valeur Métier vs Risque
            </p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-2 shadow-sm">
            <span className="block text-2xl font-bold text-blue-600">{history.length}</span>
            <span className="block text-xs font-bold uppercase tracking-tighter text-slate-400">
              Tickets Évalués
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="ticketRef"
                    className="mb-2 block text-xs font-black uppercase text-slate-400"
                  >
                    Référence / Titre du Ticket
                  </label>
                  <input
                    id="ticketRef"
                    type="text"
                    value={ticketRef}
                    onChange={(e) => setTicketRef(e.target.value)}
                    placeholder="Ex: US-402 - Refonte Login"
                    className="w-full rounded-xl border-2 border-slate-100 px-4 py-3 outline-none transition focus:border-blue-500"
                  />
                </div>

                <hr className="border-slate-50" />

                <div>
                  <label
                    htmlFor="critTicket"
                    className="mb-2 block text-xs font-black uppercase text-slate-400"
                  >
                    1. Criticité intrinsèque (1 à 5)
                  </label>
                  <input
                    id="critTicket"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={critTicket}
                    onChange={(e) => setCritTicket(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                  />
                  <div className="mt-2 flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Mineur</span>
                    <span>Bloquant</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="usageMetier"
                    className="mb-2 block text-xs font-black uppercase text-slate-400"
                  >
                    2. Fréquence d&apos;Usage (1 à 5)
                  </label>
                  <select
                    id="usageMetier"
                    value={usageMetier}
                    onChange={(e) => setUsageMetier(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value={1}>Rarement utilisé (1x/mois)</option>
                    <option value={2}>Utilisation hebdomadaire</option>
                    <option value={3}>Utilisation quotidienne</option>
                    <option value={4}>Plusieurs fois par jour</option>
                    <option value={5}>Critique / Temps réel permanent</option>
                  </select>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <label className="mb-4 block text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                    3. Matrice de Risque (Impact × Survenue)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="riskImpact"
                        className="mb-1 block text-[10px] font-bold text-slate-400"
                      >
                        IMPACT (1-3)
                      </label>
                      <select
                        id="riskImpact"
                        value={riskImpact}
                        onChange={(e) => setRiskImpact(Number(e.target.value))}
                        className="w-full rounded-lg border px-2 py-2 text-xs"
                      >
                        <option value={1}>1 - Faible</option>
                        <option value={2}>2 - Modéré</option>
                        <option value={3}>3 - Critique</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="riskProb"
                        className="mb-1 block text-[10px] font-bold text-slate-400"
                      >
                        SURVENUE (1-3)
                      </label>
                      <select
                        id="riskProb"
                        value={riskProb}
                        onChange={(e) => setRiskProb(Number(e.target.value))}
                        className="w-full rounded-lg border px-2 py-2 text-xs"
                      >
                        <option value={1}>1 - Improbable</option>
                        <option value={2}>2 - Possible</option>
                        <option value={3}>3 - Fréquent</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveCalculation}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-xl shadow-blue-100 transition hover:bg-blue-700"
                >
                  <span>Calculer et Archiver</span>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-7">
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 text-center text-white shadow-2xl">
              <div className="relative z-10">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
                  Score de Priorité Calculé
                </span>
                <div className={`my-2 text-7xl font-black ${scoreClass}`}>{finalScore}</div>
                <div className="text-sm font-bold uppercase tracking-widest opacity-80">
                  {priorityLabel}
                </div>
              </div>
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500 opacity-20 blur-[100px]" />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50 p-4">
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-700">
                  Historique (Trié par Score)
                </h3>
                <button
                  type="button"
                  onClick={openClearModal}
                  disabled={history.length === 0}
                  className="text-[10px] font-bold uppercase text-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Effacer tout
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="w-12 px-4 py-3 text-center">#</th>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3 text-center">Valeur (Crit×Usg)</th>
                      <th className="px-4 py-3 text-center">Risque (I×P)</th>
                      <th className="px-4 py-3 text-right text-blue-600">Score Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item, index) => (
                      <tr key={`${item.ref}-${item.date}-${index}`} className="transition hover:bg-slate-50">
                        <td className="px-4 py-4 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-700">
                          {item.ref}
                          <span className="block text-[9px] font-normal text-slate-400">
                            {item.date}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-slate-500">
                          {item.valeur}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-slate-500">
                          {item.risque}
                        </td>
                        <td className="px-4 py-4 text-right text-lg font-black text-blue-600">
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-history-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeClearModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="clear-history-title" className="text-lg font-semibold text-slate-900">
              Effacer l&apos;historique ?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {history.length === 1 ? (
                <>
                  L&apos;entrée enregistrée sera supprimée. Cette action est définitive.
                </>
              ) : (
                <>
                  Les{" "}
                  <span className="font-medium tabular-nums text-slate-800">{history.length}</span>{" "}
                  entrées enregistrées seront supprimées. Cette action est définitive.
                </>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={closeClearModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                onClick={confirmClearHistory}
              >
                Effacer tout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
