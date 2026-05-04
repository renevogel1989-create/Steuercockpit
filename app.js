const STORAGE_KEY = "steuerCockpit.v1";
const categories = {
  income: ["Umsaetze", "Privateinlagen", "Erstattungen", "Sonstige Einnahmen"],
  expense: ["Wareneinkauf / Fremdleistungen", "Buerobedarf", "Software / Lizenzen", "Telefon / Internet", "Fahrzeugkosten", "Reisekosten", "Bewirtung", "Fortbildung", "Versicherungen", "Bankgebuehren", "Arbeitszimmer / Homeoffice", "Abschreibungen / Anlagegueter", "Sonstige Betriebsausgaben"]
};
const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const id = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const eur = (value) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const dateDE = (value) => new Intl.DateTimeFormat("de-DE").format(new Date(value));
const sum = (items, pick = (x) => x) => items.reduce((total, item) => total + Number(pick(item) || 0), 0);
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const demo = {
  profile: { name: "", business: "", kmRate: 0.3, smallBusiness: "yes", activities: [{ id: "trade", name: "Gewerbe", type: "trade" }, { id: "freelance", name: "Freiberuflich", type: "freelance" }] },
  transactions: [{ id: id(), type: "income", date: `${new Date().getFullYear()}-01-15`, amount: 1190, vat: 19, category: "Umsaetze", activity: "trade", partner: "Beispielkunde", description: "Projektrechnung Januar", payment: "Bank", receipt: "digital", deductible: 100 }, { id: id(), type: "expense", date: `${new Date().getFullYear()}-01-18`, amount: 59, vat: 19, category: "Software / Lizenzen", activity: "trade", partner: "SaaS Anbieter", description: "Monatsabo", payment: "Kreditkarte", receipt: "missing", deductible: 100 }],
  trips: [{ id: id(), date: `${new Date().getFullYear()}-01-21`, startTime: "09:00", endTime: "10:15", type: "business", activity: "trade", kmStart: 15300, kmEnd: 15342, from: "Buero", to: "Kunde Musterstadt", purpose: "Projektbesprechung Beispielkunde", notes: "" }],
  provisions: [{ id: id(), type: "vat", activity: "trade", dueDate: `${new Date().getFullYear()}-04-10`, amount: 180, description: "UStVA Q1 Beispiel", status: "planned" }]
};
let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalize(saved || demo);
  } catch {
    return clone(demo);
  }
}
function normalize(input) {
  const next = { ...clone(demo), ...input, profile: { ...clone(demo.profile), ...(input.profile || {}) } };
  next.transactions = Array.isArray(input.transactions) ? input.transactions : [];
  next.trips = Array.isArray(input.trips) ? input.trips : [];
  next.provisions = Array.isArray(input.provisions) ? input.provisions : [];
  next.profile.activities = Array.isArray(next.profile.activities) && next.profile.activities.length ? next.profile.activities : clone(demo.profile.activities);
  [...next.transactions, ...next.trips, ...next.provisions].forEach((item) => item.activity ||= next.profile.activities[0].id);
  return next;
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function activities() { return state.profile.activities || demo.profile.activities; }
function firstActivity() { return activities()[0]?.id || "trade"; }
function activityName(value) { return activities().find((item) => item.id === value)?.name || value || "Gewerbe"; }
function selectedYear() { return Number($("yearSelect").value || new Date().getFullYear()); }
function selectedMonth() { return $("monthSelect").value || "all"; }
function selectedActivity() { return $("activityFilter").value || "all"; }
function inPeriod(item, key = "date") { const d = new Date(item[key]); return d.getFullYear() === selectedYear() && (selectedMonth() === "all" || String(d.getMonth() + 1).padStart(2, "0") === selectedMonth()); }
function inActivity(item) { return selectedActivity() === "all" || (item.activity || firstActivity()) === selectedActivity(); }
function transactions() { return state.transactions.filter((x) => inPeriod(x)).filter(inActivity).sort((a, b) => b.date.localeCompare(a.date)); }
function trips() { return state.trips.filter((x) => inPeriod(x)).filter(inActivity).sort((a, b) => b.date.localeCompare(a.date)); }
function provisions() { return state.provisions.filter((x) => inPeriod(x, "dueDate")).filter(inActivity).sort((a, b) => a.dueDate.localeCompare(b.dueDate)); }
function deductible(item) { return Number(item.amount || 0) * Number(item.deductible || 100) / 100; }
function vatAmount(item) { const rate = Number(item.vat || 0), amount = Number(item.amount || 0); if (!rate || !amount) return 0; const vat = amount - amount / (1 + rate / 100); return item.type === "expense" ? vat * Number(item.deductible || 100) / 100 : vat; }
function tripKm(item) { return Number(item.kmEnd || 0) - Number(item.kmStart || 0); }

window.addEventListener("DOMContentLoaded", init);
function init() {
  setupControls(); bindEvents(); render();
  if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
function setupControls() {
  const years = new Set([new Date().getFullYear(), ...state.transactions.map((x) => new Date(x.date).getFullYear()), ...state.trips.map((x) => new Date(x.date).getFullYear()), ...state.provisions.map((x) => new Date(x.dueDate).getFullYear())]);
  $("yearSelect").innerHTML = [...years].sort((a, b) => b - a).map((y) => `<option>${y}</option>`).join("");
  $("yearSelect").value = String(new Date().getFullYear());
  for (let m = 1; m <= 12; m++) $("monthSelect").insertAdjacentHTML("beforeend", `<option value="${String(m).padStart(2, "0")}">${new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(2026, m - 1, 1))}</option>`);
  ["transactionDate", "tripDate", "provisionDueDate"].forEach((field) => $(field).value = today());
  fillCategories(); fillActivities();
}
function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => tab.onclick = () => switchTab(tab.dataset.tab));
  ["yearSelect", "monthSelect", "activityFilter", "transactionFilter"].forEach((id) => $(id).addEventListener("change", render));
  $("transactionSearch").addEventListener("input", renderTransactions);
  $("transactionType").addEventListener("change", fillCategories);
  $("transactionForm").addEventListener("submit", saveTransaction);
  $("tripForm").addEventListener("submit", saveTrip);
  $("provisionForm").addEventListener("submit", saveProvision);
  $("profileForm").addEventListener("submit", saveProfile);
  $("clearTransactionForm").onclick = clearTransactionForm; $("clearTripForm").onclick = clearTripForm; $("clearProvisionForm").onclick = clearProvisionForm;
  $("exportTransactionsButton").onclick = () => exportCsv("buchungen", transactions()); $("exportTripsButton").onclick = () => exportCsv("fahrtenbuch", trips()); $("exportVatButton").onclick = () => exportCsv("ustva", vatRows());
  $("copyVatButton").onclick = copyVat; $("copyEuerButton").onclick = copyEuer; $("exportBackupButton").onclick = backup; $("printButton").onclick = () => print();
  $("importBackupInput").addEventListener("change", importBackup); $("resetDataButton").onclick = resetDemo;
}
function switchTab(id) { document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === id)); document.querySelectorAll(".panel").forEach((x) => x.classList.toggle("active", x.id === id)); }
function fillCategories() { const type = $("transactionType").value || "income"; $("transactionCategory").innerHTML = categories[type].map((x) => `<option>${esc(x)}</option>`).join(""); }
function fillActivities() { const opts = activities().map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join(""); $("activityFilter").innerHTML = `<option value="all">Alle Taetigkeiten</option>${opts}`; ["transactionActivity", "tripActivity", "provisionActivity"].forEach((id) => $(id).innerHTML = opts); }
function render() { fillActivities(); renderProfile(); renderDashboard(); renderTransactions(); renderTrips(); renderVat(); renderProvisions(); renderEuer(); renderTips(); }
function metric(label, value, sub) { return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></article>`; }
function renderDashboard() {
  const tx = transactions(), tr = trips(), pr = provisions();
  const income = sum(tx.filter((x) => x.type === "income"), deductible), expense = sum(tx.filter((x) => x.type === "expense"), deductible), km = sum(tr.filter((x) => x.type === "business"), tripKm);
  $("metricGrid").innerHTML = metric("Einnahmen", eur(income), `${tx.filter((x) => x.type === "income").length} Buchungen`) + metric("Ausgaben", eur(expense), `${tx.filter((x) => x.type === "expense").length} Buchungen`) + metric("Vorlaeufiger Gewinn", eur(income - expense), "EUR-Basis") + metric("Betriebliche km", `${km.toLocaleString("de-DE")} km`, eur(km * Number(state.profile.kmRate || 0.3))) + metric("Offene Ruecklagen", eur(sum(pr.filter((x) => x.status !== "paid"), (x) => x.amount)), "Liquiditaet planen");
  renderChart(); renderTasks();
}
function renderChart() {
  const months = Array.from({ length: 12 }, (_, i) => ({ label: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(selectedYear(), i, 1)), income: 0, expense: 0 }));
  state.transactions.filter((x) => new Date(x.date).getFullYear() === selectedYear()).forEach((x) => months[new Date(x.date).getMonth()][x.type] += deductible(x));
  const max = Math.max(1, ...months.flatMap((x) => [x.income, x.expense])); $("monthSummary").textContent = `Maximum ${eur(max)}`;
  $("monthChart").innerHTML = months.map((m) => `<div class="bar-group"><div class="bars"><span class="bar income" style="height:${Math.max(3, m.income / max * 180)}px"></span><span class="bar expense" style="height:${Math.max(3, m.expense / max * 180)}px"></span></div><span class="bar-label">${m.label}</span></div>`).join("");
}
function renderTasks() { const hints = taxHints().filter((x) => x.priority === "high"); $("taskCount").textContent = "4 Punkte"; $("taskList").innerHTML = [`${transactions().filter((x) => x.receipt === "missing").length} fehlende Belege pruefen.`, `${tripIssues().length} Fahrtenbuch-Hinweise pruefen.`, `${hints.length} wichtige Steuerhinweise ansehen.`, "EUR- und UStVA-Werte vor Abgabe abstimmen."].map((x) => `<li>${esc(x)}</li>`).join(""); }
function saveTransaction(e) { e.preventDefault(); upsert(state.transactions, { id: $("transactionId").value || id(), type: $("transactionType").value, date: $("transactionDate").value, amount: Number($("transactionAmount").value), vat: Number($("transactionVat").value), category: $("transactionCategory").value, activity: $("transactionActivity").value, partner: $("transactionPartner").value.trim(), description: $("transactionDescription").value.trim(), payment: $("transactionPayment").value, receipt: $("transactionReceipt").value, deductible: Number($("transactionDeductible").value || 100) }); save(); clearTransactionForm(); render(); }
function renderTransactions() { const q = $("transactionSearch").value.toLowerCase(), f = $("transactionFilter").value; let rows = transactions().filter((x) => f === "all" || (f === "missing" ? x.receipt === "missing" : x.type === f)).filter((x) => `${x.category} ${x.partner} ${x.description}`.toLowerCase().includes(q)); $("transactionTable").innerHTML = rows.length ? rows.map((x) => `<tr><td>${dateDE(x.date)}</td><td><span class="badge">${x.type === "income" ? "Einnahme" : "Ausgabe"}</span></td><td>${esc(x.category)}</td><td>${esc(activityName(x.activity))}</td><td><strong>${esc(x.description || "-")}</strong><br><span class="muted">${esc(x.partner || x.payment)}</span></td><td class="number">${eur(x.amount)}</td><td class="number">${eur(vatAmount(x))}</td><td class="number">${eur(deductible(x))}</td><td>${receiptLabel(x.receipt)}</td><td><button class="icon-button" onclick="editTransaction('${x.id}')">E</button><button class="icon-button danger" onclick="del('transactions','${x.id}')">X</button></td></tr>`).join("") : empty(10); }
window.editTransaction = (key) => { const x = state.transactions.find((i) => i.id === key); if (!x) return; ["transactionId", "transactionType", "transactionDate", "transactionAmount", "transactionVat", "transactionPartner", "transactionDescription", "transactionPayment", "transactionReceipt", "transactionDeductible"].forEach((field) => $(field).value = x[field.replace("transaction", "").charAt(0).toLowerCase() + field.replace("transaction", "").slice(1)] ?? ""); fillCategories(); $("transactionCategory").value = x.category; $("transactionActivity").value = x.activity; switchTab("transactions"); };
function clearTransactionForm() { $("transactionForm").reset(); $("transactionId").value = ""; $("transactionDate").value = today(); $("transactionDeductible").value = 100; fillCategories(); $("transactionActivity").value = firstActivity(); }
function saveTrip(e) { e.preventDefault(); const kmStart = Number($("tripKmStart").value), kmEnd = Number($("tripKmEnd").value); if (kmEnd <= kmStart) return alert("End-km muss groesser als Start-km sein."); upsert(state.trips, { id: $("tripId").value || id(), date: $("tripDate").value, startTime: $("tripStartTime").value, endTime: $("tripEndTime").value, type: $("tripType").value, activity: $("tripActivity").value, kmStart, kmEnd, from: $("tripFrom").value.trim(), to: $("tripTo").value.trim(), purpose: $("tripPurpose").value.trim(), notes: $("tripNotes").value.trim() }); save(); clearTripForm(); render(); }
function renderTrips() { const rows = trips(), total = sum(rows, tripKm), business = sum(rows.filter((x) => x.type === "business"), tripKm), commute = sum(rows.filter((x) => x.type === "commute"), tripKm), priv = sum(rows.filter((x) => x.type === "private"), tripKm); $("tripSummary").textContent = `${total.toLocaleString("de-DE")} km gesamt`; $("tripMeters").innerHTML = [["Betrieblich", business], ["Arbeitsweg", commute], ["Privat", priv]].map(([n, v]) => `<div class="meter"><div class="meter-top"><strong>${n}</strong><span>${v.toLocaleString("de-DE")} km</span></div><div class="meter-track"><div class="meter-fill" style="width:${total ? v / total * 100 : 0}%"></div></div></div>`).join(""); $("tripIssues").innerHTML = tripIssues().map((x) => `<li class="${x.level}">${esc(x.text)}</li>`).join("") || "<li>Keine offensichtlichen Luecken.</li>"; $("tripIssueCount").textContent = `${tripIssues().length} Hinweis(e)`; $("tripTable").innerHTML = rows.length ? rows.map((x) => `<tr><td>${dateDE(x.date)}<br><span class="muted">${esc([x.startTime, x.endTime].filter(Boolean).join(" - "))}</span></td><td><span class="badge">${tripType(x.type)}</span></td><td>${esc(activityName(x.activity))}</td><td>${esc(x.from)} -> ${esc(x.to)}</td><td>${esc(x.purpose)}</td><td class="number">${tripKm(x)}</td><td class="number">${x.kmEnd}</td><td><button class="icon-button danger" onclick="del('trips','${x.id}')">X</button></td></tr>`).join("") : empty(8); }
function tripIssues() { const list = [], rows = [...trips()].sort((a, b) => a.date.localeCompare(b.date)); rows.forEach((x) => { if (!x.purpose || x.purpose.length < 6) list.push({ level: "warning", text: `${dateDE(x.date)}: Zweck konkreter erfassen.` }); if (x.kmEnd <= x.kmStart) list.push({ level: "danger", text: `${dateDE(x.date)}: Kilometerstand pruefen.` }); }); for (let i = 1; i < rows.length; i++) if (rows[i].kmStart > rows[i - 1].kmEnd + 30) list.push({ level: "warning", text: `${dateDE(rows[i].date)}: km-Luecke vor dieser Fahrt.` }); return list; }
function clearTripForm() { $("tripForm").reset(); $("tripId").value = ""; $("tripDate").value = today(); $("tripActivity").value = firstActivity(); }
function vatRows() { const rows = [1, 2, 3, 4].map((q) => ({ quarter: `Q${q}`, net19: 0, net7: 0, outputVat: 0, inputVat: 0, payable: 0 })); state.transactions.filter((x) => new Date(x.date).getFullYear() === selectedYear()).filter(inActivity).forEach((x) => { const rate = Number(x.vat || 0); if (!rate) return; const row = rows[Math.floor(new Date(x.date).getMonth() / 3)], net = Number(x.amount || 0) / (1 + rate / 100), vat = vatAmount(x); if (x.type === "income") { if (rate === 19) row.net19 += net; if (rate === 7) row.net7 += net; row.outputVat += vat; } else row.inputVat += vat; }); rows.forEach((r) => r.payable = r.outputVat - r.inputVat); return rows; }
function renderVat() { const rows = vatRows(), out = sum(rows, (x) => x.outputVat), inp = sum(rows, (x) => x.inputVat), pay = sum(rows, (x) => x.payable); $("vatMetricGrid").innerHTML = metric("USt auf Umsaetze", eur(out), state.profile.smallBusiness === "yes" ? "Nur informativ" : "Regelbesteuerung") + metric("Vorsteuer", eur(inp), "Aus Ausgaben") + metric("Zahllast", eur(pay), "Ruecklage planen") + metric("Zeitraum", String(selectedYear()), selectedActivity() === "all" ? "Alle Taetigkeiten" : activityName(selectedActivity())); $("vatTable").innerHTML = rows.map((r) => `<tr><td>${r.quarter}</td><td class="number">${eur(r.net19)}</td><td class="number">${eur(r.net7)}</td><td class="number">${eur(r.outputVat)}</td><td class="number">${eur(r.inputVat)}</td><td class="number">${eur(r.payable)}</td></tr>`).join(""); $("vatChecklist").innerHTML = ["Quartalswerte mit Rechnungen und Belegen abstimmen.", "ELSTER UStVA fuer passenden Voranmeldungszeitraum oeffnen.", "Umsaetze, Umsatzsteuer und Vorsteuer getrennt uebernehmen.", "Zahllast als Ruecklage einplanen."].map((x) => `<li>${x}</li>`).join(""); }
function saveProvision(e) { e.preventDefault(); upsert(state.provisions, { id: $("provisionId").value || id(), type: $("provisionType").value, activity: $("provisionActivity").value, dueDate: $("provisionDueDate").value, amount: Number($("provisionAmount").value), description: $("provisionDescription").value.trim(), status: $("provisionStatus").value }); save(); clearProvisionForm(); render(); }
function renderProvisions() { const rows = provisions(); $("provisionMetricGrid").innerHTML = metric("Offen", eur(sum(rows.filter((x) => x.status !== "paid"), (x) => x.amount)), "Geplant oder zurueckgelegt") + metric("Zurueckgelegt", eur(sum(rows.filter((x) => x.status === "reserved"), (x) => x.amount)), "Reserve") + metric("Bezahlt", eur(sum(rows.filter((x) => x.status === "paid"), (x) => x.amount)), "Erledigt") + metric("Naechste Faelligkeit", rows.find((x) => x.status !== "paid") ? dateDE(rows.find((x) => x.status !== "paid").dueDate) : "Keine", "Kalender pruefen"); $("provisionTable").innerHTML = rows.length ? rows.map((x) => `<tr><td>${dateDE(x.dueDate)}</td><td><span class="badge">${provType(x.type)}</span></td><td>${esc(activityName(x.activity))}</td><td>${esc(x.description || "-")}</td><td>${provStatus(x.status)}</td><td class="number">${eur(x.amount)}</td><td><button class="icon-button danger" onclick="del('provisions','${x.id}')">X</button></td></tr>`).join("") : empty(7); }
function clearProvisionForm() { $("provisionForm").reset(); $("provisionId").value = ""; $("provisionDueDate").value = today(); $("provisionActivity").value = firstActivity(); }
function renderEuer() { const tx = transactions(), inc = group(tx.filter((x) => x.type === "income")), exp = group(tx.filter((x) => x.type === "expense")); $("incomeGroups").innerHTML = groupsHtml(inc, "Noch keine Einnahmen."); $("expenseGroups").innerHTML = groupsHtml(exp, "Noch keine Ausgaben."); $("elsterChecklist").innerHTML = ["Anlage EUR fuer passendes Jahr vorbereiten.", "Bei mehreren Taetigkeiten getrennte Auswertung pruefen.", "Belege geordnet aufbewahren.", "Fahrtenbuch exportieren und archivieren."].map((x) => `<li>${x}</li>`).join(""); }
function renderTips() { const hints = taxHints(); $("taxHintCount").textContent = `${hints.length} Hinweis(e)`; $("taxHintList").innerHTML = hints.length ? hints.map((h) => `<article class="hint"><span class="hint-priority ${h.priority}">${hintLabel(h.priority)}</span><div><strong>${esc(h.title)}</strong><p>${esc(h.body)}</p></div><small>${esc(h.scope)}</small></article>`).join("") : `<article class="hint"><span class="hint-priority">OK</span><div><strong>Keine auffaelligen Punkte</strong><p>Keine einfachen automatischen Pruefhinweise im Zeitraum.</p></div><small>${selectedYear()}</small></article>`; $("tipsGrid").innerHTML = ["Belege lueckenlos sammeln", "Fahrten sofort konkret erfassen", "Reisekosten pruefen", "Software und Arbeitsmittel pruefen", "Homeoffice/Arbeitszimmer pruefen", "Kleinunternehmer-Check"].map((t) => `<article class="tip"><strong>${t}</strong><p>Als Pruefpunkt vormerken und mit Belegen nachvollziehbar dokumentieren.</p></article>`).join(""); }
function taxHints() { const tx = transactions(), exp = tx.filter((x) => x.type === "expense"), inc = tx.filter((x) => x.type === "income"), pr = provisions(), hints = []; const miss = tx.filter((x) => x.receipt === "missing"); if (miss.length) hints.push({ priority: "high", title: "Fehlende Belege nachpflegen", body: `${miss.length} Buchung(en) ohne Beleg. Nachweise priorisieren.`, scope: "Belege" }); const vmiss = exp.filter((x) => x.vat > 0 && x.receipt === "missing"); if (vmiss.length) hints.push({ priority: "high", title: "Vorsteuer nur mit Beleg", body: `${vmiss.length} Ausgabe(n) mit Vorsteuer, aber fehlendem Beleg.`, scope: "Vorsteuer" }); if (exp.some((x) => x.category === "Bewirtung")) hints.push({ priority: "medium", title: "Bewirtung pruefen", body: "Anlass, Teilnehmer und Beleg sauber dokumentieren.", scope: "Bewirtung" }); if (tx.some((x) => x.deductible < 100)) hints.push({ priority: "medium", title: "Privatanteil dokumentieren", body: "Aufteilung kurz begruenden und dauerhaft nachvollziehbar halten.", scope: "Privatanteil" }); if (exp.some((x) => x.amount >= 800 && ["Abschreibungen / Anlagegueter", "Buerobedarf", "Software / Lizenzen"].includes(x.category))) hints.push({ priority: "medium", title: "Anlagegut oder Sofortabzug", body: "Groessere Anschaffung auf AfA/GWG/Sofortabzug pruefen.", scope: "AfA" }); const pay = sum(vatRows(), (x) => x.payable), reserve = sum(pr.filter((x) => x.type === "vat" && x.status !== "paid"), (x) => x.amount); if (state.profile.smallBusiness === "no" && pay > reserve + 1) hints.push({ priority: "high", title: "USt-Ruecklage zu niedrig", body: `Zahllast ${eur(pay)}, Ruecklage ${eur(reserve)}. Differenz einplanen.`, scope: "UStVA" }); if (tripIssues().length) hints.push({ priority: "high", title: "Fahrtenbuch vervollstaendigen", body: `${tripIssues().length} Plausibilitaetshinweis(e) gefunden.`, scope: "Fahrtenbuch" }); if (inc.length && !pr.some((x) => ["incomeTax", "tradeTax"].includes(x.type) && x.status !== "paid")) hints.push({ priority: "low", title: "Steuer-Ruecklage pruefen", body: "ESt-/Gewerbesteuer als Liquiditaetsplanung aufnehmen.", scope: "Ruecklagen" }); return hints.sort((a, b) => score(b.priority) - score(a.priority)); }
function saveProfile(e) { e.preventDefault(); const list = activities(); state.profile = { name: $("profileName").value.trim(), business: $("profileBusiness").value.trim(), kmRate: Number($("profileKmRate").value || 0.3), smallBusiness: $("profileSmallBusiness").value, activities: [{ id: list[0]?.id || "trade", name: $("profileActivityOne").value.trim() || "Gewerbe", type: $("profileActivityOneType").value }, { id: list[1]?.id || "freelance", name: $("profileActivityTwo").value.trim() || "Freiberuflich", type: $("profileActivityTwoType").value }] }; save(); render(); }
function renderProfile() { $("profileName").value = state.profile.name || ""; $("profileBusiness").value = state.profile.business || ""; $("profileKmRate").value = state.profile.kmRate ?? 0.3; $("profileSmallBusiness").value = state.profile.smallBusiness || "yes"; $("profileActivityOne").value = activities()[0]?.name || "Gewerbe"; $("profileActivityOneType").value = activities()[0]?.type || "trade"; $("profileActivityTwo").value = activities()[1]?.name || "Freiberuflich"; $("profileActivityTwoType").value = activities()[1]?.type || "freelance"; }
function group(items) { return items.reduce((g, x) => (g[x.category] = (g[x.category] || 0) + deductible(x), g), {}); }
function groupsHtml(groups, emptyText) { const rows = Object.entries(groups).sort((a, b) => b[1] - a[1]); return rows.length ? rows.map(([k, v]) => `<div class="group-row"><span>${esc(k)}</span><strong>${eur(v)}</strong></div>`).join("") : `<p class="muted">${emptyText}</p>`; }
function upsert(list, item) { const i = list.findIndex((x) => x.id === item.id); i >= 0 ? list[i] = item : list.push(item); }
window.del = (listName, key) => { state[listName] = state[listName].filter((x) => x.id !== key); save(); render(); };
function empty(cols) { return `<tr><td colspan="${cols}" class="empty">Noch keine Daten erfasst.</td></tr>`; }
function receiptLabel(x) { return ({ available: "Vorhanden", missing: "Fehlt", digital: "Digital" })[x] || x; }
function tripType(x) { return ({ business: "Betrieblich", commute: "Arbeitsweg", private: "Privat" })[x] || x; }
function provType(x) { return ({ vat: "Umsatzsteuer", incomeTax: "Einkommensteuer", tradeTax: "Gewerbesteuer", social: "Vorsorge", other: "Sonstiges" })[x] || x; }
function provStatus(x) { return ({ planned: "Geplant", reserved: "Zurueckgelegt", paid: "Bezahlt" })[x] || x; }
function hintLabel(x) { return ({ high: "Wichtig", medium: "Pruefen", low: "Merken" })[x] || "Hinweis"; }
function score(x) { return ({ high: 3, medium: 2, low: 1 })[x] || 0; }
function csvCell(x) { return `"${String(x ?? "").replaceAll('"', '""')}"`; }
function exportCsv(name, rows) { if (!rows.length) return alert("Keine Daten fuer den Zeitraum."); const keys = Object.keys(rows[0]); download(`${name}-${selectedYear()}-${selectedMonth()}.csv`, [keys.join(";"), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(";"))].join("\n"), "text/csv;charset=utf-8"); }
function download(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function copyText(text) { navigator.clipboard?.writeText(text).then(() => alert("Kopiert.")).catch(() => alert(text)); }
function copyVat() { copyText(vatRows().map((r) => `${r.quarter}: USt ${eur(r.outputVat)}, Vorsteuer ${eur(r.inputVat)}, Zahllast ${eur(r.payable)}`).join("\n")); }
function copyEuer() { const inc = group(transactions().filter((x) => x.type === "income")), exp = group(transactions().filter((x) => x.type === "expense")); copyText(["EUR-Zusammenfassung", "Einnahmen:", ...Object.entries(inc).map(([k, v]) => `- ${k}: ${eur(v)}`), "Ausgaben:", ...Object.entries(exp).map(([k, v]) => `- ${k}: ${eur(v)}`)].join("\n")); }
function backup() { download(`steuer-cockpit-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json"); }
function importBackup(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { state = normalize(JSON.parse(reader.result)); save(); render(); } catch { alert("Backup konnte nicht importiert werden."); } }; reader.readAsText(file); }
function resetDemo() { if (!confirm("Alle lokalen Daten auf Demostand zuruecksetzen?")) return; state = clone(demo); save(); render(); }
