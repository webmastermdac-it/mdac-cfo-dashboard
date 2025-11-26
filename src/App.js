import React, { useState, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, AlertTriangle, DollarSign, Upload } from "lucide-react";
import "./App.css";

function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const s = String(value).trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function formatEuro(value) {
  return value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function App() {
	const [targets, setTargets] = useState({
	  ebitdaPerc: 18,     // Target EBITDA % ideale software house
	  costoPersPerc: 50,  // Target costo personale % su ricavi
	  incVarPerc: 40,     // Target incidenza costi variabili %
	  incFissiPerc: 25,   // Target incidenza costi fissi %
	  rosPerc: 12,        // Target ROS %
	});
	
	const handleTargetChange = (field, value) => {
	  const num = Number(value);
	  setTargets((t) => ({
	    ...t,
	    [field]: isNaN(num) ? t[field] : num,
	  }));
	};

  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");
  const [capitaleInvestito, setCapitaleInvestito] = useState("");
  const [numeroClienti, setNumeroClienti] = useState("");
  const [whatIf, setWhatIf] = useState({
    ricaviDelta: 0,
    costiFissiDelta: 0,
    costiVariabiliDelta: 0,
    personaleDelta: 0,
  });

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mapped = results.data
          .map((r) => {
            const codice =
              r["Codice CE"] ||
              r["Codice"] ||
              r["Codice_CE"] ||
              r["codigo"] ||
              "";
            const descrizione =
              r["Descrizione CE"] ||
              r["Descrizione"] ||
              r["Descrizione_CE"] ||
              r["descrizione"] ||
              "";
            const importo = parseNumber(
              r["Importo"] || r["Valore"] || r["Amount"]
            );
            const categoria =
              r["Voce gestionale"] ||
              r["Categoria"] ||
              r["Categoria CE"] ||
              r["categoria"] ||
              "NON CLASSIFICATO";
            const anno = String(
              r["Anno"] || r["Year"] || r["anno"] || ""
            ).trim();
            const periodo =
              (r["Periodo"] || r["Quarter"] || r["periodo"] || "ANNO").trim() ||
              "ANNO";

            if (!codice && !descrizione && !importo) return null;

            return {
              codice,
              descrizione,
              importo,
              categoria,
              anno,
              periodo,
            };
          })
          .filter(Boolean);

        setRows(mapped);
      },
      error: (err) => {
        console.error("Errore parsing CSV:", err);
        alert("Errore nel parsing del CSV. Controlla il file.");
      },
    });
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchYear =
        selectedYear === "ALL" || r.anno === String(selectedYear);
      const matchPeriod =
        selectedPeriod === "ALL" || r.periodo === String(selectedPeriod);
      return matchYear && matchPeriod;
    });
  }, [rows, selectedYear, selectedPeriod]);

  const baseMetrics = useMemo(() => {
    if (!filteredRows.length) {
      return {
        ricaviTotali: 0,
        costiVariabili: 0,
        costiFissi: 0,
        costiCommerciali: 0,
        costiPersonale: 0,
        costiGenerali: 0,
        ammortamenti: 0,
        proventiOneriFin: 0,
        imposte: 0,
      };
    }

    let ricaviTotali = 0;
    let costiVariabili = 0;
    let costiFissi = 0;
    let costiCommerciali = 0;
    let costiPersonale = 0;
    let costiGenerali = 0;
    let ammortamenti = 0;
    let proventiOneriFin = 0;
    let imposte = 0;

    filteredRows.forEach((r) => {
      const v = r.importo;
      const cat = r.categoria.toLowerCase();

      if (
        cat.includes("ricavi operativi") ||
        cat.includes("ricavi") ||
        cat.includes("non classificato")
      ) {
        ricaviTotali += v;
      } else if (cat.includes("costi variabili")) {
        costiVariabili += v;
      } else if (cat.includes("costi fissi")) {
        costiFissi += v;
      } else if (cat.includes("costi commerciali")) {
        costiCommerciali += v;
      } else if (cat.includes("costi del personale")) {
        costiPersonale += v;
      } else if (cat.includes("costi generali")) {
        costiGenerali += v;
      } else if (cat.includes("ammortamenti")) {
        ammortamenti += v;
      } else if (cat.includes("proventi/") || cat.includes("oneri finan")) {
        proventiOneriFin += v;
      } else if (cat.includes("imposte")) {
        imposte += v;
      }
    });

    return {
      ricaviTotali,
      costiVariabili,
      costiFissi,
      costiCommerciali,
      costiPersonale,
      costiGenerali,
      ammortamenti,
      proventiOneriFin,
      imposte,
    };
  }, [filteredRows]);

  const kpi = useMemo(() => {
    const {
      ricaviTotali,
      costiVariabili,
      costiFissi,
      costiCommerciali,
      costiPersonale,
      costiGenerali,
      ammortamenti,
      proventiOneriFin,
      imposte,
    } = baseMetrics;

    const costiOperativi =
      costiVariabili + costiFissi + costiCommerciali + costiPersonale + costiGenerali;

    const margineContribuzione = ricaviTotali - costiVariabili;
    const EBITDA = ricaviTotali - costiOperativi;
    const EBITDAperc = ricaviTotali ? EBITDA / ricaviTotali : 0;
    const EBIT = EBITDA - ammortamenti;
    const risultatoAnteImposte = EBIT + proventiOneriFin;
    const utileNetto = risultatoAnteImposte - imposte;

    const capInv = parseNumber(capitaleInvestito);
    const clienti = parseNumber(numeroClienti);

    const ROI = capInv ? EBIT / capInv : null;
    const ROS = ricaviTotali ? EBIT / ricaviTotali : null;
    const ARPU = clienti ? ricaviTotali / clienti : null;

    const incVar = ricaviTotali ? costiVariabili / ricaviTotali : 0;
    const incFissi = ricaviTotali ? costiFissi / ricaviTotali : 0;

    return {
      ricaviTotali,
      costiOperativi,
      costiVariabili,
      costiFissi,
      costiCommerciali,
      costiPersonale,
      costiGenerali,
      margineContribuzione,
      EBITDA,
      EBITDAperc,
      EBIT,
      risultatoAnteImposte,
      utileNetto,
      ammortamenti,
      proventiOneriFin,
      imposte,
      ROI,
      ROS,
      ARPU,
      incVar,
      incFissi,
    };
  }, [baseMetrics, capitaleInvestito, numeroClienti]);
