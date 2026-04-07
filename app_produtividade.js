/* ─── Produtividade — Clinica Cavallieri ─────────────────────────────── */

const API_PRODUTIVIDADE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/resumo";

const OCTA_KLINIKI_MAP = {
    "Claudio Maximiano": "CMGJ", "Julia Chaves": "JSC", "Maria D Sousa": "MDS",
    "Rosangela Alcantara Lima": "RAL", "Rosangela Tavares": "RDT", "Vanessa Waeger": "VS",
    "Jane Sousa": "JSL", "Gessica Oliveira": "GOS", "Rose Martins": "RGM",
    "Claudia Barbosa": "DUDU", "Diana Anchieta": "DC", "Nelia de Abreu Silva": "RAS",
    "Cristialine Silva": "CJS", "Renata Aquino": "RAC", "Dayane": "DSR",
    "CLINICA CAVALLIERI": null, "Enfermagem Cavallieri": null
};

const STORAGE_OCULTOS = "cavalieri_ocultos";
let prodData = null;
let prodModoHoje = false;
let prodRefreshTimer = null;
let chartRanking = null;
let chartWhats = null;
const prodEl = {};

function formatSeg(s) { if (!s) return '-'; const m = Math.floor(s/60); const r = s%60; return m > 0 ? `${m}m${String(r).padStart(2,'0')}s` : `${r}s`; }
function getOcultos() { try { return JSON.parse(window.localStorage.getItem(STORAGE_OCULTOS)) || []; } catch(e) { return []; } }
function salvarOcultos(a) { window.localStorage.setItem(STORAGE_OCULTOS, JSON.stringify(a)); }
function isOculto(s) { return getOcultos().indexOf(s) >= 0; }
function toggleOculto(s) { const a = getOcultos(); const i = a.indexOf(s); if (i>=0) a.splice(i,1); else a.push(s); salvarOcultos(a); renderProd(); }
function buildOctaMap(octa) { const r = {}; for (const a of (octa||[])) { const s = OCTA_KLINIKI_MAP[a.agente]; if (s) r[s] = a; } return r; }

function initProdutividade() {
    prodEl.section = document.getElementById("secaoProdutividade");
    prodEl.ano = document.getElementById("anoProd");
    prodEl.mes = document.getElementById("mesProd");
    prodEl.btnAtualizar = document.getElementById("btnAtualizarProd");
    prodEl.btnHoje = document.getElementById("btnHojeProd");
    prodEl.tabela = document.getElementById("tabelaProd");
    prodEl.cardTel = document.getElementById("cardTelefone");
    prodEl.cardWpp = document.getElementById("cardWhatsapp");
    prodEl.cardCon = document.getElementById("cardConsolidado");
    prodEl.chartRank = document.getElementById("chartRankingProd");
    prodEl.chartWhats = document.getElementById("chartWhatsProd");
    prodEl.status = document.getElementById("statusProd");
    if (!prodEl.section) return;

    const h = new Date();
    for (let a = h.getFullYear(); a >= h.getFullYear()-3; a--) { const o = new Option(a,a); prodEl.ano.add(o); }
    ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].forEach((m,i) => { prodEl.mes.add(new Option(m,i+1)); });
    prodEl.ano.value = h.getFullYear();
    prodEl.mes.value = h.getMonth()+1;

    prodEl.btnAtualizar.addEventListener("click", () => { prodModoHoje = false; prodEl.btnAtualizar.classList.add("active"); prodEl.btnHoje.classList.remove("active"); if(prodRefreshTimer){clearInterval(prodRefreshTimer);prodRefreshTimer=null;} carregarProd(); });
    prodEl.ano.addEventListener("change", () => { prodModoHoje = false; carregarProd(); });
    prodEl.mes.addEventListener("change", () => { prodModoHoje = false; carregarProd(); });
    prodEl.btnHoje.addEventListener("click", () => {
        const h = new Date(); prodEl.ano.value = h.getFullYear(); prodEl.mes.value = h.getMonth()+1;
        prodModoHoje = true; prodEl.btnHoje.classList.add("active"); prodEl.btnAtualizar.classList.remove("active");
        carregarProd(); prodRefreshTimer = setInterval(carregarProd, 120000);
    });
}

