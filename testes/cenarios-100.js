#!/usr/bin/env node
/* ============================================================
   Fluxo — Bateria de 100 cenários de conversa com o Agente
   ------------------------------------------------------------
   Testa o agente REAL (agente.js) com o LLM REAL (o mesmo
   serviço gratuito que o app usa), simulando usuários de
   5 faixas de idade:

     Adolescentes (14-17) · Jovens (18-25) · Adultos (26-40)
     Meia-idade (41-59)   · Idosos (60+)

   Cada cenário monta um "navegador de mentira" com dados
   financeiros realistas, envia a mensagem do usuário (com
   histórico, quando o cenário testa contexto) e confere o
   RESULTADO ESSENCIAL: contas criadas, valores lançados,
   perguntas feitas em vez de chute, memória, tema, páginas…

   Uso:
     node testes/cenarios-100.js              # roda os 100
     node testes/cenarios-100.js --only 13,40 # re-rodar alguns
     node testes/cenarios-100.js --rodar 13   # (interno) 1 cenário

   Requisitos: Node 18+ e internet (o LLM é o serviço real).
   ============================================================ */
"use strict";

/* ---------- utilidades de data (dinâmicas, como no navegador) ---------- */
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const HOJE = new Date();
const HOJE_ISO = iso(HOJE);
const ONTEM = iso(new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() - 1));
const AMANHA = iso(new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() + 1));
const PM = d => iso(new Date(HOJE.getFullYear(), HOJE.getMonth() - 1, d)); /* dia d do mês passado */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- navegador de mentira (só é montado no modo --rodar) ---------- */
const win = {};
let state = null;
let SENT = [];            /* corpos das requisições enviadas ao LLM */
let reportCalled = false; /* o PDF foi pedido à UI? */
let undoImpl = () => "Não há ação recente desta sessão para desfazer.";

function montarNavegador(){
  const store = new Map();
  global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  global.window = win;

  /* categorias idênticas às do app (index.html) */
  const CATS = [
    ["Alimentação","despesa"],["Moradia","despesa"],["Transporte","despesa"],["Saúde","despesa"],
    ["Educação","despesa"],["Lazer","despesa"],["Compras","despesa"],["Assinaturas","despesa"],
    ["Contas","despesa"],["Impostos","despesa"],["Outros","despesa"],
    ["Salário","receita"],["Freelance","receita"],["Vendas","receita"],["Investimentos","receita"],["Outros","receita"]
  ].map(([nome, tipo], i) => ({id: "cat" + i, name: nome, type: tipo}));

  state = {
    accounts: [], cards: [], transactions: [], transfers: [],
    categories: CATS,
    budgets: {monthly: 0, categories: {}},
    goals: {saveMonthly: 0, netWorth: 0},
    settings: {theme: "light"}
  };
  global.state = state;

  let n = 0;
  global.uid = () => "t" + (++n);
  global.save = () => {};
  global.render = () => {};
  global.fmtMoney = c => {
    c = Math.round(c);
    const neg = c < 0; c = Math.abs(c);
    const s = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + pad(c % 100);
    return (neg ? "- " : "") + "R$ " + s;
  };
  global.fmtDate = d => { const [y, m, dd] = String(d).split("-"); return dd + "/" + m + "/" + y; };
  global.todayISO = () => HOJE_ISO;
  global.cycleRange = anchor => [
    iso(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    iso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))
  ];
  global.ACC_TYPES = {corrente:"Conta corrente", poupanca:"Poupança", dinheiro:"Dinheiro",
                      digital:"Carteira digital", investimento:"Investimentos"};
  global.accountBalance = acc => {
    let b = acc.initial || 0;
    state.transactions.forEach(t => {
      if(t.accountId === acc.id && t.status === "pago") b += (t.type === "receita" ? t.value : -t.value);
    });
    state.transfers.forEach(tr => {
      if(tr.from === acc.id) b -= tr.value;
      if(tr.to === acc.id) b += tr.value;
    });
    return b;
  };
  global.netWorth = () => state.accounts.reduce((s, a) => s + accountBalance(a), 0);
  global.cardStats = c => {
    const txs = state.transactions.filter(t => t.cardId === c.id);
    const used = txs.filter(t => t.status !== "pago").reduce((s, t) => s + t.value, 0);
    return {invoiceNow: used, used, available: c.limit - used};
  };
  global.accById  = id => state.accounts.find(a => a.id === id) || null;
  global.cardById = id => state.cards.find(c => c.id === id) || null;
  global.catById  = id => state.categories.find(c => c.id === id) || null;
  global.invoiceMonthKey = d => String(d).slice(0, 7);
  global.applyTheme = () => {};
  global.location = {hash: ""};

  win.FluxoUI = {
    undo(){},
    undoLast: () => undoImpl(),
    report: () => { reportCalled = true; return true; }
  };
  global.FluxoUI = win.FluxoUI;   /* no navegador, propriedades de window são
                                      globais — o agente chama FluxoUI.undo() direto */

  /* carrega os módulos REAIS do app */
  require("../memoria.js");
  require("../agente.js");

  /* intercepta o fetch para registrar o que foi enviado ao LLM
     (e diagnosticar respostas de erro no stderr) */
  const fetchReal = global.fetch;
  global.fetch = async function(url, init){
    try{ SENT.push(JSON.parse(init && init.body)); }catch(e){}
    const res = await fetchReal(url, init);
    if(!res.ok){
      let corpo = "";
      try{ corpo = await res.text(); }catch(e){}
      console.error(">>> HTTP " + res.status + " do LLM: " + corpo.slice(0, 300));
      console.error(">>> corpo da requisição tem " + (init && init.body ? init.body.length : 0) + " chars");
    }
    return res;
  };
}

/* categorias plausíveis por descrição — espelha o que o agente real
   escolheria ao lançar (para o resumo não ficar “Sem categoria”) */
const CAT_INF = [
  [/netflix|spotify|assinatura|streaming/i, "Assinaturas"],
  [/uber|combust|posto|gasolina|onibus|metro|estacion/i, "Transporte"],
  [/mercado|ifood|lanche|bob|aliment|restaur|padaria|almo|jantar/i, "Alimentação"],
  [/farmacia|remedio|medic|saude|medico|dentista|exame/i, "Saúde"],
  [/luz|agua|internet|gas$|condominio|boleto/i, "Contas"],
  [/aluguel/i, "Moradia"],
  [/escola|faculdade|curso|livro|material/i, "Educação"],
  [/jogo|skin|cinema|show|divers/i, "Lazer"],
  [/salario|inss|mesada|bolsa|penso|aposentadoria|adiantamento/i, "Salário"],
  [/venda|doce/i, "Vendas"],
  [/presente/i, "Outros"]
];
function inferirCat(desc, tipo){
  const d = String(desc || "");
  if(tipo === "receita"){
    if(/presente/i.test(d)) return "Outros";
    if(/venda|doce/i.test(d)) return "Vendas";
    return "Salário";
  }
  for(const [re, nome] of CAT_INF) if(re.test(d)) return nome;
  return null;
}

