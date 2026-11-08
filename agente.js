/* ============================================================
   Fluxo — Agente Autônomo (o "cérebro" do assistente)
   ------------------------------------------------------------
   Substitui o antigo parser de intenções (if/else + regex) por
   um AGENTE DE IA real com Tool Calling, rodando no navegador:

     1. O usuário escreve QUALQUER COISA em linguagem natural.
     2. O agente envia a conversa (com memória + contexto do app)
        para um LLM gratuito e SEM CHAVE (Pollinations, modelo
        GPT-OSS 20B, endpoint compatível com OpenAI, CORS aberto).
     3. O modelo DECIDE sozinho o que fazer e responde com
        chamadas de ferramentas (tool_calls) — zero regras fixas.
     4. O loop do agente executa cada ferramenta aqui no navegador
        (criar contas, lançar transações, consultar dados, salvar
        memória...) e devolve o resultado para o modelo.
     5. O modelo responde ao usuário em português, de forma natural.

   Resiliência: timeout por chamada, retentativas com pausa,
   nomes de ferramenta higienizados (o modelo às vezes emite
   sufixos internos) e resposta amigável se tudo falhar.

   Privacidade: os DADOS financeiros ficam só no navegador
   (localStorage); apenas o texto da conversa + o contexto
   necessário vão para o serviço de IA.
   ============================================================ */
(function(){
"use strict";
if(window.FluxoAgente) return;   /* evita instância dupla */

/* ---------- 1. Cliente LLM (sem chave, CORS aberto) ---------- */
const ENDPOINT = "https://text.pollinations.ai/openai";
const MODEL    = "openai";              /* GPT-OSS 20B — tier anônimo, com tools */
const REFERRER = "lebot007-fluxo";      /* identificação do app (não é chave) */
const TIMEOUT_MS  = 75000;              /* por tentativa */
const MAX_RETRIES = 2;                  /* retentativas por chamada (rede/5xx) */
const MAX_WAITS   = 3;                  /* esperas pela cota gratuita (HTTP 402) por chamada */

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

/* Higieniza o nome da ferramenta: o GPT-OSS às vezes vaza o
   formato interno dele (ex.: "criar_conta<|channel|>commentary"). */
function cleanToolName(name){
  return String(name || "").split("<|")[0].replace(/\s+/g, "").trim();
}

/* Extrai o JSON dos argumentos mesmo se vier com lixo em volta */
function parseArgs(raw){
  if(raw == null) return {};
  if(typeof raw === "object") return raw;
  try{ return JSON.parse(raw); }catch(e){}
  const s = String(raw);
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if(a >= 0 && b > a){ try{ return JSON.parse(s.slice(a, b+1)); }catch(e){} }
  return {};
}

/**
 * Uma chamada ao LLM (compatível com /v1/chat/completions).
 * O tier gratuito limita a ~1 geração a cada ~37s por IP: ao receber
 * HTTP 402, espera o tempo indicado em Retry-After e continua — quem
 * chama acompanha via onWait(segundos).
 * @returns {object} corpo da resposta ({choices:[{message}]})
 */
async function llmChat(messages, tools, onWait){
  let retries = 0, waits = 0;
  for(;;){
    const ctl = new AbortController();
    const tm  = setTimeout(()=>ctl.abort(), TIMEOUT_MS);
    try{
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        signal: ctl.signal,
        body: JSON.stringify({
          model: MODEL,
          referrer: REFERRER,
          messages,
          tools: tools || undefined,
          tool_choice: tools ? "auto" : undefined,
          max_tokens: 2048,
          reasoning_effort: "low"      /* respostas mais rápidas e cabe no limite de saída */
        })
      });
      clearTimeout(tm);

      /* cota gratuita esgotada NESTA janela → espera a próxima vaga */
      if(res.status === 402){
        if(waits >= MAX_WAITS) throw new Error("serviço gratuito ocupado agora");
        const ra = Math.min((parseInt(res.headers.get("retry-after") || "37", 10) || 37) + 1, 46);
        if(onWait) onWait(ra);
        await sleep(ra * 1000);
        waits++;
        continue;
      }
      if(res.status === 429 || res.status >= 500){       /* lotado / instável → tenta de novo */
        if(retries >= MAX_RETRIES) throw new Error("HTTP " + res.status);
        retries++;
        await sleep(2500 * retries);
        continue;
      }
      if(!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    }catch(e){
      clearTimeout(tm);
      if(e && e.name === "AbortError"){
        if(retries >= MAX_RETRIES) throw new Error("tempo esgotado");
        retries++; await sleep(2000); continue;
      }
      throw e;
    }
  }
}

/* ---------- 2. Utilidades ---------- */
const NORM = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

const money = cents => (typeof fmtMoney === "function") ? fmtMoney(cents) : ("R$ " + (cents/100).toFixed(2));
const dISO  = iso => (typeof fmtDate === "function") ? fmtDate(iso) : String(iso);
const today = () => (typeof todayISO === "function") ? todayISO() : new Date().toISOString().slice(0,10);

/* converte "1905" | 1905.5 | "1.905,50" → centavos */
function toCents(v){
  if(v == null || v === "") return null;
  if(typeof v === "number") return Math.round(v * 100);
  const s = String(v).replace(/r\$/gi,"").trim();
  let r = null;
  if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) r = parseFloat(s.replace(/\./g,"").replace(",","."));
  else if(/^\d+,\d{1,2}$/.test(s))             r = parseFloat(s.replace(",","."));
  else if(/^\d+(\.\d+)?$/.test(s))             r = parseFloat(s);
  return r != null && isFinite(r) ? Math.round(r * 100) : null;
}