function buildAlerts(kpi, targets) {
  const alerts = { red: [], yellow: [], green: [] };

  const ricavi = kpi.ricaviTotali || 0;
  const costoPersPerc = ricavi ? (kpi.costiPersonale / ricavi) * 100 : 0;
  const ebitdaPerc = kpi.EBITDAperc * 100;
  const incVarPerc = kpi.incVar * 100;
  const incFissiPerc = kpi.incFissi * 100;
  const rosPerc = kpi.ROS !== null ? kpi.ROS * 100 : null;

  // 🔴 Costo personale
  if (ricavi > 0) {
    const target = targets.costoPersPerc;
    const delta = costoPersPerc - target;
    const riduzione = delta > 0 ? (delta / 100) * ricavi : 0;

    if (delta > 10) {
      alerts.red.push({
        id: "costo-personale-red",
        title: `CRITICO ROSSO: Costo personale critico: ${costoPersPerc.toFixed(
          1
        )}%`,
        subtitle: `Il costo del personale è ${delta.toFixed(
          1
        )} punti sopra il target del ${target.toFixed(
          1
        )}% ideale per una software house.`,
        actions: [
          riduzione > 0
            ? `Ridurre il costo del personale di circa ${formatEuro(
                Math.round(riduzione)
              )} su base annua.`
            : null,
          "Valutare una maggiore componente variabile legata ai risultati.",
          "Analizzare la produttività per FTE (full-time equivalente) per individuare aree a bassa resa.",
        ].filter(Boolean),
      });
    } else if (delta > 0) {
      alerts.yellow.push({
        id: "costo-personale-yellow",
        title: `ATTENZIONE GIALLO: Costo personale sopra target: ${costoPersPerc.toFixed(
          1
        )}%`,
        subtitle: `Il costo del personale è ${delta.toFixed(
          1
        )} punti sopra il target del ${target.toFixed(
          1
        )}%. Da monitorare attentamente.`,
        actions: [
          "Evitare nuove assunzioni strutturali finché il margine non migliora.",
          "Valutare outsourcing mirato su picchi di lavoro.",
        ],
      });
    } else {
      alerts.green.push({
        id: "costo-personale-green",
        title: `OK VERDE: Costo personale sotto controllo (${costoPersPerc.toFixed(
          1
        )}%)`,
        subtitle: `Il costo del personale è entro il target del ${target.toFixed(
          1
        )}%.`,
        actions: [
          "Mantenere il livello di efficienza attuale.",
          "Valutare eventuali assunzioni solo se correlate a ricavi ricorrenti.",
        ],
      });
    }
  }

  // 🔴 EBITDA %
  {
    const target = targets.ebitdaPerc;
    const delta = ebitdaPerc - target;
    if (ebitdaPerc < target - 5) {
      alerts.red.push({
        id: "ebitda-red",
        title: `CRITICO ROSSO: EBITDA debole: ${ebitdaPerc.toFixed(1)}%`,
        subtitle: `L’EBITDA è ${Math.abs(
          delta
        ).toFixed(1)} punti sotto il target del ${target.toFixed(
          1
        )}%. La redditività operativa è insufficiente per una software house.`,
        actions: [
          "Rivedere pricing e scontistica su progetti non profittevoli.",
          "Ridurre costi variabili non strategici (subforniture, consulenze spot).",
          "Analizzare i clienti/progetti con margine più basso e intervenire.",
        ],
      });
    } else if (ebitdaPerc < target) {
      alerts.yellow.push({
        id: "ebitda-yellow",
        title: `ATTENZIONE GIALLO: EBITDA sotto obiettivo: ${ebitdaPerc.toFixed(
          1
        )}%`,
        subtitle: `L’EBITDA è leggermente sotto il target del ${target.toFixed(
          1
        )}%.`,
        actions: [
          "Aumentare il tasso di fatturazione effettiva (billable vs non-billable).",
          "Migliorare l’allocazione delle risorse sui progetti più redditizi.",
        ],
      });
    } else {
      alerts.green.push({
        id: "ebitda-green",
        title: `OK VERDE: EBITDA sano: ${ebitdaPerc.toFixed(1)}%`,
        subtitle: `L’EBITDA è sopra il target del ${target.toFixed(
          1
        )}%. Buona marginalità operativa.`,
        actions: [
          "Valutare investimenti in prodotto, R&D o acquisition clienti.",
          "Consolidare i processi che stanno generando questo margine.",
        ],
      });
    }
  }

  // 🟡 Incidenza costi variabili
  if (ricavi > 0) {
    const incVar = incVarPerc;
    const target = targets.incVarPerc;
    const delta = incVar - target;

    if (delta > 10) {
      alerts.red.push({
        id: "costi-variabili-red",
        title: `CRITICO ROSSO: Costi variabili alti: ${incVar.toFixed(1)}%`,
        subtitle: `I costi variabili sono ${delta.toFixed(
          1
        )} punti sopra il target del ${target.toFixed(
          1
        )}%. Rischio di margini troppo compressi su progetti.`,
        actions: [
          "Rinegoziare tariffe con subfornitori e partner tecnici.",
          "Standardizzare maggiormente stack tecnologico e modalità di delivery.",
        ],
      });
    } else if (delta > 0) {
      alerts.yellow.push({
        id: "costi-variabili-yellow",
        title: `ATTENZIONE GIALLO: Costi variabili in aumento: ${incVar.toFixed(
          1
        )}%`,
        subtitle: `I costi variabili hanno superato il target del ${target.toFixed(
          1
        )}%.`,
        actions: [
          "Monitorare quali progetti generano più costi esterni.",
          "Valutare make or buy su alcune attività ripetitive.",
        ],
      });
    } else {
      alerts.green.push({
        id: "costi-variabili-green",
        title: `OK VERDE: Costi variabili in linea (${incVar.toFixed(1)}%)`,
        subtitle: `L’incidenza dei costi variabili è entro il target del ${target.toFixed(
          1
        )}%.`,
        actions: [
          "Mantenere la disciplina su preventivi e controllo ore esterne.",
        ],
      });
    }
  }

  // 🟡 ROS %
  if (rosPerc !== null) {
    const target = targets.rosPerc;
    const delta = rosPerc - target;
    if (rosPerc < target - 4) {
      alerts.red.push({
        id: "ros-red",
        title: `CRITICO ROSSO: ROS basso: ${rosPerc.toFixed(1)}%`,
        subtitle: `Il ROS è ${Math.abs(
          delta
        ).toFixed(1)} punti sotto il target del ${target.toFixed(
          1
        )}%. La redditività finale sulle vendite è troppo bassa.`,
        actions: [
          "Eliminare o riprezzare clienti e progetti strutturalmente in perdita.",
          "Allineare i listini al valore effettivo erogato (soprattutto sviluppo custom).",
        ],
      });
    } else if (rosPerc < target) {
      alerts.yellow.push({
        id: "ros-yellow",
        title: `ATTENZIONE GIALLO: ROS sotto obiettivo: ${rosPerc.toFixed(
          1
        )}%`,
        subtitle: `Il ROS è leggermente sotto il target del ${target.toFixed(
          1
        )}%.`,
        actions: [
          "Ridurre costi non core che non impattano la delivery.",
          "Spingere i servizi/prodotti con multipli di margine migliori.",
        ],
      });
    } else {
      alerts.green.push({
        id: "ros-green",
        title: `OK VERDE: ROS in linea: ${rosPerc.toFixed(1)}%`,
        subtitle: `La redditività sulle vendite è allineata o superiore al target.`,
        actions: [
          "Mantenere la disciplina su scontistiche e termini contrattuali.",
        ],
      });
    }
  }

  return alerts;
}
const alerts = useMemo(() => buildAlerts(kpi, targets), [kpi, targets]);

  const simulated = useMemo(() => {
    const {
      ricaviTotali,
      costiVariabili,
      costiFissi,
      costiCommerciali,
      costiPersonale,
      costiGenerali,
      ammortamenti,
      proventiOneriFin,
      imposte,
    } = baseMetrics;

    const ricaviSim = ricaviTotali * (1 + whatIf.ricaviDelta / 100);
    const costiVarSim = costiVariabili * (1 + whatIf.costiVariabiliDelta / 100);
    const costiFissiSim = costiFissi * (1 + whatIf.costiFissiDelta / 100);
    const costiPersSim = costiPersonale * (1 + whatIf.personaleDelta / 100);

    const costiOperativiSim =
      costiVarSim + costiFissiSim + costiCommerciali + costiPersSim + costiGenerali;

    const margineContribuzioneSim = ricaviSim - costiVarSim;
    const EbitdaSim = ricaviSim - costiOperativiSim;
    const EbitdaPercSim = ricaviSim ? EbitdaSim / ricaviSim : 0;
    const EbitSim = EbitdaSim - ammortamenti;
    const RisAnteImpSim = EbitSim + proventiOneriFin;
    const UtileNettoSim = RisAnteImpSim - imposte;

    return {
      ricaviSim,
      costiOperativiSim,
      margineContribuzioneSim,
      EbitdaSim,
      EbitdaPercSim,
      EbitSim,
      RisAnteImpSim,
      UtileNettoSim,
    };
  }, [baseMetrics, whatIf]);

  const trendData = useMemo(() => {
    const byPeriod = {};
    filteredRows.forEach((r) => {
      const key = r.periodo || "ANNO";
      if (!byPeriod[key]) {
        byPeriod[key] = { periodo: key, ricavi: 0, costi: 0 };
      }
      const v = r.importo;
      const cat = r.categoria.toLowerCase();
      if (cat.includes("ricavi") || cat.includes("non classificato")) {
        byPeriod[key].ricavi += v;
      } else {
        byPeriod[key].costi += v;
      }
    });
    return Object.values(byPeriod);
  }, [filteredRows]);

  const years = useMemo(() => {
    const s = new Set(rows.map((r) => r.anno).filter(Boolean));
    return ["ALL", ...Array.from(s)];
  }, [rows]);

  const periods = useMemo(() => {
    const s = new Set(rows.map((r) => r.periodo).filter(Boolean));
    return ["ALL", ...Array.from(s)];
  }, [rows]);

  const cfoInsight = useMemo(() => {
    const parts = [];
    if (!rows.length) {
      return "Carica un file CSV per iniziare l’analisi.";
    }

    if (kpi.EBITDAperc < 0.1) {
      parts.push(
        "L’EBITDA % è sotto il 10%, i margini operativi sono troppo compressi. Va rivisto subito il mix tra pricing, costi variabili e struttura fissa."
      );
    } else if (kpi.EBITDAperc > 0.2) {
      parts.push(
        "L’EBITDA % è sopra il 20%, ottima marginalità. Ha senso valutare investimenti su crescita, tecnologia o acquisizione clienti."
      );
    }

    if (kpi.costiPersonale > kpi.ricaviTotali * 0.4) {
      parts.push(
        "Il costo del personale supera il 40% dei ricavi: approfondisci saturazione delle risorse, automazione e uso di esterni on-demand."
      );
    }

    if (kpi.incVar > 0.5) {
      parts.push(
        "L’incidenza dei costi variabili è elevata: lavora su contratti fornitori, standardizzazione dei servizi e aumento del valore medio per cliente."
      );
    }

    if (kpi.utileNetto < 0) {
      parts.push(
        "Il risultato netto è negativo: prima priorità è riportare l’EBITDA in area verde, poi intervenire su oneri finanziari e fiscalità."
      );
    }

    if (!parts.length) {
      parts.push(
        "La struttura economica è complessivamente equilibrata. Il focus può essere spostato su crescita selettiva dei ricavi e miglior mix clienti."
      );
    }

    return parts.join(" ");
  }, [rows.length, kpi]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>CFO Dashboard</h1>
          <p>Conto economico riclassificato, KPI e simulazioni What-If</p>
        </div>
        <div className="header-badge">
          <DollarSign size={16} />
          <span>MDAC – Esperto CFO</span>
        </div>
      </header>

      {/* Sezione input */}
      <section className="card">
        <div className="card-header">
          <h2>Dati di input</h2>
        </div>
        <div className="card-body input-grid">
          <div className="file-upload">
            <label className="upload-label">
              <Upload size={18} />
              <span>Carica CSV da Google Sheets</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} />
            </label>
            <p className="helper-text">
              Il file deve contenere: <b>Codice CE, Descrizione CE, Importo, Voce
              gestionale, Anno, Periodo</b>.
            </p>
          </div>
          <div className="filters-grid">
            <div className="field">
              <label>Anno</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y === "ALL" ? "Tutti" : y}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Periodo</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p === "ALL" ? "Tutti" : p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Capitale investito (per ROI)</label>
              <input
                type="text"
                value={capitaleInvestito}
                onChange={(e) => setCapitaleInvestito(e.target.value)}
                placeholder="es. 150000"
              />
            </div>
            <div className="field">
              <label>Numero clienti (per ARPU)</label>
              <input
                type="text"
                value={numeroClienti}
                onChange={(e) => setNumeroClienti(e.target.value)}
                placeholder="es. 120"
              />
            </div>
          </div>
        </div>
      </section>
      <section className="card">
  <div className="card-header">
    <h2>Target KPI (Software house)</h2>
  </div>
  <div className="card-body filters-grid">
    <div className="field">
      <label>Target EBITDA %</label>
      <input
        type="number"
        value={targets.ebitdaPerc}
        onChange={(e) => handleTargetChange("ebitdaPerc", e.target.value)}
      />
      <small className="helper-text">
        Ideale software house: 18–22%
      </small>
    </div>
    <div className="field">
      <label>Target costo personale % su ricavi</label>
      <input
        type="number"
        value={targets.costoPersPerc}
        onChange={(e) => handleTargetChange("costoPersPerc", e.target.value)}
      />
      <small className="helper-text">
        Ideale software house: &lt;= 50–55%
      </small>
    </div>
    <div className="field">
      <label>Target incidenza costi variabili %</label>
      <input
        type="number"
        value={targets.incVarPerc}
        onChange={(e) => handleTargetChange("incVarPerc", e.target.value)}
      />
      <small className="helper-text">
        Ideale software house: &lt;= 40%
      </small>
    </div>
    <div className="field">
      <label>Target incidenza costi fissi %</label>
      <input
        type="number"
        value={targets.incFissiPerc}
        onChange={(e) => handleTargetChange("incFissiPerc", e.target.value)}
      />
      <small className="helper-text">
        Ideale software house: &lt;= 25–30%
      </small>
    </div>
    <div className="field">
      <label>Target ROS %</label>
      <input
        type="number"
        value={targets.rosPerc}
        onChange={(e) => handleTargetChange("rosPerc", e.target.value)}
      />
      <small className="helper-text">
        Ideale software house: &gt;= 12%
      </small>
    </div>
  </div>