/* reseta o mundo para um cenário */
function reset(setup){
  setup = setup || {};
  state.accounts = []; state.cards = []; state.transactions = []; state.transfers = [];
  state.budgets = {monthly: setup.orcamento || 0, categories: {}};
  state.goals = {saveMonthly: 0, netWorth: 0};
  state.settings = {theme: setup.tema || "light"};
  win.FluxoMemoria.clear();
  reportCalled = false;
  undoImpl = setup.undo || (() => "Não há ação recente desta sessão para desfazer.");
  global.location.hash = "";
  SENT = [];

  (setup.contas || []).forEach(c => state.accounts.push({
    id: uid(), name: c.nome, type: c.tipo || "corrente", institution: "",
    initial: c.saldo || 0, note: "", createdAt: HOJE_ISO
  }));
  (setup.cartoes || []).forEach(c => state.cards.push({
    id: uid(), name: c.nome, bank: c.banco || "", limit: c.limite,
    closeDay: c.fechamento || 27, dueDay: c.vencimento || 10, color: "#0e6b4f", active: true
  }));
  (setup.txs || []).forEach(t => {
    let acc = null;
    if(t.conta){
      const q = t.conta.toLowerCase();
      acc = state.accounts.find(a => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase().split(" ")[0])) || null;
    }
    let card = null;
    if(t.cartao){
      const q = t.cartao.toLowerCase();
      card = state.cards.find(c => c.name.toLowerCase().includes(q)) || null;
    }
    state.transactions.push({
      id: uid(), type: t.tipo, desc: t.desc, value: t.valor,
      date: t.data || HOJE_ISO,
      categoryId: (state.categories.find(c =>
        (t.categoria ? c.name.toLowerCase() === t.categoria.toLowerCase() : c.name === inferirCat(t.desc, t.tipo))) || {}).id || null,
      accountId: card ? null : (acc ? acc.id : ((state.accounts[0] || {}).id || null)),
      cardId: card ? card.id : null,
      payMethod: t.forma || "Pix", status: t.status || "pago",
      note: "", paidDate: (t.status || "pago") === "pago" ? HOJE_ISO : undefined
    });
  });
  (setup.transfers || []).forEach(tr => {
    const de = state.accounts.find(a => a.name.toLowerCase().includes(tr.de.toLowerCase()));
    const para = state.accounts.find(a => a.name.toLowerCase().includes(tr.para.toLowerCase()));
    state.transfers.push({id: uid(), from: de && de.id, to: para && para.id, value: tr.valor,
      date: tr.data || HOJE_ISO, desc: tr.desc || "Transferência", note: "", payMethod: "Pix", createdAt: HOJE_ISO});
  });
  (setup.fatos || []).forEach(f => {
    const r = win.FluxoMemoria.add(f);
    if(!r.ok) throw new Error("fato de setup rejeitado pela memória: '" + f + "' (" + r.reason + ")");
  });
}

/* ---------- fábrica de cenários ---------- */
const SCENARIOS = [];
function CEN(id, grupo, idade, titulo, msg, opts, checks){
  SCENARIOS.push(Object.assign({id, grupo, idade, titulo, msg, checks}, opts || {}));
}

/* ---------- asserções (o resultado ESSENCIAL, não a redação) ---------- */
const respondeu    = () => c => (c.text || "").trim().length > 0;
const texto        = re => c => re.test(c.text || "");
const perguntou    = () => c => /\?/.test(c.text || "");
const nContas      = n => c => c.state.accounts.length === n;
const contaInicial = v => c => c.state.accounts.some(a => a.initial === v);
const contaNomeada = (re, v) => c => c.state.accounts.some(a => re.test(a.name) && (v === undefined || a.initial === v));
const semContaNova = ()  => c => c.state.accounts.length === 0;
const nTx          = n => c => c.state.transactions.length === n;
const semNovaTx    = () => c => c.state.transactions.length === c.txCountBefore;
const nTransf      = n => c => c.state.transfers.length === n;
const orcamento    = v => c => c.state.budgets.monthly === v;
const metaEconomia = v => c => c.state.goals.saveMonthly === v;
const metaPatrimonio = v => c => c.state.goals.netWorth === v;
const memTem       = re => c => c.mem.all().some(f => re.test(f.text));
const memNaoTem    = re => c => !c.mem.all().some(f => re.test(f.text));
const hash         = p => c => global.location.hash === "#/" + p;
const tema         = t => c => c.state.settings.theme === t;
const pdfPediu     = () => c => c.reportCalled === true;
const historicoEnviado = re => c => c.sent.some(b => (b.messages || []).some(m => re.test(m.content || "")));

function txCom(p){
  return c => c.state.transactions.some(t => {
    if(p.tipo !== undefined && t.type !== p.tipo) return false;
    if(p.valor !== undefined && t.value !== p.valor) return false;
    if(p.data !== undefined && t.date !== p.data) return false;
    if(p.status !== undefined && t.status !== p.status) return false;
    if(p.descRe && !p.descRe.test(t.desc || "")) return false;
    if(p.contaRe){
      const a = accById(t.accountId);
      if(!a || !p.contaRe.test(a.name)) return false;
    }
    if(p.cartaoRe){
      const cd = cardById(t.cardId);
      if(!cd || !p.cartaoRe.test(cd.name)) return false;
    }
    return true;
  });
}
function transfCom(p){
  return c => c.state.transfers.some(tr => {
    const de = accById(tr.from), para = accById(tr.to);
    return (!p.valor || tr.value === p.valor) && de && para && p.de.test(de.name) && p.para.test(para.name);
  });
}
/* nada mudou: dados financeiros + memória + tema + página */
function nadaMudou(){
  return c => c.snapshotDepois === c.snapshotAntes;
}
/* nada mudou nos dados financeiros (memória pode crescer) */
function dadosIntactos(){
  return c => c.state.transactions.length === c.txCountBefore
    && c.state.accounts.length === c.contasAntes
    && c.state.transfers.length === (c.transfAntes || 0)
    && c.state.budgets.monthly === (c.orcAntes || 0)
    && c.state.goals.saveMonthly === (c.metaAntes || 0);
}

/* ============================================================
   CENÁRIOS 1-18 · ADOLESCENTES (14-17)
   App zerado ou com uma carteira "Dinheiro" — mesada, lanche,
   joguinho, gíria, emoji, primeira meta…
   ============================================================ */
const DINHEIRO = {contas: [{nome: "Dinheiro", tipo: "dinheiro", saldo: 5000}]};

CEN(1, "Adolescentes", 15, "cumprimenta sem mexer em nada", "oi", {setup: {}}, [
  ["respondeu algo", respondeu()],
  ["nada mudou no app", nadaMudou()]
]);

CEN(2, "Adolescentes", 14, "cria carteira da mesada (R$ 50)", "cria uma conta pro meu dinheiro de mesada com 50 reais", {setup: {}}, [
  ["criou 1 conta", nContas(1)],
  ["saldo inicial R$ 50,00", contaInicial(5000)]
]);

CEN(3, "Adolescentes", 15, "recebeu R$ 20 de mesada", "recebi 20 de mesada", {setup: {contas: DINHEIRO.contas}}, [
  ["receita de R$ 20 registrada", txCom({tipo: "receita", valor: 2000})]
]);

CEN(4, "Adolescentes", 16, "gastou R$ 15 no lanche da escola", "gastei 15 no lanche da escola", {setup: {contas: DINHEIRO.contas}}, [
  ["despesa de R$ 15 registrada", txCom({tipo: "despesa", valor: 1500})]
]);

CEN(5, "Adolescentes", 14, "comprou skin de R$ 25 no jogo", "comprei uma skin de 25 reais no jogo", {setup: {contas: DINHEIRO.contas}}, [
  ["despesa de R$ 25 registrada", txCom({tipo: "despesa", valor: 2500})]
]);

CEN(6, "Adolescentes", 16, "multitarefa: lanche R$ 10 + jogo R$ 25", "gastei 10 no lanche e 25 no jogo hoje", {setup: {contas: DINHEIRO.contas}}, [
  ["despesa de R$ 10", txCom({tipo: "despesa", valor: 1000})],
  ["despesa de R$ 25", txCom({tipo: "despesa", valor: 2500})],
  ["os dois lançados", nTx(2)]
]);

