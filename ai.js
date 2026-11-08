/* ============================================================
   Fluxo — Assistente Financeiro (IA local)
   Chat em linguagem natural (pt-BR) que automatiza o app:
   cria contas/cartões, lança despesas e receitas, transfere,
   paga faturas, consulta saldos e gera relatórios.

   100% local: nada é enviado a servidores. Sem dependências.
   ============================================================ */
(function(){
"use strict";

/* ---------- 0. Guardas ---------- */
if(!document.getElementById("app")) return;   // só roda na página principal do app
if(window.AIChat) return;                     // evita instância dupla

const CHAT_KEY  = "fluxo.chat.v1";
const CHAT_MAX  = 250;
const SID = Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/* ---------- 1. Utilidades de texto ---------- */
const NORM = s => String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const clampN = (v,a,b) => Math.max(a, Math.min(b, v));
const words = s => NORM(s).split(/[^a-z0-9]+/).filter(Boolean);

function lev(a,b){
  if(Math.abs(a.length-b.length) > 2) return 9;
  const m=a.length, n=b.length;
  const d=[];
  for(let i=0;i<=m;i++){ d[i]=[i]; }
  for(let j=0;j<=n;j++){ d[0][j]=j; }
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[m][n];
}
const wordIn = (hayWords, w) => hayWords.some(h => h===w || (w.length>3 && lev(h,w)<=1) || (w.length>5 && lev(h,w)<=2));
/* casa palavra inteira (evita "inter" dentro de "internet") */
const hasWord = (t, w) => new RegExp("\\b" + String(w).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "\\b").test(t);

/* Nomes bonitos para bancos comuns */
const BANK_DISPLAY = {
  nubank:"Nubank", itau:"Itaú", bradesco:"Bradesco", santander:"Santander",
  "banco do brasil":"Banco do Brasil", bb:"Banco do Brasil", caixa:"Caixa",
  "caixa economica":"Caixa Econômica", inter:"Inter", c6:"C6 Bank", picpay:"PicPay",
  neon:"Neon", original:"Original", xp:"XP", btg:"BTG", btgpactual:"BTG Pactual",
  safra:"Safra", banrisul:"Banrisul", sicredi:"Sicredi", sicoob:"Sicoob",
  next:"Next", digio:"digio", pagbank:"PagBank", pagseguro:"PagBank",
  mercadopago:"Mercado Pago", "mercado pago":"Mercado Pago", bmg:"BMG",
  "will bank":"Will Bank", activobank:"ActivoBank", porto:"Porto", daycoval:"Daycoval"
};
const BANK_NAMES = Object.keys(BANK_DISPLAY);
const prettyBank = w => BANK_DISPLAY[NORM(w)] || cap1(w);

/* Palavras que sobrevivem como "descrição" do lançamento */
const PRETTY_WORDS = { salario:"Salário", ifood:"iFood", uber:"Uber", netflix:"Netflix",
  spotify:"Spotify", mercado:"Mercado", supermercado:"Supermercado", aluguel:"Aluguel",
  academia:"Academia", internet:"Internet", luz:"Luz", agua:"Água", condominio:"Condomínio",
  transporte:"Transporte", saude:"Saúde", educacao:"Educação", freelance:"Freelance" };
const prettyWord = w => PRETTY_WORDS[w] || w;

/* ---------- 2. Extração de entidades ---------- */

/* Datas — devolve ISO ou null */
function extractDate(raw){
  const t = NORM(raw);
  const today = todayISO();
  let m;
  if(/\bhoje\b/.test(t)) return today;
  if(/\bontem\b/.test(t)) return addDays(today,-1);
  if(/\banteontem\b/.test(t)) return addDays(today,-2);
  if(/\bamanha\b/.test(t)) return addDays(today,1);
  if(/\bsemana passada\b/.test(t)) return addDays(today,-7);
  if(/\bproxima semana\b/.test(t)) return addDays(today,7);
  if(/\bmes passado\b|\bmes anterior\b/.test(t)) return addMonths(today,-1);
  if(/\bproximo mes\b|\bmes que vem\b/.test(t)) return addMonths(today,1);
  if((m=/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(t))){
    const d=+m[1], mo=+m[2];
    let y = m[3] ? (+m[3]<100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    if(mo>=1 && mo<=12 && d>=1 && d<=31){
      const dt = new Date(y, mo-1, d);
      if(dt.getDate()===d && dt.getMonth()===mo-1) return isoOf(dt);
    }
  }
  if((m=/dia\s+(\d{1,2})\b/.exec(t))){
    const d = Math.min(Math.max(+m[1],1),28);
    const now = new Date();
    return isoOf(new Date(now.getFullYear(), now.getMonth(), d));
  }
  if((m=/(\d{1,3})\s*dias\s*atras\b/.exec(t)) || (m=/faz\s+(\d{1,3})\s*dias\b/.exec(t)))
    return addDays(today, -Math.min(365, +m[1]));
  return null;
}

/* Remove trechos de data do texto (para não confundir com valores) */
function blankDates(raw){
  let s = String(raw??"");
  const pats = [
    /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,
    /\bdia\s+\d{1,2}\b/gi,
    /\b\d{1,3}\s*dias\s*atr[áa]s\b/gi,
    /\bfaz\s+\d{1,3}\s*dias\b/gi,
    /\b(anteontem|amanh[ãa]|ontem|hoje)\b/gi,
    /\bsemana passada\b/gi, /\bpr[óo]xima semana\b/gi,
    /\bm[êe]s (passado|anterior|que vem)\b/gi, /\bpr[óo]ximo m[êe]s\b/gi,
    /\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)( de \d{4})?\b/gi
  ];
  for(const p of pats) s = s.replace(p, m => " ".repeat(m.length));
  return s;
}

/* Mês de referência (para consultas) — {y, m} ou null */
function extractMonth(raw){
  const t = NORM(raw);
  const now = new Date();
  let m;
  if(/\bmes passado\b|\bmes anterior\b|\banterior\b/.test(t)){
    const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return {y:d.getFullYear(), m:d.getMonth()};
  }
  if(/\b(este|atual|esse) ?mes\b|\bmes\b|\bmensal\b/.test(t)) return {y:now.getFullYear(), m:now.getMonth()};
  const MN = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  for(let i=0;i<12;i++){
    if(new RegExp("\\b"+MN[i]+"\\b").test(t)){
      let y = now.getFullYear();
      if((m=/(\d{4})/.exec(t))) y = +m[1];
      else if(i > now.getMonth()) y = now.getFullYear()-1;
      return {y, m:i};
    }
  }
  if((m=/(\d{4})/.exec(t))) return {y:+m[1], m:now.getMonth()};
  return null;
}
const mkOf = mm => `${mm.y}-${String(mm.m+1).padStart(2,"0")}`;
const monthLabel = mm => `${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][mm.m]} de ${mm.y}`;

/* Dinheiro — todos os valores mencionados (em centavos) */
function extractMoneyAll(raw){
  const s = String(raw??"").replace(/r\$/gi, m => " ".repeat(m.length-1)+" ");
  const out = [];
  const re = /(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d{1,3}(?:\.\d{3})+|\d+,\d{1,2}|\d+(?:\.\d{1,2})?)/g;
  let m;
  while((m = re.exec(s))){
    let r = m[1], cents;
    if(r.includes(".") && r.includes(",")) cents = Math.round(parseFloat(r.replace(/\./g,"").replace(",",".")) * 100);
    else if(r.includes(","))               cents = Math.round(parseFloat(r.replace(",",".")) * 100);
    else if(r.includes(".")){
      const p = r.split(".");
      if(p.length===2 && p[1].length===3 && p[0].length<=3) cents = Math.round(parseInt(p.join(""),10) * 100); /* 1.000 = mil */
      else cents = Math.round(parseFloat(r) * 100);
    }
    else cents = parseInt(r,10) * 100;
    if(!isFinite(cents)) continue;
    const after = s.slice(m.index + r.length, m.index + r.length + 6);
    const km = /^\s*(mil|k)\b/i.exec(after);
    out.push({cents: km ? cents*1000 : cents, i:m.index, len:r.length + (km ? km[0].length : 0)});
  }
  /* "mil" sozinho: "com mil reais" */
  const alone = /(^|\s)mil(\s|$)/.exec(s);
  if(alone && !out.some(o => Math.abs(o.i - alone.index) < 8))
    out.push({cents:100000, i:alone.index, len:3});
  return out;
}
const moneyAt = (raw, i) => extractMoneyAll(raw).find(m => Math.abs(m.i - i) < 30) || null;

/* Contas — casamento por nome, instituição ou tipo */
function findAccount(raw){
  const hits = findAllAccounts(raw);
  return hits.length ? hits[0].acc : null;
}
function findAllAccounts(raw){
  const t = NORM(raw);
  if(!t) return [];
  const tw = words(t);
  const hits = [];
  for(const a of state.accounts){
    const nameW = words(a.name);
    let score = 0;
    for(const w of nameW){
      if(w.length < 3) continue;
      if(tw.includes(w)) score += 3;
      else if(wordIn(tw, w)) score += 2;
    }
    const inst = NORM(a.institution||"");
    if(inst && inst.length > 2 && hasWord(t, inst)) score += 2;
    if(score >= 2) hits.push({acc:a, score, i:t.indexOf(nameW.length ? NORM(a.name).split(" ")[0] : "")});
  }
  hits.sort((x,y) => y.score - x.score);
  /* mantém só a melhor por conta */
  const seen = new Set(), out = [];
  for(const h of hits){ if(!seen.has(h.acc.id)){ seen.add(h.acc.id); out.push(h); } }
  return out;
}
function accountByTypeWord(t){
  const map = [[/dinheiro|especie/,"dinheiro"],[/poupanca/,"poupanca"],[/investimento/,"investimento"],[/carteira digital|\bdigital\b/,"digital"]];
  for(const [re,type] of map){
    if(re.test(t)){
      const cands = state.accounts.filter(a => a.type===type);
      if(cands.length === 1) return cands[0];
    }
  }
  return null;
}

/* Cartões */
function findCard(raw){
  const t = NORM(raw);
  if(!t) return null;
  const tw = words(t);
  let best=null, bs=0;
  for(const c of state.cards){
    let score = 0;
    for(const w of words(c.name)){ if(w.length<3) continue; if(tw.includes(w)) score+=3; else if(wordIn(tw,w)) score+=2; }
    const b = NORM(c.bank||"");
    if(b && b.length>2 && hasWord(t, b)) score += 2;
    if(score > bs){ bs=score; best=c; }
  }
  return bs >= 2 ? best : null;
}

/* Categorias — nome direto (fuzzy) ou palavras-chave */
const CAT_KEYWORDS = [
  [/supermercado|mercado|padaria|ifood|restaurante|almoco|janta|lanche|cafe|pizza|delivery|hortifruti|hortifruti|acougue|mercearia/, "Alimentação"],
  [/uber|99|taxi|gasolina|combustivel|posto|onibus|metro|estacionamento|pedagio|aplicativo de corrida/, "Transporte"],
  [/aluguel|condominio/, "Moradia"],
  [/\bluz\b|energia|\bagua\b|internet|telefone|plano de celular|gas encanado/, "Contas"],
  [/farmacia|remedio|medico|dentista|plano de saude|exame|hospital|terapia|psicolog/, "Saúde"],
  [/curso|faculdade|escola|livro|material escolar|ingles|faculdade|concurso/, "Educação"],
  [/netflix|spotify|disney|hbo|max\b|prime video|amazon prime|assinatura|streaming|youtube premium/, "Assinaturas"],
  [/cinema|jogo|bar\b|festa|viagem|hotel|passeio|balada|show\b/, "Lazer"],
  [/roupa|loja|shopee|mercado livre|mercadolivre|amazon|magalu|magazine|americanas|eletronic|celular|notebook|tv\b|moveis|fone|headset|earbuds|smartwatch|gadget/, "Compras"],
  [/iptu|ipva|imposto|receita federal|tributo/, "Impostos"],
  [/salario|vencimento|ordenado/, "Salário"],
  [/freela|freelance|bico|trabalho extra/, "Freelance"],
  [/rendimento|dividendo|juros|cdb|tesouro|renda fixa|renda passiva/, "Investimentos"],
  [/vendi|venda de/, "Vendas"]
];
function findCategory(raw, type){
  const t = NORM(raw);
  let best=null, bs=0;
  for(const c of state.categories){
    if(type && c.type !== type) continue;
    const cn = NORM(c.name);
    if(cn.length < 3) continue;
    if(hasWord(t, cn)){ if(cn.length > bs){ bs=cn.length; best=c; } continue; }
    const cw = words(cn);
    if(cw.length && cw.every(w => w.length<3 || words(t).some(tw => tw===w || lev(tw,w)<=1))){
      if(cn.length-2 > bs){ bs=cn.length-2; best=c; }
    }
  }
  if(best) return best;
  for(const [re,name] of CAT_KEYWORDS){
    if(re.test(t)){
      const c = state.categories.find(c => NORM(c.name) === NORM(name) && (!type || c.type===type));
      if(c) return c;
    }
  }
  return null;
}

/* Descrição — sobra do texto após remover valores, datas, contas e stopwords */
const STOP = new Set(("quero,gostaria,poderia,pode,faca,fazer,faz,criar,crie,cria,criar,adiciona,adicionar,adicione,adiciona,"+
"cadastrar,cadastre,cadastro,cadastra,registra,registre,registrar,lanca,lancar,lance,lancamento,novo,nova,uma,um,uns,umas,"+
"abrir,abra,abri,de,do,da,dos,das,no,na,nos,nas,em,com,para,pra,por,pelo,pela,sobre,valor,valores,de,reais,real,mil,k,"+
"centavos,pago,paga,pendente,futura,futuro,hoje,ontem,amanha,dia,dias,mes,ano,pix,dinheiro,credito,debito,boleto,cartao,cartoes,"+
"conta,contas,banco,banca,banca,carteira,fatura,faturas,limite,saldo,inicial,despesa,despesas,gasto,gastos,gastei,gastar,"+
"paguei,pagar,pagamento,receita,receitas,recebi,receber,ganhei,comprei,compra,compras,comprar,transferir,transfere,"+
"transferencia,mover,mova,move,enviar,envia,envie,passar,passei,passe,total,tipo,corrente,poupanca,digital,investimento,"+
"fecha,fechamento,fecha,vence,vencimento,venc,interesse,titulo,meu,minha,meus,minhas,eu,que,qual,quais,quanto,quanta,"+
"la,no,tal,esse,essa,este,esta,naquele,aqui,dele,dela,mais,menos,tambem,somente,apenas,agora,ja,tudo").split(","));
function extractDesc(raw, ctx){
  let s = blankDates(NORM(raw));
  s = s.replace(/rs\s*\d[\d.,]*/g, " ");
  s = s.replace(/\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d+(?:\.\d+)?/g, " ");
  if(ctx.account){
    for(const w of words(ctx.account.name + " " + (ctx.account.institution||""))) s = s.replace(new RegExp("\\b"+w+"\\b","g"), " ");
  }
  if(ctx.card){
    for(const w of words(ctx.card.name + " " + (ctx.card.bank||""))) s = s.replace(new RegExp("\\b"+w+"\\b","g"), " ");
  }
  const toks = words(s).filter(w => !STOP.has(w) && !/^\d+$/.test(w) && w.length > 1);
  const desc = toks.map(prettyWord).join(" ").trim();
  return desc ? cap1(desc).slice(0, 60) : "";
}

/* ---------- 3. Estado do chat ---------- */
let history = [];       /* [{r:'u'|'b', t?} | {r:'b', card} ] */
let pending  = null;    /* preenchimento de campos em andamento */
let lastAction = null;  /* última ação executada (para desfazer) */

function chatLoad(){
  try{
    const d = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
    if(Array.isArray(d)) history = d.slice(-CHAT_MAX);
  }catch(e){ history = []; }
}
function chatSave(){
  try{ localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-CHAT_MAX))); }
  catch(e){ /* armazenamento cheio: histórico fica só na memória */ }
}

