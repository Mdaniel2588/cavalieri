/* ─── Produtividade — Clinica Cavallieri ─────────────────────────────── */

const API_PROD = "https://kliniki.cavalliericlinica.com.br:444/clinic_bridge/index.php/produtividade/resumo";

const OCTA_MAP = {
    "Claudio Maximiano":"CMGJ","Julia Chaves":"JSC","Maria D Sousa":"MDS",
    "Rosangela Alcantara Lima":"RAL","Rosangela Tavares":"RDT","Vanessa Waeger":"VS",
    "Jane Sousa":"JSL","Gessica Oliveira":"GOS","Rose Martins":"RGM",
    "Claudia Barbosa":"DUDU","Diana Anchieta":"DC","Nelia de Abreu Silva":"RAS",
    "Cristialine Silva":"CJS","Renata Aquino":"RAC","Dayane":"DSR"
};

const ST_OCULTOS = "cavalieri_ocultos";
let prodData = null;
let prodTimer = null;
let chartRank = null;
let chartWpp = null;
const el = {};

const fmt = s => { if(!s) return '-'; const m=Math.floor(s/60),r=s%60; return m>0?`${m}m${String(r).padStart(2,'0')}s`:`${r}s`; };
const getOcultos = () => { try{return JSON.parse(localStorage.getItem(ST_OCULTOS))||[];}catch(e){return[];} };
const isOculto = s => getOcultos().indexOf(s)>=0;
function toggleOculto(s){const a=getOcultos();const i=a.indexOf(s);if(i>=0)a.splice(i,1);else a.push(s);localStorage.setItem(ST_OCULTOS,JSON.stringify(a));renderProd();}
function buildOcta(o){const r={};for(const a of(o||[])){const s=OCTA_MAP[a.agente];if(s)r[s]=a;}return r;}

// ── Init ──────────────────────────────────────────────────────────────

function initProdutividade() {
    el.section = document.getElementById("secaoProdutividade");
    el.ano = document.getElementById("anoProd");
    el.mes = document.getElementById("mesProd");
    el.btnMes = document.getElementById("btnAtualizarProd");
    el.btnHoje = document.getElementById("btnHojeProd");
    el.tabMarc = document.getElementById("tabMarcacao");
    el.tabRecep = document.getElementById("tabRecepcao");
    el.panelMarc = document.getElementById("panelMarcacao");
    el.panelRecep = document.getElementById("panelRecepcao");
    el.cardTel = document.getElementById("cardTelefone");
    el.cardWpp = document.getElementById("cardWhatsapp");
    el.cardCon = document.getElementById("cardConsolidado");
    el.chartRank = document.getElementById("chartRankingProd");
    el.chartWpp = document.getElementById("chartWhatsProd");
    el.status = document.getElementById("statusProd");
    if (!el.section) return;

    const h = new Date();
    for(let a=h.getFullYear();a>=h.getFullYear()-3;a--) el.ano.add(new Option(a,a));
    ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].forEach((m,i)=>el.mes.add(new Option(m,i+1)));
    el.ano.value=h.getFullYear(); el.mes.value=h.getMonth()+1;

    // Sub-tabs marcação/recepção
    el.tabMarc.addEventListener("click", () => { el.tabMarc.classList.add("active"); el.tabRecep.classList.remove("active"); el.panelMarc.style.display=""; el.panelRecep.style.display="none"; });
    el.tabRecep.addEventListener("click", () => { el.tabRecep.classList.add("active"); el.tabMarc.classList.remove("active"); el.panelRecep.style.display=""; el.panelMarc.style.display="none"; });

    el.btnMes.addEventListener("click", () => { stopTimer(); carregarProd(false); });
    el.ano.addEventListener("change", () => { stopTimer(); carregarProd(false); });
    el.mes.addEventListener("change", () => { stopTimer(); carregarProd(false); });
    el.btnHoje.addEventListener("click", () => {
        const h=new Date(); el.ano.value=h.getFullYear(); el.mes.value=h.getMonth()+1;
        carregarProd(true);
        prodTimer = setInterval(() => carregarProd(true), 120000);
    });

    // Auto-load HOJE
    carregarProd(true);
    prodTimer = setInterval(() => carregarProd(true), 120000);
}

function stopTimer() { if(prodTimer){clearInterval(prodTimer);prodTimer=null;} }