CEN(7, "Adolescentes", 15, "pergunta quanto tem (R$ 95)", "quanto eu tenho?", {setup: {contas: [{nome: "Dinheiro", tipo: "dinheiro", saldo: 7500}],
  txs: [{tipo: "receita", desc: "Mesada", valor: 2000, conta: "Dinheiro", status: "pago"}]}}, [
  ["informou o saldo (R$ 95,00)", texto(/95,00/)]
]);

CEN(8, "Adolescentes", 14, "pai deu R$ 30", "meu pai me deu 30 conto", {setup: {contas: DINHEIRO.contas}}, [
  ["receita de R$ 30", txCom({tipo: "receita", valor: 3000})]
]);

CEN(9, "Adolescentes", 17, "gíria: '30 paus' no Inter", "cria conta inter com 30 paus", {setup: {}}, [
  ["conta Inter criada", contaNomeada(/inter/i)],
  ["com R$ 30,00", contaNomeada(/inter/i, 3000)]
]);

CEN(10, "Adolescentes", 15, "meta: juntar R$ 100 pro fone", "quero juntar 100 reais pra comprar um fone", {setup: {}}, [
  ["meta definida sem interrogatório (economia mensal R$ 100)", c => c.state.goals.saveMonthly === 10000 || c.state.goals.netWorth === 10000]
]);

CEN(11, "Adolescentes", 16, "pede pra apagar gasto (não há ferramenta)", "apaga o gasto do jogo aí", {setup: {contas: DINHEIRO.contas,
  txs: [{tipo: "despesa", desc: "Skin do jogo", valor: 2500, conta: "Dinheiro"}]}}, [
  ["não apagou por conta própria", semNovaTx()],
  ["respondeu algo útil", respondeu()]
]);

CEN(12, "Adolescentes", 14, "pergunta como ver os gastos", "como eu vejo meus gastos?", {setup: {}}, [
  ["ensinou um caminho real (página ou 'me pergunte')", c => hash("lancamentos")(c) || /lançamentos|relat[oó]rio|planejamento|me pergunte|posso (te )?(contar|mostrar)|quanto gastei/i.test(c.text || "")],
  ["não mexeu nos dados", semContaNova()]
]);

CEN(13, "Adolescentes", 15, "CONTEXTO: 'e a outra?' usa o histórico", "e a outra?", {
  setup: {contas: [{nome: "PicPay", tipo: "digital", saldo: 2000}]},
  history: [
    {role: "user", content: "quero criar duas contas: picpay com 20 e lanche com 50"},
    {role: "assistant", content: "✅ Conta **PicPay** criada com saldo **R$ 20,00**."}
  ]}, [
  ["criou a conta que faltava (R$ 50)", contaInicial(5000)],
  ["agora são 2 contas", nContas(2)],
  ["o histórico foi enviado ao LLM", historicoEnviado(/duas contas/i)]
]);

CEN(14, "Adolescentes", 16, "mensagem com emoji: R$ 12 no Bob's", "💸💸 gastei 12 no bob's", {setup: {contas: DINHEIRO.contas}}, [
  ["despesa de R$ 12", txCom({tipo: "despesa", valor: 1200})]
]);

CEN(15, "Adolescentes", 17, "deve R$ 5 pro amigo", "tô devendo 5 pro meu amigo", {setup: {contas: DINHEIRO.contas}}, [
  ["despesa de R$ 5 registrada", txCom({tipo: "despesa", valor: 500})]
]);

CEN(16, "Adolescentes", 15, "quanto gastou no mês (R$ 40)", "quanto gastei esse mês?", {setup: {contas: DINHEIRO.contas,
  txs: [{tipo: "despesa", desc: "Lanche", valor: 1500, conta: "Dinheiro"},
        {tipo: "despesa", desc: "Jogo", valor: 2500, conta: "Dinheiro"}]}}, [
  ["informou o total (R$ 40,00)", texto(/40,00/)]
]);

CEN(17, "Adolescentes", 16, "gíria: 'bora modo escuro'", "bora modo escuro", {setup: {}}, [
  ["tema mudou para escuro", tema("dark")]
]);

CEN(18, "Adolescentes", 14, "quem é você?", "quem é você?", {setup: {}}, [
  ["se apresentou (Fluxo)", texto(/fluxo/i)],
  ["nada mudou", nadaMudou()]
]);

/* ============================================================
   CENÁRIOS 19-38 · JOVENS (18-25)
   Primeiro salário, streaming no cartão, pix, faculdade…
   ============================================================ */
const JOVEM_BASE = {contas: [{nome: "Inter", tipo: "corrente", saldo: 120000}]};
const JOVEM_CARTAO = {contas: [{nome: "Inter", tipo: "corrente", saldo: 120000}],
  cartoes: [{nome: "Nubank", banco: "Nubank", limite: 350000}]};

CEN(19, "Jovens", 22, "primeiro salário R$ 2.200", "recebi meu primeiro salário de 2200", {setup: {contas: JOVEM_BASE.contas}}, [
  ["receita de R$ 2.200 na conta certa", txCom({tipo: "receita", valor: 220000, contaRe: /inter/i})]
]);

CEN(20, "Jovens", 21, "Spotify R$ 44,90", "paguei 44,90 do spotify", {setup: {contas: JOVEM_BASE.contas}}, [
  ["despesa de R$ 44,90", txCom({tipo: "despesa", valor: 4490})]
]);

CEN(21, "Jovens", 23, "Netflix R$ 55,90 no cartão Nubank", "assinei netflix de 55,90 no cartão nubank", {setup: JOVEM_CARTAO}, [
  ["despesa de R$ 55,90 no cartão", txCom({tipo: "despesa", valor: 5590, cartaoRe: /nubank/i})],
  ["ficou pendente (fatura)", txCom({tipo: "despesa", valor: 5590, status: "pendente"})]
]);

CEN(22, "Jovens", 20, "multitarefa: Uber R$ 60 + iFood R$ 35 ontem", "botei 60 de uber e 35 de ifood ontem", {setup: {contas: JOVEM_BASE.contas}}, [
  ["uber R$ 60 com data de ontem", txCom({tipo: "despesa", valor: 6000, data: ONTEM})],
  ["ifood R$ 35 com data de ontem", txCom({tipo: "despesa", valor: 3500, data: ONTEM})]
]);

CEN(23, "Jovens", 24, "renda extra R$ 300 vendendo doces", "renda extra de 300 vendendo doces", {setup: {contas: JOVEM_BASE.contas}}, [
  ["receita de R$ 300", txCom({tipo: "receita", valor: 30000})]
]);

CEN(24, "Jovens", 25, "multitarefa: aluguel R$ 900 + condomínio R$ 250", "aluguel 900 e condominio 250", {setup: {contas: JOVEM_BASE.contas}}, [
  ["aluguel R$ 900", txCom({tipo: "despesa", valor: 90000})],
  ["condomínio R$ 250", txCom({tipo: "despesa", valor: 25000})]
]);

CEN(25, "Jovens", 23, "transferiu R$ 200 Inter → Caixa", "transferi 200 da inter pra caixa", {setup: {contas: [
  {nome: "Inter", tipo: "corrente", saldo: 120000}, {nome: "Caixa", tipo: "corrente", saldo: 0}]}}, [
  ["transferência registrada", transfCom({de: /inter/i, para: /caixa/i, valor: 20000})]
]);

CEN(26, "Jovens", 22, "cadastra cartão Nubank limite R$ 3.500", "cadastra meu cartao nubank com limite 3500", {setup: {contas: JOVEM_BASE.contas}}, [
  ["cartão criado com o limite certo", c => c.state.cards.some(cd => /nubank/i.test(cd.name) && cd.limit === 350000)]
]);

