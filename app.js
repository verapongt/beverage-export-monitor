const palette = ["#0f766e", "#c77700", "#2563eb", "#be3455", "#15803d", "#7c3aed", "#db6b2b", "#475569", "#0891b2", "#a16207"];

const hsDescriptions = {
  "220210": "Waters, mineral waters and aerated waters, sweetened/flavoured",
  "220291": "Non-alcoholic beer",
  "220299": "Other non-alcoholic beverages",
  "200989": "Other fruit or vegetable juice blends",
  "200990": "Mixtures of juices",
  "210690": "Food preparations for beverages",
  "090240": "Tea extracts and tea preparations",
  "170490": "Sugar confectionery and jelly products",
  "180690": "Cocoa preparations and drink bases",
  "220110": "Mineral waters and aerated waters, not sweetened"
};

const baseCountries = [
  { country: "Indonesia", factor: 1.25 },
  { country: "Philippines", factor: 1.08 },
  { country: "Vietnam", factor: 0.98 },
  { country: "Cambodia", factor: 0.82 },
  { country: "Laos", factor: 0.7 },
  { country: "Myanmar", factor: 0.64 },
  { country: "Malaysia", factor: 0.58 },
  { country: "China", factor: 0.52 },
  { country: "United States", factor: 0.43 },
  { country: "Australia", factor: 0.35 }
];

const productMix = [
  ["220299", 0.36],
  ["220210", 0.27],
  ["200990", 0.12],
  ["200989", 0.09],
  ["210690", 0.07],
  ["090240", 0.04],
  ["220291", 0.025],
  ["170490", 0.015],
  ["180690", 0.012],
  ["220110", 0.008]
];

let rows = buildSampleRows();
const state = { period: "latest", country: "All countries" };

const els = {
  periodSelect: document.querySelector("#periodSelect"),
  countrySelect: document.querySelector("#countrySelect"),
  resetButton: document.querySelector("#resetButton"),
  lastUpdated: document.querySelector("#lastUpdated"),
  kpiGrid: document.querySelector("#kpiGrid"),
  trendChart: document.querySelector("#trendChart"),
  countryTrendChart: document.querySelector("#countryTrendChart"),
  shareChart: document.querySelector("#shareChart"),
  signalBoard: document.querySelector("#signalBoard"),
  countryBars: document.querySelector("#countryBars"),
  productBars: document.querySelector("#productBars"),
  treemap: document.querySelector("#treemap"),
  countryDetailTitle: document.querySelector("#countryDetailTitle"),
  csvInput: document.querySelector("#csvInput"),
  sampleButton: document.querySelector("#sampleButton")
};

function buildSampleRows() {
  const periods = [];
  for (let year = 2024; year <= 2025; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      periods.push(`${year}-${String(month).padStart(2, "0")}`);
    }
  }

  return periods.flatMap((period, index) => {
    const seasonal = 1 + Math.sin((index / 12) * Math.PI * 2) * 0.09;
    const growth = 1 + index * 0.018;
    return baseCountries.flatMap((country, countryIndex) => {
      return productMix.map(([hsCode, share], productIndex) => {
        const pulse = 1 + Math.cos((index + countryIndex + productIndex) * 0.75) * 0.045;
        const value = 48_000_000 * country.factor * share * seasonal * growth * pulse;
        return {
          period,
          hs_code: hsCode,
          product_description: hsDescriptions[hsCode],
          country: country.country,
          value_fob: Math.round(value),
          quantity: Math.round(value / (32 + productIndex * 4)),
          unit: "kg",
          source: "Sample dataset based on HS 2202 dashboard spec",
          downloaded_at: "2026-06-06T13:45:00+07:00"
        };
      });
    });
  });
}

function init() {
  wireEvents();
  populateFilters();
  render();
}