function getDia() {
    const h=new Date();
    return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`;
}

async function carregarProd(hoje) {
    const ano=el.ano.value, mes=el.mes.value;
    const diaP = hoje ? `&dia=${getDia()}` : "";

    el.btnHoje.classList.toggle("active", hoje);
    el.btnMes.classList.toggle("active", !hoje);
    showSt("Carregando...", "info");

    try {
        // Kliniki+3CX rápido, OctaDesk em paralelo
        const [r1, r2] = await Promise.all([
            fetch(`${API_PROD}?ano=${ano}&mes=${mes}&com_3cx=1${diaP}`),
            fetch(`${API_PROD}?ano=${ano}&mes=${mes}&com_octa=1${diaP}`)
        ]);
        const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.erro||"Erro");
        prodData = j1.data;
        renderProd();
        hideSt();

        try{const j2=await r2.json();if(j2.ok&&j2.data){prodData.octadesk=j2.data.octadesk;renderProd();}}catch(e){}

        if(hoje){showSt("HOJE realtime — atualiza a cada 2 min","info");setTimeout(hideSt,3000);}
    } catch(err) { showSt("Falha: "+err.message,"error"); }
}

function showSt(m,t){if(!el.status)return;el.status.hidden=false;el.status.className=`status-banner ${t}`;el.status.textContent=m;}
function hideSt(){if(el.status)el.status.hidden=true;}

// ── Render ────────────────────────────────────────────────────────────

function renderProd() {
    if (!prodData) return;
    const marc = prodData.marcacao || [];
    const recep = prodData.recepcao || [];
    const octa = prodData.octadesk || [];
    const octaMap = buildOcta(octa);

    renderCards(marc, recep, octa);
    renderMarcacao(marc, octaMap);
    renderRecepcao(recep);
    renderChartRank(marc, octaMap);
    renderChartWpp(octa);
}

function renderCards(marc, recep, octa) {
    const tLig = prodData.ligacoes_total || 0;
    el.cardTel.innerHTML = tLig
        ? `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE</div><div class="prod-card-big">${tLig}</div><div class="prod-card-label">Ligacoes Atendidas</div>`
        : `<div class="prod-card-icon">&#128222;</div><div class="prod-card-title">TELEFONE</div><div class="prod-card-big" style="font-size:16px;color:#96b7ff;">-</div>`;

    const tWpp = octa.reduce((s,a)=>s+(a.total||0),0);
    el.cardWpp.innerHTML = `<div class="prod-card-icon">&#128172;</div><div class="prod-card-title">WHATSAPP</div><div class="prod-card-big">${tWpp}</div><div class="prod-card-label">Conversas</div>`;

    const tAg = marc.reduce((s,u)=>s+(u.agendamentos||0),0);
    const tAdm = recep.reduce((s,u)=>s+(u.admissoes||0),0);
    el.cardCon.innerHTML = `<div class="prod-card-icon">&#128200;</div><div class="prod-card-title">CONSOLIDADO</div>
        <div class="prod-card-big">${tAg}</div><div class="prod-card-label">Agendamentos</div>
        <div class="prod-card-sub">Admissoes: ${tAdm}</div>`;
}

// ── MARCAÇÃO ──────────────────────────────────────────────────────────

function renderMarcacao(marc, octaMap) {
    if (!el.panelMarc) return;
    const lista = marc.filter(u => !isOculto(u.usuario) && ((u.agendamentos||0)+(u.ligacoes||0)>0))
        .map(u => {
            const wpp = (octaMap[u.usuario]||{}).total||0;
            const total = (u.agendamentos||0)+(u.ligacoes||0)+wpp;
            return {...u, wpp, total};
        }).sort((a,b)=>b.total-a.total);

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th>
        <th>Agend.</th><th>Ligacoes</th><th>T.Med</th><th>WhatsApp</th><th>TOTAL</th><th></th>
    </tr></thead><tbody>`;
    let p=1;
    for(const u of lista){
        h+=`<tr>
            <td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell">${u.agendamentos||0}</td>
            <td class="num-cell">${u.ligacoes||'-'}</td>
            <td class="num-cell">${fmt(u.tempo_medio_lig)}</td>
            <td class="num-cell">${u.wpp||'-'}</td>
            <td class="num-cell total-cell">${u.total}</td>
            <td><button class="btn-ocultar" onclick="toggleOculto('${u.usuario}')">x</button></td>
        </tr>`;
    }
    const tA=lista.reduce((s,u)=>s+(u.agendamentos||0),0);
    const tL=lista.reduce((s,u)=>s+(u.ligacoes||0),0);
    const tW=lista.reduce((s,u)=>s+u.wpp,0);
    const tT=lista.reduce((s,u)=>s+u.total,0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell">${tA}</td><td class="num-cell">${tL||'-'}</td><td></td>
        <td class="num-cell">${tW||'-'}</td><td class="num-cell total-cell">${tT}</td><td></td>
    </tr></tbody></table>`;

    const ocultos = getOcultos();
    if(ocultos.length) h+=`<div style="margin-top:8px;font-size:11px;color:#96b7ff;">Ocultos: ${ocultos.map(s=>`<button class="btn-restaurar" onclick="toggleOculto('${s}')">${s}</button>`).join(' ')}</div>`;

    el.panelMarc.innerHTML = h;
}