async function carregarProd() {
    const ano = prodEl.ano.value, mes = prodEl.mes.value;
    let diaParam = "";
    if (prodModoHoje) { const h = new Date(); diaParam = `&dia=${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`; }

    showStatus("Carregando...", "info");
    try {
        // Kliniki+3CX primeiro (rápido), OctaDesk em paralelo
        const [r1, r2] = await Promise.all([
            fetch(`${API_PRODUTIVIDADE}?ano=${ano}&mes=${mes}&com_3cx=1${diaParam}`),
            fetch(`${API_PRODUTIVIDADE}?ano=${ano}&mes=${mes}&com_octa=1${diaParam}`)
        ]);
        const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.erro || "Erro");
        prodData = j1.data;
        renderProd();
        hideStatus();

        try { const j2 = await r2.json(); if (j2.ok && j2.data) { prodData.octadesk = j2.data.octadesk; renderProd(); } } catch(e) {}

        if (prodModoHoje) { showStatus("HOJE realtime — atualiza a cada 2 min", "info"); setTimeout(hideStatus, 3000); }
    } catch (err) { showStatus("Falha: " + err.message, "error"); }
}

function showStatus(m, t) { if (!prodEl.status) return; prodEl.status.hidden = false; prodEl.status.className = `status-banner ${t}`; prodEl.status.textContent = m; }
function hideStatus() { if (prodEl.status) prodEl.status.hidden = true; }

// ── Render ────────────────────────────────────────────────────────────

function renderProd() {
    if (!prodData) return;
    const marc = prodData.marcacao || [];
    const recep = prodData.recepcao || [];
    const octa = prodData.octadesk || [];
    const octaMap = buildOctaMap(octa);

    renderCards(marc, recep, octa);
    renderTabelas(marc, recep, octaMap);
    renderChartRanking(marc, octaMap);
    renderChartWpp(octa);
}

function renderCards(marc, recep, octa) {
    const totalLig = prodData.ligacoes_total || 0;
    prodEl.cardTel.innerHTML = totalLig
        ? `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE</div><div class="prod-card-big">${totalLig}</div><div class="prod-card-label">Ligacoes Atendidas</div>`
        : `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE</div><div class="prod-card-big" style="font-size:16px;color:#96b7ff;">Sem dados</div>`;

    const totalWpp = octa.reduce((s,a) => s + (a.total||0), 0);
    prodEl.cardWpp.innerHTML = `<div class="prod-card-icon">&#128172;</div><div class="prod-card-title">WHATSAPP</div><div class="prod-card-big">${totalWpp}</div><div class="prod-card-label">Conversas</div>`;

    const totalAg = marc.reduce((s,u) => s + (u.agendamentos||0), 0);
    const totalAdm = recep.reduce((s,u) => s + (u.admissoes||0), 0);
    prodEl.cardCon.innerHTML = `<div class="prod-card-icon">&#128200;</div><div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${totalAg}</div><div class="prod-card-label">Agendamentos</div>
        <div class="prod-card-sub">Admissoes: ${totalAdm}</div>`;
}