</section>


      {/* KPI */}
      <section className="card">
        <div className="card-header">
          <h2>KPI principali</h2>
        </div>
        <div className="card-body kpi-grid">
          <Kpi label="Ricavi totali" value={formatEuro(kpi.ricaviTotali)} />
          <Kpi label="Costi operativi" value={formatEuro(kpi.costiOperativi)} />
          <Kpi label="Margine di contribuzione" value={formatEuro(kpi.margineContribuzione)} />
          <Kpi
            label="Margine di contribuzione %"
            value={(kpi.margineContribuzione / (kpi.ricaviTotali || 1) * 100).toFixed(1) + " %"}
          />
          <Kpi label="EBITDA" value={formatEuro(kpi.EBITDA)} highlight />
          <Kpi label="EBITDA %" value={(kpi.EBITDAperc * 100).toFixed(1) + " %"} highlight />
          <Kpi label="EBIT" value={formatEuro(kpi.EBIT)} />
          <Kpi label="Utile netto" value={formatEuro(kpi.utileNetto)} />
          <Kpi
            label="Incidenza costi variabili"
            value={(kpi.incVar * 100).toFixed(1) + " %"}
          />
          <Kpi
            label="Incidenza costi fissi"
            value={(kpi.incFissi * 100).toFixed(1) + " %"}
          />
          <Kpi
            label="ROI"
            value={
              kpi.ROI !== null ? (kpi.ROI * 100).toFixed(1) + " %" : "Inserisci capitale"
            }
          />
          <Kpi
            label="ROS"
            value={kpi.ROS !== null ? (kpi.ROS * 100).toFixed(1) + " %" : "N/D"}
          />
          <Kpi
            label="ARPU"
            value={kpi.ARPU !== null ? formatEuro(kpi.ARPU) : "Inserisci n. clienti"}
          />
        </div>
      </section>

      {/* Conto economico sintetico + grafico */}
      <section className="layout-two">
        <div className="card">
          <div className="card-header">
            <h2>Conto Economico Riclassificato (Sintesi)</h2>
          </div>
          <div className="card-body">
            <table className="ce-table">
              <tbody>
                <CeRow label="Ricavi operativi" value={kpi.ricaviTotali} />
                <CeRow label="Costi variabili diretti" value={kpi.costiVariabili} />
                <CeRow label="Margine di contribuzione" value={kpi.margineContribuzione} bold />
                <CeRow
                  label="Costi fissi + generali + commerciali"
                  value={kpi.costiFissi + kpi.costiGenerali + kpi.costiCommerciali}
                />
                <CeRow label="Costo del personale" value={kpi.costiPersonale} />
                <CeRow label="EBITDA" value={kpi.EBITDA} highlight />
                <CeRow label="Ammortamenti" value={kpi.ammortamenti} />
                <CeRow label="EBIT" value={kpi.EBIT} />
                <CeRow label="Proventi/Oneri finanziari" value={kpi.proventiOneriFin} />
                <CeRow label="Risultato ante imposte" value={kpi.risultatoAnteImposte} />
                <CeRow label="Imposte sul reddito" value={kpi.imposte} />
                <CeRow label="Utile netto" value={kpi.utileNetto} bold />
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Trend ricavi / costi per periodo</h2>
          </div>
          <div className="card-body chart-wrapper">
            {trendData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="periodo" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ricavi" name="Ricavi" />
                  <Bar dataKey="costi" name="Costi" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="helper-text">Carica dati per vedere il grafico.</p>
            )}
          </div>
        </div>
      </section>

      {/* What-If */}
      <section className="card">
        <div className="card-header">
          <h2>Simulazione What-If</h2>
        </div>
        <div className="card-body whatif-layout">
          <div className="whatif-controls">
            <SliderField
              label="Δ Ricavi (%)"
              value={whatIf.ricaviDelta}
              onChange={(v) => setWhatIf((w) => ({ ...w, ricaviDelta: v }))}
            />
            <SliderField
              label="Δ Costi variabili (%)"
              value={whatIf.costiVariabiliDelta}
              onChange={(v) => setWhatIf((w) => ({ ...w, costiVariabiliDelta: v }))}
            />
            <SliderField
              label="Δ Costi fissi (%)"
              value={whatIf.costiFissiDelta}
              onChange={(v) => setWhatIf((w) => ({ ...w, costiFissiDelta: v }))}
            />
            <SliderField
              label="Δ Costo del personale (%)"
              value={whatIf.personaleDelta}
              onChange={(v) => setWhatIf((w) => ({ ...w, personaleDelta: v }))}
            />
          </div>
          <div className="whatif-summary">
            <h3>Scenario simulato</h3>
            <ul>
              <li>Ricavi simulati: {formatEuro(simulated.ricaviSim)}</li>
              <li>Costi operativi simulati: {formatEuro(simulated.costiOperativiSim)}</li>
              <li>
                Margine di contribuzione:{" "}
                {formatEuro(simulated.margineContribuzioneSim)}
              </li>
              <li>EBITDA simulato: {formatEuro(simulated.EbitdaSim)}</li>
              <li>
                EBITDA % simulata: {(simulated.EbitdaPercSim * 100).toFixed(1)} %
              </li>
              <li>EBIT simulato: {formatEuro(simulated.EbitSim)}</li>
              <li>Utile netto simulato: {formatEuro(simulated.UtileNettoSim)}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Insight + Suggerimenti */}