/* ---------- 4. DOM ---------- */
const fab = document.createElement("button");
fab.id = "ai-fab";
fab.setAttribute("aria-label", "Abrir assistente financeiro");
fab.title = "Assistente (IA)";
fab.innerHTML = icon("sparkles", 24) + '<span class="ai-fab-badge"></span>';

const panel = document.createElement("div");
panel.id = "ai-panel";
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-label", "Assistente Fluxo");
panel.innerHTML =
'<div class="ai-head">'+
  '<div class="ai-avatar">'+icon("sparkles",20)+'</div>'+
  '<div class="ai-title"><b>Assistente Fluxo</b><span>IA local · seus dados ficam no navegador</span></div>'+
  '<button class="icon-btn" id="ai-clear" title="Limpar conversa" aria-label="Limpar conversa">'+icon("trash",16)+'</button>'+
  '<button class="icon-btn" id="ai-close" title="Fechar" aria-label="Fechar assistente">'+icon("x",17)+'</button>'+
'</div>'+
'<div id="ai-msgs" aria-live="polite"></div>'+
'<div id="ai-chips"></div>'+
'<form id="ai-form" autocomplete="off">'+
  '<input id="ai-input" placeholder="Ex.: cadastrar despesa de mercado 250,50" aria-label="Mensagem para o assistente" maxlength="280">'+
  '<button id="ai-send" type="submit" aria-label="Enviar mensagem">'+
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-4.6 16-4-6.4z"/><path d="M20 4 11.4 13.6"/></svg>'+
  '</button>'+