CEN(27, "Jovens", 24, "quanto sobra do salário (R$ 2.105)", "quanto sobrou do meu salario?", {setup: {contas: JOVEM_BASE.contas,
  txs: [{tipo: "receita", desc: "Salário", valor: 220000, conta: "Inter"},
        {tipo: "despesa", desc: "Uber", valor: 6000, conta: "Inter"},
        {tipo: "despesa", desc: "iFood", valor: 3500, conta: "Inter"}]}}, [
  ["calculou certo (R$ 2.105,00)", texto(/2\.105/)]
]);

CEN(28, "Jovens", 21, "meta: juntar R$ 500/mês", "minha meta é juntar 500 por mes", {setup: {}}, [
  ["meta de economia R$ 500", metaEconomia(50000)]
]);

CEN(29, "Jovens", 20, "teto de gastos R$ 1.500", "teto de gastos 1500", {setup: {}}, [
  ["orçamento R$ 1.500 definido", orcamento(150000)]
]);

CEN(30, "Jovens", 23, "paga a fatura do Nubank", "paga a fatura do nubank", {setup: {contas: JOVEM_BASE.contas,
  cartoes: [{nome: "Nubank", banco: "Nubank", limite: 350000}],
  txs: [{tipo: "despesa", desc: "Netflix", valor: 5590, cartao: "Nubank", status: "pendente"}]}}, [
  ["compra quitada e debitada da conta", txCom({tipo: "despesa", valor: 5590, cartaoRe: /nubank/i, status: "pago", contaRe: /inter/i})]
]);

CEN(31, "Jovens", 19, "memoriza bolsa da faculdade", "lembra que eu recebo 100 de bolsa da faculdade", {setup: {}}, [
  ["fato guardado", memTem(/bolsa/i)]
]);

CEN(32, "Jovens", 22, "o que você sabe sobre mim?", "o que você sabe sobre mim?", {setup: {fatos: [
  "Meu salário é 2.200 e cai dia 5", "Odeio gastar com fast food"]}}, [
  ["listou o que sabe (fast food)", texto(/fast food/i)],
  ["não inventou memória nova", c => c.mem.count() === 2]
]);

CEN(33, "Jovens", 19, "conflito de memória: bolsa 100 → 150", "na verdade minha bolsa agora é 150", {setup: {fatos: ["Recebo 100 de bolsa da faculdade"]}}, [
  ["atualizou OU pediu confirmação antes", c =>
    (c.mem.all().some(f => /150/.test(f.text)) && !c.mem.all().some(f => /100 de bolsa/.test(f.text))) ||
    (/150/.test(c.text || "") && perguntou()(c))]
]);

CEN(34, "Jovens", 24, "CONTEXTO: 'faltou a internet de 99'", "faltou a internet de 99", {
  setup: {contas: JOVEM_BASE.contas,
    txs: [{tipo: "despesa", desc: "Luz", valor: 12000, conta: "Inter"},
          {tipo: "despesa", desc: "Água", valor: 8000, conta: "Inter"}]},
  history: [
    {role: "user", content: "lança aí: luz 120 e água 80"},
    {role: "assistant", content: "✅ Despesa **Luz** de **R$ 120,00** registrada.\n✅ Despesa **Água** de **R$ 80,00** registrada."}
  ]}, [
  ["internet R$ 99 lançada", txCom({tipo: "despesa", valor: 9900})],
  ["os 3 lançamentos no total", nTx(3)],
  ["o histórico foi enviado ao LLM", historicoEnviado(/luz 120/i)]
]);

CEN(35, "Jovens", 19, "esquece a bolsa da memória", "esquece que eu recebo bolsa", {setup: {fatos: ["Recebo 100 de bolsa da faculdade"]}}, [
  ["fato apagado", memNaoTem(/bolsa/i)]
]);

CEN(36, "Jovens", 25, "relatório do mês em PDF", "gera o relatorio do mes em pdf", {setup: {contas: JOVEM_BASE.contas}}, [
  ["PDF gerado e entregue", pdfPediu()],
  ["confirmação no chat", texto(/pdf|relat/i)]
]);

CEN(37, "Jovens", 21, "quanto gastou com iFood (R$ 83)", "quanto gastei com ifood?", {setup: {contas: JOVEM_BASE.contas,
  txs: [{tipo: "despesa", desc: "iFood sexta", valor: 3500, conta: "Inter"},
        {tipo: "despesa", desc: "iFood fds", valor: 4800, conta: "Inter"}]}}, [
  ["informou o total (R$ 83,00)", texto(/83,00/)]
]);

CEN(38, "Jovens", 23, "resumo do mês passado", "resumo do mes passado", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 150000}],
  txs: [{tipo: "receita", desc: "Salário", valor: 100000, conta: "Inter", data: PM(5)},
        {tipo: "despesa", desc: "Mercado", valor: 43000, conta: "Inter", data: PM(12)}]}}, [
  ["receitas do mês passado (R$ 1.000)", texto(/1\.000/)],
  ["despesas do mês passado (R$ 430)", texto(/430/)]
]);

/* ============================================================
   CENÁRIOS 39-63 · ADULTOS (26-40)
   Salário, contas da casa, cartão, transferências, ambiguidade…
   ============================================================ */
const ADULTO_3CONTAS = {contas: [
  {nome: "Inter", tipo: "corrente", saldo: 190500},
  {nome: "Caixa", tipo: "corrente", saldo: 75500},
  {nome: "InfinitePay", tipo: "digital", saldo: 14615}]};

CEN(39, "Adultos", 32, "clássico: Inter 1905,00 + InfinitePay 146,15", "Crie as contas Inter com 1905,00 e InfinitePay com 146,15", {setup: {}}, [
  ["conta Inter com R$ 1.905,00", contaNomeada(/inter/i, 190500)],
  ["carteira InfinitePay com R$ 146,15", contaNomeada(/infinite/i, 14615)],
  ["exatamente 2 contas", nContas(2)]
]);

CEN(40, "Adultos", 35, "salário sem dizer a conta (3 contas) → perguntar", "meu salário de 5400 caiu", {setup: {contas: ADULTO_3CONTAS.contas}}, [
  ["não lançou por adivinhação", semNovaTx()],
  ["perguntou em qual conta", perguntou()]
]);

CEN(41, "Adultos", 30, "mercado R$ 412,67 no débito da Inter", "mercado 412,67 no debito da inter", {setup: {contas: ADULTO_3CONTAS.contas}}, [
  ["despesa de R$ 412,67 na Inter", txCom({tipo: "despesa", valor: 41267, contaRe: /inter/i})]
]);

CEN(42, "Adultos", 34, "multitarefa: 3 contas da casa na Inter", "lança na inter: aluguel 1800, escola 950 e plano de saude 420", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 190500}]}}, [
  ["aluguel R$ 1.800", txCom({tipo: "despesa", valor: 180000})],
  ["escola R$ 950", txCom({tipo: "despesa", valor: 95000})],
  ["plano R$ 420", txCom({tipo: "despesa", valor: 42000})],
  ["3 lançamentos", nTx(3)]
]);

CEN(43, "Adultos", 33, "notebook 3200 em 10x (sem chute)", "comprei um notebook de 3200 em 10x no cartao nubank", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 50000}],
  cartoes: [{nome: "Nubank", banco: "Nubank", limite: 350000}]}}, [
  ["registrou no cartão OU explicou (sem inventar)", c =>
    c.state.transactions.length === c.txCountBefore ||
    c.state.transactions.some(t => t.value === 320000 && t.cardId)],
  ["respondeu algo", respondeu()]
]);

