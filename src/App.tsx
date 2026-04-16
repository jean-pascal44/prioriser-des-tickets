import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const STORAGE_KEY = "prio_history";
const APP_META_KEY = "prio_app_meta";

const DEFAULT_APP_TITLE = "Calculateur de priorité";
const DEFAULT_APP_DESCRIPTION =
  "Outil d'arbitrage AMOA & QA : Valeur Métier vs Risque";

type AppMeta = {
  title: string;
  description: string;
};

function loadAppMeta(): AppMeta {
  try {
    const raw = localStorage.getItem(APP_META_KEY);
    if (!raw) {
      return { title: DEFAULT_APP_TITLE, description: DEFAULT_APP_DESCRIPTION };
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as AppMeta).title === "string" &&
      typeof (parsed as AppMeta).description === "string"
    ) {
      return {
        title: (parsed as AppMeta).title.trim() || DEFAULT_APP_TITLE,
        description: (parsed as AppMeta).description,
      };
    }
  } catch {
    /* ignore */
  }
  return { title: DEFAULT_APP_TITLE, description: DEFAULT_APP_DESCRIPTION };
}

const CRITICITE_OPTIONS: { value: number; label: string; dotClass: string }[] = [
  { value: 1, label: "Simple", dotClass: "bg-slate-300" },
  { value: 2, label: "Mineur", dotClass: "bg-slate-500" },
  { value: 3, label: "Majeur", dotClass: "bg-amber-400" },
  { value: 4, label: "Critique", dotClass: "bg-orange-400" },
  { value: 5, label: "Bloquant", dotClass: "bg-red-600" },
];

const USAGE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Rarement utilisé (par mois)" },
  { value: 2, label: "Utilisation hebdomadaire" },
  { value: 3, label: "Utilisation quotidienne" },
  { value: 4, label: "Plusieurs fois par jour" },
  { value: 5, label: "Critique / temps réel permanent" },
];

const IMPACT_OPTIONS: { value: number; label: string; dotClass: string }[] = [
  { value: 1, label: "Faible", dotClass: CRITICITE_OPTIONS[0].dotClass },
  { value: 2, label: "Modéré", dotClass: CRITICITE_OPTIONS[2].dotClass },
  { value: 3, label: "Critique", dotClass: CRITICITE_OPTIONS[4].dotClass },
];

const SURVENUE_OPTIONS: { value: number; label: string; dotClass: string }[] = [
  { value: 1, label: "Improbable", dotClass: CRITICITE_OPTIONS[0].dotClass },
  { value: 2, label: "Possible", dotClass: CRITICITE_OPTIONS[2].dotClass },
  { value: 3, label: "Fréquent", dotClass: CRITICITE_OPTIONS[4].dotClass },
];

type HistoryEntry = {
  id: string;
  ref: string;
  critTicket: number;
  usageMetier: number;
  riskImpact: number;
  riskProb: number;
  valeur: number;
  risque: number;
  total: number;
  date: string;
};

function inferCritUsage(valeur: number): { c: number; u: number } {
  for (let c = 1; c <= 5; c++) {
    const u = valeur / c;
    if (Number.isInteger(u) && u >= 1 && u <= 5) return { c, u };
  }
  let best = { c: 3, u: 3 };
  let bestDiff = Infinity;
  for (let c = 1; c <= 5; c++) {
    for (let u = 1; u <= 5; u++) {
      const diff = Math.abs(c * u - valeur);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { c, u };
      }
    }
  }
  return best;
}

function inferImpactProb(risque: number): { i: number; p: number } {
  for (let i = 1; i <= 3; i++) {
    const p = risque / i;
    if (Number.isInteger(p) && p >= 1 && p <= 3) return { i, p };
  }
  let best = { i: 2, p: 2 };
  let bestDiff = Infinity;
  for (let i = 1; i <= 3; i++) {
    for (let p = 1; p <= 3; p++) {
      const diff = Math.abs(i * p - risque);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { i, p };
      }
    }
  }
  return best;
}