'</form>';
document.body.appendChild(fab);
document.body.appendChild(panel);

const msgsEl = panel.querySelector("#ai-msgs");
const chipsEl = panel.querySelector("#ai-chips");
const inputEl = panel.querySelector("#ai-input");
const formEl  = panel.querySelector("#ai-form");

function isOpen(){ return panel.classList.contains("open"); }
function open(){
  panel.classList.add("open");
  fab.setAttribute("aria-label", "Fechar assistente financeiro");
  fab.classList.remove("has-news");
  if(!history.length) greet();
  setTimeout(()=>{ try{ inputEl.focus(); }catch(e){} }, 180);
}
function close(){
  panel.classList.remove("open");
  fab.setAttribute("aria-label", "Abrir assistente financeiro");
}
function toggle(){ isOpen() ? close() : open(); }
fab.addEventListener("click", toggle);
panel.querySelector("#ai-close").addEventListener("click", close);
panel.querySelector("#ai-clear").addEventListener("click", ()=>{
  confirmModal({
    title:"Limpar conversa", okLabel:"Limpar", danger:true,
    msg:"Apagar todo o histórico da conversa com o assistente?<br><span style=\"color:var(--ink2)\">Seus dados financeiros <b>não</b> são afetados.</span>",
    onOk:()=>{ history=[]; chatSave(); pending=null; renderChat(); greet(); }
  });
});
window.AIChat = { open, close, toggle, isOpen };

/* ---------- 5. Renderização ---------- */
function miniMD(text){
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .split("\n").map(l => l.startsWith("- ") ? `<div class="ai-li">${l.slice(2)}</div>` : l)
    .join("<br>");
}
function msgNode(m){
  if(m.r === "u"){
    const row = document.createElement("div");
    row.className = "ai-row user";
    row.innerHTML = `<div class="ai-bub">${esc(m.t)}</div>`;
    return row;
  }
  const row = document.createElement("div");
  row.className = "ai-row";
  let inner;
  if(m.card){
    const c = m.card;
    const canUndo = c.undo && c.sid === SID && lastAction;
    inner = `<div class="ai-card">
      <div class="ai-card-h">${icon(c.ic||"check",15)} ${esc(c.title)}</div>
      <div class="ai-card-b">${(c.rows||[]).filter(r=>r[1]!=="" && r[1]!=null).map(r=>`<div class="ai-kv"><span>${esc(r[0])}</span><b>${r[1]}</b></div>`).join("")}</div>
      ${canUndo ? `<div class="ai-card-f"><button class="btn btn-ghost btn-sm" data-ai-undo>${icon("x",12)} Desfazer</button></div>` : ""}
    </div>`;
  } else {
    inner = `<div class="ai-bub"><div class="ai-msg-text">${miniMD(m.t||"")}</div></div>`;
  }
  row.innerHTML = `<div class="ai-bot-ic">${icon("sparkles",14)}</div>${inner}`;
  const ub = row.querySelector("[data-ai-undo]");
  if(ub) ub.addEventListener("click", undoLast);
  return row;
}
function renderChat(){
  msgsEl.innerHTML = "";
  history.forEach(m => msgsEl.appendChild(m.pdf ? pdfNode(m.pdf) : msgNode(m)));
  scrollBottom();
}
function scrollBottom(){ msgsEl.scrollTop = msgsEl.scrollHeight; }

function pushUser(text){
  history.push({r:"u", t:text});
  chatSave();
  msgsEl.appendChild(msgNode(history[history.length-1]));
  scrollBottom();
}
let typingEl = null;
function showTyping(){
  hideTyping();
  typingEl = document.createElement("div");
  typingEl.className = "ai-row";
  typingEl.innerHTML = `<div class="ai-bot-ic">${icon("sparkles",14)}</div><div class="ai-bub ai-typing"><i></i><i></i><i></i></div>`;
  msgsEl.appendChild(typingEl);
  scrollBottom();
}
function hideTyping(){ if(typingEl){ typingEl.remove(); typingEl=null; } }

function botSay(text, opts={}){
  hideTyping();
  history.push({r:"b", t:text});
  chatSave();
  msgsEl.appendChild(msgNode(history[history.length-1]));
  scrollBottom();
  setChips(opts.chips || defaultChips());
}
function botCard(card){
  hideTyping();
  const m = {r:"b", card:{...card, sid:SID}};
  history.push(m);
  chatSave();
  msgsEl.appendChild(msgNode(m));
  scrollBottom();
  setChips(defaultChips());
}
/* Resposta com pequeno atraso natural */
function botReply(fn, delay){
  showTyping();
  setTimeout(()=>{ try{ fn(); }catch(err){ console.error(err); botSay("Tive um problema ao processar isso. Tente reformular ou use os botões do app. 😕"); } },
    delay || 320 + Math.random()*280);
}

/* ---------- 4b. Relatório em PDF ---------- */
const pdfCache = {};   /* monthKey -> {url, size, filename} */

function pdfNode(m){
  const row = document.createElement("div");
  row.className = "ai-row";
  row.innerHTML = `<div class="ai-bot-ic">${icon("sparkles",14)}</div>
  <div class="ai-card">
    <div class="ai-card-h">${icon("download",15)} Relatório em PDF</div>
    <div class="ai-pdf">
      <div class="ai-file">PDF</div>
      <div class="ai-pmeta">
        <div class="ai-pname"></div>
        <div class="ai-psub"></div>
      </div>
      <button class="btn btn-primary btn-sm" data-pdf>Baixar</button>
    </div>
  </div>`;
  const nameEl = row.querySelector(".ai-pname");
  const subEl  = row.querySelector(".ai-psub");
  const paint = c => { nameEl.textContent = c.filename; subEl.textContent = (m.label ? m.label + " · " : "") + c.size; };
  const cached = pdfCache[m.mk];
  if(cached) paint(cached);
  else { nameEl.textContent = "relatorio-fluxo-" + m.mk + ".pdf"; subEl.textContent = m.label || ""; }
  row.querySelector("[data-pdf]").addEventListener("click", () => downloadPdf(m.mk));
  return row;
}

function downloadPdf(mk){
  let c = pdfCache[mk];
  if(!c){ c = makePdfForMk(mk); if(!c) return; }
  const a = document.createElement("a");
  a.href = c.url; a.download = c.filename;
  document.body.appendChild(a); a.click(); a.remove();
}

/* ciclo do relatório: consistente com o app (respeita o "primeiro dia do mês") */
function cycleForReport(mm){
  const now = new Date();
  if(mm.y === now.getFullYear() && mm.m === now.getMonth()) return cycleRange(now);
  return cycleRange(new Date(mm.y, mm.m, 15));
}