function wireEvents() {
  els.periodSelect.addEventListener("change", (event) => {
    state.period = event.target.value;
    render();
  });

  els.countrySelect.addEventListener("change", (event) => {
    state.country = event.target.value;
    render();
  });

  els.resetButton.addEventListener("click", () => {
    state.period = "latest";
    state.country = "All countries";
    populateFilters();
    render();
  });

  els.sampleButton.addEventListener("click", () => {
    rows = buildSampleRows();
    state.period = "latest";
    state.country = "All countries";
    populateFilters();
    render();
  });

  els.csvInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    rows = parseCsv(text);
    state.period = "latest";
    state.country = "All countries";
    populateFilters();
    render();
  });
}

function populateFilters() {
  const periods = unique(rows.map((row) => row.period)).sort();
  const latest = periods[periods.length - 1];
  const countries = unique(rows.map((row) => row.country)).sort();

  els.periodSelect.innerHTML = [
    `<option value="latest">Latest (${latest})</option>`,
    ...periods.map((period) => `<option value="${period}">${period}</option>`)
  ].join("");
  els.periodSelect.value = state.period;

  els.countrySelect.innerHTML = [
    `<option>All countries</option>`,
    ...countries.map((country) => `<option>${escapeHtml(country)}</option>`)
  ].join("");
  els.countrySelect.value = state.country;
}

function render() {
  const periods = unique(rows.map((row) => row.period)).sort();
  const latestPeriod = state.period === "latest" ? periods[periods.length - 1] : state.period;
  const visibleRows = rows.filter((row) => row.period === latestPeriod && (state.country === "All countries" || row.country === state.country));
  const allLatestRows = rows.filter((row) => row.period === latestPeriod);
  const comparisonRows = state.country === "All countries" ? allLatestRows : visibleRows;
  const currentValue = sum(visibleRows, "value_fob");
  const currentQuantity = sum(visibleRows, "quantity");
  const mom = percentChange(currentValue, valueForOffset(latestPeriod, -1, state.country));
  const yoy = percentChange(currentValue, valueForOffset(latestPeriod, -12, state.country));
  const topCountry = topN(groupBySum(comparisonRows, "country", "value_fob"), 1)[0];
  const downloadedAt = latest(rows.map((row) => row.downloaded_at).filter(Boolean));

  els.lastUpdated.textContent = `Updated ${formatDate(downloadedAt)}`;
  els.kpiGrid.innerHTML = [
    kpi("Export value", formatMoney(currentValue), "FOB value, selected scope"),
    kpi("Quantity", formatQuantity(currentQuantity), "Reported where HS detail has unit"),
    kpi("MoM", formatPercent(mom), "Month-on-month", mom),
    kpi("YoY", formatPercent(yoy), `Compared with ${shiftPeriod(latestPeriod, -12)}`, yoy)
  ].join("");

  renderTrendChart(latestPeriod);
  renderCountryTrendChart();
  renderShareChart(allLatestRows);
  renderSignalBoard(latestPeriod);
  renderCountryBars(allLatestRows);
  renderProductDetail(visibleRows, latestPeriod);
  els.countryDetailTitle.textContent = `Top 10 สินค้าส่งออกไป ${state.country === "All countries" ? topCountry?.key || "Top country" : state.country}`;
}

function kpi(label, value, hint, deltaValue) {
  const deltaClass = Number.isFinite(deltaValue) && deltaValue < 0 ? "delta down" : "delta";
  const meta = Number.isFinite(deltaValue) ? `<div class="${deltaClass}">${formatPercent(deltaValue)}</div>` : `<p>${hint}</p>`;
  return `<article class="kpi"><span>${label}</span><strong>${value}</strong>${meta}<p>${hint}</p></article>`;
}

function renderTrendChart(latestPeriod) {
  const periods = unique(rows.map((row) => row.period)).sort().slice(-18);
  const series = periods.map((period) => ({
    period,
    value: sum(rows.filter((row) => row.period === period && (state.country === "All countries" || row.country === state.country)), "value_fob") / 1_000_000
  }));
  els.trendChart.innerHTML = lineChart(series, { color: "#0f766e", labelEvery: 3, height: 300, markerPeriod: latestPeriod });
}