CEN(44, "Adultos", 36, "paga fatura Nubank usando a Inter", "paga a fatura do nubank usando a inter", {setup: {contas: [
  {nome: "Inter", tipo: "corrente", saldo: 190500}, {nome: "Caixa", tipo: "corrente", saldo: 75500}],
  cartoes: [{nome: "Nubank", banco: "Nubank", limite: 350000}],
  txs: [{tipo: "despesa", desc: "Mercado", valor: 41267, cartao: "Nubank", status: "pendente"}]}}, [
  ["fatura quitada debitando da Inter", txCom({tipo: "despesa", valor: 41267, cartaoRe: /nubank/i, status: "pago", contaRe: /inter/i})]
]);

CEN(45, "Adultos", 31, "transfere R$ 500 Inter → Poupança", "transfere 500 da inter pra poupanca", {setup: {contas: [
  {nome: "Inter", tipo: "corrente", saldo: 190500}, {nome: "Poupança", tipo: "poupanca", saldo: 0}]}}, [
  ["transferência registrada", transfCom({de: /inter/i, para: /poupan/i, valor: 50000})]
]);

CEN(46, "Adultos", 29, "saldo total (R$ 1.500)", "qual meu saldo total?", {setup: {contas: [
  {nome: "Inter", tipo: "corrente", saldo: 100000}, {nome: "Caixa", tipo: "corrente", saldo: 50000}]}}, [
  ["informou R$ 1.500,00", texto(/1\.500,00/)]
]);

CEN(47, "Adultos", 38, "contas em aberto (R$ 200)", "quanto tenho de contas em aberto?", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}],
  txs: [{tipo: "despesa", desc: "Luz", valor: 12000, conta: "Inter", status: "pendente"},
        {tipo: "despesa", desc: "Água", valor: 8000, conta: "Inter", status: "pendente"},
        {tipo: "despesa", desc: "Mercado", valor: 5000, conta: "Inter", status: "pago"}]}}, [
  ["informou o total em aberto (R$ 200,00)", texto(/200,00/)]
]);

CEN(48, "Adultos", 37, "orçamento R$ 3.800", "define orcamento de 3800", {setup: {}}, [
  ["orçamento definido", orcamento(380000)]
]);

CEN(49, "Adultos", 39, "meta de patrimônio R$ 50.000", "meta de patrimonio de 50000", {setup: {}}, [
  ["meta de patrimônio definida", metaPatrimonio(5000000)]
]);

CEN(50, "Adultos", 30, "gastos com mercado em outubro (R$ 430)", "quanto gastei com mercado em outubro?", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}],
  txs: [{tipo: "despesa", desc: "Mercado", valor: 25000, conta: "Inter", data: PM(10)},
        {tipo: "despesa", desc: "Mercado", valor: 18000, conta: "Inter", data: PM(20)},
        {tipo: "despesa", desc: "Mercado", valor: 41267, conta: "Inter", data: HOJE_ISO}]}}, [
  ["informou o total de outubro (R$ 430,00)", texto(/430/)]
]);

CEN(51, "Adultos", 34, "memoriza o aluguel", "lembre que meu aluguel é 1800", {setup: {}}, [
  ["fato guardado", memTem(/aluguel/i)],
  ["com o valor certo", memTem(/1\.?800/)]
]);

CEN(52, "Adultos", 31, "CONTEXTO: 'e uma poupança com 2000'", "e uma poupanca com 2000", {
  setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000},
                   {nome: "Caixa", tipo: "corrente", saldo: 50000}]},
  history: [
    {role: "user", content: "crie as contas: inter com 1000 e caixa com 500"},
    {role: "assistant", content: "✅ Conta **Inter** criada com saldo **R$ 1.000,00**.\n✅ Conta **Caixa** criada com saldo **R$ 500,00**."}
  ]}, [
  ["criou a Poupança com R$ 2.000", contaNomeada(/poupan/i, 200000)],
  ["agora são 3 contas", nContas(3)],
  ["o histórico foi enviado ao LLM", historicoEnviado(/inter com 1000/i)]
]);

CEN(53, "Adultos", 36, "ensina recuperação de senha", "esqueci minha senha, como recupero?", {setup: {}}, [
  ["ensinou o caminho (Esqueci/chave/recuperação)", texto(/esqueci|chave|recupera/i)],
  ["não mexeu nos dados", dadosIntactos()]
]);

CEN(54, "Adultos", 33, "ensina backup", "como faco backup dos meus dados?", {setup: {}}, [
  ["ensinou (exportar/backup)", texto(/exportar|backup/i)],
  ["não mexeu nos dados", dadosIntactos()]
]);

CEN(55, "Adultos", 35, "desfaz a última ação", "desfaz o que você acabou de fazer", {
  setup: {
    contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}],
    txs: [{tipo: "despesa", desc: "Mercado", valor: 8000, conta: "Inter"}],
    undo: () => { state.transactions.pop(); return "Pronto, ação desfeita e saldos atualizados."; }},
  history: [
    {role: "user", content: "lança uma despesa de mercado de 80 na inter"},
    {role: "assistant", content: "✅ Despesa **Mercado** de **R$ 80,00** registrada."}
  ]}, [
  ["ação desfeita (lançamento sumiu)", c => c.state.transactions.length === c.txCountBefore - 1]
]);

CEN(56, "Adultos", 30, "volta para o tema claro", "volta pro tema claro", {setup: {tema: "dark"}}, [
  ["tema mudou para claro", tema("light")]
]);

CEN(57, "Adultos", 28, "PDF do mês atual", "quero o pdf deste mes", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}]}}, [
  ["PDF gerado e entregue", pdfPediu()]
]);

CEN(58, "Adultos", 32, "multitarefa mista: receita + despesa", "recebi 3000 de adiantamento e paguei 150 de luz", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}]}}, [
  ["receita R$ 3.000", txCom({tipo: "receita", valor: 300000})],
  ["despesa R$ 150", txCom({tipo: "despesa", valor: 15000})]
]);

CEN(59, "Adultos", 27, "pede um resumo", "me da um resumo", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}],
  txs: [{tipo: "receita", desc: "Salário", valor: 100000, conta: "Inter"},
        {tipo: "despesa", desc: "Mercado", valor: 30000, conta: "Inter"}]}}, [
  ["receitas (R$ 1.000,00)", texto(/1\.000,00/)],
  ["despesas (R$ 300,00)", texto(/300,00/)]
]);

CEN(60, "Adultos", 29, "quais são as minhas contas?", "quais são as minhas contas?", {setup: ADULTO_3CONTAS}, [
  ["mencionou a Inter", texto(/inter/i)],
  ["mencionou a Caixa", texto(/caixa/i)],
  ["mencionou a InfinitePay", texto(/infinite/i)]
]);

CEN(61, "Adultos", 34, "AMBIGUIDADE: 'gastei 50' com 2 contas → perguntar", "gastei 50 ontem", {setup: {contas: [
  {nome: "Inter", tipo: "corrente", saldo: 100000}, {nome: "Caixa", tipo: "corrente", saldo: 50000}]}}, [
  ["não lançou por adivinhação", semNovaTx()],
  ["perguntou em qual conta", perguntou()]
]);

CEN(62, "Adultos", 33, "AMBIGUIDADE: sem valor → perguntar", "lança um gasto aí", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 100000}]}}, [
  ["não lançou nada sem valor", semNovaTx()],
  ["pediu o valor", perguntou()]
]);

CEN(63, "Adultos", 37, "ANTI-DUPLICATA: Inter já existe", "cria a conta Inter com 500", {setup: {contas: [{nome: "Inter", tipo: "corrente", saldo: 190500}]}}, [
  ["NÃO duplicou a conta Inter", c => c.state.accounts.filter(a => /inter/i.test(a.name)).length === 1]
]);

/* ============================================================
   CENÁRIOS 64-82 · MEIA-IDADE (41-59)
   Linguagem formal, financiamentos, investimentos, farmácia…
   ============================================================ */
