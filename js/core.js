"use strict";
/* ---------- 1. Utilitários ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const APP_ID = "fluxo";
const DB_KEY = "fluxo.v1";
const AUTO_KEY = "fluxo.autobackup";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES3 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

// Tratamento rigoroso de Datas (Evita bug de UTC/Timezone)
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromISO = s => { const [a,b,c] = s.split("-").map(Number); return new Date(a, b-1, c); };
const todayISO = () => isoOf(new Date());
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(fromISO(s));
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate()+n); return isoOf(d); };
const addMonths = (iso, n) => {
  const d = fromISO(iso), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+n);
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  d.setDate(Math.min(day, last)); return isoOf(d);
};
const monthKey = iso => iso.slice(0, 7);
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
const labShort = iso => `${iso.slice(8,10)} ${MESES3[+iso.slice(5,7)-1]}/${iso.slice(2,4)}`;

let _fmtCache = {};
function fmtMoney(cents){
  const cur = state.settings.currency || "BRL";
  if(!_fmtCache[cur]) _fmtCache[cur] = new Intl.NumberFormat("pt-BR", {style:"currency", currency:cur});
  return _fmtCache[cur].format((cents||0)/100);
}
function fmtShort(cents){
  const v = (cents||0)/100, a = Math.abs(v);
  if(a >= 1e6) return (v/1e6).toLocaleString("pt-BR",{maximumFractionDigits:1}) + "M";
  if(a >= 1e3) return (v/1e3).toLocaleString("pt-BR",{maximumFractionDigits: a <1e4?1:0}) + "k";
  return v.toLocaleString("pt-BR",{maximumFractionDigits:0});
}
function fmtDate(iso){
  if(!validDate(iso)) return "—";
  const [y,m,d] = iso.split("-");
  const f = state.settings.dateFormat || "dd/mm/aaaa";
  if(f === "aaaa-mm-dd") return iso;
  if(f === "mm/dd/aaaa") return `${m}/${d}/${y}`;
  return `${d}/${m}/${y}`;
}
const fmtDateShort = iso => validDate(iso) ? `${iso.slice(8,10)} ${MESES3[+iso.slice(5,7)-1]}` : "—";

function download(name, content, mime){
  const b = new Blob([content], {type: mime});
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(u), 800);
}

// Fallback de Ícones (Resiliência caso icons.js falhe)
if (!window.icon) {
  window.icon = (name, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
}

/* ---------- 2. Estado e armazenamento ---------- */
const PAY_METHODS = ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Transferência", "Débito automático", "Outro"];
const ACC_TYPES = {corrente:"Conta corrente", poupanca:"Poupança", dinheiro:"Dinheiro", digital:"Carteira digital", investimento:"Investimentos", outra:"Outra"};
const PALETTE = ["#e8590c", "#1971c2", "#f08c00", "#e03131", "#7048e8", "#d6336c", "#0ca678", "#4c6ef5", "#5f3dc4", "#b08968", "#2f9e44", "#8d99ae", "#12b886", "#f59f00"];

function defaultState(){
  const C = (name,type,icon,color)=>({id:uid(),name,type,icon,color});
  return {
    meta:{app:APP_ID, version:1, createdAt:new Date().toISOString()},
    settings:{currency:"BRL", dateFormat:"dd/mm/aaaa", theme:"light", monthStart:1},
    categories:[
      C("Alimentação","despesa","utensils","#e8590c"), C("Moradia","despesa","home","#1971c2"),
      C("Transporte","despesa","car","#f08c00"), C("Saúde","despesa","heart","#e03131"),
      C("Educação","despesa","book","#7048e8"), C("Lazer","despesa","ticket","#d6336c"),
      C("Compras","despesa","bag","#0ca678"), C("Assinaturas","despesa","repeat","#4c6ef5"),
      C("Contas","despesa","receipt","#5f3dc4"), C("Impostos","despesa","landmark","#b08968"),
      C("Outros","despesa","dots","#8d99ae"),
      C("Salário","receita","briefcase","#2f9e44"), C("Freelance","receita","sparkles","#12b886"),
      C("Vendas","receita","tag","#f59f00"), C("Investimentos","receita","trendUp","#37b24d"),
      C("Outros","receita","coins","#74c69d")
    ],
    accounts:[], cards:[], transactions:[], recurrences:[],
    budgets:{monthly:0, categories:{}},
    goals:{saveMonthly:0, netWorth:0},
    demo:false, initialized:false
  };
}
let state = loadState() || defaultState();
const ui = { period:"mes", from:"", to:"", txF:{q:"",type:"",cat:"",acc:"",status:"",method:"",from:"",to:"",sort:"date-desc",_focus:false} };

function loadState(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(d && d.meta && d.meta.app === APP_ID) return mergeDefaults(d);
  }catch(e){ console.warn("Falha ao ler dados locais", e); }
  return null;
}
function mergeDefaults(d){
  const base = defaultState();
  const out = {...base, ...d, settings:{...base.settings, ...(d.settings||{})},
    budgets:{...base.budgets, ...(d.budgets||{})}, goals:{...base.goals, ...(d.goals||{})}};
  ["categories","accounts","cards","transactions","recurrences"].forEach(k=>{ if(!Array.isArray(out[k])) out[k]=[]; });
  return out;
}
function save(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(state)); }catch(e){ toast("Não foi possível salvar (armazenamento cheio?).", "err"); } }