function renderCountryTrendChart() {
  const periods = unique(rows.map((row) => row.period)).sort().slice(-12);
  const countries = topN(groupBySum(rows.filter((row) => row.period === periods[periods.length - 1]), "country", "value_fob"), 6).map((item) => item.key);
  const grouped = countries.map((country, index) => ({
    name: country,
    color: palette[index],
    values: periods.map((period) => ({
      period,
      value: sum(rows.filter((row) => row.period === period && row.country === country), "value_fob") / 1_000_000
    }))
  }));
  els.countryTrendChart.innerHTML = multiLineChart(periods, grouped);
}

function renderShareChart(latestRows) {
  const items = topN(groupBySum(latestRows, "country", "value_fob"), 8);
  const totalValue = sum(latestRows, "value_fob");
  els.shareChart.innerHTML = items.map((item, index) => {
    const share = totalValue ? item.value / totalValue : 0;
    return `<div class="share-item">
      <span><i class="share-swatch" style="background:${palette[index]}"></i> ${escapeHtml(item.key)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${share * 100}%; background:${palette[index]}"></div></div>
      <span>${formatPercent(share, 0)}</span>
    </div>`;
  }).join("");
}

function renderSignalBoard(latestPeriod) {
  const latestRows = rows.filter((row) => row.period === latestPeriod);
  const items = topN(groupBySum(latestRows, "country", "value_fob"), 5);
  els.signalBoard.innerHTML = items.map((item) => {
    const countryValue = item.value;
    const mom = percentChange(countryValue, valueForOffset(latestPeriod, -1, item.key));
    const yoy = percentChange(countryValue, valueForOffset(latestPeriod, -12, item.key));
    const direction = yoy >= 8 && mom >= 0 ? "Accelerating" : yoy < 0 || mom < -6 ? "Slowing" : "Stable";
    return `<div class="signal-card">
      <div><strong>${escapeHtml(item.key)}</strong><span>MoM ${formatPercent(mom)} / YoY ${formatPercent(yoy)}</span></div>
      <span class="${direction === "Slowing" ? "delta down" : "delta"}">${direction}</span>
    </div>`;
  }).join("");
}

function renderCountryBars(latestRows) {
  const items = topN(groupBySum(latestRows, "country", "value_fob"), 10);
  els.countryBars.innerHTML = barRows(items, items[0]?.value || 1, (item) => item.key);
}

function renderProductDetail(visibleRows, latestPeriod) {
  const targetCountry = state.country === "All countries"
    ? topN(groupBySum(rows.filter((row) => row.period === latestPeriod), "country", "value_fob"), 1)[0]?.key
    : state.country;
  const detailRows = rows.filter((row) => row.period === latestPeriod && row.country === targetCountry);
  const items = topN(groupBySum(detailRows, "hs_code", "value_fob"), 10).map((item) => ({
    ...item,
    label: `${item.key} ${hsDescriptions[item.key] || ""}`
  }));
  els.productBars.innerHTML = barRows(items, items[0]?.value || 1, (item) => item.label);
  els.treemap.innerHTML = items.map((item, index) => {
    const share = item.value / sum(detailRows, "value_fob");
    return `<div class="tile" style="--basis:${Math.max(120, share * 620)}px; background:${palette[index % palette.length]}">
      <span>${escapeHtml(item.key)}<br>${formatPercent(share, 0)}</span>
    </div>`;
  }).join("");
}

function barRows(items, maxValue, labelGetter) {
  return items.map((item) => {
    const width = Math.max(2, (item.value / maxValue) * 100);
    return `<div class="bar-row">
      <div class="bar-name">${escapeHtml(labelGetter(item))}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <div class="bar-value">${formatMoney(item.value)}</div>
    </div>`;
  }).join("");
}