const MEIA_BASE = {contas: [
  {nome: "Itaú", tipo: "corrente", saldo: 1250000},
  {nome: "Investimentos", tipo: "investimento", saldo: 3500000}]};

CEN(64, "Meia-idade", 47, "formal: salário R$ 7.500 no Itaú", "Bom dia. Gostaria de registrar meu salário de 7.500 na conta Itaú.", {setup: {contas: MEIA_BASE.contas}}, [
  ["receita de R$ 7.500 no Itaú", txCom({tipo: "receita", valor: 750000, contaRe: /ita/i})]
]);

CEN(65, "Meia-idade", 52, "financiamento do carro R$ 1.230,45", "Registre o pagamento do financiamento do carro: 1.230,45 no Itaú.", {setup: {contas: MEIA_BASE.contas}}, [
  ["despesa de R$ 1.230,45 no Itaú", txCom({tipo: "despesa", valor: 123045, contaRe: /ita/i})]
]);

CEN(66, "Meia-idade", 45, "multitarefa formal: luz, água e internet", "Registre as despesas: luz 189,90; água 95,30; internet 149,90", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}]}}, [
  ["luz R$ 189,90", txCom({tipo: "despesa", valor: 18990})],
  ["água R$ 95,30", txCom({tipo: "despesa", valor: 9530})],
  ["internet R$ 149,90", txCom({tipo: "despesa", valor: 14990})],
  ["3 lançamentos", nTx(3)]
]);

CEN(67, "Meia-idade", 50, "meta de economia R$ 2.000", "defina uma meta de economia mensal de 2.000", {setup: {}}, [
  ["meta de economia R$ 2.000", metaEconomia(200000)]
]);

CEN(68, "Meia-idade", 48, "maior gasto do mês (mercado R$ 412,67)", "Qual foi meu maior gasto este mês?", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}],
  txs: [{tipo: "despesa", desc: "Mercado", valor: 41267, conta: "Itaú"},
        {tipo: "despesa", desc: "Combustível", valor: 30000, conta: "Itaú"}]}}, [
  ["apontou o maior gasto (R$ 412,67)", texto(/412/)]
]);

CEN(69, "Meia-idade", 44, "saldo da conta Itaú (R$ 12.500)", "Mostre o saldo da conta Itaú", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}]}}, [
  ["informou R$ 12.500,00", texto(/12\.500,00/)]
]);

CEN(70, "Meia-idade", 55, "transfere R$ 3.000 para investimentos", "Transfira 3.000 do Itaú para a conta de investimentos", {setup: {contas: MEIA_BASE.contas}}, [
  ["transferência registrada", transfCom({de: /ita/i, para: /invest/i, valor: 300000})]
]);

CEN(71, "Meia-idade", 49, "paga fatura do Azul debitando do Itaú", "Paguei a fatura do cartão Azul debitando do Itaú", {setup: {contas: MEIA_BASE.contas,
  cartoes: [{nome: "Azul", banco: "Banco Azul", limite: 1200000}],
  txs: [{tipo: "despesa", desc: "Farmácia", valor: 18990, cartao: "Azul", status: "pendente"},
        {tipo: "despesa", desc: "Posto", valor: 25000, cartao: "Azul", status: "pendente"}]}}, [
  ["compras quitadas e debitadas do Itaú", txCom({tipo: "despesa", valor: 18990, cartaoRe: /azul/i, status: "pago", contaRe: /ita/i})]
]);

CEN(72, "Meia-idade", 53, "ensina exportar dados p/ contador", "Como exporto meus dados para o contador?", {setup: {}}, [
  ["ensinou (exportar/csv/json)", texto(/exportar|csv|json/i)],
  ["não mexeu nos dados", dadosIntactos()]
]);

CEN(73, "Meia-idade", 46, "abre a página de relatórios", "abra a página de relatórios", {setup: {}}, [
  ["abriu Relatórios (ou indicou o caminho)", c => hash("relatorios")(c) || /relat/i.test(c.text || "")]
]);

CEN(74, "Meia-idade", 51, "farmácia no ano (R$ 285,20)", "quanto gastamos de farmácia este ano?", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}],
  txs: [{tipo: "despesa", desc: "Farmácia", valor: 18990, conta: "Itaú"},
        {tipo: "despesa", desc: "Farmácia", valor: 9530, conta: "Itaú", data: PM(15)}]}}, [
  ["informou o total (R$ 285,20)", texto(/285/)]
]);

CEN(75, "Meia-idade", 43, "teto mensal R$ 5.000", "Defina o teto mensal de gastos em 5.000", {setup: {}}, [
  ["orçamento R$ 5.000 definido", orcamento(500000)]
]);

CEN(76, "Meia-idade", 54, "memoriza ano da aposentadoria", "Guarde que minha aposentadoria será em 2035", {setup: {}}, [
  ["fato guardado", memTem(/2035/)]
]);

CEN(77, "Meia-idade", 47, "pede conselho de economia (mentor)", "Estou gastando muito. Onde posso economizar?", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}],
  txs: [{tipo: "despesa", desc: "Mercado", valor: 41267, conta: "Itaú"},
        {tipo: "despesa", desc: "Combustível", valor: 30000, conta: "Itaú"}]}}, [
  ["deu conselho com base nos dados", texto(/mercado|combust|gast|economiz|alimenta|transport|onde mais/i)],
  ["não mexeu nos dados", dadosIntactos()]
]);

CEN(78, "Meia-idade", 50, "CONTEXTO formal: 'adicione também…'", "Adicione também uma conta de investimentos com 10.000.", {
  setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 100000},
                   {nome: "Poupança", tipo: "poupanca", saldo: 50000}]},
  history: [
    {role: "user", content: "Por favor, crie as contas: Itaú com 1.000 e Poupança com 500"},
    {role: "assistant", content: "✅ Conta **Itaú** criada com saldo **R$ 1.000,00**.\n✅ Conta **Poupança** criada com saldo **R$ 500,00**."}
  ]}, [
  ["criou Investimentos com R$ 10.000", contaNomeada(/invest/i, 1000000)],
  ["agora são 3 contas", nContas(3)]
]);

CEN(79, "Meia-idade", 54, "esquece a aposentadoria", "esqueça que minha aposentadoria será em 2035", {setup: {fatos: ["Minha aposentadoria será em 2035"]}}, [
  ["fato apagado", memNaoTem(/2035/)]
]);

CEN(80, "Meia-idade", 56, "consórcio 12x R$ 120 (sem chute)", "quero lançar um consórcio de 12 parcelas de 120", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}]}}, [
  ["lançou certo (R$ 120 ou R$ 1.440) OU explicou", c =>
    c.state.transactions.length === c.txCountBefore ||
    c.state.transactions.some(t => [12000, 144000].includes(t.value))],
  ["respondeu algo", respondeu()]
]);

CEN(81, "Meia-idade", 45, "lista transações pendentes", "Mostre as transações pendentes", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}],
  txs: [{tipo: "despesa", desc: "Luz", valor: 18990, conta: "Itaú", status: "pendente"},
        {tipo: "despesa", desc: "Internet", valor: 14990, conta: "Itaú", status: "pendente"},
        {tipo: "despesa", desc: "Mercado", valor: 20000, conta: "Itaú", status: "pago"}]}}, [
  ["listou as pendentes (luz/internet)", texto(/189,90|luz/i)]
]);

CEN(82, "Meia-idade", 49, "fatura do cartão Azul (R$ 439,90)", "quanto está a fatura do cartão azul?", {setup: {contas: [{nome: "Itaú", tipo: "corrente", saldo: 1250000}],
  cartoes: [{nome: "Azul", banco: "Banco Azul", limite: 1200000}],
  txs: [{tipo: "despesa", desc: "Farmácia", valor: 18990, cartao: "Azul", status: "pendente"},
        {tipo: "despesa", desc: "Posto", valor: 25000, cartao: "Azul", status: "pendente"}]}}, [
  ["informou a fatura (R$ 439,90)", texto(/439/)]
]);

