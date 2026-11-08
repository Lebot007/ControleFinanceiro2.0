/* ============================================================
   Fluxo — Assistente Financeiro (camada de UI do chat)
   ------------------------------------------------------------
   Aqui fica SÓ a interface: painel, bolhas, cartões de
   confirmação, PDF, "Minha Memória" e o histórico.

   O CÉREBRO mora em agente.js: um agente de IA real (LLM com
   Tool Calling) que entende linguagem natural, decide sozinho
   o que fazer, executa as ações no app e guarda fatos na
   memória. Este arquivo não tem NENHUMA regra de conversa —
   a mensagem vai para o agente e a resposta dele é renderizada.

   Fluxo de um turno:
     usuário fala → agente pensa (LLM na nuvem, sem chave)
     → agente executa ferramentas (aqui, no navegador)
     → resposta final + cartões de confirmação
   ============================================================ */
(function(){
"use strict";

/* ---------- 0. Guardas ---------- */
if(!document.getElementById("app")) return;   // só roda na página principal do app
if(window.AIChat) return;                     // evita instância dupla

const CHAT_KEY = "fluxo.chat.v1";
const CHAT_MAX = 250;
const SID = Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/* ---------- 1. Estado do chat ---------- */
let history = [];        /* [{r:'u'|'b', t?} | {r:'b', card} | {r:'b', pdf}] */
let lastAction = null;   /* última ação executada (para desfazer) */
let busy = false;        /* um turno do agente por vez */
let lastPrompt = null;   /* último System Prompt montado (debug) */

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

/* ---------- 2. DOM ---------- */
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
  '<div class="ai-title"><b>Fluxo</b><span>mentor financeiro · IA de verdade · memória ativa</span></div>'+
  '<button class="icon-btn" id="ai-mem-btn" title="Minha memória" aria-label="Abrir Minha Memória">'+icon("book",16)+'</button>'+
  '<button class="icon-btn" id="ai-clear" title="Limpar conversa" aria-label="Limpar conversa">'+icon("trash",16)+'</button>'+
  '<button class="icon-btn" id="ai-close" title="Fechar" aria-label="Fechar assistente">'+icon("x",17)+'</button>'+
'</div>'+
'<div id="ai-msgs" aria-live="polite"></div>'+
'<div id="ai-chips"></div>'+
'<form id="ai-form" autocomplete="off">'+
  '<input id="ai-input" placeholder="Pergunte ou peça qualquer coisa…" aria-label="Mensagem para o assistente" maxlength="500">'+
  '<button id="ai-send" type="submit" aria-label="Enviar mensagem">'+
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-4.6 16-4-6.4z"/><path d="M20 4 11.4 13.6"/></svg>'+
  '</button>'+
'</form>';
document.body.appendChild(fab);
document.body.appendChild(panel);

const msgsEl  = panel.querySelector("#ai-msgs");
const chipsEl = panel.querySelector("#ai-chips");
const inputEl = panel.querySelector("#ai-input");
const formEl  = panel.querySelector("#ai-form");
const sendEl  = panel.querySelector("#ai-send");

function isOpen(){ return panel.classList.contains("open"); }
function open(){
  panel.classList.add("open");
  document.body.classList.add("ai-chat-open");
  fab.setAttribute("aria-label", "Fechar assistente financeiro");
  fab.classList.remove("has-news");
  if(!history.length) greet();
  setTimeout(()=>{ try{ inputEl.focus(); }catch(e){} }, 180);
}
function close(){
  panel.classList.remove("open");
  document.body.classList.remove("ai-chat-open");
  fab.setAttribute("aria-label", "Abrir assistente financeiro");
}
function toggle(){ isOpen() ? close() : open(); }
fab.addEventListener("click", toggle);
panel.querySelector("#ai-close").addEventListener("click", close);
function clearChatConfirm(){
  confirmModal({
    title:"Limpar conversa", okLabel:"Limpar", danger:true,
    msg:"Apagar todo o histórico da conversa com o assistente?<br><span style=\"color:var(--ink2)\">Sua <b>memória</b> e seus dados financeiros <b>não</b> são afetados.</span>",
    onOk:()=>{ history=[]; chatSave(); renderChat(); greet(); }
  });
}
panel.querySelector("#ai-clear").addEventListener("click", clearChatConfirm);
panel.querySelector("#ai-mem-btn").addEventListener("click", ()=>openMemModal());
window.AIChat = { open, close, toggle, isOpen, memory:()=>openMemModal(), lastSystemPrompt:()=>lastPrompt };

/* ---------- 3. Minha Memória (modal: ver / editar / apagar fatos) ---------- */
let memOverlay = null;
function memEsc(e){ if(e.key === "Escape"){ e.stopPropagation(); closeMemModal(); } }
function closeMemModal(){
  if(!memOverlay) return;
  const ov = memOverlay; memOverlay = null;
  document.removeEventListener("keydown", memEsc, true);
  ov.classList.remove("show");
  setTimeout(()=>ov.remove(), 180);
}
function openMemModal(){
  if(memOverlay){ closeMemModal(); return; }
  const M = window.FluxoMemoria;
  if(!M){ botSay("O módulo de memória não carregou — recarregue a página."); return; }
  const ov = document.createElement("div");
  ov.id = "ai-mem-overlay";
  document.body.appendChild(ov);
  memOverlay = ov;
  requestAnimationFrame(()=>ov.classList.add("show"));
  ov.addEventListener("mousedown", e=>{ if(e.target === ov) closeMemModal(); });
  document.addEventListener("keydown", memEsc, true);
  paintMem();
  const x = ov.querySelector("[data-close]");
  if(x) x.focus();
}
function paintMem(){
  const ov = memOverlay; if(!ov) return;
  const M = window.FluxoMemoria, facts = M.all();
  ov.innerHTML =
  '<div class="ai-mem-card" role="dialog" aria-modal="true" aria-label="Minha Memória">'+
    '<div class="ai-mem-head">'+
      '<div class="ai-mem-ic">'+icon("book",17)+'</div>'+
      '<div class="ai-mem-tt"><b>Minha Memória</b><span>'+facts.length+' fato'+(facts.length===1?'':'s')+' · fica só no seu navegador</span></div>'+
      '<button class="ai-mem-x" data-close title="Fechar" aria-label="Fechar Minha Memória">'+icon("x",16)+'</button>'+
    '</div>'+
    '<p class="ai-mem-sub">Tudo que o Fluxo lembra sobre você. Edite ou apague à vontade — <b>seus dados financeiros não são afetados</b>.</p>'+
    '<div class="ai-mem-list">'+
      (facts.length ? facts.map(f=>
        '<div class="ai-mem-row" data-id="'+f.id+'">'+
          '<span class="ai-mem-tag '+esc(f.kind)+'">'+esc(M.KIND_LABEL[f.kind]||f.kind)+'</span>'+
          '<span class="ai-mem-text">'+esc(f.text)+'</span>'+
          '<button class="ai-mem-act" data-edit title="Editar fato" aria-label="Editar fato">'+icon("pencil",14)+'</button>'+
          '<button class="ai-mem-act" data-del title="Apagar fato" aria-label="Apagar fato">'+icon("trash",14)+'</button>'+
        '</div>').join("")
      : '<div class="ai-mem-empty">'+icon("sparkles",26)+'<b>Nada guardado ainda</b><span>Me conte no chat: “lembre-se que meu salário é 3000”.</span></div>')+
    '</div>'+
    (facts.length ? '<div class="ai-mem-foot"><button class="ai-mem-wipe" data-wipe>Apagar toda a memória</button></div>' : '')+
  '</div>';
  const closeBtn = ov.querySelector("[data-close]");
  if(closeBtn) closeBtn.onclick = closeMemModal;
  ov.querySelectorAll(".ai-mem-row").forEach(row=>{
    const id = row.dataset.id;
    row.querySelector("[data-edit]").onclick = ()=>editMemRow(row, id);
    const del = row.querySelector("[data-del]");
    del.onclick = ()=>{
      if(del.dataset.armed){ M.remove(id); paintMem(); toast("Fato apagado da memória."); }
      else{
        del.dataset.armed = "1"; del.classList.add("armed"); del.textContent = "Apagar?";
        setTimeout(()=>{ if(del.isConnected){ delete del.dataset.armed; del.classList.remove("armed"); del.innerHTML = icon("trash",14); } }, 2600);
      }
    };
  });
  const wipe = ov.querySelector("[data-wipe]");
  if(wipe) wipe.onclick = ()=>{
    if(wipe.dataset.armed){ M.clear(); paintMem(); toast("Memória apagada."); }
    else{
      wipe.dataset.armed = "1"; wipe.classList.add("armed"); wipe.textContent = "Apagar TUDO mesmo? (toque de novo)";
      setTimeout(()=>{ if(wipe.isConnected){ delete wipe.dataset.armed; wipe.classList.remove("armed"); wipe.textContent = "Apagar toda a memória"; } }, 3200);
    }
  };
}
function editMemRow(row, id){
  const M = window.FluxoMemoria;
  const f = M.all().find(x=>x.id===id);
  if(!f) return;
  row.innerHTML =
    '<span class="ai-mem-tag '+esc(f.kind)+'">'+esc(M.KIND_LABEL[f.kind]||f.kind)+'</span>'+
    '<input class="ai-mem-input" value="'+esc(f.text)+'" maxlength="200" aria-label="Editar fato">'+
    '<button class="ai-mem-act ok" data-save title="Salvar" aria-label="Salvar edição">'+icon("check",14)+'</button>'+
    '<button class="ai-mem-act" data-cancel title="Cancelar" aria-label="Cancelar edição">'+icon("x",14)+'</button>';
  const inp = row.querySelector("input");
  inp.focus(); try{ inp.select(); }catch(e){}
  const save = ()=>{
    const r = M.update(id, inp.value);
    if(r.ok){ paintMem(); toast("Fato atualizado."); }
    else{ inp.classList.add("err"); toast("Esse texto não parece um fato útil.", "warn"); }
  };
  row.querySelector("[data-save]").onclick = save;
  row.querySelector("[data-cancel]").onclick = paintMem;
  inp.addEventListener("keydown", e=>{
    if(e.key === "Enter"){ e.preventDefault(); save(); }
    if(e.key === "Escape"){ paintMem(); }
  });
}

/* ---------- 4. Renderização ---------- */
/* Markdown mínimo e seguro: escapa tudo, depois aplica **negrito** e bullets */
function miniMD(text){
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<b>$1</b>")
    .split("\n").map(l => {
      const t = l.trim();
      if(/^[-*•]\s+/.test(t)) return '<div class="ai-li">'+t.replace(/^[-*•]\s+/,"")+'</div>';
      if(/^\d+[.)]\s+/.test(t)) return '<div class="ai-li">'+t.replace(/^\d+[.)]\s+/,"")+'</div>';
      return l;
    }).join("<br>")
    .replace(/(<br>)+$/,"");
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
      <div class="ai-card-b">${(c.rows||[]).filter(r=>r[1]!=="" && r[1]!=null).map(r=>`<div class="ai-kv"><span>${esc(r[0])}</span><b>${esc(String(r[1]))}</b></div>`).join("")}</div>
      ${canUndo ? `<div class="ai-card-f"><button class="btn btn-ghost btn-sm" data-ai-undo>${icon("x",12)} Desfazer</button></div>` : ""}
    </div>`;
  } else {
    inner = `<div class="ai-bub"><div class="ai-msg-text">${miniMD(m.t||"")}</div></div>`;
  }
  row.innerHTML = `<div class="ai-bot-ic">${icon("sparkles",14)}</div>${inner}`;
  const ub = row.querySelector("[data-ai-undo]");
  if(ub) ub.addEventListener("click", ()=>{ botSay(undoLast()); });
  return row;
}
function renderChat(){
  msgsEl.innerHTML = "";
  history.forEach(m => msgsEl.appendChild(m.pdf ? pdfNode(m.pdf) : msgNode(m)));
  scrollBottom();
}
function scrollBottom(){
  msgsEl.scrollTop = msgsEl.scrollHeight;
  /* garante o ajuste depois do layout assentar (fontes, imagens, bolhas) */
  requestAnimationFrame(()=>{ if(msgsEl.isConnected) msgsEl.scrollTop = msgsEl.scrollHeight; });
}

function pushUser(text){
  history.push({r:"u", t:text});
  chatSave();
  msgsEl.appendChild(msgNode(history[history.length-1]));
  scrollBottom();
}

/* Indicador de digitação com status do que o agente está fazendo.
   Se a resposta demorar um pouco, a frase evolui — nada de contagem
   de segundos ou avisos técnicos na cara do usuário. */
let typingEl = null, typingTimer = null, typingIdx = 0;
const TYPING_PHRASES = ["pensando…", "ainda pensando…", "quase lá…", "últimos ajustes…"];
function showTyping(status){
  if(!typingEl){
    typingEl = document.createElement("div");
    typingEl.className = "ai-row";
    msgsEl.appendChild(typingEl);
  }
  typingEl.innerHTML = `<div class="ai-bot-ic">${icon("sparkles",14)}</div>`+
    `<div class="ai-bub ai-typing"><i></i><i></i><i></i>${status ? '<span class="ai-status">'+esc(status)+'</span>' : ''}</div>`;
  typingIdx = 0;
  clearInterval(typingTimer);
  typingTimer = setInterval(()=>{
    typingIdx = Math.min(typingIdx + 1, TYPING_PHRASES.length - 1);
    const s = typingEl && typingEl.querySelector(".ai-status");
    if(s) s.textContent = TYPING_PHRASES[typingIdx];
  }, 6000);
  scrollBottom();
}
function hideTyping(){
  clearInterval(typingTimer); typingTimer = null;
  if(typingEl){ typingEl.remove(); typingEl=null; }
}

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
}

/* ---------- 5. Relatório em PDF (chamado pela ferramenta do agente) ---------- */
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
  if(!window.FluxoPDF) throw new Error("gerador de PDF não carregou");
  const [ps, pe] = cycleForReport(mm);
  const mk = mm.y + "-" + String(mm.m+1).padStart(2,"0");
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
    filename: "relatorio-fluxo-" + mk + ".pdf",
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
    return null;
  }
}

/* Gera (ou reaproveita) o relatório e entrega no chat. Devolve true/false. */
function generateReport(mm){
  if(!mm) mm = {y: new Date().getFullYear(), m: new Date().getMonth()};
  const mk = mm.y + "-" + String(mm.m+1).padStart(2,"0");
  const c = pdfCache[mk] || makePdfForMk(mk);
  if(!c) return false;
  history.push({r:"b", pdf:{mk, label: ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][mm.m] + " de " + mm.y}});
  chatSave();
  msgsEl.appendChild(pdfNode(history[history.length-1].pdf));
  scrollBottom();
  downloadPdf(mk);
  return true;
}

/* ---------- 6. Chips de sugestão (atalhos de UI, não regras) ---------- */
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
  if(!state.accounts.length) chips.push("Crie as contas Inter com 1905 e Cauda com 255", "O que você faz?", "Como recupero minha senha?");
  else if(!state.transactions.length) chips.push("Recebi 3000 de salário", "Cadastrar despesa de mercado 250,50", "Lembre-se que odeio gastar com fast food");
  else chips.push("Qual meu saldo?", "Resumo do mês", "O que você sabe sobre mim?", "Quanto gastei este mês?");
  return chips;
}

/* ---------- 7. Desfazer ---------- */
function setUndo(kind, ref){ lastAction = {kind, ref, sid:SID}; }

function undoLast(){
  if(!lastAction || lastAction.sid !== SID){
    return "Não há ação recente desta sessão para desfazer.";
  }
  const {kind, ref} = lastAction;
  try{
    if(kind === "tx"){
      state.transactions = state.transactions.filter(t => t.id !== ref.id);
    } else if(kind === "account"){
      const linked = state.transactions.some(t=>t.accountId===ref.id) || state.transfers.some(t=>t.from===ref.id||t.to===ref.id);
      if(linked){ lastAction=null; return "Essa conta já recebeu movimentações, então não vou excluí-la automaticamente. Dá para excluir em **Contas e carteiras**."; }
      state.accounts = state.accounts.filter(a => a.id !== ref.id);
    } else if(kind === "card"){
      const linked = state.transactions.some(t=>t.cardId===ref.id);
      if(linked){ lastAction=null; return "Esse cartão já tem compras vinculadas, então não vou excluí-lo automaticamente. Dá para excluir em **Cartões de crédito**."; }
      state.cards = state.cards.filter(c => c.id !== ref.id);
    } else if(kind === "transfer"){
      state.transfers = state.transfers.filter(t => t.id !== ref.id);
    } else if(kind === "paid"){
      (ref.txs||[]).forEach(t => { t.status = "pendente"; delete t.paidDate; });
    }
    lastAction = null;
    save(); render();
    return "Pronto, ação desfeita e saldos atualizados.";
  }catch(e){
    return "Não consegui desfazer: " + (e.message || "erro");
  }
}

/* ---------- 8. Pontos de contato para as ferramentas do agente ---------- */
window.FluxoUI = {
  undo: setUndo,
  undoLast: () => undoLast(),
  report: (mm) => generateReport(mm)
};

/* ---------- 9. Envio — o turno do agente ---------- */
function llmHistory(){
  return history
    .filter(m => m.t && typeof m.t === "string")          /* só bolhas de texto */
    .slice(-8)                                            /* contexto suficiente, prompt leve */
    .map(m => ({role: m.r === "u" ? "user" : "assistant", content: m.t}));
}

function setBusy(b){
  busy = b;
  inputEl.disabled = b;
  sendEl.disabled = b;
  panel.classList.toggle("busy", b);
}

async function agir(text){
  setBusy(true);
  showTyping("pensando…");
  const t0 = Date.now();
  try{
    const out = await window.FluxoAgente.turn(text, {
      history: llmHistory(),
      onStatus: s => showTyping(/…$/.test(s) ? s : s + "…")
    });
    hideTyping();
    if(out.text) botSay(out.text);
    (out.cards || []).forEach(c => botCard(c));
    if(!out.text && !(out.cards||[]).length){
      botSay("Fiquei sem palavras agora — pode repetir de outro jeito?");
    }
  }catch(e){
    hideTyping();
    botSay("Meu cérebro deu um nó agora 😵‍💫 Pode repetir? Se persistir, aguarde uns segundos — o serviço gratuito de IA às vezes respira fundo.");
  }finally{
    setBusy(false);
    if(isOpen()){ try{ inputEl.focus(); }catch(e){} }
  }
}

function send(text){
  text = String(text||"").trim().slice(0, 500);
  if(!text || busy) return;
  pushUser(text);
  /* guarda o System Prompt desta interação (inspeção/debug via AIChat.lastSystemPrompt()) */
  try{
    if(window.FluxoMemoria) lastPrompt = null; /* o prompt agora é montado no agente.js */
  }catch(e){}
  agir(text);
}
formEl.addEventListener("submit", e => {
  e.preventDefault();
  const v = inputEl.value;
  inputEl.value = "";
  send(v);
});

/* ---------- 10. Boas-vindas ---------- */
function greet(){
  const nome = (window.FluxoMemoria && window.FluxoMemoria.knownName()) || "";
  botSay("Oi"+(nome ? ", **"+nome+"**" : "")+"! Eu sou o **Fluxo**, seu mentor financeiro — agora movido por uma **IA de verdade**, que entende qualquer coisa que você escrever.\n"+
    "Pode pedir como se fosse a uma pessoa: “crie as contas Inter com 1905 e Cauda com 255”, “quanto sobrou do meu salário?”, “como recupero minha senha?”…\n"+
    "Eu também **memorizo** o que você me conta (toque no ícone de livro para ver a **Minha Memória**).\n"+
    "_Obs.: para eu pensar, a conversa passa por um serviço de IA gratuito; seus dados financeiros e sua memória continuam salvos só no seu navegador._",
    {chips: defaultChips()});
}

/* ---------- 11. Boot ---------- */
chatLoad();
renderChat();
setChips(defaultChips());
if(!sessionStorage.getItem("fluxo.ai.seen")){
  sessionStorage.setItem("fluxo.ai.seen","1");
  setTimeout(()=>{ fab.classList.add("pulse"); setTimeout(()=>fab.classList.remove("pulse"), 5500); }, 1600);
}
})();