function buildReportData(mm){
  if(!window.FluxoPDF) throw new Error("gerador de PDF não carregado");
  const [ps, pe] = cycleForReport(mm);
  const txs = state.transactions.filter(t => t.date >= ps && t.date <= pe)
    .sort((a,b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const rec  = txs.filter(t => t.type === "receita");
  const desp = txs.filter(t => t.type === "despesa");
  const sumRec  = rec.reduce((s,t) => s + t.value, 0);
  const sumDesp = desp.reduce((s,t) => s + t.value, 0);
  const res = sumRec - sumDesp;
  const byCat = (list, total) => {
    const m = {};
    list.forEach(t => { const c = catById(t.categoryId); const k = c ? c.name : "Sem categoria"; m[k] = (m[k]||0) + t.value; });
    return Object.entries(m).sort((a,b) => b[1] - a[1]).map(([nome, v]) => ({
      nome, valor: fmtMoney(v),
      pct: total > 0 ? (100 * v / total).toLocaleString("pt-BR", {maximumFractionDigits:1}) + "%" : "—"
    }));
  };
  const transfers = state.transfers.filter(t => t.date >= ps && t.date <= pe)
    .sort((a,b) => a.date.localeCompare(b.date));
  const data = {
    titulo: "Fluxo — Relatório Financeiro",
    periodo: "Ciclo de " + fmtDate(ps) + " a " + fmtDate(pe),
    geradoEm: fmtDate(todayISO()),
    filename: "relatorio-fluxo-" + mkOf(mm) + ".pdf",
    resumo: [
      {label:"Receitas", value: fmtMoney(sumRec), color: [0.05, 0.51, 0.37]},
      {label:"Despesas", value: fmtMoney(sumDesp), color: [0.80, 0.25, 0.25]},
      {label:"Resultado do ciclo", value: (res >= 0 ? "+ " : "- ") + fmtMoney(Math.abs(res)), color: res >= 0 ? [0.05,0.51,0.37] : [0.80,0.25,0.25]},
      {label:"Saldo atual", value: fmtMoney(netWorth())}
    ],
    despesasCategoria: byCat(desp, sumDesp),
    totalDespesas: fmtMoney(sumDesp),
    receitasCategoria: byCat(rec, sumRec),
    totalReceitas: fmtMoney(sumRec),
    contas: state.accounts.map(a => {
      const b = accountBalance(a);
      return {nome: a.name, tipo: ACC_TYPES[a.type] || a.type, saldo: fmtMoney(b), neg: b < 0};
    }),
    cartoes: state.cards.map(c => {
      const s = cardStats(c);
      return {nome: c.name + (c.bank ? " (" + c.bank + ")" : ""), fatura: fmtMoney(s.invoiceNow),
              aberto: fmtMoney(s.used), disponivel: fmtMoney(s.available)};
    }),
    lancamentos: txs.map(t => ({
      data: fmtDate(t.date).slice(0, 5),
      desc: t.desc + (t.installment ? " (" + t.installment + "/" + t.installments + ")" : ""),
      categoria: (catById(t.categoryId) || {name:"—"}).name,
      valor: fmtMoney(t.value),
      tipo: t.type
    })),
    transferencias: transfers.map(t => ({
      data: fmtDate(t.date).slice(0, 5),
      desc: transferLabel(t),
      fluxo: ((accById(t.from)||{name:"?"}).name) + " -> " + ((accById(t.to)||{name:"?"}).name),
      valor: fmtMoney(t.value)
    }))
  };
  return FluxoPDF.buildMonthlyReport(data);
}

function makePdfForMk(mk){
  try{
    const mm = {y: +mk.slice(0,4), m: +mk.slice(5,7) - 1};
    const built = buildReportData(mm);
    const blob = new Blob([built.bytes], {type: "application/pdf"});
    pdfCache[mk] = {
      url: URL.createObjectURL(blob),
      size: Math.max(1, Math.round(blob.size / 1024)) + " KB",
      filename: built.filename
    };
    return pdfCache[mk];
  }catch(e){
    botSay("Não consegui gerar o PDF agora: " + (e.message || "erro") + ". Tente novamente.");
    return null;
  }
}

function generateReport(mm){
  if(!mm) mm = {y: new Date().getFullYear(), m: new Date().getMonth()};
  const mk = mkOf(mm);
  botReply(() => {
    const c = pdfCache[mk] || makePdfForMk(mk);
    if(!c) return;
    hideTyping();
    history.push({r:"b", pdf:{mk, label: monthLabel(mm)}});
    chatSave();
    msgsEl.appendChild(pdfNode(history[history.length-1].pdf));
    scrollBottom();
    setChips(defaultChips());
    downloadPdf(mk);   /* entrega o arquivo na hora + botão fica disponível */
  }, 700);
}

/* Chips de sugestão */
function setChips(list){
  chipsEl.innerHTML = "";
  (list||[]).forEach(c => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ai-chip";
    b.textContent = c;
    b.addEventListener("click", ()=>{ send(c); });
    chipsEl.appendChild(b);
  });
}
function defaultChips(){
  const chips = [];
  if(!state.accounts.length) chips.push("Criar conta no Nubank com 500", "O que você faz?");
  else if(!state.transactions.length) chips.push("Recebi 3000 de salário", "Cadastrar despesa de mercado 250,50", "O que você faz?");
  else chips.push("Qual meu saldo?", "Resumo do mês", "Relatório do mês em PDF", "Cadastrar despesa de mercado 250,50");
  return chips;
}

/* ---------- 6. Ações (com desfazer) ---------- */
function setUndo(kind, ref){ lastAction = {kind, ref, sid:SID}; }

function undoLast(){
  if(!lastAction || lastAction.sid !== SID){
    botSay("Não há ação recente desta sessão para desfazer.");
    return;
  }
  const {kind, ref} = lastAction;
  try{
    if(kind === "tx"){
      state.transactions = state.transactions.filter(t => t.id !== ref.id);
    } else if(kind === "account"){
      const linked = state.transactions.some(t=>t.accountId===ref.id) || state.transfers.some(t=>t.from===ref.id||t.to===ref.id);
      if(linked){ botSay("Essa conta já recebeu movimentações, então não vou excluí-la automaticamente. Dá para excluir em **Contas e carteiras**."); return; }
      state.accounts = state.accounts.filter(a => a.id !== ref.id);
    } else if(kind === "card"){
      const linked = state.transactions.some(t=>t.cardId===ref.id);
      if(linked){ botSay("Esse cartão já tem compras vinculadas, então não vou excluí-lo automaticamente. Dá para excluir em **Cartões de crédito**."); return; }
      state.cards = state.cards.filter(c => c.id !== ref.id);
    } else if(kind === "transfer"){
      state.transfers = state.transfers.filter(t => t.id !== ref.id);
    } else if(kind === "paid"){
      (ref.txs||[]).forEach(t => { t.status = "pendente"; delete t.paidDate; });
    }
    lastAction = null;
    save(); render();
    botSay("Pronto, ação desfeita e saldos atualizados. ✓");
  }catch(e){
    botSay("Não consegui desfazer: " + (e.message || "erro"));
  }
}

function actCreateAccount(p){
  const acc = {
    id: uid(), createdAt: todayISO(),
    name: p.name, type: p.type || "corrente",
    institution: p.institution || "", initial: p.initial || 0, note: ""
  };
  state.accounts.push(acc);
  save(); render(); setUndo("account", acc);
  botCard({ic:"bank", title:"Conta criada", rows:[
    ["Nome", esc(acc.name)],
    ["Tipo", ACC_TYPES[acc.type] || acc.type],
    ["Saldo inicial", fmtMoney(acc.initial)]
  ], undo:acc.id});
  toast("Conta criada pelo assistente.");
}

function actCreateCard(p){
  const card = {
    id: uid(), name: p.name, bank: p.bank || "",
    limit: p.limit || 0,
    closeDay: p.closeDay || 27, dueDay: p.dueDay || 10,
    color: p.color || "#0e6b4f", active: true
  };
  state.cards.push(card);
  save(); render(); setUndo("card", card);
  botCard({ic:"creditCard", title:"Cartão criado", rows:[
    ["Nome", esc(card.name)],
    ["Banco", esc(card.bank || "—")],
    ["Limite", fmtMoney(card.limit)],
    ["Fechamento / vencimento", "dia " + card.closeDay + " / dia " + card.dueDay]
  ], undo:card.id});
  toast("Cartão criado pelo assistente.");
}

function actAddTx(type, p){
  const t = {
    id: uid(), type, desc: p.desc, value: p.value,
    date: p.date || todayISO(), categoryId: p.categoryId || null,
    accountId: p.cardId ? null : (p.accountId || null),
    cardId: p.cardId || null,
    payMethod: p.payMethod || (p.cardId ? "Cartão de crédito" : "Pix"),
    status: p.status || "pago", note: "Criado via assistente",
    paidDate: (p.status || "pago") === "pago" ? todayISO() : undefined
  };
  state.transactions.push(t);
  save(); render(); setUndo("tx", t);
  const c = p.categoryId ? catById(p.categoryId) : null;
  const dest = p.cardId ? (cardById(p.cardId)?.name || "cartão") : (accById(p.accountId)?.name || "—");
  botCard({ic: type==="receita" ? "arrowUR" : "arrowDR",
    title: type==="receita" ? "Receita registrada" : "Despesa registrada", rows:[
    ["Descrição", esc(t.desc)],
    ["Valor", (type==="receita"?"+ ":"− ") + fmtMoney(t.value)],
    ["Data", fmtDate(t.date)],
    ["Categoria", c ? esc(c.name) : "—"],
    ["Destino", esc(dest)],
    ["Forma", esc(t.payMethod)],
    ["Status", t.status==="pago" ? (type==="receita"?"Recebida":"Paga") : "Pendente"]
  ], undo:t.id});
  toast(type==="receita" ? "Receita adicionada." : "Despesa adicionada.");
}

function actTransfer(p){
  const tr = {
    id: uid(), from: p.from.id, to: p.to.id, value: p.value,
    date: p.date || todayISO(), desc: p.desc || "Transferência",
    note: "Criado via assistente", payMethod: p.payMethod || "Pix",
    createdAt: new Date().toISOString()
  };
  state.transfers.push(tr);
  save(); render(); setUndo("transfer", tr);
  botCard({ic:"transfer", title:"Transferência realizada", rows:[
    ["De", esc(p.from.name)],
    ["Para", esc(p.to.name)],
    ["Valor", fmtMoney(p.value)],
    ["Data", fmtDate(tr.date)]
  ], undo:tr.id});
  toast(fmtMoney(p.value) + " de " + p.from.name + " para " + p.to.name + ".");
}

function actPayInvoice(card, accId){
  const mk = invoiceMonthKey(todayISO(), card.closeDay);
  const txs = state.transactions.filter(t =>
    t.cardId === card.id && t.status !== "pago" && invoiceMonthKey(t.date, card.closeDay) === mk);
  if(!txs.length){
    botSay("A fatura atual do **" + card.name + "** já está paga (ou não tem compras em aberto). 👍");
    return;
  }
  const total = txs.reduce((s,t)=>s+t.value,0);
  txs.forEach(t => { t.status="pago"; t.accountId=accId; t.paidDate=todayISO(); });
  save(); render(); setUndo("paid", {txs});
  const acc = accById(accId);
  botCard({ic:"creditCard", title:"Fatura paga", rows:[
    ["Cartão", esc(card.name)],
    ["Parcelas quitadas", String(txs.length)],
    ["Total pago", fmtMoney(total)],
    ["Conta debitada", acc ? esc(acc.name) : "—"]
  ], undo:"paid"});
  toast("Fatura do " + card.name + " paga: " + fmtMoney(total) + ".");
}

/* Marca como pago um lançamento pendente que casa com a descrição */
function actPayPending(match, type){
  match.status = "pago";
  if(!match.accountId && match.cardId){
    const accs = state.accounts;
    if(accs.length === 1){ match.accountId = accs[0].id; }
  }
  match.paidDate = todayISO();
  save(); render(); setUndo("paid", {txs:[match]});
  botCard({ic:"check", title: type==="receita" ? "Recebida" : "Paga", rows:[
    ["Lançamento", esc(match.desc)],
    ["Valor", fmtMoney(match.value)],
    ["Data", fmtDate(match.date)]
  ], undo:"paid"});
  toast("Lançamento atualizado.");
}

/* ---------- 7. Intenções ---------- */

function greet(){
  botSay("Oi! Eu sou o **assistente do Fluxo**. 👋\n"+
    "Me pede em português o que você precisa que eu cuido do resto — sem tocar em menus:\n"+
    "- **Criar conta**: “criar conta no Inter com 500”\n"+
    "- **Despesa**: “cadastrar despesa de mercado 250,50”\n"+
    "- **Receita**: “recebi 3000 de salário”\n"+
    "- **Cartão**: “criar cartão Nubank com limite 5000”\n"+
    "- **Transferir**: “transferir 500 do Inter para a Poupança”\n"+
    "- **Consultar**: “qual meu saldo?” · “resumo do mês”\n"+
    "- **Relatório**: “relatório do mês em PDF”",
    {chips: defaultChips()});
}

function helpText(){
  return "Aqui está o que eu sei fazer:\n"+
    "- **Contas**: “criar conta no Nubank com 2000”\n"+
    "- **Cartões**: “criar cartão Itaú com limite 8000” · “comprei 200 no cartão Nubank” · “pagar fatura do Nubank”\n"+
    "- **Despesas**: “cadastrar despesa de mercado 250,50” · “gastei 30 com uber ontem”\n"+
    "- **Receitas**: “recebi 3000 de salário” · “cadastrar receita de freelance 800”\n"+
    "- **Transferências**: “transferir 500 da conta X para a Y”\n"+
    "- **Consultas**: “qual meu saldo?” · “resumo do mês” · “quanto gastei com alimentação?” · “o que falta pagar?”\n"+
    "- **Relatório em PDF**: “relatório do mês em PDF” · “relatório de outubro”\n"+
    "- **Extras**: “orcamento 4000” · “modo escuro” · “abrir cartões” · “desfazer”\n"+
    "Se faltar alguma informação, eu pergunto antes de salvar nada.";
}

function askSlots(intent, data, missing){
  pending = {intent, data, missing, asks:0};
  const Q = {
    value: () => "Qual o valor?",
    desc:  () => "Qual a descrição?",
    name:  () => "Qual o nome? (ex.: Nubank, Carteira, Inter…)",
    cardName: () => "Qual o nome do cartão?",
    from:  () => "De qual conta sai o dinheiro?",
    to:    () => "Para qual conta vai?",
    account: () => "Em qual conta?",
    card:  () => "Em qual cartão?",
    limit: () => "Qual o limite do cartão?"
  };
  const chipsFor = {
    name: () => BANK_NAMES.slice(0, 8).map(b => "conta " + BANK_DISPLAY[b]),
    account: () => state.accounts.slice(0,6).map(a => a.name),
    card: () => state.cards.slice(0,6).map(c => c.name),
    from: () => state.accounts.slice(0,6).map(a => a.name),
    to:   () => state.accounts.slice(0,6).map(a => a.name)
  };
  const key = missing[0];
  botSay("**" + (Q[key] ? Q[key]() : "Faltou uma informação.") + "**", {chips: (chipsFor[key] ? chipsFor[key]() : defaultChips())});
}

function continuePending(text){
  if(!pending) return false;
  const {intent, data} = pending;
  pending.asks++;
  const ctx = {account: findAccount(text), card: findCard(text)};
  const t = NORM(text);

  /* usuário mudou de assunto? uma intenção concreta e DIFERENTE da pendência
     interrompe o preenchimento (respostas curtas caem em "fallback" e continuam preenchendo) */
  const novaIntent = classify(t);
  if(novaIntent !== "fallback" && novaIntent !== intent){
    pending = null;
    return false;
  }

  const fill = (slot, val) => { data[slot] = val; pending.missing = pending.missing.filter(s => s !== slot); };

  for(const slot of [...pending.missing]){
    if(slot === "value"){
      const m = extractMoneyAll(blankDates(text));
      if(m.length && m[0].cents > 0){ fill("value", m[0].cents); continue; }
    }
    if(slot === "desc"){
      const d = extractDesc(text, ctx);
      if(d){ fill("desc", d); continue; }
    }
    if(slot === "name" || slot === "cardName"){
      const d = extractDesc(text, {account:null, card:null});
      if(d){ fill(slot, d); continue; }
    }
    if(slot === "limit"){
      const m = extractMoneyAll(blankDates(text));
      if(m.length){ fill("limit", m[0].cents); continue; }
    }
    if(slot === "account"){
      const a = ctx.account || accountByTypeWord(t);
      if(a){ fill("account", a.id); continue; }
    }
    if(slot === "card"){
      if(ctx.card){ fill("card", ctx.card.id); continue; }
    }
    if(slot === "from" || slot === "to"){
      const a = ctx.account || accountByTypeWord(t);
      if(a){ fill(slot, a.id); continue; }
    }
    /* resposta solta (ex.: só um número para o valor) */
    if(slot === "value" && /^\s*[\d.,]+\s*$/.test(text)){
      const m = extractMoneyAll(text);
      if(m.length){ fill("value", m[0].cents); continue; }
    }
  }

  if(pending.missing.length === 0){
    pending = null;
    EXEC[intent](data, {});
    return true;
  }
  if(pending.asks >= 3){
    pending = null;
    botSay("Sem problemas — deixa para outra hora. É só me pedir de novo quando quiser. 😉");
    return true;
  }
  askSlots(intent, data, pending.missing);
  return true;
}

/* Executores por intenção */
const EXEC = {
  create_account(p){
    p.initial = p.initial || 0;
    actCreateAccount(p);
  },
  create_card(p){ actCreateCard({...p, name: p.name || p.cardName || "Cartão", bank: p.bank || ""}); },
  expense(p){ EXEC._tx("despesa", p); },
  income(p){ EXEC._tx("receita", p); },
  _tx(type, p){
    /* destination resolution */
    if(type === "receita") p.cardId = null;   /* receita nunca sai de cartão de crédito */
    if(p.cardId){
      const card = cardById(p.cardId);
      if(!card){ botSay("Não encontrei esse cartão. Olha os que existem: " + (state.cards.map(c=>c.name).join(", ") || "nenhum")); return; }
      p.payMethod = "Cartão de crédito";
      p.status = "pendente";
      p.accountId = null;
    } else {
      if(!p.account){
        if(state.accounts.length === 1) p.account = state.accounts[0].id;
        else { askSlots(type === "despesa" ? "expense" : "income", p, ["account"]); return; }
      }
      if(!accById(p.account)){ botSay("Não encontrei essa conta. Cadastre em **Contas e carteiras** ou me peça para criar."); return; }
      p.status = p.status || (p.date && p.date > todayISO() ? "pendente" : "pago");
    }
    if(!p.categoryId){
      const c = findCategory(p.catText || (p.desc + " " + NORM(p.rawish||"")).replace(/\s?\d{1,3}(?:\.\d{3})+,\d{1,2}|\s?\d+,\d{1,2}|\s?\d+(?:\.\d+)?/, " "), type);
      p.categoryId = c ? c.id : (state.categories.find(c=>c.type===type && NORM(c.name)==="outros")||{}).id || null;
    }
    actAddTx(type, {...p, accountId: p.cardId ? null : p.account});
  },
  transfer(p){
    const from = accById(p.from), to = accById(p.to);
    if(!from || !to){ botSay("Preciso de duas contas válidas para transferir."); return; }
    if(from.id === to.id){ botSay("A conta de origem e a de destino precisam ser diferentes. 😅"); return; }
    actTransfer({from, to, value:p.value, date:p.date, desc:p.desc, payMethod:p.payMethod});
  },
  pay_invoice(p){
    const card = cardById(p.card);
    if(!card){ botSay("Não encontrei esse cartão."); return; }
    if(!p.account){
      if(state.accounts.length === 1) p.account = state.accounts[0].id;
      else { askSlots("pay_invoice", p, ["account"]); return; }
    }
    actPayInvoice(card, p.account);
  },
  pay_pending_with(p){
    const match = p.match;
    match.accountId = p.account;
    actPayPending(match, p.payType || "despesa");
  }
};

/* Classificação */
function classify(t){
  const has = re => re.test(t);
  if(has(/\b(ajuda|socorro|help|comandos?|exemplos?|o que (vc|voce|voce) (faz|pode|consegue)|como (uso|funciona))\b/)) return "help";
  if(has(/^(oi|ola|opa|eae|e ai|ei|hey|bom dia|boa tarde|boa noite|salve|tudo bem|tudo bom|fala)\b/)) return "greet";
  if(has(/\b(obrigad[oa]|valeu|vlw|show|top|perfeit[oa]|mandou bem|demais)\b/)) return "thanks";
  if(has(/\b(desfazer|desfaca|cancelar (o |a )?(ultimo|ultima)|volta atras|remove isso)\b/)) return "undo";
  if(has(/\b(apagar|apague|limpar|limpe|resetar|reset|zerar|zere)\b.{0,26}\b(tudo|dados|historico|dados)\b/)) return "wipe";
  if(has(/\b(relatorio|pdf|exportar)\b/)) return "report";
  if(has(/\b(pagar|paga|pagar|quitar|quitei|liquidar|zerar)\b.{0,34}\bfatura/)) return "pay_invoice";
  if(has(/\b(transferir|transfiro|transferiu|transferencia|transfer|transfere|movo|mover|mova|movi|mandar|manda|mande|mandei|enviar|envia|envie|enviei|passar|passei|passe|passa)\b/)) return "transfer";
  if(has(/\b(abrir|abre|abra|ir para|va para|vá para|me leva|leva|mostrar|mostra|ver|visualizar|exibir)\b.{0,32}\b(pagina|aba|secao|tela|menu|dashboard|visao geral|lancamentos?|contas a pagar|receitas?|cartoes|carteira|planejamento|relatorios?|configurac)/)) return "navigate";
  if(has(/\b(criar|crie|cria|adicionar|adicione|adiciona|cadastrar|cadastre|nova|novo|abrir|abra|quero|gostaria)\b.{0,30}\bcart(ao|oes)\b/) && !has(/\bcompr/)) return "create_card";
  if(has(/\b(criar|crie|cria|adicionar|adicione|adiciona|cadastrar|cadastre|cadastra|nova|novo|abrir|abra|quero|gostaria)\b.{0,26}\b(conta|banco|carteira|poupanca)\b/) && !has(/\ba pagar\b|\bpagar\b|\bextrato\b|\bsaldo\b/)) return "create_account";
  if(has(/\b(orcamento|teto de gastos?)\b/)) return "budget";
  if(has(/\bmeta\b/)) return "goal";
  if(has(/\b(tema|modo)\s+(escuro|dark|claro|light)\b/) || has(/\b(ativar|desativar|ligar|desligar)\b.{0,14}\b(escuro|dark|claro|light)\b/)) return "theme";
  if(has(/\bqual (e|é|meu|o|a)?\s*(meu |o |a )?(saldo|patrimonio)/) || has(/\bquanto (dinheiro )?(eu )?tenho\b/) || has(/\bsaldo (atual|total|geral|disponivel)\b/)) return "balance";
  if(has(/\b(resumo|panorama|balanco|como (esta|ta|andam|ta indo|andando))\b/) ) return "summary";
  if(has(/\bquanto (gastei|gasto|foi gasto|gastamos)\b/) || has(/\bgastos? (com|em|no|na|de|da)\b/) || has(/\btotal (com|de|da|em)\b/)) return "spend_query";
  if(has(/\b(minhas|meus|quais|listar|mostra|mostrar)\b.{0,22}\b(contas|carteiras|bancos)\b/)) return "list_accounts";
  if(has(/\b(minhos|meus|minhas|quais|listar|mostra|mostrar)\b.{0,22}\bcartoes\b/)) return "list_cards";
  if(has(/\b(o que|o q|quais)\b.{0,34}\b(falta|pendente|a pagar|vencer|vence)\b/) || has(/\bvencimentos?\b/) || has(/\bcontas a pagar\b/)) return "pending_bills";
  if(has(/\b(receita|recebi|salario|deposito|depositaram|entrou|rendeu|ganhei|vendi|venda)\b/)) return "income";
  if(has(/\b(despesa|gasto|gastei|paguei|comprei|compra|boleto|pagar|conta de|lancamento)\b/)) return "expense";
  return "fallback";
}

/* Rotearadores de resposta */
function handle(text){
  const t = NORM(text);
  const intent = classify(t);
  const date = extractDate(text);
  const moneySrc = blankDates(text);
  const moneys = extractMoneyAll(moneySrc);
  const account = findAccount(moneySrc) || accountByTypeWord(t);
  const card = findCard(moneySrc);

  switch(intent){

  case "help": botSay(helpText()); return;

  case "greet":
    botSay("Olá! Tudo certo? Me diz o que você quer fazer — por exemplo: “cadastrar despesa de mercado 250,50” ou “qual meu saldo?”."); return;

  case "thanks":
    botSay("Por nada! Estou aqui sempre que precisar. 😉"); return;

  case "undo": undoLast(); return;

  case "wipe":
    botSay("Essa ação apaga **tudo** (lançamentos, contas, cartões). Abri a confirmação do app — é preciso digitar APAGAR lá.");
    setTimeout(()=>{ try{ wipeAll(); }catch(e){} }, 400);
    return;

  case "report":
    generateReport(extractMonth(text));
    return;

  case "pay_invoice": {
    let c = card;
    if(!c && state.cards.length === 1) c = state.cards[0];
    if(!c && state.cards.length === 0){ botSay("Você ainda não tem cartões cadastrados. Me peça: “criar cartão Nubank com limite 5000”."); return; }
    if(!c){ askSlots("pay_invoice", {card:null, account:null}, ["card"]); return; }
    EXEC.pay_invoice({card:c.id, account:null, rawish:text});
    return;
  }

  case "transfer": {
    const hits = findAllAccounts(moneySrc);
    let from=null, to=null;
    if(hits.length >= 2){ from = hits[0].acc; to = hits[1].acc; }
    else if(hits.length === 1){
      const tLow = NORM(moneySrc);
      const wPos = new RegExp("\\b" + NORM(hits[0].acc.name).split(" ")[0] + "\\b").exec(tLow);
      const pos = wPos ? wPos.index : -1;
      const para = /\b(para|pra|ate)\b/.exec(tLow);
      if(para && pos >= 0 && pos < para.index) { from = hits[0].acc; }
      else { to = hits[0].acc; }
    }
    const value = moneys.length ? moneys[0].cents : 0;
    const p = {value, date, from: from?from.id:null, to: to?to.id:null, rawish:text, desc:""};
    const missing = [];
    if(!p.value) missing.push("value");
    if(!p.from) missing.push("from");
    if(!p.to) missing.push("to");
    if(missing.length){
      if(state.accounts.length < 2){ botSay("Para transferir é preciso ter **pelo menos duas contas** cadastradas. Me peça para criar outra: “criar conta no Inter com 500”."); return; }
      askSlots("transfer", p, missing); return;
    }
    EXEC.transfer(p);
    return;
  }

  case "create_card": {
    const limit = moneys.length ? moneys[0].cents : 0;
    let closeDay=null, dueDay=null, m;
    if((m=/fecha\w*\s*(dia\s*)?(\d{1,2})/.exec(t))) closeDay = clampN(+m[2],1,28);
    if((m=/vence?\w*\s*(dia\s*)?(\d{1,2})/.exec(t))) dueDay = clampN(+m[2],1,28);
    /* nome: banco conhecido ou sobra do texto */
    let name = "", bank = "";
    for(const b of BANK_NAMES){ if(new RegExp("\\b"+b+"\\b").test(t)){ name = BANK_DISPLAY[b]; bank = BANK_DISPLAY[b]; break; } }
    if(!name){
      const d = extractDesc(text, {account:null, card:null});
      name = d;
    }
    const p = {name, bank, limit, closeDay, dueDay, rawish:text};
    const missing = [];
    if(!p.name) missing.push("cardName");
    if(!p.limit) missing.push("limit");
    if(missing.length){ askSlots("create_card", p, missing); return; }
    EXEC.create_card(p);
    return;
  }

  case "create_account": {
    const initial = moneys.length ? moneys[0].cents : 0;
    let type = "corrente";
    if(/poupanca/.test(t)) type = "poupanca";
    else if(/investimento/.test(t)) type = "investimento";
    else if(/dinheiro|especie/.test(t)) type = "dinheiro";
    else if(/carteira digital|\bdigital\b/.test(t)) type = "digital";
    let name = "", bank = "";
    for(const b of BANK_NAMES){ if(new RegExp("\\b"+b+"\\b").test(t)){ name = BANK_DISPLAY[b]; bank = BANK_DISPLAY[b]; break; } }
    if(!name){
      /* tenta pegar o que vem depois de "conta/carteira no|na|do|da" */
      const d = extractDesc(text, {account:null, card:null});
      name = d;
      bank = "";
    }
    if(!name && !initial){ askSlots("create_account", {name:"", type, initial:0}, ["name"]); return; }
    if(!name){ askSlots("create_account", {name:"", type, initial}, ["name"]); return; }
    EXEC.create_account({name, type, initial, institution:bank, rawish:text});
    return;
  }

  case "budget": {
    if(moneys.length){
      state.budgets.monthly = moneys[0].cents;
      save(); render();
      botCard({ic:"target", title:"Orçamento definido", rows:[["Teto mensal de gastos", fmtMoney(state.budgets.monthly)]]});
      toast("Orçamento atualizado.");
    } else {
      const b = state.budgets.monthly || 0;
      botSay(b ? "Seu orçamento mensal atual é **" + fmtMoney(b) + "**. Para mudar: “orcamento 4000”."
               : "Você ainda não definiu orçamento. Me diga: “orcamento 4000”.");
    }
    return;
  }

  case "goal": {
    if(moneys.length){
      const isNW = /patrimonio|riqueza|patrim/.test(t);
      const v = moneys[0].cents;
      if(isNW) state.goals.netWorth = v; else state.goals.saveMonthly = v;
      save(); render();
      botCard({ic:"target", title:"Meta definida", rows:[
        [isNW ? "Meta de patrimônio" : "Meta de economia mensal", fmtMoney(v)] ]});
      toast("Meta salva.");
    } else {
      botSay("Metas atuais — economia mensal: **" + fmtMoney(state.goals.saveMonthly||0) +
             "** · patrimônio: **" + fmtMoney(state.goals.netWorth||0) +
             "**. Para definir: “meta de economia 500” ou “meta de patrimonio 50000”.");
    }
    return;
  }

  case "navigate": {
    const routes = [
      [/dashboard|visao geral|inicio|principal/, "dashboard"],
      [/lancamento/, "lancamentos"],
      [/contas a pagar|a pagar/, "contas"],
      [/receita/, "receitas"],
      [/cartoes|cartao/, "cartoes"],
      [/carteira/, "carteiras"],
      [/planejamento/, "planejamento"],
      [/relatorio/, "relatorios"],
      [/configurac|ajustes|settings/, "configuracoes"]
    ];
    const NAMES = {dashboard:"Visão geral", lancamentos:"Lançamentos", contas:"Contas a pagar",
      receitas:"Receitas", cartoes:"Cartões de crédito", carteiras:"Contas e carteiras",
      planejamento:"Planejamento", relatorios:"Relatórios", configuracoes:"Configurações"};
    for(const [re, route] of routes){
      if(re.test(t)){ location.hash = "#/" + route; botSay("Abri a página de **" + (NAMES[route] || route) + "**. 👍"); return; }
    }
    botSay("Não sei qual página é essa. Tente: dashboard, lançamentos, contas a pagar, receitas, cartões, carteiras, planejamento, relatórios ou configurações.");
    return;
  }

  case "theme": {
    const dark = /escuro|dark/.test(t);
    state.settings.theme = dark ? "dark" : "light";
    applyTheme(); save();
    botSay("Tema " + (dark ? "escuro" : "claro") + " ativado. 🌓");
    return;
  }

  case "balance": {
    const nw = netWorth();
    let msg = "Seu **saldo total** é **" + fmtMoney(nw) + "**.";
    if(state.accounts.length){
      msg += "\nPor conta:";
      state.accounts.forEach(a => { msg += "\n- " + a.name + ": " + fmtMoney(accountBalance(a)); });
    } else {
      msg += "\nAinda não há contas cadastradas — me peça: “criar conta no Nubank com 500”.";
    }
    if(card && state.cards.length){
      msg += "\nNo cartão **" + card.name + "**: fatura atual " + fmtMoney(cardStats(card).invoiceNow) + ".";
    }
    botSay(msg);
    return;
  }

  case "summary": {
    const [cs, ce] = cycleRange(new Date());
    const txP = state.transactions.filter(tx => inRange(tx.date, cs, ce));
    const rec = txP.filter(x=>x.type==="receita").reduce((s,x)=>s+x.value,0);
    const desp = txP.filter(x=>x.type==="despesa").reduce((s,x)=>s+x.value,0);
    const pend = state.transactions.filter(x=>x.status!=="pago" && x.type==="despesa");
    const late = pend.filter(x=>x.date < todayISO());
    let msg = "**Resumo do ciclo atual** (" + fmtDate(cs) + " a " + fmtDate(ce) + "):\n"+
      "- Receitas: " + fmtMoney(rec) + "\n"+
      "- Despesas: " + fmtMoney(desp) + "\n"+
      "- Resultado: **" + fmtMoney(rec-desp) + "**\n"+
      "- Saldo total hoje: " + fmtMoney(netWorth());
    if(pend.length) msg += "\n- Em aberto: " + pend.length + " conta(s) (" + fmtMoney(pend.reduce((s,x)=>s+x.value,0)) + ")" +
      (late.length ? ", sendo " + late.length + " vencida(s) ⚠️" : "");
    /* maior categoria */
    const byCat = {};
    txP.filter(x=>x.type==="despesa").forEach(x => { byCat[x.categoryId]=(byCat[x.categoryId]||0)+x.value; });
    const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    if(top){ const c = catById(top[0]); if(c) msg += "\n- Maior gasto: **" + c.name + "** (" + fmtMoney(top[1]) + ")"; }
    botSay(msg);
    return;
  }

  case "spend_query": {
    const mm = extractMonth(text) || {y:new Date().getFullYear(), m:new Date().getMonth()};
    const mk = mkOf(mm);
    const cat = findCategory(text, "despesa");
    const list = state.transactions.filter(x =>
      x.type === "despesa" && monthKey(x.date) === mk && (!cat || x.categoryId === cat.id));
    const total = list.reduce((s,x)=>s+x.value,0);
    let msg = "Em **" + monthLabel(mm) + "** você gastou **" + fmtMoney(total) + "**" +
      (cat ? " com **" + cat.name + "**" : "") + " (" + list.length + " lançamento(s)).";
    if(list.length){
      const byCat = {};
      list.forEach(x => { const c = catById(x.categoryId); const k = c ? c.name : "Outros"; byCat[k]=(byCat[k]||0)+x.value; });
      const tops = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4);
      msg += "\nDistribuição:";
      tops.forEach(([k,v]) => { msg += "\n- " + k + ": " + fmtMoney(v); });
    }
    botSay(msg);
    return;
  }

  case "list_accounts": {
    if(!state.accounts.length){ botSay("Você não tem contas cadastradas ainda. Que tal: “criar conta no Inter com 500”?"); return; }
    let msg = "Suas contas:";
    state.accounts.forEach(a => { msg += "\n- **" + a.name + "** (" + (ACC_TYPES[a.type]||a.type) + "): " + fmtMoney(accountBalance(a)); });
    botSay(msg);
    return;
  }

  case "list_cards": {
    if(!state.cards.length){ botSay("Você não tem cartões cadastrados. Me peça: “criar cartão Nubank com limite 5000”."); return; }
    let msg = "Seus cartões:";
    state.cards.forEach(c => {
      const s = cardStats(c);
      msg += "\n- **" + c.name + "** · limite " + fmtMoney(c.limit||0) + " · fatura atual " + fmtMoney(s.invoiceNow) + " · disponível " + fmtMoney(s.available);
    });
    botSay(msg);
    return;
  }

  case "pending_bills": {
    const pend = state.transactions.filter(x=>x.type==="despesa" && x.status!=="pago").sort((a,b)=>a.date.localeCompare(b.date));
    if(!pend.length){ botSay("Você não tem contas em aberto. Está tudo pago! ✅"); return; }
    const today = todayISO();
    let msg = "Contas em aberto (**" + pend.length + "**), totalizando **" + fmtMoney(pend.reduce((s,x)=>s+x.value,0)) + "**:";
    pend.slice(0,8).forEach(x => {
      const late = x.date < today;
      msg += "\n- " + (late ? "⚠️ " : "") + x.desc + " — " + fmtMoney(x.value) + " (vence " + fmtDate(x.date) + ")";
    });
    if(pend.length > 8) msg += "\n- … e mais " + (pend.length-8) + ".";
    msg += "\nPara pagar uma: “paguei " + pend[0].desc.toLowerCase() + "”.";
    botSay(msg);
    return;
  }

  case "income":
  case "expense": {
    const type = intent === "income" ? "receita" : "despesa";
    const value = moneys.length ? moneys[0].cents : 0;
    const desc = extractDesc(text, {account, card});
    /* paguei/recebi algo que já está pendente? (só se o valor bater ou nenhum valor informado) */
    if(/\b(paguei|quitei|recebi)\b/.test(t) && desc){
      const today = todayISO();
      const cands = state.transactions.filter(x =>
        x.type === type && x.status !== "pago" &&
        words(desc).some(w => w.length>3 && words(x.desc).includes(w)));
      if(cands.length){
        /* ordem: vencidas/atuais primeiro; depois a mais próxima */
        cands.sort((a,b) => {
          const fa = a.date <= today ? 0 : 1, fb = b.date <= today ? 0 : 1;
          if(fa !== fb) return fa - fb;
          return a.date.localeCompare(b.date);
        });
        const match = cands[0];
        const compat = !value || Math.abs(value - match.value) <= Math.max(100, Math.round(match.value * 0.02));
        if(compat){
          if(match.cardId && !match.accountId && state.accounts.length > 1){
            askSlots("pay_pending_with", {match, payType:type, account:null}, ["account"]);
            return;
          }
          actPayPending(match, type);
          return;
        }
        /* valor divergente → segue para criar um lançamento novo */
      }
    }
    let categoryId = null;
    /* remove o valor da frase antes de detectar categoria (ex.: "99,90" não deve casar com o app "99") */
    const catText = (desc + " " + t).replace(/\s?\d{1,3}(?:\.\d{3})+,\d{1,2}|\s?\d+,\d{1,2}|\s?\d+(?:\.\d+)?/, " ");
    const cat = findCategory(catText, type);
    if(cat) categoryId = cat.id;
    const useCard = card || (/cartao|credito/.test(t) && /\bcomprei|compra\b/.test(t) && state.cards.length === 1);
    const p = {
      value, desc, date, categoryId,
      cardId: card ? card.id : (useCard && !card ? state.cards[0].id : null),
      account: (card || useCard) ? null : (account ? account.id : null),
      payMethod: /pix/.test(t) ? "Pix" : /boleto/.test(t) ? "Boleto" : /dinheiro/.test(t) && !account ? "Dinheiro" :
                 /debito/.test(t) ? "Cartão de débito" : null,
      status: /\bpendente\b|\bvou pagar\b|\bvou receber\b|\bfutura?\b/.test(t) ? "pendente" :
              (date && date > todayISO() ? "pendente" : null),
      rawish: text,
      catText: catText
    };
    const missing = [];
    if(!p.value) missing.push("value");
    if(!p.desc && !categoryId) missing.push("desc");
    if(missing.length){ askSlots(intent, p, missing); return; }
    if(!p.desc) p.desc = cat ? cat.name : (type==="receita" ? "Receita" : "Despesa");
    EXEC._tx(type, p);
    return;
  }

  case "fallback":
  default:
    botSay("Não tenho certeza do que você quer. 😅 Posso, por exemplo:\n"+
      "- criar contas e cartões\n- lançar despesas e receitas\n- transferir entre contas e pagar faturas\n- mostrar saldos, resumos e relatórios\n"+
      "Digite **ajuda** para ver tudo o que eu sei.");
    return;
  }
}

/* ---------- 8. Envio ---------- */
function send(text){
  text = String(text||"").trim().slice(0, 280);
  if(!text) return;
  pushUser(text);
  if(pending){
    const done = continuePending(text);
    if(done) return;
  }
  botReply(()=>handle(text));
}
formEl.addEventListener("submit", e => {
  e.preventDefault();
  const v = inputEl.value;
  inputEl.value = "";
  send(v);
});

/* ---------- 9. Boot ---------- */
chatLoad();
renderChat();
setChips(defaultChips());
if(!sessionStorage.getItem("fluxo.ai.seen")){
  sessionStorage.setItem("fluxo.ai.seen","1");
  setTimeout(()=>{ fab.classList.add("pulse"); setTimeout(()=>fab.classList.remove("pulse"), 5500); }, 1600);
}
})();