/* ============================================================
   CENÁRIOS 83-100 · IDOSOS (60+)
   CAPS LOCK, erros de digitação, linguagem rebuscada, INSS,
   paciência com perguntas repetidas…
   ============================================================ */
const IDOSO_BASE = {contas: [{nome: "Caixa", tipo: "corrente", saldo: 280000}]};

CEN(83, "Idosos", 68, "CAPS LOCK: INSS R$ 3.200", "GANHEI MEU INSS DE 3200", {setup: {contas: IDOSO_BASE.contas}}, [
  ["receita de R$ 3.200 na Caixa", txCom({tipo: "receita", valor: 320000, contaRe: /caixa/i})]
]);

CEN(84, "Idosos", 72, "CAPS: remédio R$ 240 na farmácia", "PAGUEI 240 DE REMÉDIO NA FARMACIA", {setup: {contas: IDOSO_BASE.contas}}, [
  ["despesa de R$ 240", txCom({tipo: "despesa", valor: 24000})]
]);

CEN(85, "Idosos", 66, "erros de digitação: aluguél 1500", "reccebi 1500 do alugel do apartamento", {setup: {contas: IDOSO_BASE.contas}}, [
  ["receita de R$ 1.500", txCom({tipo: "receita", valor: 150000})]
]);

CEN(86, "Idosos", 70, "linguagem formal e rebuscada: saldo", "Boa tarde. Eu gostaria muito de saber qual é o meu saldo, por favor.", {setup: {contas: IDOSO_BASE.contas}}, [
  ["informou o saldo (R$ 2.800,00)", texto(/2\.800,00/)]
]);

CEN(87, "Idosos", 64, "como ver os gastos do mês", "como eu faço pra ver meus gastos do mês?", {setup: {}}, [
  ["ensinou um caminho real (página ou 'me pergunte')", c => hash("lancamentos")(c) || /lançamentos|relat[oó]rio|planejamento|me pergunte|posso (te )?(contar|mostrar)|quanto gastei/i.test(c.text || "")]
]);

CEN(88, "Idosos", 74, "neto deu R$ 100 de presente", "meu neto me deu 100 de presente", {setup: {contas: IDOSO_BASE.contas}}, [
  ["receita de R$ 100", txCom({tipo: "receita", valor: 10000})]
]);

CEN(89, "Idosos", 67, "multitarefa devagar: gás e luz", "primeiro registra 45 de gás e depois 120 de luz", {setup: {contas: IDOSO_BASE.contas}}, [
  ["gás R$ 45", txCom({tipo: "despesa", valor: 4500})],
  ["luz R$ 120", txCom({tipo: "despesa", valor: 12000})]
]);

CEN(90, "Idosos", 62, "não acha a página dos cartões", "não consigo achar onde vejo meus cartões", {setup: {}}, [
  ["abriu Cartões (ou indicou o caminho)", c => hash("cartoes")(c) || /cartões/i.test(c.text || "")]
]);

CEN(91, "Idosos", 69, "quer guardar R$ 300 todo mês", "quero guardar 300 reais todo mês", {setup: {}}, [
  ["meta de economia R$ 300", metaEconomia(30000)]
]);

CEN(92, "Idosos", 71, "perdeu a senha e não tem o arquivo", "perdi minha senha e não tenho o arquivo de recuperação", {setup: {}}, [
  ["explicou o caminho (reset/APAGAR)", texto(/apagar|reset|chave/i)],
  ["não mexeu nos dados", dadosIntactos()]
]);

CEN(93, "Idosos", 73, "CONTEXTO: repete a mesma pergunta", "qual é o meu saldo de novo?", {
  setup: {contas: IDOSO_BASE.contas},
  history: [
    {role: "user", content: "qual é o meu saldo?"},
    {role: "assistant", content: "💰 **Saldo total: R$ 2.800,00**\n- Caixa: **R$ 2.800,00**"}
  ]}, [
  ["respondeu de novo com o saldo (R$ 2.800)", texto(/2\.800/)],
  ["o histórico foi enviado ao LLM", historicoEnviado(/meu saldo/i)]
]);

CEN(94, "Idosos", 65, "repete explicação de backup", "Pode repetir como eu salvo meus dados?", {setup: {}}, [
  ["ensinou de novo (exportar/backup)", texto(/exportar|backup/i)]
]);

CEN(95, "Idosos", 68, "frase solta: 'a conta de luz subiu pra 180'", "a conta de luz subiu pra 180", {setup: {contas: IDOSO_BASE.contas,
  txs: [{tipo: "despesa", desc: "Luz", valor: 15000, conta: "Caixa"}]}}, [
  ["perguntou o que fazer OU lançou R$ 180 certo", c =>
    (c.state.transactions.length === c.txCountBefore && perguntou()(c)) ||
    (c.state.transactions.length > c.txCountBefore && c.state.transactions.some(t => t.value === 18000))]
]);

CEN(96, "Idosos", 75, "elogio: 'você é um amor'", "obrigado, você é um amor!", {setup: {}}, [
  ["respondeu com gentileza", respondeu()],
  ["não mexeu nos dados", dadosIntactos()]
]);

CEN(97, "Idosos", 63, "quem é você e o que faz?", "quem é você e o que você faz?", {setup: {}}, [
  ["se apresentou", texto(/fluxo|assistente|mentor/i)],
  ["nada mudou", nadaMudou()]
]);

CEN(98, "Idosos", 70, "'tira o escuro' → tema claro", "tira o escuro que está difícil de ler", {setup: {tema: "dark"}}, [
  ["tema mudou para claro", tema("light")]
]);

CEN(99, "Idosos", 66, "CONTEXTO: 'transfere pra ela' (coreferência)", "e transfere 2000 da caixa pra ela", {
  setup: {contas: [{nome: "Caixa", tipo: "corrente", saldo: 280000},
                   {nome: "Poupança", tipo: "poupanca", saldo: 1000000}]},
  history: [
    {role: "user", content: "crie uma conta poupança com 10.000"},
    {role: "assistant", content: "✅ Conta **Poupança** criada com saldo **R$ 10.000,00**."}
  ]}, [
  ["transferiu Caixa → Poupança R$ 2.000", transfCom({de: /caixa/i, para: /poupan/i, valor: 200000})],
  ["o histórico foi enviado ao LLM", historicoEnviado(/poupança com 10/i)]
]);

CEN(100, "Idosos", 67, "MULTITAREFA MÁXIMA: 4 pedidos numa frase", "Pra fechar o mês: recebi 3200 do INSS, paguei 240 de remédio, 180 de luz e quero guardar 300 por mês", {setup: {contas: IDOSO_BASE.contas}}, [
  ["receita INSS R$ 3.200", txCom({tipo: "receita", valor: 320000})],
  ["remédio R$ 240", txCom({tipo: "despesa", valor: 24000})],
  ["luz R$ 180", txCom({tipo: "despesa", valor: 18000})],
  ["meta de economia R$ 300", metaEconomia(30000)],
  ["tudo numa tacada só", nTx(3)]
]);

/* ============================================================
   EXECUÇÃO
   Modo filho (--rodar N): executa 1 cenário e imprime o resultado.
   Modo orquestrador (padrão): roda os cenários em processos
   separados (isolamento total) e monta o relatório.
   ============================================================ */
function snapshot(){
  return JSON.stringify([state.accounts.length, state.transactions.length, state.transfers.length,
    state.budgets.monthly, state.goals, state.settings.theme, global.location.hash,
    win.FluxoMemoria.count()]);
}