/* ---------- 3. Derivados, períodos e cálculos ---------- */
const catById = id => state.categories.find(c=>c.id===id);
const accById = id => state.accounts.find(a=>a.id===id);
const cardById = id => state.cards.find(c=>c.id===id);
function txStatus(t){ if(t.status === "pago") return "pago"; return t.date < todayISO() ? "vencido" : "pendente"; }
function accountBalance(acc){
  let b = acc.initial || 0;
  for(const t of state.transactions) if(t.status==="pago" && t.accountId===acc.id) b += t.type==="receita" ? t.value : -t.value;
  return b;
}
const netWorth = () => state.accounts.reduce((s,a)=>s+accountBalance(a), 0);
const invested = () => state.accounts.filter(a=>a.type==="investimento"||a.type==="poupanca").reduce((s,a)=>s+Math.max(0,accountBalance(a)),0);

function rangeForPeriod(p, from, to){
  const t = new Date(), ms = Math.min(Math.max(+state.settings.monthStart||1,1),28);
  const cycle = anchor => {
    const s = new Date(anchor.getFullYear(), anchor.getMonth(), ms);
    if(anchor < s) s.setMonth(s.getMonth()-1);
    const e = new Date(s.getFullYear(), s.getMonth()+1, ms-1);
    return [isoOf(s), isoOf(e)];
  };
  if(p==="prev"){ const [cs]=cycle(t); return cycle(fromISO(addDays(cs,-1))); }
  if(p==="mes") return cycle(t);
  if(p==="30d") return [todayISO(), addDays(todayISO(),30)];
  if(p==="ano") return [`${t.getFullYear()}-01-01`, `${t.getFullYear()}-12-31`];
  if(p==="custom"){ let f=from||`${t.getFullYear()}-01-01`, g=to||todayISO(); if(f>g){ const tmp=f; f=g; g=tmp; } return [f,g]; }
  return cycle(t);
}
function periodRange(){ return rangeForPeriod(ui.period, ui.from, ui.to); }
const inRange = (d,s,e) => d >=s && d <=e;

function lastMonths(n){
  const out=[], d=new Date();
  for(let i=n-1;i>=0;i--){ const x=new Date(d.getFullYear(), d.getMonth()-i, 1);
    out.push({key:`${x.getFullYear()}-${pad(x.getMonth()+1)}`, label:`${MESES3[x.getMonth()]}/${String(x.getFullYear()).slice(2)}`}); }
  return out;
}
function monthsInRange(ps,pe){
  const out=[]; let y=+ps.slice(0,4), m=+ps.slice(5,7);
  const ey=+pe.slice(0,4), em=+pe.slice(5,7); let guard=0;
  while((y<ey || (y===ey && m<=em)) && guard++<24){
    out.push({key:`${y}-${pad(m)}`, label:`${MESES3[m-1]}/${String(y).slice(2)}`});
    m++; if(m>12){m=1;y++;}
  }
  return out;
}
function cycleRange(anchor){
  const ms = Math.min(Math.max(+state.settings.monthStart||1,1),28);
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), ms);
  if(anchor < s) s.setMonth(s.getMonth()-1);
  const e = new Date(s.getFullYear(), s.getMonth()+1, ms-1);
  return [isoOf(s), isoOf(e)];
}
function cardStats(card){
  const inst = state.transactions.filter(t=>t.cardId===card.id && t.type==="despesa");
  const open = inst.filter(t=>t.status!=="pago");
  const used = open.reduce((s,t)=>s+t.value,0);
  const now = todayISO(), mk = monthKey(now);
  const invoiceNow = inst.filter(t=>monthKey(t.date)===mk).reduce((s,t)=>s+t.value,0);
  const overdue = open.filter(t=>t.date<now).reduce((s,t)=>s+t.value,0);
  return {used, open:open.length, invoiceNow, overdue, available:(card.limit||0)-used};
}

/* ---------- 4. Recorrências e parcelas ---------- */
function advanceDate(iso, freq, every){
  every = Math.max(1, +every||1);
  if(freq==="mensal") return addMonths(iso, every);
  if(freq==="semanal") return addDays(iso, 7*every);
  if(freq==="anual") return addMonths(iso, 12*every);
  return addDays(iso, every);
}
function materializeRecurrence(r){
  if(!r.active) return;
  const horizon = addDays(todayISO(), 90);
  let guard = 0;
  while(r.nextDate && r.nextDate <= horizon && guard++ < 200){
    if(r.endMode==="date" && r.endDate && r.nextDate > r.endDate) { r.active=false; break; }
    if(r.endMode==="count" && r.generated >= (r.count||0)) { r.active=false; break; }
    state.transactions.push({
      id:uid(), type:r.type, desc:r.desc, value:r.value, date:r.nextDate,
      categoryId:r.categoryId, accountId:r.accountId||null, cardId:r.cardId||null,
      payMethod:r.payMethod||"Pix", status:"pendente", note:r.note||"",
      recurrenceId:r.id, recIndex:(r.generated||0)+1
    });
    r.nextDate = advanceDate(r.nextDate, r.freq, r.every);
    r.generated = (r.generated||0)+1;
  }
}
const materializeAll = () => state.recurrences.forEach(materializeRecurrence);

function createInstallments({type, desc, value, firstDate, n, categoryId, accountId, cardId, payMethod, note}){
  const groupId = uid();
  const base = Math.floor(value/n), rest = value - base*n;
  for(let i=0;i<n;i++){
    state.transactions.push({
      id:uid(), type, desc, value: base + (i===0?rest:0), date: addMonths(firstDate, i),
      categoryId, accountId: cardId ? null : accountId, cardId: cardId||null,
      payMethod, status:"pendente", note:note||"", groupId, installment:i+1, installments:n
    });
  }
  return groupId;
}