function isLegacyHistoryShape(o: object): o is {
  ref: string;
  valeur: number;
  risque: number;
  total: number;
  date: string;
  id?: string;
  critTicket?: number;
  usageMetier?: number;
  riskImpact?: number;
  riskProb?: number;
} {
  const x = o as Record<string, unknown>;
  return (
    typeof x.ref === "string" &&
    typeof x.valeur === "number" &&
    typeof x.risque === "number" &&
    typeof x.total === "number" &&
    typeof x.date === "string"
  );
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: HistoryEntry[] = [];
    for (const x of parsed) {
      if (x === null || typeof x !== "object" || !isLegacyHistoryShape(x)) continue;
      const cu =
        typeof x.critTicket === "number" && typeof x.usageMetier === "number"
          ? { c: x.critTicket, u: x.usageMetier }
          : inferCritUsage(x.valeur);
      const ip =
        typeof x.riskImpact === "number" && typeof x.riskProb === "number"
          ? { i: x.riskImpact, p: x.riskProb }
          : inferImpactProb(x.risque);
      const valeur = cu.c * cu.u;
      const risque = ip.i * ip.p;
      out.push({
        id: typeof x.id === "string" ? x.id : crypto.randomUUID(),
        ref: x.ref,
        critTicket: cu.c,
        usageMetier: cu.u,
        riskImpact: ip.i,
        riskProb: ip.p,
        valeur,
        risque,
        total: valeur + risque,
        date: x.date,
      });
    }
    return out;
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

const DEFAULT_CRIT = 3;
const DEFAULT_USAGE = 3;
const DEFAULT_IMPACT = 2;
const DEFAULT_PROB = 2;

export default function App() {
  const initialMeta = loadAppMeta();
  const [appTitle, setAppTitle] = useState(initialMeta.title);
  const [appDescription, setAppDescription] = useState(initialMeta.description);
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    title: initialMeta.title,
    description: initialMeta.description,
  });

  const [ticketRef, setTicketRef] = useState("");
  const [critTicket, setCritTicket] = useState(DEFAULT_CRIT);
  const [usageMetier, setUsageMetier] = useState(DEFAULT_USAGE);
  const [riskImpact, setRiskImpact] = useState(DEFAULT_IMPACT);
  const [riskProb, setRiskProb] = useState(DEFAULT_PROB);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [entryPendingDelete, setEntryPendingDelete] = useState<HistoryEntry | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const { valeurMetier, scoreRisque, finalScore } = useMemo(() => {
    const valeur = critTicket * usageMetier;
    const risque = riskImpact * riskProb;
    return { valeurMetier: valeur, scoreRisque: risque, finalScore: valeur + risque };
  }, [critTicket, usageMetier, riskImpact, riskProb]);

  const { label: priorityLabel, scoreClass } = priorityTier(finalScore);

  const isUpdateMode = selectedEntryId !== null;

  const resetFormToNew = useCallback(() => {
    setSelectedEntryId(null);
    setTicketRef("");
    setCritTicket(DEFAULT_CRIT);
    setUsageMetier(DEFAULT_USAGE);
    setRiskImpact(DEFAULT_IMPACT);
    setRiskProb(DEFAULT_PROB);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  }, [history]);

  useEffect(() => {
    document.title = appTitle || DEFAULT_APP_TITLE;
  }, [appTitle]);

  useEffect(() => {
    try {
      localStorage.setItem(
        APP_META_KEY,
        JSON.stringify({ title: appTitle, description: appDescription }),
      );
    } catch {
      /* ignore */
    }
  }, [appTitle, appDescription]);

  useEffect(() => {
    if (!clearModalOpen && !selectedEntryId && !entryPendingDelete && !headerModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (entryPendingDelete) {
        setEntryPendingDelete(null);
        return;
      }
      if (clearModalOpen) {
        setClearModalOpen(false);
        return;
      }
      if (headerModalOpen) {
        setHeaderModalOpen(false);
        return;
      }
      resetFormToNew();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clearModalOpen, selectedEntryId, entryPendingDelete, headerModalOpen, resetFormToNew]);

  const applyEntryToForm = (entry: HistoryEntry) => {
    setTicketRef(entry.ref);
    setCritTicket(entry.critTicket);
    setUsageMetier(entry.usageMetier);
    setRiskImpact(entry.riskImpact);
    setRiskProb(entry.riskProb);
  };

  const selectHistoryRow = (entry: HistoryEntry) => {
    if (selectedEntryId === entry.id) {
      resetFormToNew();
      return;
    }
    setSelectedEntryId(entry.id);
    applyEntryToForm(entry);
  };

  const onRowKeyDown = (e: ReactKeyboardEvent, entry: HistoryEntry) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectHistoryRow(entry);
    }
  };

  const saveCalculation = () => {
    const ref = ticketRef.trim() || "Ticket sans nom";
    if (selectedEntryId) {
      setHistory((h) =>
        h
          .map((e) =>
            e.id === selectedEntryId
              ? {
                  ...e,
                  ref,
                  critTicket,
                  usageMetier,
                  riskImpact,
                  riskProb,
                  valeur: valeurMetier,
                  risque: scoreRisque,
                  total: finalScore,
                }
              : e,
          )
          .sort((a, b) => b.total - a.total),
      );
    } else {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        ref,
        critTicket,
        usageMetier,
        riskImpact,
        riskProb,
        valeur: valeurMetier,
        risque: scoreRisque,
        total: finalScore,
        date: new Date().toLocaleTimeString(),
      };
      setHistory((h) => [...h, entry].sort((a, b) => b.total - a.total));
    }
    setTicketRef("");
    setCritTicket(DEFAULT_CRIT);
    setUsageMetier(DEFAULT_USAGE);
    setRiskImpact(DEFAULT_IMPACT);
    setRiskProb(DEFAULT_PROB);
    setSelectedEntryId(null);
  };

  const openClearModal = () => {
    if (history.length === 0) return;
    setClearModalOpen(true);
  };

  const closeClearModal = () => setClearModalOpen(false);

  const confirmClearHistory = () => {
    setHistory([]);
    resetFormToNew();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setClearModalOpen(false);
  };

  const openDeleteEntryModal = (entry: HistoryEntry) => {
    setEntryPendingDelete(entry);
  };

  const closeDeleteEntryModal = () => setEntryPendingDelete(null);

  const confirmDeleteEntry = () => {
    if (!entryPendingDelete) return;
    const id = entryPendingDelete.id;
    setHistory((h) => h.filter((e) => e.id !== id));
    if (selectedEntryId === id) resetFormToNew();
    setEntryPendingDelete(null);
  };

  const openHeaderModal = () => {
    setHeaderDraft({ title: appTitle, description: appDescription });
    setHeaderModalOpen(true);
  };

  const closeHeaderModal = () => setHeaderModalOpen(false);

  const submitHeaderModal = () => {
    setAppTitle(headerDraft.title.trim() || DEFAULT_APP_TITLE);
    setAppDescription(headerDraft.description);
    setHeaderModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between gap-4 border-b pb-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-800">
                {appTitle}
              </h1>
              <button
                type="button"
                onClick={openHeaderModal}
                className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"
                title="Modifier le titre et la description"
                aria-label="Modifier le titre et la description"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-1 italic text-slate-500">{appDescription}</p>
          </div>
          <div className="shrink-0 rounded-lg border bg-white px-4 py-2 shadow-sm">
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

                <fieldset className="min-w-0">
                  <legend
                    id="crit-legend"
                    className="mb-2 block text-xs font-black uppercase text-slate-400"
                  >
                    1. Criticité intrinsèque
                  </legend>
                  <div
                    className="flex flex-nowrap items-start justify-between gap-1 sm:gap-2"
                    role="radiogroup"
                    aria-labelledby="crit-legend"
                  >
                    {CRITICITE_OPTIONS.map((opt) => {
                      const id = `crit-${opt.value}`;
                      const selected = critTicket === opt.value;
                      return (
                        <label
                          key={opt.value}
                          htmlFor={id}
                          className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg py-0.5 text-center"
                        >
                          <input
                            id={id}
                            type="radio"
                            name="critTicket"
                            checked={selected}
                            onChange={() => setCritTicket(opt.value)}
                            className="peer sr-only"
                          />
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full sm:h-5 sm:w-5 ${opt.dotClass} ${
                              selected
                                ? "ring-2 ring-slate-900 ring-offset-2"
                                : "ring-1 ring-slate-300/90"
                            } peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2`}
                            aria-hidden
                          />
                          <span className="max-w-[4.5rem] text-[10px] font-medium leading-tight text-slate-700 sm:max-w-none sm:text-xs">
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend
                    id="usage-legend"
                    className="mb-2 block text-xs font-black uppercase text-slate-400"
                  >
                    2. Fréquence d&apos;usage
                  </legend>
                  <div
                    className="flex flex-nowrap items-start justify-between gap-1 sm:gap-2"
                    role="radiogroup"
                    aria-labelledby="usage-legend"
                  >
                    {USAGE_OPTIONS.map((opt) => {
                      const id = `usage-${opt.value}`;
                      const selected = usageMetier === opt.value;
                      const dotClass =
                        CRITICITE_OPTIONS[opt.value - 1]?.dotClass ?? "bg-slate-300";
                      return (
                        <label
                          key={opt.value}
                          htmlFor={id}
                          className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg py-0.5 text-center"
                        >
                          <input
                            id={id}
                            type="radio"
                            name="usageMetier"
                            checked={selected}
                            onChange={() => setUsageMetier(opt.value)}
                            className="peer sr-only"
                          />
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full sm:h-5 sm:w-5 ${dotClass} ${
                              selected
                                ? "ring-2 ring-slate-900 ring-offset-2"
                                : "ring-1 ring-slate-300/90"
                            } peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2`}
                            aria-hidden
                          />
                          <span className="max-w-[4.5rem] text-[10px] font-medium leading-tight text-slate-700 sm:max-w-none sm:text-xs">
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="min-w-0">
                  <p className="mb-2 block text-xs font-black uppercase text-slate-400">
                    3. Matrice de risque (Impact × Survenue)
                  </p>
                  <div className="flex gap-0">
                    <fieldset className="min-w-0 flex-1 border-0 p-0 pr-3 text-center sm:pr-4">
                      <legend className="sr-only">Impact</legend>
                      <div
                        id="impact-legend"
                        className="mb-2 w-full text-center text-xs font-black uppercase text-slate-500"
                      >
                        Impact
                      </div>
                      <div
                        className="flex flex-nowrap items-start justify-between gap-2"
                        role="radiogroup"
                        aria-labelledby="impact-legend"
                      >
                        {IMPACT_OPTIONS.map((opt) => {
                          const id = `impact-${opt.value}`;
                          const selected = riskImpact === opt.value;
                          return (
                            <label
                              key={opt.value}
                              htmlFor={id}
                              className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg py-0.5 text-center"
                            >
                              <input
                                id={id}
                                type="radio"
                                name="riskImpact"
                                checked={selected}
                                onChange={() => setRiskImpact(opt.value)}
                                className="peer sr-only"
                              />
                              <span
                                className={`h-4 w-4 shrink-0 rounded-full sm:h-5 sm:w-5 ${opt.dotClass} ${
                                  selected
                                    ? "ring-2 ring-slate-900 ring-offset-2"
                                    : "ring-1 ring-slate-300/90"
                                } peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2`}
                                aria-hidden
                              />
                              <span className="max-w-[5rem] text-[10px] font-medium leading-tight text-slate-700 sm:max-w-none sm:text-xs">
                                {opt.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <fieldset className="min-w-0 flex-1 border-0 border-l border-slate-200/90 p-0 pl-3 text-center sm:pl-4">
                      <legend className="sr-only">Survenue</legend>
                      <div
                        id="surv-legend"
                        className="mb-2 w-full text-center text-xs font-black uppercase text-slate-500"
                      >
                        Survenue
                      </div>
                      <div
                        className="flex flex-nowrap items-start justify-between gap-2"
                        role="radiogroup"
                        aria-labelledby="surv-legend"
                      >
                        {SURVENUE_OPTIONS.map((opt) => {
                          const id = `surv-${opt.value}`;
                          const selected = riskProb === opt.value;
                          return (
                            <label
                              key={opt.value}
                              htmlFor={id}
                              className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg py-0.5 text-center"
                            >
                              <input
                                id={id}
                                type="radio"
                                name="riskProb"
                                checked={selected}
                                onChange={() => setRiskProb(opt.value)}
                                className="peer sr-only"
                              />
                              <span
                                className={`h-4 w-4 shrink-0 rounded-full sm:h-5 sm:w-5 ${opt.dotClass} ${
                                  selected
                                    ? "ring-2 ring-slate-900 ring-offset-2"
                                    : "ring-1 ring-slate-300/90"
                                } peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2`}
                                aria-hidden
                              />
                              <span className="max-w-[5rem] text-[10px] font-medium leading-tight text-slate-700 sm:max-w-none sm:text-xs">
                                {opt.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                </div>

                <hr className="border-slate-50" />

                <button
                  type="button"
                  onClick={saveCalculation}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-xl shadow-blue-100 transition hover:bg-blue-700"
                >
                  <span>{isUpdateMode ? "Mettre à jour" : "Calculer"}</span>
                  {isUpdateMode ? (
                    <svg
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z"
                      />
                    </svg>
                  )}
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
                      <th className="px-4 py-3 text-center">Valeur</th>
                      <th className="px-4 py-3 text-center">Risque</th>
                      <th className="px-4 py-3 text-right text-blue-600">Score Final</th>
                      <th className="w-12 px-2 py-3 text-center">
                        <span className="sr-only">Supprimer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item, index) => {
                      const selected = selectedEntryId === item.id;
                      return (
                        <tr
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          onClick={() => selectHistoryRow(item)}
                          onKeyDown={(e) => onRowKeyDown(e, item)}
                          className={`cursor-pointer transition outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
                            selected
                              ? "bg-blue-50 hover:bg-blue-50/90"
                              : "hover:bg-slate-50"
                          }`}
                        >
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
                          <td
                            className="px-2 py-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openDeleteEntryModal(item)}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Supprimer cette entrée"
                              aria-label={`Supprimer ${item.ref}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="h-5 w-5"
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {headerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="header-app-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeHeaderModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="header-app-title" className="text-lg font-semibold text-slate-900">
              Titre et description
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Affichés dans l&apos;en-tête de la page.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-700">
                Titre
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border-2 border-slate-100 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  value={headerDraft.title}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, title: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="block text-sm text-slate-700">
                Description
                <textarea
                  className="mt-1 w-full resize-y rounded-xl border-2 border-slate-100 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  rows={3}
                  value={headerDraft.description}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={closeHeaderModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                onClick={submitHeaderModal}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {entryPendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-entry-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteEntryModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="delete-entry-title" className="text-lg font-semibold text-slate-900">
              Supprimer cette entrée ?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {entryPendingDelete.ref.trim() || "(sans titre)"}
              </span>{" "}
              (score {entryPendingDelete.total}) sera retirée de l&apos;historique. Cette action est
              définitive.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={closeDeleteEntryModal}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                onClick={confirmDeleteEntry}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

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