async function rodarCenario(s){
  reset(s.setup);
  const acoesExecutadas = [];   /* rótulos das ferramentas que rodaram (via onStatus) */
  const c = {
    state, mem: win.FluxoMemoria, sent: SENT, reportCalled: false,
    txCountBefore: state.transactions.length,
    contasAntes: state.accounts.length,
    transfAntes: state.transfers.length,
    orcAntes: state.budgets.monthly,
    metaAntes: state.goals.saveMonthly,
    snapshotAntes: snapshot(),
    text: "", err: null
  };
  const t0 = Date.now();
  let out = null;
  try{
    out = await Promise.race([
      win.FluxoAgente.turn(s.msg, {history: s.history || [], onStatus: rot => acoesExecutadas.push(rot)}),
      new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado (300s)")), 300000))
    ]);
  }catch(e){ c.err = e; }
  c.out = out;
  c.text = (out && out.text) || "";
  c.snapshotDepois = snapshot();
  c.reportCalled = reportCalled;

  const falhas = [];
  if(c.err) falhas.push("ERRO: " + (c.err.message || String(c.err)));
  else if(!c.text.trim() && !((out && out.cards) || []).length) falhas.push("resposta vazia");
  (s.checks || []).forEach(([rotulo, fn]) => {
    let ok;
    try{ ok = !!fn(c); }catch(e){ ok = false; }
    if(!ok) falhas.push(rotulo);
  });
  return {
    id: s.id, grupo: s.grupo, idade: s.idade, titulo: s.titulo, msg: s.msg,
    ok: falhas.length === 0, falhas,
    duracaoMs: Date.now() - t0,
    resposta: c.text.slice(0, 300),
    acoes: acoesExecutadas,
    estado: {
      contas: state.accounts.map(a => a.name + "(" + (a.initial/100) + ")"),
      txs: state.transactions.map(t => t.type[0] + ":" + t.desc + "=" + (t.value/100) + (t.status === "pendente" ? " pend" : "")),
      transf: state.transfers.map(t => "->" + (t.value/100)),
      meta: (state.goals.saveMonthly/100) + "/" + (state.goals.netWorth/100),
      memoria: win.FluxoMemoria.all().map(f => f.text)
    }
  };
}

const argRodar = process.argv.indexOf("--rodar");
if(argRodar > -1){
  /* ---------- modo filho: 1 cenário ---------- */
  const id = parseInt(process.argv[argRodar + 1], 10);
  const s = SCENARIOS.find(x => x.id === id);
  if(!s){ console.error("cenário " + id + " não existe"); process.exit(2); }
  montarNavegador();
  rodarCenario(s)
    .then(r => { console.log("RESULTADO:" + JSON.stringify(r)); process.exit(r.ok ? 0 : 3); })
    .catch(e => {
      console.log("RESULTADO:" + JSON.stringify({id, grupo: s.grupo, ok: false, falhas: ["ERRO interno: " + (e.message || e)], duracaoMs: 0, resposta: ""}));
      process.exit(2);
    });
}else{
  /* ---------- orquestrador ---------- */
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1
    ? process.argv[onlyArg + 1].split(",").map(x => parseInt(x.trim(), 10)).filter(Boolean)
    : null;
  const lista = only ? SCENARIOS.filter(s => only.includes(s.id)) : SCENARIOS;

  (async () => {
    const {spawnSync} = require("child_process");
    const fs = require("fs");
    const resultados = [];
    /* salva o resultado parcial após CADA cenário: se o processo for
       interrompido (timeout de shell, sandbox…), nada se perde */
    const salvarParcial = () => {
      try{
        fs.writeFileSync(__dirname + "/ultimo-resultado.json",
          JSON.stringify({geradoEm: new Date().toISOString(), total: resultados.length,
            passou: resultados.filter(r => r.ok).length, parcial: true, resultados}, null, 2));
      }catch(e){}
    };
    console.log("Bateria de " + lista.length + " cenários — LLM real, usuário simulado de 14 a 75 anos\n");
    const t0 = Date.now();
    for(let i = 0; i < lista.length; i++){
      const s = lista[i];
      process.stdout.write("[" + String(i + 1).padStart(3) + "/" + lista.length + "] #" + String(s.id).padStart(3, "0") + " " + s.grupo.padEnd(14) + " · " + s.titulo.slice(0, 52).padEnd(52));
      const p = spawnSync(process.execPath, [__filename, "--rodar", String(s.id)], {
        timeout: 320000, encoding: "utf8", maxBuffer: 8 * 1024 * 1024
      });
      let r = null;
      const linha = (p.stdout || "").split("\n").find(l => l.startsWith("RESULTADO:"));
      if(linha){
        try{ r = JSON.parse(linha.slice("RESULTADO:".length)); }catch(e){}
      }
      if(!r){
        r = {id: s.id, grupo: s.grupo, idade: s.idade, titulo: s.titulo, msg: s.msg, ok: false,
             falhas: ["ERRO no processo filho (exit " + p.status + (p.signal ? " / " + p.signal : "") + ")"],
             duracaoMs: 0, resposta: (p.stderr || "").slice(0, 200)};
      }
      resultados.push(r);
      salvarParcial();
      console.log((r.ok ? " ✓ " : " ✗ ") + (r.duracaoMs / 1000).toFixed(1) + "s" + (r.ok ? "" : "  → " + r.falhas.join(" | ")));
      if(!r.ok && p.stderr) console.log("      stderr: " + String(p.stderr).replace(/\n/g, " ⏎ ").slice(0, 400));
      /* pacing: o tier gratuito permite ~1 geração/45s por IP. Esperar a
         janela abrir evita fila dupla (que estouraria a paciência interna) */
      if(i < lista.length - 1) await sleep(46000);
    }

    /* ---------- relatório ---------- */
    const total = resultados.length, passou = resultados.filter(r => r.ok).length;
    const grupos = {};
    resultados.forEach(r => {
      grupos[r.grupo] = grupos[r.grupo] || {total: 0, ok: 0};
      grupos[r.grupo].total++;
      if(r.ok) grupos[r.grupo].ok++;
    });
    console.log("\n════════════════════════════════════════════════");
    console.log("RESULTADO: " + passou + "/" + total + " cenários passaram" + (passou === total ? " 🎉" : ""));
    Object.keys(grupos).forEach(g => {
      const gc = grupos[g];
      console.log("  " + g.padEnd(14) + gc.ok + "/" + gc.total);
    });
    const falhas = resultados.filter(r => !r.ok);
    if(falhas.length){
      console.log("\nFalhas:");
      falhas.forEach(r => {
        console.log("  ✗ #" + String(r.id).padStart(3, "0") + " [" + r.grupo + "] " + r.titulo);
        console.log("      mensagem: \"" + r.msg + "\"");
        console.log("      falhou em: " + r.falhas.join(" | "));
        if(r.resposta) console.log("      resposta: " + r.resposta.replace(/\n/g, " ").slice(0, 160));
        if(r.acoes && r.acoes.length) console.log("      ferramentas: " + r.acoes.join(" · "));
        if(r.estado) console.log("      estado: txs=[" + r.estado.txs.join(" | ") + "] contas=[" + r.estado.contas.join(", ") + "] meta=" + r.estado.meta);
      });
    }
    console.log("\nTempo total: " + ((Date.now() - t0) / 1000 / 60).toFixed(1) + " min");

    try{
      fs.writeFileSync(__dirname + "/ultimo-resultado.json",
        JSON.stringify({geradoEm: new Date().toISOString(), total, passou, porGrupo: grupos, resultados}, null, 2));
      console.log("Relatório salvo em testes/ultimo-resultado.json");
    }catch(e){}
    process.exit(passou === total ? 0 : 1);
  })().catch(e => { console.error("ERRO:", e); process.exit(2); });
}
