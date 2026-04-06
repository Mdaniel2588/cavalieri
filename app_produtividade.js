/* ─── Produtividade — Clinica Cavallieri ─────────────────────────────── */

const API_PRODUTIVIDADE = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/resumo";
const API_DIARIO        = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/diario";

// Mapeamento OctaDesk agente → sigla Kliniki
const OCTA_KLINIKI_MAP = {
    "Claudio Maximiano":        "CMGJ",
    "Julia Chaves":             "JSC",
    "Maria D Sousa":            "MDS",
    "Rosangela Alcantara Lima": "RAL",
    "Rosangela Tavares":        "RDT",
    "Vanessa Waeger":           "VS",
    "Jane Sousa":               "JSL",
    "CLINICA CAVALLIERI":       null,
    "Enfermagem Cavallieri":    null
};

const STORAGE_SETORES = "cavalieri_setores";

function formatSeg(seg) {
    if (!seg) return '-';
    const min = Math.floor(seg / 60);
    const s = seg % 60;
    return min > 0 ? `${min}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

let prodData = null;
let prodDiario = null;
let chartProdBar = null;
let chartProdPhone = null;
let chartProdWhats = null;

const prodElements = {};

// ── Init ──────────────────────────────────────────────────────────────

function initProdutividade() {
    prodElements.section       = document.getElementById("secaoProdutividade");
    prodElements.anoProd       = document.getElementById("anoProd");
    prodElements.mesProd       = document.getElementById("mesProd");
    prodElements.btnAtualizar  = document.getElementById("btnAtualizarProd");
    prodElements.tabela        = document.getElementById("tabelaProd");
    prodElements.cardTelefone  = document.getElementById("cardTelefone");
    prodElements.cardWhatsapp  = document.getElementById("cardWhatsapp");
    prodElements.cardConsolid  = document.getElementById("cardConsolidado");
    prodElements.chartBarProd  = document.getElementById("chartBarProd");
    prodElements.chartPhoneProd = document.getElementById("chartPhoneProd");
    prodElements.chartWhatsProd = document.getElementById("chartWhatsProd");
    prodElements.statusProd    = document.getElementById("statusProd");

    if (!prodElements.section) return;

    preencherFiltrosProd();
    prodElements.btnAtualizar.addEventListener("click", carregarProdutividade);
    prodElements.anoProd.addEventListener("change", carregarProdutividade);
    prodElements.mesProd.addEventListener("change", carregarProdutividade);
}

function preencherFiltrosProd() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    for (let a = anoAtual; a >= anoAtual - 3; a--) {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        prodElements.anoProd.appendChild(opt);
    }
    const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    meses.forEach((m, i) => {
        const opt = document.createElement("option");
        opt.value = i + 1;
        opt.textContent = m;
        prodElements.mesProd.appendChild(opt);
    });
    prodElements.anoProd.value = anoAtual;
    prodElements.mesProd.value = hoje.getMonth() + 1;
}

async function carregarProdutividade() {
    const ano = prodElements.anoProd.value;
    const mes = prodElements.mesProd.value;

    showProdStatus("Carregando dados...", "info");

    try {
        const [resResumo, resDiario] = await Promise.all([
            fetch(`${API_PRODUTIVIDADE}?ano=${ano}&mes=${mes}&com_3cx=1&com_octa=1`),
            fetch(`${API_DIARIO}?ano=${ano}&mes=${mes}`)
        ]);

        const jsonResumo = await resResumo.json();
        const jsonDiario = await resDiario.json();

        if (!jsonResumo.ok) throw new Error(jsonResumo.erro || "Erro na API");

        prodData = jsonResumo.data;
        prodDiario = jsonDiario.ok ? jsonDiario.diario : [];

        renderProdutividade();
        hideProdStatus();
    } catch (err) {
        showProdStatus("Falha ao carregar: " + err.message, "error");
        console.error(err);
    }
}

function showProdStatus(msg, type) {
    if (prodElements.statusProd) {
        prodElements.statusProd.hidden = false;
        prodElements.statusProd.className = `status-banner ${type}`;
        prodElements.statusProd.textContent = msg;
    }
}

function hideProdStatus() {
    if (prodElements.statusProd) {
        prodElements.statusProd.hidden = true;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────

function getSetoresConfig() {
    try {
        const raw = window.localStorage.getItem(STORAGE_SETORES);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

function salvarSetores(setores) {
    window.localStorage.setItem(STORAGE_SETORES, JSON.stringify(setores));
}

function isAtendente(u) {
    const setores = getSetoresConfig();
    const tipo = setores[u.usuario];
    if (tipo) return tipo === "marcacao" || tipo === "recepcao";
    const cargo = (u.cargo || "").toUpperCase();
    const setor = (u.setor || "").toUpperCase();
    if (cargo.indexOf("MEDIC") >= 0 || cargo.indexOf("DRA") >= 0 || cargo.indexOf("DR ") >= 0) return false;
    if (cargo.indexOf("INFORM") >= 0) return false;
    if (setor.indexOf("RECEP") >= 0 || cargo.indexOf("ATENDENTE") >= 0) return true;
    if ((u.agendamentos || 0) > 0) return true;
    if ((u.cadastros_paciente || 0) > 5) return true;
    return false;
}

function isMedico(u) {
    const setores = getSetoresConfig();
    const tipo = setores[u.usuario];
    if (tipo) return tipo === "medico";
    const cargo = (u.cargo || "").toUpperCase();
    if (cargo.indexOf("MEDIC") >= 0 || cargo.indexOf("DRA") >= 0 || cargo.indexOf("DR ") >= 0) return true;
    if ((u.laudos_digitados || 0) > 0 && (u.agendamentos || 0) === 0 && (u.cadastros_paciente || 0) === 0) return true;
    return false;
}

// Mapear octadesk para siglas Kliniki
function buildOctaPorSigla(octadesk) {
    const resultado = {};
    for (const a of octadesk) {
        const sigla = OCTA_KLINIKI_MAP[a.agente];
        if (sigla) {
            resultado[sigla] = a;
        }
    }
    return resultado;
}

// ── Render Principal ──────────────────────────────────────────────────

function renderProdutividade() {
    if (!prodData) return;

    const usuarios = prodData.usuarios || [];
    const ligacoes = prodData.ligacoes || [];
    const octadesk = prodData.octadesk || [];
    const octaPorSigla = buildOctaPorSigla(octadesk);

    renderCardsTotais(usuarios, ligacoes, octadesk);
    renderTabelaAtendentes(usuarios, octaPorSigla);
    renderTabelaMedicos(usuarios);
    renderChartAtendentes(usuarios, octaPorSigla);
    renderChartWhatsapp(octadesk);
}

// ── Cards Totais ──────────────────────────────────────────────────────

function renderCardsTotais(usuarios, ligacoes, octadesk) {
    // Telefone
    const totalRecebidas = ligacoes.reduce((s, l) => s + (l.recebidas || 0), 0);
    const totalAtendidas = ligacoes.reduce((s, l) => s + (l.atendidas || 0), 0);
    const totalNaoAtendidas = ligacoes.reduce((s, l) => s + (l.nao_atendidas || 0), 0);
    const totalLig = totalRecebidas + ligacoes.reduce((s, l) => s + (l.realizadas || 0), 0);
    const taxaAtendimento = totalRecebidas ? ((totalAtendidas / totalRecebidas) * 100).toFixed(0) : 0;

    const semDados3cx = totalLig === 0;
    prodElements.cardTelefone.innerHTML = `
        <div class="prod-card-icon">&#128222;</div>
        <div class="prod-card-title">TELEFONE (3CX)</div>
        ${semDados3cx
            ? `<div class="prod-card-big" style="font-size:16px;color:#96b7ff;">Sem dados no periodo</div>
               <div class="prod-card-sub">3CX sem registros para este mes</div>`
            : `<div class="prod-card-big">${totalLig}</div>
               <div class="prod-card-sub">Recebidas: ${totalRecebidas} | Atendidas: ${totalAtendidas}</div>
               <div class="prod-card-sub">Nao atendidas: ${totalNaoAtendidas} | Taxa: ${taxaAtendimento}%</div>`
        }
    `;

    // WhatsApp
    const totalChats = octadesk.reduce((s, a) => s + (a.total || 0), 0);
    const totalInbound = octadesk.reduce((s, a) => s + (a.inbound || 0), 0);
    const totalOutbound = octadesk.reduce((s, a) => s + (a.outbound || 0), 0);
    const totalClosed = octadesk.reduce((s, a) => s + (a.closed || 0), 0);

    prodElements.cardWhatsapp.innerHTML = `
        <div class="prod-card-icon">&#128172;</div>
        <div class="prod-card-title">WHATSAPP (OCTADESK)</div>
        <div class="prod-card-big">${totalChats}</div>
        <div class="prod-card-sub">Recebidos: ${totalInbound} | Enviados: ${totalOutbound}</div>
        <div class="prod-card-sub">Finalizados: ${totalClosed}</div>
    `;

    // Consolidado
    const atendentes = usuarios.filter(isAtendente);
    const totalAgendamentos = atendentes.reduce((s, u) => s + (u.agendamentos || 0), 0);
    const totalCadastros = atendentes.reduce((s, u) => s + (u.cadastros_paciente || 0), 0);
    const totalEmails = usuarios.reduce((s, u) => s + (u.emails_laudo || 0) + (u.emails_enviados || 0), 0);
    const totalEntregas = usuarios.reduce((s, u) => s + (u.entregas_arquivo || 0), 0);

    prodElements.cardConsolid.innerHTML = `
        <div class="prod-card-icon">&#128200;</div>
        <div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${totalAgendamentos}</div>
        <div class="prod-card-label">Agendamentos</div>
        <div class="prod-card-sub">Cadastros: ${totalCadastros} | Emails: ${totalEmails} | Entregas: ${totalEntregas}</div>
        <div class="prod-card-sub">Resultados Online: ${prodData.resultados_online || 0}</div>
    `;
}

// ── Tabela Atendentes ─────────────────────────────────────────────────

function renderTabelaAtendentes(usuarios, octaPorSigla) {
    if (!prodElements.tabela) return;

    const atendentes = usuarios
        .filter(u => isAtendente(u) && ((u.agendamentos || 0) + (u.cadastros_paciente || 0) > 0))
        .sort((a, b) => ((b.agendamentos || 0) + (b.cadastros_paciente || 0)) - ((a.agendamentos || 0) + (a.cadastros_paciente || 0)));

    const temLig = atendentes.some(u => u.ligacoes_atendidas);

    let html = `<div class="prod-section-title">ATENDENTES</div>`;
    html += `<table class="prod-table"><thead><tr>
        <th>Sigla</th>
        <th>Nome</th>
        <th>Agendamentos</th>
        <th>Outros Servicos</th>
        <th>WhatsApp</th>
        ${temLig ? '<th>Lig. Atend.</th><th>Lig. N/Atend.</th><th>T. Medio</th>' : ''}
    </tr></thead><tbody>`;

    for (const u of atendentes) {
        const octa = octaPorSigla[u.usuario];
        const whatsapp = octa ? octa.total : 0;
        const outrosServicos = (u.cadastros_paciente || 0) + (u.entregas_arquivo || 0) +
            (u.emails_laudo || 0) + (u.emails_enviados || 0);
        const tMedio = u.tempo_conversa_medio ? formatSeg(u.tempo_conversa_medio) : '-';

        html += `<tr>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="num-cell">${u.agendamentos || 0}</td>
            <td class="num-cell">${outrosServicos}</td>
            <td class="num-cell">${whatsapp || '-'}</td>
            ${temLig ? `<td class="num-cell">${u.ligacoes_atendidas || '-'}</td>
            <td class="num-cell">${u.ligacoes_nao_atendidas || '-'}</td>
            <td class="num-cell">${tMedio}</td>` : ''}
        </tr>`;
    }

    // Totais
    const totAg = atendentes.reduce((s, u) => s + (u.agendamentos || 0), 0);
    const totOutros = atendentes.reduce((s, u) => s + (u.cadastros_paciente || 0) + (u.entregas_arquivo || 0) + (u.emails_laudo || 0) + (u.emails_enviados || 0), 0);
    const totWpp = atendentes.reduce((s, u) => s + ((octaPorSigla[u.usuario] || {}).total || 0), 0);
    const totLigAt = atendentes.reduce((s, u) => s + (u.ligacoes_atendidas || 0), 0);
    const totLigNa = atendentes.reduce((s, u) => s + (u.ligacoes_nao_atendidas || 0), 0);

    html += `<tr style="background:#111a3a;font-weight:bold;">
        <td colspan="2" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${totAg}</td>
        <td class="num-cell">${totOutros}</td>
        <td class="num-cell">${totWpp || '-'}</td>
        ${temLig ? `<td class="num-cell">${totLigAt}</td><td class="num-cell">${totLigNa}</td><td></td>` : ''}
    </tr>`;

    html += "</tbody></table>";

    // Detalhamento "Outros Servicos"
    html += `<details class="prod-detalhe">
        <summary>Detalhamento: Outros Servicos</summary>
        <table class="prod-table prod-table-sm"><thead><tr>
            <th>Sigla</th><th>Nome</th><th>Cadastros</th><th>Entregas</th><th>Emails</th>
        </tr></thead><tbody>`;
    for (const u of atendentes) {
        const cad = u.cadastros_paciente || 0;
        const ent = u.entregas_arquivo || 0;
        const em = (u.emails_laudo || 0) + (u.emails_enviados || 0);
        if (cad + ent + em === 0) continue;
        html += `<tr>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="num-cell">${cad}</td>
            <td class="num-cell">${ent}</td>
            <td class="num-cell">${em}</td>
        </tr>`;
    }
    html += "</tbody></table></details>";

    // Medicos
    html += renderTabelaMedicosHtml(usuarios);

    prodElements.tabela.innerHTML = html;
}

function renderTabelaMedicosHtml(usuarios) {
    const medicos = usuarios
        .filter(u => isMedico(u) && (u.laudos_digitados || 0) > 0)
        .sort((a, b) => (b.laudos_digitados || 0) - (a.laudos_digitados || 0));

    if (!medicos.length) return "";

    let html = `<div class="prod-section-title">MEDICOS / LAUDO</div>`;
    html += `<table class="prod-table"><thead><tr>
        <th>Sigla</th><th>Nome</th>
        <th>Laudos</th><th>Liberados</th><th>Emails</th><th>Capturas</th>
    </tr></thead><tbody>`;

    for (const u of medicos) {
        html += `<tr>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome || '-'}</td>
            <td class="num-cell">${u.laudos_digitados || 0}</td>
            <td class="num-cell">${u.laudos_liberados || 0}</td>
            <td class="num-cell">${(u.emails_laudo || 0) + (u.emails_enviados || 0)}</td>
            <td class="num-cell">${u.capturas || 0}</td>
        </tr>`;
    }

    const totL = medicos.reduce((s, u) => s + (u.laudos_digitados || 0), 0);
    const totLib = medicos.reduce((s, u) => s + (u.laudos_liberados || 0), 0);
    html += `<tr style="background:#111a3a;font-weight:bold;">
        <td colspan="2" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${totL}</td>
        <td class="num-cell">${totLib}</td>
        <td class="num-cell">-</td>
        <td class="num-cell">-</td>
    </tr>`;

    html += "</tbody></table>";
    return html;
}

// Stub for compatibility
function renderTabelaMedicos() {}

// ── Chart: Atendentes Consolidado ─────────────────────────────────────

function renderChartAtendentes(usuarios, octaPorSigla) {
    const atendentes = usuarios
        .filter(u => isAtendente(u) && ((u.agendamentos || 0) + (u.cadastros_paciente || 0) > 0))
        .sort((a, b) => (b.agendamentos || 0) - (a.agendamentos || 0))
        .slice(0, 15);

    if (chartProdBar) chartProdBar.destroy();

    const datasets = [
        {
            label: "Agendamentos",
            data: atendentes.map(u => u.agendamentos || 0),
            backgroundColor: "#3a86ff"
        },
        {
            label: "Outros Servicos",
            data: atendentes.map(u => (u.cadastros_paciente || 0) + (u.entregas_arquivo || 0) + (u.emails_laudo || 0) + (u.emails_enviados || 0)),
            backgroundColor: "#4cc9f0"
        },
        {
            label: "WhatsApp",
            data: atendentes.map(u => (octaPorSigla[u.usuario] || {}).total || 0),
            backgroundColor: "#25d366"
        }
    ];

    // Se tiver dados de ligação, adicionar
    if (atendentes.some(u => u.ligacoes_atendidas)) {
        datasets.push({
            label: "Ligacoes",
            data: atendentes.map(u => u.ligacoes_atendidas || 0),
            backgroundColor: "#f2c94c"
        });
    }

    chartProdBar = new Chart(prodElements.chartBarProd, {
        type: "bar",
        data: {
            labels: atendentes.map(u => u.usuario),
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 12 } },
                datalabels: { color: "#fff", anchor: "end", align: "top", font: { size: 9, weight: "bold" } }
            },
            scales: {
                x: { ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } }
            }
        }
    });
}

// ── Chart: WhatsApp por Agente ────────────────────────────────────────

function renderChartWhatsapp(octadesk) {
    if (!octadesk.length) {
        if (chartProdWhats) chartProdWhats.destroy();
        return;
    }

    const sorted = octadesk
        .filter(a => a.agente !== "SEM AGENTE")
        .sort((a, b) => b.total - a.total);

    if (chartProdWhats) chartProdWhats.destroy();

    chartProdWhats = new Chart(prodElements.chartWhatsProd, {
        type: "bar",
        data: {
            labels: sorted.map(a => {
                const sigla = OCTA_KLINIKI_MAP[a.agente];
                return sigla ? `${sigla} (${a.agente.split(" ")[0]})` : a.agente;
            }),
            datasets: [
                {
                    label: "Recebidos",
                    data: sorted.map(a => a.inbound || 0),
                    backgroundColor: "#25d366"
                },
                {
                    label: "Enviados",
                    data: sorted.map(a => a.outbound || 0),
                    backgroundColor: "#128c7e"
                }
            ]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#fff", boxWidth: 12 } },
                datalabels: { color: "#fff", font: { size: 9, weight: "bold" } }
            },
            scales: {
                x: { stacked: true, ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.1)" } },
                y: { stacked: true, ticks: { color: "#fff", font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}