<section className="layout-two">
  <div className="card">
    <div className="card-header">
      <h2>
        Alert & Azioni – Semaforo KPI{" "}
        <TrendingUp size={18} className="icon-inline" />
      </h2>
    </div>
    <div className="card-body">
      {!rows.length && (
        <p className="helper-text">
          Carica un CSV per vedere gli alert e le azioni consigliate.
        </p>
      )}

      {rows.length > 0 && (
        <div className="alert-groups">
          {alerts.red.length > 0 && (
            <div className="alert-block alert-red">
              <h3>CRITICO ROSSO</h3>
              {alerts.red.map((a) => (
                <div key={a.id} className="alert-item">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-subtitle">{a.subtitle}</div>
                  <div className="alert-actions-label">AZIONI CONSIGLIATE:</div>
                  <ul>
                    {a.actions.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {alerts.yellow.length > 0 && (
            <div className="alert-block alert-yellow">
              <h3>ATTENZIONE GIALLO</h3>
              {alerts.yellow.map((a) => (
                <div key={a.id} className="alert-item">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-subtitle">{a.subtitle}</div>
                  <div className="alert-actions-label">AZIONI CONSIGLIATE:</div>
                  <ul>
                    {a.actions.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {alerts.green.length > 0 && (
            <div className="alert-block alert-green">
              <h3>OK VERDE</h3>
              {alerts.green.map((a) => (
                <div key={a.id} className="alert-item">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-subtitle">{a.subtitle}</div>
                  <div className="alert-actions-label">NOTE:</div>
                  <ul>
                    {a.actions.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>

  <div className="card">
    <div className="card-header">
      <h2>
        Insight del CFO – Commento Strategico{" "}
        <AlertTriangle size={18} className="icon-inline warning" />
      </h2>
    </div>
    <div className="card-body">
      <p className="insight-text">
        Questo pannello sintetizza lo stato della software house partendo dai
        KPI chiave: EBITDA %, costo del personale, incidenza costi variabili,
        ROS e struttura dei costi. Usa il semaforo a sinistra per priorizzare
        gli interventi: prima riduzione dei costi critici (rosso), poi
        ottimizzazione (giallo), infine consolidamento delle aree in salute
        (verde).
      </p>
    </div>
  </div>
</section>


      <footer className="app-footer">
        <span>MDAC – CFO Dashboard prototipo</span>
      </footer>
    </div>
  );
}

function Kpi({ label, value, highlight }) {
  return (
    <div className={`kpi-card ${highlight ? "kpi-highlight" : ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function SliderField({ label, value, onChange }) {
  return (
    <div className="slider-field">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-value">{value}%</span>
      </div>
      <input
        type="range"
        min={-50}
        max={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function CeRow({ label, value, bold, highlight }) {
  return (
    <tr className={highlight ? "ce-row-highlight" : ""}>
      <td className={bold || highlight ? "ce-label-strong" : ""}>{label}</td>
      <td className={bold || highlight ? "ce-value-strong" : ""}>
        {formatEuro(value)}
      </td>
    </tr>
  );
}

export default App;