/* aceita "aaaa-mm-dd", "dd/mm/aaaa" ou relativas curtas; devolve ISO ou null */
function toISO(v){
  if(!v) return null;
  const s = String(v).trim();
  let m;
  if((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))){
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    return (d.getDate()===+m[3] && d.getMonth()===+m[2]-1) ? s : null;
  }
  if((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s))){
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    const d = new Date(y, +m[2]-1, +m[1]);
    return (d.getDate()===+m[1] && d.getMonth()===+m[2]-1)
      ? d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0") : null;
  }
  const t = NORM(s);
  if(/^hoje$/.test(t)) return today();
  if(/^ontem$/.test(t)){ const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
  if(/^amanha?$/.test(t)){ const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
  return null;
}

/* "atual" | "anterior"/"mês passado" | "aaaa-mm" | "junho 2025" → {label, cs, ce, mm} */
function periodRange(p){
  const t = NORM(p || "atual");
  const now = new Date();
  let anchor = now;
  if(/^(anterior|mes passado|passado|ultimo mes)$/.test(t)) anchor = new Date(now.getFullYear(), now.getMonth()-1, 15);
  else if(/^\d{4}-\d{2}$/.test(t)) anchor = new Date(+t.slice(0,4), +t.slice(5,7)-1, 15);
  else{
    const MN = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const mm = MN.findIndex(x => t.includes(x));
    const yy = /(\d{4})/.exec(t);
    if(mm >= 0) anchor = new Date(yy ? +yy[1] : now.getFullYear(), mm, 15);
  }
  if(typeof cycleRange !== "function") return null;
  const [cs, ce] = cycleRange(anchor);
  return {label: dISO(cs) + " a " + dISO(ce), cs, ce, mm:{y:anchor.getFullYear(), m:anchor.getMonth()}};
}

/* ---------- 3. Resolução de nomes (contas, cartões, categorias) ---------- */
function resolveAccount(name){
  if(!name || !Array.isArray(state.accounts)) return null;
  const q = NORM(name);
  if(!q) return null;
  let hit = state.accounts.find(a => NORM(a.name) === q)
        || state.accounts.find(a => NORM(a.institution) === q)
        || state.accounts.find(a => NORM(a.name).startsWith(q))
        || state.accounts.find(a => NORM(a.name).includes(q) || q.includes(NORM(a.name)));
  return hit || null;
}
function resolveCard(name){
  if(!name || !Array.isArray(state.cards)) return null;
  const q = NORM(name);
  if(!q) return null;
  return state.cards.find(c => NORM(c.name) === q)
      || state.cards.find(c => NORM(c.bank) === q)
      || state.cards.find(c => NORM(c.name).includes(q) || q.includes(NORM(c.name))
                            || NORM(c.bank||"").includes(q))
      || null;
}
function resolveCategory(name, type){
  if(!name || !Array.isArray(state.categories)) return null;
  const q = NORM(name);
  let hit = state.categories.find(c => NORM(c.name) === q && (!type || c.type === type))
         || state.categories.find(c => NORM(c.name).includes(q) && (!type || c.type === type))
         || state.categories.find(c => q.includes(NORM(c.name)) && (!type || c.type === type));
  if(!hit && type) hit = state.categories.find(c => c.type === type && NORM(c.name) === "outros");
  return hit || null;
}
const accountNames = () => (state.accounts || []).map(a => a.name + " (" + ((typeof ACC_TYPES === "object" ? ACC_TYPES[a.type] : a.type) || a.type) + ")");
const cardNames    = () => (state.cards || []).map(c => c.name);
const categoryNames = type => (state.categories || []).filter(c => !type || c.type === type).map(c => c.name);

/* ---------- 4. Ferramentas: definições (schemas) ---------- */
const TOOL_DEFS = [
  {type:"function", function:{
    name:"criar_conta",
    description:"Cria uma conta ou carteira no app (banco, poupança, dinheiro, carteira digital, investimentos).",
    parameters:{type:"object", properties:{
      nome:{type:"string", description:"Nome da conta (ex.: Inter, Nubank, Carteira)"},
      saldo_inicial:{type:"number", description:"Saldo inicial em reais (ex.: 1905.50). Padrão 0."},
      tipo:{type:"string", enum:["corrente","poupanca","dinheiro","digital","investimento"], description:"Tipo da conta. Padrão corrente."}
    }, required:["nome"]}
  }},
  {type:"function", function:{
    name:"criar_cartao",
    description:"Cadastra um cartão de crédito com limite e dias de fechamento/vencimento da fatura.",
    parameters:{type:"object", properties:{
      nome:{type:"string"}, banco:{type:"string"},
      limite:{type:"number", description:"Limite em reais"},
      dia_fechamento:{type:"integer", description:"Dia do mês em que a fatura fecha (1-28). Padrão 27."},
      dia_vencimento:{type:"integer", description:"Dia do mês de vencimento da fatura (1-28). Padrão 10."}
    }, required:["nome","limite"]}
  }},
  {type:"function", function:{
    name:"lancar_transacao",
    description:"Registra uma despesa ou receita. Se o usuário não disser a conta/cartão, use a conta única ou pergunte antes.",
    parameters:{type:"object", properties:{
      tipo:{type:"string", enum:["despesa","receita"]},
      valor:{type:"number", description:"Valor em reais (ex.: 250.5)"},
      descricao:{type:"string", description:"Descrição curta (ex.: Mercado, Salário, Aluguel)"},
      conta:{type:"string", description:"Nome da conta/cartela de destino (saída/entrada do dinheiro)"},
      cartao:{type:"string", description:"Nome do cartão de crédito, se a compra for no cartão"},
      categoria:{type:"string", description:"Nome da categoria (veja as disponíveis no contexto)"},
      data:{type:"string", description:"Data no formato aaaa-mm-dd. Padrão: hoje."},
      status:{type:"string", enum:["pago","pendente"], description:"Pago ou pendente. No cartão, o padrão é pendente até pagar a fatura."},
      forma_pagamento:{type:"string", description:"Ex.: Pix, Boleto, Dinheiro, Cartão de débito"}
    }, required:["tipo","valor","descricao"]}
  }},
  {type:"function", function:{
    name:"transferir",
    description:"Transfere dinheiro entre duas contas já cadastradas.",
    parameters:{type:"object", properties:{
      valor:{type:"number", description:"Valor em reais"},
      de:{type:"string", description:"Nome da conta de origem"},
      para:{type:"string", description:"Nome da conta de destino"},
      data:{type:"string", description:"aaaa-mm-dd. Padrão: hoje."},
      descricao:{type:"string"}
    }, required:["valor","de","para"]}
  }},
  {type:"function", function:{
    name:"pagar_fatura",
    description:"Quita a fatura atual de um cartão de crédito, debitando de uma conta.",
    parameters:{type:"object", properties:{
      cartao:{type:"string", description:"Nome do cartão"},
      conta:{type:"string", description:"Nome da conta de onde sai o dinheiro"}
    }, required:["cartao"]}
  }},
  {type:"function", function:{
    name:"consultar_saldo",
    description:"Consulta o saldo total, o saldo de cada conta e as faturas abertas dos cartões.",
    parameters:{type:"object", properties:{}}
  }},
  {type:"function", function:{
    name:"consultar_resumo",
    description:"Resumo financeiro de um período: receitas, despesas, resultado, maiores categorias e contas em aberto.",
    parameters:{type:"object", properties:{
      periodo:{type:"string", description:"\"atual\" (padrão), \"anterior\", \"aaaa-mm\" ou \"junho 2025\""}
    }}
  }},
  {type:"function", function:{
    name:"consultar_transacoes",
    description:"Busca lançamentos por texto, tipo, status ou período. Use para responder perguntas sobre gastos específicos.",
    parameters:{type:"object", properties:{
      busca:{type:"string", description:"Texto da descrição/categoria/conta (ex.: mercado, aluguel, salário)"},
      tipo:{type:"string", enum:["despesa","receita"]},
      status:{type:"string", enum:["pago","pendente"]},
      periodo:{type:"string", description:"\"atual\" (padrão), \"anterior\", \"aaaa-mm\" ou \"tudo\" para todo o histórico"},
      limite:{type:"integer", description:"Máximo de lançamentos a listar (padrão 12, máx 30)"}
    }}
  }},
  {type:"function", function:{
    name:"gerar_relatorio_pdf",
    description:"Gera e entrega no chat o relatório mensal em PDF.",
    parameters:{type:"object", properties:{
      mes:{type:"string", description:"\"atual\" (padrão), \"anterior\" ou \"aaaa-mm\""}
    }}
  }},
  {type:"function", function:{
    name:"definir_orcamento",
    description:"Define o teto mensal de gastos (orçamento).",
    parameters:{type:"object", properties:{ valor:{type:"number", description:"Valor em reais"} }, required:["valor"]}
  }},
  {type:"function", function:{
    name:"definir_meta",
    description:"Define uma meta de economia mensal ou de patrimônio.",
    parameters:{type:"object", properties:{
      tipo:{type:"string", enum:["economia_mensal","patrimonio"]},
      valor:{type:"number", description:"Valor em reais"}
    }, required:["tipo","valor"]}
  }},
  {type:"function", function:{
    name:"navegar",
    description:"Abre uma página do app.",
    parameters:{type:"object", properties:{
      pagina:{type:"string", enum:["dashboard","lancamentos","contas","receitas","cartoes","carteiras","planejamento","relatorios","configuracoes"]}
    }, required:["pagina"]}
  }},
  {type:"function", function:{
    name:"mudar_tema",
    description:"Alterna o tema visual do app.",
    parameters:{type:"object", properties:{ tema:{type:"string", enum:["claro","escuro"]} }, required:["tema"]}
  }},
  {type:"function", function:{
    name:"desfazer",
    description:"Desfaz a última ação executada pelo assistente nesta sessão.",
    parameters:{type:"object", properties:{}}
  }},
  {type:"function", function:{
    name:"salvar_memoria",
    description:"Guarda um fato duradouro sobre o usuário (salário, preferências, objetivos, nome). Não guarde conversa fiada nem perguntas.",
    parameters:{type:"object", properties:{ fato:{type:"string", description:"O fato, em uma frase (ex.: Meu salário é 3000 e cai dia 5)"} }, required:["fato"]}
  }},
  {type:"function", function:{
    name:"buscar_memoria",
    description:"Busca fatos memorizados sobre o usuário. Sem termo, lista os mais recentes.",
    parameters:{type:"object", properties:{ termo:{type:"string"} }}
  }},
  {type:"function", function:{
    name:"editar_memoria",
    description:"Atualiza um fato memorizado (use quando o usuário corrigir algo ou confirmar uma atualização).",
    parameters:{type:"object", properties:{
      texto_antigo:{type:"string", description:"O fato como está hoje (ou algo bem parecido)"},
      texto_novo:{type:"string", description:"O novo texto do fato"}
    }, required:["texto_antigo","texto_novo"]}
  }},
  {type:"function", function:{
    name:"apagar_memoria",
    description:"Apaga definitivamente um fato da memória. Só use se o usuário pediu para esquecer.",
    parameters:{type:"object", properties:{ termo:{type:"string", description:"O fato a esquecer (ou algo bem parecido)"} }, required:["termo"]}
  }}
];

/* ---------- 5. Ferramentas: executores ---------- */
/* Cada executor devolve um objeto serializável para o modelo;
   se houver "receipt", o chat mostra um cartão de confirmação. */

const TOOL_LABEL = {
  criar_conta:"criar conta", criar_cartao:"criar cartão", lancar_transacao:"lançar transação",
  transferir:"transferir", pagar_fatura:"pagar fatura", consultar_saldo:"consultar saldo",
  consultar_resumo:"consultar resumo", consultar_transacoes:"buscar lançamentos",
  gerar_relatorio_pdf:"gerar relatório", definir_orcamento:"definir orçamento",
  definir_meta:"definir meta", navegar:"abrir página", mudar_tema:"mudar tema",
  desfazer:"desfazer", salvar_memoria:"memorizar", buscar_memoria:"consultar memória",
  editar_memoria:"atualizar memória", apagar_memoria:"apagar da memória"
};

const TOOL_RUN = {

  criar_conta(a){
    if(!a.nome) return {ok:false, motivo:"faltou o nome"};
    const saldo = toCents(a.saldo_inicial ?? 0) || 0;
    const tipos = ["corrente","poupanca","dinheiro","digital","investimento"];
    const tipo  = tipos.includes(a.tipo) ? a.tipo : "corrente";
    const acc = {
      id: uid(), createdAt: today(),
      name: String(a.nome).slice(0,40), type: tipo,
      institution: "", initial: saldo, note: ""
    };
    state.accounts.push(acc);
    save(); render();
    window.FluxoUI && FluxoUI.undo("account", acc);
    return {ok:true, conta:acc.name, saldo:money(saldo),
      receipt:{undo:true, ic:"bank", title:"Conta criada", rows:[
        ["Nome", acc.name],
        ["Tipo", (typeof ACC_TYPES === "object" && ACC_TYPES[tipo]) || tipo],
        ["Saldo inicial", money(saldo)]
      ]}};
  },

  criar_cartao(a){
    if(!a.nome) return {ok:false, motivo:"faltou o nome"};
    const limite = toCents(a.limite) || 0;
    const clamp = (v,d) => { v = parseInt(v,10); return (v>=1 && v<=28) ? v : d; };
    const card = {
      id: uid(), name: String(a.nome).slice(0,40), bank: a.banco ? String(a.banco).slice(0,30) : "",
      limit: limite, closeDay: clamp(a.dia_fechamento,27), dueDay: clamp(a.dia_vencimento,10),
      color:"#0e6b4f", active:true
    };
    state.cards.push(card);
    save(); render();
    window.FluxoUI && FluxoUI.undo("card", card);
    return {ok:true, cartao:card.name, limite:money(limite),
      receipt:{undo:true, ic:"creditCard", title:"Cartão criado", rows:[
        ["Nome", card.name], ["Banco", card.bank || "—"], ["Limite", money(limite)],
        ["Fechamento / vencimento", "dia " + card.closeDay + " / dia " + card.dueDay]
      ]}};
  },

  lancar_transacao(a){
    const tipo = a.tipo === "receita" ? "receita" : (a.tipo === "despesa" ? "despesa" : null);
    if(!tipo) return {ok:false, motivo:'tipo deve ser "despesa" ou "receita"'};
    const valor = toCents(a.valor);
    if(!valor || valor <= 0) return {ok:false, motivo:"valor inválido"};
    const desc = String(a.descricao || "").slice(0,60).trim() || (tipo === "receita" ? "Receita" : "Despesa");
    const data = toISO(a.data) || today();

    let accountId = null, cardId = null, payMethod = a.forma_pagamento || null, status = a.status || null;

    if(a.cartao){
      const card = resolveCard(a.cartao);
      if(!card) return {ok:false, motivo:"cartão não encontrado", disponiveis:cardNames()};
      cardId = card.id; accountId = null; payMethod = "Cartão de crédito"; status = status || "pendente";
    } else {
      let acc = null;
      if(a.conta){ acc = resolveAccount(a.conta); if(!acc) return {ok:false, motivo:"conta não encontrada", disponiveis:accountNames()}; }
      else if(state.accounts.length === 1) acc = state.accounts[0];
      else if(state.accounts.length === 0) return {ok:false, motivo:"nenhuma conta cadastrada — crie uma primeiro com criar_conta"};
      else return {ok:false, motivo:"em qual conta?", disponiveis:accountNames()};
      accountId = acc.id;
      payMethod = payMethod || "Pix";
      status = status || (data > today() ? "pendente" : "pago");
    }

    const cat = a.categoria ? resolveCategory(a.categoria, tipo) : (resolveCategory("Outros", tipo) || null);
    if(a.categoria && !cat) return {ok:false, motivo:"categoria não encontrada", disponiveis:categoryNames(tipo)};

    const t = {
      id: uid(), type:tipo, desc, value:valor, date:data,
      categoryId: cat ? cat.id : null,
      accountId: cardId ? null : accountId,
      cardId, payMethod: payMethod || "Pix",
      status: status || "pago", note:"Criado via assistente (IA)",
      paidDate: (status || "pago") === "pago" ? today() : undefined
    };
    state.transactions.push(t);
    save(); render();
    window.FluxoUI && FluxoUI.undo("tx", t);
    const dest = cardId ? ((cardById(cardId)||{}).name || "cartão") : ((accById(accountId)||{}).name || "—");
    return {ok:true, lancamento:desc, valor:money(valor), tipo,
      receipt:{undo:true, ic: tipo==="receita" ? "arrowUR" : "arrowDR",
        title: tipo==="receita" ? "Receita registrada" : "Despesa registrada", rows:[
        ["Descrição", desc],
        ["Valor", (tipo==="receita"?"+ ":"− ") + money(valor)],
        ["Data", dISO(data)],
        ["Categoria", cat ? cat.name : "—"],
        ["Destino", dest],
        ["Forma", payMethod],
        ["Status", t.status==="pago" ? (tipo==="receita"?"Recebida":"Paga") : "Pendente"]
      ]}};
  },

  transferir(a){
    const valor = toCents(a.valor);
    if(!valor || valor <= 0) return {ok:false, motivo:"valor inválido"};
    const from = resolveAccount(a.de), to = resolveAccount(a.para);
    if(!from) return {ok:false, motivo:"conta de origem não encontrada", disponiveis:accountNames()};
    if(!to)   return {ok:false, motivo:"conta de destino não encontrada", disponiveis:accountNames()};
    if(from.id === to.id) return {ok:false, motivo:"origem e destino são a mesma conta"};
    const tr = {
      id: uid(), from:from.id, to:to.id, value:valor,
      date: toISO(a.data) || today(),
      desc: String(a.descricao || "Transferência").slice(0,60),
      note:"Criado via assistente (IA)", payMethod:"Pix",
      createdAt:new Date().toISOString()
    };
    state.transfers.push(tr);
    save(); render();
    window.FluxoUI && FluxoUI.undo("transfer", tr);
    return {ok:true, de:from.name, para:to.name, valor:money(valor),
      receipt:{undo:true, ic:"transfer", title:"Transferência realizada", rows:[
        ["De", from.name], ["Para", to.name], ["Valor", money(valor)], ["Data", dISO(tr.date)]
      ]}};
  },

  pagar_fatura(a){
    const card = resolveCard(a.cartao);
    if(!card) return {ok:false, motivo:"cartão não encontrado", disponiveis:cardNames()};
    let acc = null;
    if(a.conta){ acc = resolveAccount(a.conta); if(!acc) return {ok:false, motivo:"conta não encontrada", disponiveis:accountNames()}; }
    else if(state.accounts.length === 1) acc = state.accounts[0];
    else if(state.accounts.length === 0) return {ok:false, motivo:"nenhuma conta para debitar"};
    else return {ok:false, motivo:"de qual conta sai o dinheiro?", disponiveis:accountNames()};

    const mk = invoiceMonthKey(today(), card.closeDay);
    const txs = state.transactions.filter(t =>
      t.cardId === card.id && t.status !== "pago" && invoiceMonthKey(t.date, card.closeDay) === mk);
    if(!txs.length) return {ok:true, aviso:"a fatura atual já está paga (ou não há compras em aberto)"};
    const total = txs.reduce((s,t)=>s+t.value,0);
    txs.forEach(t => { t.status="pago"; t.accountId=acc.id; t.paidDate=today(); });
    save(); render();
    window.FluxoUI && FluxoUI.undo("paid", {txs});
    return {ok:true, cartao:card.name, total:money(total), parcelas:txs.length, conta:acc.name,
      receipt:{undo:true, ic:"creditCard", title:"Fatura paga", rows:[
        ["Cartão", card.name], ["Parcelas quitadas", String(txs.length)],
        ["Total pago", money(total)], ["Conta debitada", acc.name]
      ]}};
  },

  consultar_saldo(){
    const dados = {
      saldo_total: money(netWorth()),
      contas: state.accounts.map(a => ({nome:a.name, saldo:money(accountBalance(a))})),
      cartoes: state.cards.map(c => { const s = cardStats(c); return {nome:c.name, fatura_atual:money(s.invoiceNow), disponivel:money(s.available)}; })
    };
    return {ok:true, ...dados};
  },

  consultar_resumo(a){
    const pr = periodRange(a.periodo);
    if(!pr) return {ok:false, motivo:"período inválido"};
    const txs = state.transactions.filter(t => t.date >= pr.cs && t.date <= pr.ce);
    const rec  = txs.filter(t=>t.type==="receita").reduce((s,t)=>s+t.value,0);
    const desp = txs.filter(t=>t.type==="despesa").reduce((s,t)=>s+t.value,0);
    const byCat = {};
    txs.filter(t=>t.type==="despesa").forEach(t => {
      const c = catById(t.categoryId); const k = c ? c.name : "Sem categoria";
      byCat[k] = (byCat[k]||0) + t.value;
    });
    const top = Object.entries(byCat).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([k,v])=>k+": "+money(v));
    const pend = state.transactions.filter(t=>t.type==="despesa" && t.status!=="pago");
    return {ok:true, periodo:pr.label,
      receitas:money(rec), despesas:money(desp), resultado:money(rec-desp),
      saldo_hoje:money(netWorth()),
      maiores_categorias:top, pendentes:{quantidade:pend.length, total:money(pend.reduce((s,t)=>s+t.value,0))}};
  },

  consultar_transacoes(a){
    const pr = (a.periodo && NORM(a.periodo) === "tudo") ? null : periodRange(a.periodo);
    const q = a.busca ? NORM(a.busca) : "";
    const limite = Math.min(Math.max(parseInt(a.limite,10) || 12, 1), 30);
    let list = state.transactions.slice();
    if(pr) list = list.filter(t => t.date >= pr.cs && t.date <= pr.ce);
    if(a.tipo)   list = list.filter(t => t.type === a.tipo);
    if(a.status) list = list.filter(t => t.status === a.status);
    if(q) list = list.filter(t => {
      const c = catById(t.categoryId), acc = accById(t.accountId), card = cardById(t.cardId);
      return [t.desc, c && c.name, acc && acc.name, card && card.name].some(x => x && NORM(x).includes(q));
    });
    list.sort((x,y)=>y.date.localeCompare(x.date));
    const total = list.reduce((s,t)=>s+t.value,0);
    return {ok:true, periodo: pr ? pr.label : "todo o histórico",
      quantidade:list.length, total:money(total),
      lancamentos:list.slice(0,limite).map(t => ({
        data:dISO(t.date), descricao:t.desc, valor:money(t.value), tipo:t.type,
        categoria:(catById(t.categoryId)||{}).name || "—",
        destino:(cardById(t.cardId)||{}).name || (accById(t.accountId)||{}).name || "—",
        status:t.status
      })),
      truncado:list.length > limite ? (list.length - limite) + " mais não listados" : null};
  },

  gerar_relatorio_pdf(a){
    const pr = periodRange(a.mes);
    if(!pr) return {ok:false, motivo:"mês inválido"};
    const ok = window.FluxoUI && FluxoUI.report(pr.mm);
    return {ok:!!ok, mes:pr.label, aviso: ok ? "PDF entregue no chat" : "não consegui gerar agora"};
  },

  definir_orcamento(a){
    const v = toCents(a.valor);
    if(!v || v <= 0) return {ok:false, motivo:"valor inválido"};
    state.budgets.monthly = v; save(); render();
    return {ok:true, orcamento:money(v),
      receipt:{ic:"target", title:"Orçamento definido", rows:[["Teto mensal de gastos", money(v)]]}};
  },

  definir_meta(a){
    const v = toCents(a.valor);
    if(!v || v <= 0) return {ok:false, motivo:"valor inválido"};
    const label = a.tipo === "patrimonio" ? "Meta de patrimônio" : "Meta de economia mensal";
    if(a.tipo === "patrimonio") state.goals.netWorth = v; else state.goals.saveMonthly = v;
    save(); render();
    return {ok:true, meta:money(v),
      receipt:{ic:"target", title:"Meta definida", rows:[[label, money(v)]]}};
  },

  navegar(a){
    const rotas = {dashboard:"dashboard", lancamentos:"lancamentos", contas:"contas", receitas:"receitas",
      cartoes:"cartoes", carteiras:"carteiras", planejamento:"planejamento", relatorios:"relatorios", configuracoes:"configuracoes"};
    const r = rotas[a.pagina];
    if(!r) return {ok:false, motivo:"página desconhecida"};
    location.hash = "#/" + r;
    return {ok:true, pagina:a.pagina};
  },

  mudar_tema(a){
    const dark = a.tema === "escuro";
    state.settings.theme = dark ? "dark" : "light";
    applyTheme(); save();
    return {ok:true, tema: dark ? "escuro" : "claro"};
  },

  desfazer(){
    const msg = (window.FluxoUI && FluxoUI.undoLast()) || "não há ação recente para desfazer";
    return {ok:true, resultado:msg};
  },

  salvar_memoria(a){
    const M = window.FluxoMemoria;
    if(!M) return {ok:false, motivo:"módulo de memória indisponível"};
    const v = M.valid(String(a.fato || ""));
    if(!v.ok) return {ok:false, motivo:"não parece um fato útil (" + v.reason + ")"};
    const dup = M.duplicateOf(v.text);
    if(dup) return {ok:true, status:"duplicado", fato:dup.text, aviso:"isso já está na memória"};
    const conf = M.conflictFor(v.text);
    if(conf) return {ok:true, status:"conflito", existente:conf.fact.text, novo:v.text,
      aviso:"conflita com um fato existente — pergunte ao usuário se deve atualizar; se ele confirmar, use editar_memoria"};
    const r = M.add(v.text);
    return r.ok ? {ok:true, status:"salvo", fato:r.fact.text, categoria:(M.KIND_LABEL[r.fact.kind]||r.fact.kind)}
                : {ok:false, motivo:r.reason};
  },

  buscar_memoria(a){
    const M = window.FluxoMemoria;
    if(!M) return {ok:false, motivo:"módulo de memória indisponível"};
    if(a.termo){
      const hits = M.find(String(a.termo));
      return {ok:true, fatos:hits.map(h=>h.fact.text), quantidade:hits.length};
    }
    const facts = M.all();
    return {ok:true, fatos:facts.slice(-15).map(f=>f.text), quantidade:facts.length};
  },

  editar_memoria(a){
    const M = window.FluxoMemoria;
    if(!M) return {ok:false, motivo:"módulo de memória indisponível"};
    const hits = M.find(String(a.texto_antigo || ""));
    if(!hits.length) return {ok:false, motivo:"não encontrei esse fato", tenho:M.all().slice(-10).map(f=>f.text)};
    if(hits.length > 1 && hits[0].score < hits[1].score + 2)
      return {ok:false, motivo:"encontrei vários parecidos — peça ao usuário para especificar", candidatos:hits.slice(0,3).map(h=>h.fact.text)};
    const antes = hits[0].fact.text;
    const r = M.update(hits[0].fact.id, String(a.texto_novo || ""));
    return r.ok ? {ok:true, antes, depois:r.fact.text} : {ok:false, motivo:r.reason};
  },

  apagar_memoria(a){
    const M = window.FluxoMemoria;
    if(!M) return {ok:false, motivo:"módulo de memória indisponível"};
    const hits = M.find(String(a.termo || ""));
    if(!hits.length) return {ok:false, motivo:"não encontrei nada parecido", tenho:M.all().slice(-10).map(f=>f.text)};
    if(hits.length > 1 && hits[0].score < hits[1].score + 3)
      return {ok:false, status:"ambiguo", motivo:"há vários fatos parecidos — confirme com o usuário qual apagar", candidatos:hits.slice(0,3).map(h=>h.fact.text)};
    const f = M.remove(hits[0].fact.id);
    return {ok:true, apagado:f ? f.text : a.termo};
  }
};