function renderTabelas(marc, recep, octaMap) {
    if (!prodEl.tabela) return;
    let html = "";

    // ── MARCAÇÃO ──
    const marcFilt = marc.filter(u => !isOculto(u.usuario) && ((u.agendamentos||0) + (u.ligacoes||0) > 0))
        .map(u => {
            const wpp = (octaMap[u.usuario]||{}).total || 0;
            const total = (u.agendamentos||0) + (u.ligacoes||0) + wpp;
            return { ...u, wpp, total };
        }).sort((a,b) => b.total - a.total);

    html += `<div class="prod-section-title">MARCACAO</div>`;
    html += `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th><th>Setor</th>
        <th>Agend.</th><th>Ligacoes</th><th>T.Med</th><th>WhatsApp</th><th>TOTAL</th><th></th>
    </tr></thead><tbody>`;
    let pos = 1;
    for (const u of marcFilt) {
        const setor = u.setor_atual || '-';
        const setorClass = setor === 'marcacao' ? 'setor-marc' : (setor === 'recepcao' ? 'setor-recep' : '');
        html += `<tr>
            <td class="rank-cell">${pos++}</td>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="${setorClass}">${setor}</td>
            <td class="num-cell">${u.agendamentos || 0}</td>
            <td class="num-cell">${u.ligacoes || '-'}</td>
            <td class="num-cell">${formatSeg(u.tempo_medio_lig)}</td>
            <td class="num-cell">${u.wpp || '-'}</td>
            <td class="num-cell total-cell">${u.total}</td>
            <td><button class="btn-ocultar" onclick="toggleOculto('${u.usuario}')">x</button></td>
        </tr>`;
    }
    const tA = marcFilt.reduce((s,u) => s + (u.agendamentos||0), 0);
    const tL = marcFilt.reduce((s,u) => s + (u.ligacoes||0), 0);
    const tW = marcFilt.reduce((s,u) => s + u.wpp, 0);
    const tT = marcFilt.reduce((s,u) => s + u.total, 0);
    html += `<tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${tA}</td><td class="num-cell">${tL||'-'}</td><td></td>
        <td class="num-cell">${tW||'-'}</td><td class="num-cell total-cell">${tT}</td><td></td>
    </tr></tbody></table>`;

    // ── RECEPÇÃO ──
    const recFilt = recep.filter(u => !isOculto(u.usuario) && (u.admissoes||0) > 0)
        .sort((a,b) => (b.admissoes||0) - (a.admissoes||0));

    html += `<div class="prod-section-title">RECEPCAO</div>`;
    html += `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th><th>Setor</th><th>Admissoes</th><th></th>
    </tr></thead><tbody>`;
    pos = 1;
    for (const u of recFilt) {
        const setor = u.setor_atual || '-';
        const setorClass = setor === 'recepcao' ? 'setor-recep' : (setor === 'marcacao' ? 'setor-marc' : '');
        html += `<tr>
            <td class="rank-cell">${pos++}</td>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="${setorClass}">${setor}</td>
            <td class="num-cell total-cell">${u.admissoes || 0}</td>
            <td><button class="btn-ocultar" onclick="toggleOculto('${u.usuario}')">x</button></td>
        </tr>`;
    }
    const tAdm = recFilt.reduce((s,u) => s + (u.admissoes||0), 0);
    html += `<tr class="total-row"><td colspan="4" style="text-align:right;">TOTAL</td>
        <td class="num-cell total-cell">${tAdm}</td><td></td>
    </tr></tbody></table>`;

    // Ocultos
    const ocultos = getOcultos();
    if (ocultos.length) {
        html += `<div style="margin-top:12px;padding:8px;font-size:11px;color:#96b7ff;">
            Ocultos: ${ocultos.map(s => `<button class="btn-restaurar" onclick="toggleOculto('${s}')">${s}</button>`).join(' ')}
        </div>`;
    }

    prodEl.tabela.innerHTML = html;
}

function renderChartRanking(marc, octaMap) {
    const top = marc.filter(u => !isOculto(u.usuario))
        .map(u => {
            const wpp = (octaMap[u.usuario]||{}).total || 0;
            const total = (u.agendamentos||0) + (u.ligacoes||0) + wpp;
            return { ...u, wpp, total };
        }).filter(u => u.total > 0).sort((a,b) => b.total - a.total).slice(0, 15);

    if (chartRanking) chartRanking.destroy();
    chartRanking = new Chart(prodEl.chartRank, {
        type: "bar",
        data: {
            labels: top.map(u => u.usuario),
            datasets: [
                { label: "Agendamentos", data: top.map(u => u.agendamentos||0), backgroundColor: "#3a86ff" },
                { label: "Ligacoes", data: top.map(u => u.ligacoes||0), backgroundColor: "#f2c94c" },
                { label: "WhatsApp", data: top.map(u => u.wpp), backgroundColor: "#25d366" }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#fff", boxWidth: 10 } }, datalabels: { display: false } },
            scales: {
                x: { stacked: true, ticks: { color: "#fff" }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } }
            }
        }
    });
}

function renderChartWpp(octa) {
    const sorted = (octa||[]).filter(a => a.agente !== "SEM AGENTE" && a.agente !== "CLINICA CAVALLIERI" && a.agente !== "Enfermagem Cavallieri")
        .sort((a,b) => b.total - a.total);
    if (chartWhats) chartWhats.destroy();
    if (!sorted.length) return;
    chartWhats = new Chart(prodEl.chartWhats, {
        type: "bar",
        data: {
            labels: sorted.map(a => { const s = OCTA_KLINIKI_MAP[a.agente]; return s ? `${s}` : a.agente; }),
            datasets: [
                { label: "Recebidos", data: sorted.map(a => a.inbound||0), backgroundColor: "#25d366" },
                { label: "Enviados", data: sorted.map(a => a.outbound||0), backgroundColor: "#128c7e" }
            ]
        },
        options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#fff", boxWidth: 10 } }, datalabels: { color: "#fff", font: { size: 9, weight: "bold" } } },
            scales: {
                x: { stacked: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { stacked: true, ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}