// ── RECEPÇÃO ──────────────────────────────────────────────────────────

function renderRecepcao(recep) {
    if (!el.panelRecep) return;
    const lista = recep.filter(u => !isOculto(u.usuario) && (u.admissoes||0)>0)
        .sort((a,b)=>(b.admissoes||0)-(a.admissoes||0));

    let h = `<table class="prod-table"><thead><tr>
        <th>#</th><th>Sigla</th><th>Nome</th><th>Admissoes</th><th></th>
    </tr></thead><tbody>`;
    let p=1;
    for(const u of lista){
        h+=`<tr>
            <td class="rank-cell">${p++}</td>
            <td style="font-weight:bold;">${u.usuario}</td>
            <td style="text-align:left;">${u.nome||'-'}</td>
            <td class="num-cell total-cell">${u.admissoes||0}</td>
            <td><button class="btn-ocultar" onclick="toggleOculto('${u.usuario}')">x</button></td>
        </tr>`;
    }
    const tAdm=lista.reduce((s,u)=>s+(u.admissoes||0),0);
    h+=`<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL</td>
        <td class="num-cell total-cell">${tAdm}</td><td></td>
    </tr></tbody></table>`;

    el.panelRecep.innerHTML = h;
}

// ── Charts ────────────────────────────────────────────────────────────

function renderChartRank(marc, octaMap) {
    const top = marc.filter(u=>!isOculto(u.usuario))
        .map(u=>{const w=(octaMap[u.usuario]||{}).total||0;return{...u,wpp:w,total:(u.agendamentos||0)+(u.ligacoes||0)+w};})
        .filter(u=>u.total>0).sort((a,b)=>b.total-a.total).slice(0,12);

    if(chartRank)chartRank.destroy();
    chartRank = new Chart(el.chartRank, {
        type:"bar",
        data:{
            labels:top.map(u=>u.usuario),
            datasets:[
                {label:"Agendamentos",data:top.map(u=>u.agendamentos||0),backgroundColor:"#3a86ff"},
                {label:"Ligacoes",data:top.map(u=>u.ligacoes||0),backgroundColor:"#f2c94c"},
                {label:"WhatsApp",data:top.map(u=>u.wpp),backgroundColor:"#25d366"}
            ]
        },
        options:{
            responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{display:false}},
            scales:{
                x:{stacked:true,ticks:{color:"#fff"},grid:{display:false}},
                y:{stacked:true,beginAtZero:true,ticks:{color:"#aaa"},grid:{color:"rgba(255,255,255,0.1)"}}
            }
        }
    });
}

function renderChartWpp(octa) {
    const sorted = (octa||[]).filter(a=>a.agente!=="SEM AGENTE"&&a.agente!=="CLINICA CAVALLIERI"&&a.agente!=="Enfermagem Cavallieri")
        .sort((a,b)=>b.total-a.total);
    if(chartWpp)chartWpp.destroy();
    if(!sorted.length)return;
    chartWpp = new Chart(el.chartWpp, {
        type:"bar",
        data:{
            labels:sorted.map(a=>{const s=OCTA_MAP[a.agente];return s||a.agente;}),
            datasets:[
                {label:"Recebidos",data:sorted.map(a=>a.inbound||0),backgroundColor:"#25d366"},
                {label:"Enviados",data:sorted.map(a=>a.outbound||0),backgroundColor:"#128c7e"}
            ]
        },
        options:{
            indexAxis:"y",responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:"#fff",boxWidth:10}},datalabels:{color:"#fff",font:{size:9,weight:"bold"}}},
            scales:{
                x:{stacked:true,ticks:{color:"#aaa"},grid:{color:"rgba(255,255,255,0.1)"}},
                y:{stacked:true,ticks:{color:"#fff",font:{size:10}},grid:{display:false}}
            }
        }
    });
}