/* ---------- 6. System Prompt (persona + memória + contexto + conhecimento) ---------- */
function buildSystemPrompt(userMsg){
  const M = window.FluxoMemoria;
  const now = new Date();
  const DIAS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

  /* contexto financeiro real */
  let ctx = {};
  try{
    const [cs, ce] = cycleRange(now);
    const desp = state.transactions.filter(x => x.type === "despesa" && x.date >= cs && x.date <= ce).reduce((s,x)=>s+x.value,0);
    const pend = state.transactions.filter(x => x.type === "despesa" && x.status !== "pago");
    ctx = {
      ciclo: dISO(cs) + " a " + dISO(ce),
      saldo: money(netWorth()),
      gastosCiclo: money(desp),
      orcamento: state.budgets.monthly ? money(state.budgets.monthly) : "não definido",
      contas: state.accounts.map(a => a.name + ": " + money(accountBalance(a))).join(" · ") || "nenhuma",
      cartoes: state.cards.map(c => c.name + " (limite " + money(c.limit) + ")").join(" · ") || "nenhum",
      pendentes: pend.length ? pend.length + " em aberto (" + money(pend.reduce((s,t)=>s+t.value,0)) + ")" : "nenhuma",
      catsDespesa: categoryNames("despesa").join(", "),
      catsReceita: categoryNames("receita").join(", ")
    };
  }catch(e){}

  const facts = M ? M.all().slice(-25) : [];

  return [
"Você é o **Fluxo**, assistente financeiro pessoal do app Fluxo (organizador de finanças em português, os dados ficam salvos somente no navegador do usuário).",

"## PERSONA",
"- Mentor financeiro: amigável, direto, paciente e EDUCACIONAL — explique o porquê das sugestões.",
"- Responda SEMPRE em português do Brasil, em textos curtos. Use **negrito** nos números-chave e bullets “- ” para listas/passos.",
"- Você EXECUTA ações de verdade (via ferramentas), CONSULTA os dados reais do app, ENSINA as funcionalidades e PLANEJA gastos com o usuário.",

"## COMO AGIR",
"- Para executar qualquer coisa no app, use as ferramentas — nunca diga que fez algo sem chamar a ferramenta.",
"- Pedidos compostos (ex.: criar 3 contas de uma vez): emita TODAS as chamadas de ferramenta NA MESMA mensagem (em paralelo), não uma de cada vez.",
"- Se faltar informação essencial (valor, conta, nome), faça UMA pergunta objetiva em vez de adivinhar.",
"- NUNCA invente dados financeiros: consulte antes de afirmar saldos, gastos ou lançamentos.",
"- Valores estão em REAIS; datas use aaaa-mm-dd nas ferramentas e dd/mm nas respostas.",
"- Depois de executar, confirme de forma natural o que foi feito (os cartões de confirmação aparecem sozinhos).",
"- Se algo falhar (ferramenta retorna erro), explique com bom humor e sugira o próximo passo.",

"## MEMÓRIA (autônoma)",
"- Sempre que o usuário revelar um fato duradouro — salário/renda, dia de pagamento, aluguel, preferências (“odeio fast food”), objetivos, nome — chame salvar_memoria, MESMO que ele não peça para lembrar.",
"- Não salve: conversa fiada (“oi”, “obrigado”), perguntas, valores de compras pontuais.",
"- Se salvar_memoria retornar “conflito”, pergunte ao usuário antes de atualizar (ex.: mudou de emprego?) e, se ele confirmar, use editar_memoria.",
"- “lembre-se que X” → salvar_memoria(X) e confirme: “Anotado! Vou lembrar que X”.",
"- “edite a memória” → editar_memoria; “esqueça X” → confirme com o usuário e use apagar_memoria.",
"- Use a memória de forma proativa: se ele disse que odeia fast food e pedir sugestão de economia, mencione isso.",

"## ENSINO DO APP (quando o usuário perguntar “como…”, ENSINE — não execute)",
"- **Recuperar senha**: tela de bloqueio → “Esqueci minha senha” → selecionar o arquivo fluxo-chave-recuperacao.json (baixado quando a senha foi criada) → definir nova senha. Sem a chave e sem a senha, só resta o reset total (apaga TUDO — digite APAGAR).",
"- **Senha/bloqueio**: Configurações → Segurança e bloqueio → criar/trocar senha (mín. 4 caracteres) → baixa nova chave de recuperação. Protege apenas o acesso neste navegador.",
"- **Lançamentos**: botão + (canto inferior direito) ou Lançamentos → Novo; despesa/receita, valor, categoria, conta/cartão, forma, data; há parcelamento e recorrência.",
"- **Contas e cartões**: Contas e carteiras → Nova conta / Cartões de crédito → Novo cartão (limite + dias de fechamento/vencimento). Transferir move dinheiro entre contas (não muda o patrimônio).",
"- **Faturas**: compras no cartão ficam pendentes; quitar via “pagar fatura” (por mim ou na página do cartão).",
"- **Orçamento e metas**: Planejamento → teto mensal, limite por categoria e metas (economia/patrimônio).",
"- **Relatórios**: página Relatórios ou peça-me “relatório do mês em PDF”.",
"- **Backup**: Configurações → Backup dos dados → exportar .json (tudo) ou .csv (lançamentos); importar restaura. Único jeito de levar os dados a outro dispositivo.",
"- **Instalar/offline**: ícone de instalação no navegador (ou menu → Adicionar à tela inicial); depois funciona offline.",
"- **Tema**: ícone lua/sol na barra superior, ou me peça “modo escuro”.",
"- **Apagar tudo**: Configurações → seção de risco → digitar APAGAR.",
"- Se perguntarem algo que não existe no app, seja honesto: “Ainda não aprendi isso, mas posso te mostrar onde encontrar no site.”",

"## SOBRE VOCÊ (se perguntarem)",
"- Você é um agente de IA (modelo GPT-OSS via Pollinations, gratuito e sem cadastro).",
"- Os dados financeiros e a memória ficam SOMENTE no navegador do usuário; apenas o texto da conversa e o contexto necessário são enviados ao serviço de IA para você pensar.",

"## CONTEXTO ATUAL DO APP",
"- Hoje: " + DIAS[now.getDay()] + ", " + now.getDate() + " de " + MESES[now.getMonth()] + " de " + now.getFullYear(),
"- Ciclo atual: " + (ctx.ciclo || "—"),
"- Saldo total hoje: " + (ctx.saldo || "—") + " · Gastos no ciclo: " + (ctx.gastosCiclo || "—") + " · Orçamento: " + (ctx.orcamento || "—"),
"- Contas: " + (ctx.contas || "—"),
"- Cartões: " + (ctx.cartoes || "—"),
"- Contas em aberto: " + (ctx.pendentes || "—"),
"- Categorias de despesa disponíveis: " + (ctx.catsDespesa || "—"),
"- Categorias de receita disponíveis: " + (ctx.catsReceita || "—"),

"## MEMÓRIA DO USUÁRIO (fatos que você já sabe sobre ele)",
facts.length ? facts.map(f => "- [" + ((M.KIND_LABEL[f.kind]) || f.kind) + "] " + f.text).join("\n") : "- (vazia — nada memorizado ainda; aproveite para aprender sobre o usuário)",

"## MENSAGEM ATUAL DO USUÁRIO",
"“" + (userMsg || "") + "”"
  ].join("\n\n");
}