function lineChart(series, options = {}) {
  const width = 840;
  const height = options.height || 280;
  const pad = { top: 18, right: 24, bottom: 42, left: 52 };
  const maxValue = Math.max(...series.map((point) => point.value), 1);
  const points = series.map((point, index) => {
    const x = pad.left + (index / Math.max(series.length - 1, 1)) * (width - pad.left - pad.right);
    const y = height - pad.bottom - (point.value / maxValue) * (height - pad.top - pad.bottom);
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${points[points.length - 1].x},${height - pad.bottom} L${points[0].x},${height - pad.bottom} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" aria-label="Monthly export trend">
    <path d="${area}" fill="${options.color || "#0f766e"}" opacity="0.12"></path>
    <path d="${path}" fill="none" stroke="${options.color || "#0f766e"}" stroke-width="3" stroke-linecap="round"></path>
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}" stroke="#dce5e1"></line>
    <line x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${height - pad.bottom}" stroke="#dce5e1"></line>
    ${points.map((point, index) => index % (options.labelEvery || 2) === 0 ? `<text class="axis-text" x="${point.x}" y="${height - 14}" text-anchor="middle">${point.period.slice(5)}</text>` : "").join("")}
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${point.period === options.markerPeriod ? 5 : 3}" fill="${options.color || "#0f766e"}"></circle>`).join("")}
    <text class="axis-text" x="8" y="${pad.top + 4}">${Math.round(maxValue).toLocaleString()}mn</text>
  </svg>`;
}

function multiLineChart(periods, grouped) {
  const width = 900;
  const height = 320;
  const pad = { top: 18, right: 24, bottom: 58, left: 54 };
  const maxValue = Math.max(...grouped.flatMap((series) => series.values.map((point) => point.value)), 1);
  const xFor = (index) => pad.left + (index / Math.max(periods.length - 1, 1)) * (width - pad.left - pad.right);
  const yFor = (value) => height - pad.bottom - (value / maxValue) * (height - pad.top - pad.bottom);
  const lines = grouped.map((series) => {
    const path = series.values.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(" ");
    return `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linecap="round"></path>`;
  }).join("");
  const legend = grouped.map((series, index) => `<text class="axis-text" x="${pad.left + index * 135}" y="${height - 12}" fill="${series.color}">● ${series.name}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" aria-label="Country trend comparison">
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}" stroke="#dce5e1"></line>
    <line x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${height - pad.bottom}" stroke="#dce5e1"></line>
    ${lines}
    ${periods.map((period, index) => index % 2 === 0 ? `<text class="axis-text" x="${xFor(index)}" y="${height - 35}" text-anchor="middle">${period.slice(5)}</text>` : "").join("")}
    <text class="axis-text" x="8" y="${pad.top + 4}">${Math.round(maxValue).toLocaleString()}mn</text>
    ${legend}
  </svg>`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map((header) => header.trim());
  return lines.filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    return {
      ...row,
      value_fob: Number(row.value_fob || row.value || 0),
      quantity: Number(row.quantity || 0),
      product_description: row.product_description || hsDescriptions[row.hs_code] || "Imported CSV product"
    };
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function groupBySum(items, key, valueKey) {
  const map = new Map();
  items.forEach((item) => map.set(item[key], (map.get(item[key]) || 0) + Number(item[valueKey] || 0)));
  return [...map.entries()].map(([itemKey, value]) => ({ key: itemKey, value }));
}

function topN(items, count) {
  return [...items].sort((a, b) => b.value - a.value).slice(0, count);
}

function valueForOffset(period, offsetMonths, country) {
  const shifted = shiftPeriod(period, offsetMonths);
  return sum(rows.filter((row) => row.period === shifted && (country === "All countries" || row.country === country)), "value_fob");
}

function shiftPeriod(period, offsetMonths) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function percentChange(current, previous) {
  if (!previous) return NaN;
  return (current - previous) / previous;
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function latest(values) {
  return values.sort().at(-1);
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "-";
  return `฿${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}mn`;
}

function formatQuantity(value) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}mn kg`;
  return `${Math.round(value).toLocaleString()} kg`;
}

function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

function formatDate(value) {
  if (!value) return "not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