/* ---------- 7. O loop do agente ---------- */
const MAX_STEPS = 6;   /* limite de rodadas de ferramentas por mensagem */

/**
 * Executa um turno completo: mensagem → (LLM ⇄ ferramentas)* → resposta final.
 * @param {string} userText   a mensagem do usuário
 * @param {object} opts       {history:[{role,content}], onStatus:fn(string)}
 * @returns {Promise<{text:string, cards:object[]}>}
 */
async function turn(userText, opts){
  opts = opts || {};
  const cards = [];
  const messages = [
    {role:"system", content: buildSystemPrompt(userText)},
    ...(opts.history || []).slice(-16),
    {role:"user", content: String(userText || "").slice(0, 500)}
  ];

  for(let step = 0; step < MAX_STEPS; step++){
    const resp = await llmChat(messages, TOOL_DEFS, seg => {
      opts.onStatus && opts.onStatus("serviço gratuito: aguardando " + seg + "s para a próxima etapa");
    });
    const m = resp && resp.choices && resp.choices[0] && resp.choices[0].message;
    if(!m) throw new Error("resposta vazia do modelo");

    const calls = (m.tool_calls || []).map(c => ({
      id: c.id || ("call_" + step + "_" + Math.random().toString(36).slice(2,8)),
      name: cleanToolName(c.function && c.function.name),
      args: parseArgs(c.function && c.function.arguments)
    })).filter(c => c.name);

    /* sem ferramentas → resposta final */
    if(!calls.length){
      const text = String(m.content || "").trim();
      if(text) return {text, cards};
      /* conteúdo vazio sem tool calls (raro): força o modelo a responder */
      messages.push({role:"assistant", content:"(vazio)"});
      messages.push({role:"user", content:"Responda agora, em português, de forma breve."});
      continue;
    }

    /* registra a mensagem do assistente com as chamadas */
    messages.push({role:"assistant", content: m.content || null,
      tool_calls: calls.map(c => ({id:c.id, type:"function", function:{name:c.name, arguments:JSON.stringify(c.args)}}))});

    /* executa cada chamada (em ordem) e devolve o resultado ao modelo */
    for(const c of calls){
      opts.onStatus && opts.onStatus(TOOL_LABEL[c.name] || c.name);
      let out;
      const fn = TOOL_RUN[c.name];
      if(!fn) out = {ok:false, motivo:'ferramenta desconhecida: "' + c.name + '" — use apenas as ferramentas definidas'};
      else{
        try{ out = fn(c.args); }
        catch(e){ out = {ok:false, motivo:"erro ao executar: " + (e && e.message ? e.message : e)}; }
      }
      if(out && out.receipt){ cards.push(out.receipt); delete out.receipt; }
      try{ messages.push({role:"tool", tool_call_id:c.id, content: JSON.stringify(out).slice(0, 4000)}); }
      catch(e){ messages.push({role:"tool", tool_call_id:c.id, content:'{"ok":false,"motivo":"erro interno"}'}); }
    }
  }

  /* estourou o limite de rodadas: resume o que conseguiu fazer */
  const feitas = cards.length
    ? "Consegui executar " + cards.length + " ação(ões) — os cartões aí em cima mostram os detalhes. Quer que eu continue?"
    : "Fiz várias tentativas, mas a resposta ficou longa demais. Pode repetir o pedido, talvez em partes?";
  return {text: feitas, cards};
}

/* ---------- 8. API pública ---------- */
window.FluxoAgente = { turn, llmChat, buildSystemPrompt, TOOL_DEFS, TOOL_RUN };
})();
