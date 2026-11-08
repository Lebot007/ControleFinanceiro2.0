/* ============================================================
   Fluxo — Agente Autônomo (o "cérebro" do assistente)
   ------------------------------------------------------------
   Um AGENTE DE IA real com Tool Calling, rodando no navegador:

     1. O usuário escreve QUALQUER COISA em linguagem natural.
     2. Uma chamada ao LLM gratuito e sem chave (Pollinations,
        GPT-OSS 20B, endpoint compatível com OpenAI, CORS aberto)
        decide o que fazer — o entendimento é 100% do modelo.
        Mensagens com VÁRIOS itens geram VÁRIAS chamadas de
        ferramenta em paralelo (multitarefa numa tacada só).
     3. As ferramentas (criar contas, lançar transações, consultar
        dados, memorizar...) executam AQUI, no navegador.
     4. Se TUDO deu certo: resposta final montada NA HORA, com a
        voz do Fluxo (síntese local instantânea, sem 2ª chamada).
        Se ALGO falhou: o modelo recebe os resultados e ganha até
        2 rodadas para se corrigir sozinho (agente de verdade) —
        trocar o nome da conta, escolher outra opção ou fazer a
        pergunta certa ao usuário.

   VELOCIDADE (regra de ouro): o usuário nunca espera de graça.
   - Caminho feliz = 1 geração do serviço por mensagem.
   - HTTP 402 (limite gratuito: ~1 geração/45s por IP): fila silenciosa
     que entrega sozinha quando a janela abre — sem contagem de segundos
     na tela; se a fila andar mal, resposta amigável imediata.
   - Timeout curto por tentativa + retentativas ágeis.

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
const TIMEOUT_MS  = 30000;              /* por tentativa — falha rápido, nunca trava o usuário */
const MAX_RETRIES = 2;                  /* retentativas por chamada (rede/5xx/timeout) */

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
 * RÁPIDA E RESILIENTE:
 * - HTTP 402 (limite gratuito: ~1 geração/45s por IP): entra numa FILA
 *   silenciosa — espera o tempo do Retry-After (com teto de paciência)
 *   e entrega sozinho quando a janela abre. Nada de contagem de
 *   segundos na tela: só frases amigáveis do indicador de digitação.
 * - 429/5xx: retentativas ágeis. Timeout curto por tentativa.
 * @returns {object} corpo da resposta ({choices:[{message}]})
 */
const PATIENCE_MS = 55000;   /* espera máxima total na fila gratuita por mensagem */

async function llmChat(messages, tools, onStatus){
  let retries = 0, queued = 0;
  const t0 = Date.now();
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
          max_tokens: 800,
          temperature: 0.4,            /* decisões de ferramenta mais determinísticas */
          reasoning_effort: "medium"   /* raciocínio completo: entende multitarefas */
        })
      });
      clearTimeout(tm);

      /* limite gratuito atingido (~1 geração/45s por IP): fila silenciosa */
      if(res.status === 402){
        const ra = parseInt(res.headers.get("retry-after") || "0", 10) || 0;
        const waitMs = Math.min(Math.max(ra * 1000, 8000), 50000);
        if(queued >= 2 || Date.now() - t0 + waitMs > PATIENCE_MS)
          throw new Error("serviço gratuito ocupado");
        queued++;
        if(onStatus) onStatus("fila do serviço gratuito — respondendo já…");
        await sleep(waitMs);
        continue;
      }
      if(res.status === 429 || res.status >= 500){       /* lotado / instável → tenta de novo */
        if(retries >= MAX_RETRIES) throw new Error("HTTP " + res.status);
        retries++;
        await sleep(1500 * retries);
        continue;
      }
      if(!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    }catch(e){
      clearTimeout(tm);
      if(e && e.name === "AbortError"){
        if(retries >= MAX_RETRIES) throw new Error("tempo esgotado");
        retries++; await sleep(1200); continue;
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
    description:"Cria uma conta ou carteira no app (banco, poupança, dinheiro, carteira digital como InfinitePay/PicPay/Mercado Pago, investimentos). Antes de criar, confira no contexto se a conta JÁ EXISTE — não duplique. Pedido com várias contas = uma chamada por conta, todas na mesma mensagem.",
    parameters:{type:"object", properties:{
      nome:{type:"string", description:"Nome da conta (ex.: Inter, Nubank, InfinitePay)"},
      saldo_inicial:{type:"number", description:"Saldo inicial em reais (ex.: 1905.50). Padrão 0."},
      tipo:{type:"string", enum:["corrente","poupanca","dinheiro","digital","investimento"], description:"Tipo da conta. Carteiras de aplicativo = digital. Padrão corrente."},
      forcar:{type:"boolean", description:"true para criar mesmo existindo conta parecida — use SOMENTE se o usuário confirmar que quer a duplicata."}
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
    description:"Registra UMA despesa ou receita. Vários lançamentos na mesma mensagem = uma chamada por lançamento, todas em paralelo. Se o usuário não disser a conta/cartão, use a conta única ou pergunte antes.",
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
  }},
  {type:"function", function:{
    name:"executar_lote",
    description:"Executa VÁRIAS ações de uma vez, numa chamada só. USE SEMPRE que o pedido tiver 2 ou mais itens (ex.: criar 2 contas, lançar 3 despesas, criar conta e já lançar um valor nela). Cada ação segue o formato da ferramenta original. Pedido com 1 item só → use a ferramenta direto, sem lote.",
    parameters:{type:"object", properties:{
      acoes:{type:"array", description:"Ações a executar, em ordem", items:{type:"object", properties:{
        ferramenta:{type:"string", enum:["criar_conta","criar_cartao","lancar_transacao","transferir","pagar_fatura","consultar_saldo","consultar_resumo","consultar_transacoes","definir_orcamento","definir_meta","salvar_memoria","editar_memoria","apagar_memoria"],
          description:"Nome da ferramenta a executar"},
        args:{type:"object", description:"Argumentos da ferramenta (mesmos campos da ferramenta original)"}
      }, required:["ferramenta","args"]}}
    }, required:["acoes"]}
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
  editar_memoria:"atualizar memória", apagar_memoria:"apagar da memória",
  executar_lote:"executar várias ações"
};

const TOOL_RUN = {

  criar_conta(a){
    if(!a.nome) return {ok:false, motivo:"faltou o nome"};
    /* guarda anti-duplicata: conta parecida já existe → devolve ao
       modelo, que decide (usar a existente, perguntar ou confirmar).
       Matching ESTRITO (exato ou prefixo ≥3 letras) para não bloquear
       nomes legítimos — ex.: “InfinitePay” NÃO é duplicata de “Inter”. */
    if(a.forcar !== true){
      const q = NORM(String(a.nome).slice(0,40));
      const dup = (state.accounts || []).find(a2 => {
        const n = NORM(a2.name), i = NORM(a2.institution);
        if(q && (q === n || (i && q === i))) return true;
        return !!(n.length >= 3 && q.length >= 3 && (n.startsWith(q) || q.startsWith(n)));
      });
      if(dup) return {ok:false, motivo:"já existe a conta “" + dup.name + "”",
        dica:"não duplique. Se for lançar um valor nela, use lancar_transacao; se o usuário confirmar que quer outra conta com nome parecido, reforce com forcar:true",
        disponiveis:accountNames()};
    }
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
  },

  /* LOTE: várias ações numa chamada só. O serviço gratuito devolve no
     máximo 1 tool call por geração — então a multitarefa acontece com o
     modelo montando uma LISTA de ações, e tudo roda aqui de uma vez. */
  executar_lote(a){
    const list = Array.isArray(a.acoes) ? a.acoes : (Array.isArray(a) ? a : null);
    if(!list || !list.length) return {ok:false, motivo:"envie acoes: [{ferramenta, args}, …]"};
    if(list.length > 12) return {ok:false, motivo:"máximo de 12 ações por lote"};
    const seen = new Set();
    const resultados = [], receipts = [];
    for(const it of list){
      const nome = cleanToolName(it && it.ferramenta);
      const args = (it && it.args && typeof it.args === "object" && !Array.isArray(it.args)) ? it.args : parseArgs(it && it.args);
      const fn = TOOL_RUN[nome];
      if(!fn || nome === "executar_lote"){
        resultados.push({ferramenta:String(nome || "?"), ok:false,
          motivo:'ferramenta inválida no lote: "' + nome + '" — use as ferramentas definidas'});
        continue;
      }
      const key = nome + "|" + JSON.stringify(args);
      if(seen.has(key)){
        resultados.push({ferramenta:nome, ok:false, motivo:"ação repetida no lote — não duplico"});
        continue;
      }
      seen.add(key);
      let out;
      try{ out = fn(args); }
      catch(e){ out = {ok:false, motivo:"erro ao executar: " + (e && e.message ? e.message : e)}; }
      if(out && out.receipt){ receipts.push(out.receipt); delete out.receipt; }
      resultados.push({ferramenta:nome, ...out});
    }
    const ok = resultados.every(r => r.ok !== false);
    return {ok, acoes:resultadoCompacto(resultados), receipts};
  }
};

/* versão enxuta dos resultados do lote para o modelo (sem campos visuais) */
function resultadoCompacto(rs){
  return rs.map(r => {
    const c = {...r};
    delete c.receipt; delete c.receipts;
    return c;
  });
}

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

  const facts = M ? M.all().slice(-12) : [];

  return [
"Você é o **Fluxo**, assistente financeiro pessoal do app Fluxo (organizador de finanças em português; os dados ficam salvos somente no navegador do usuário).",

"## ESTILO",
"- Português do Brasil, amigável e DIRETO. Mentor paciente: quando ensinar, explique o porquê em 1 frase.",
"- Respostas CURTAS: no máximo 3 frases ou 5 bullets curtos. Use **negrito** nos números-chave e listas com “- ”. Obs.: ao executar ações, o app já mostra cartões de confirmação automáticos — não repita todos os detalhes.",

"## COMO PENSAR (regras de inteligência)",
"- MULTITAREFA: pedido com 2 ou mais itens → use **executar_lote** com uma ação por item (mesmos argumentos da ferramenta original). Ex.: “Inter com 1905,00 e InfinitePay com 146,15” → executar_lote com 2 ações de criar_conta. Pedido de 1 item → use a ferramenta direto.",
"- NUNCA invente nomes, bancos, valores ou ações que o usuário NÃO disse. Não soube o nome/banco → pergunte. Não está claro se um valor é saldo de conta ou gasto/receita → PERGUNTE antes de agir. Chutar é proibido.",
"- Continuações (“e os outros?”, “sim”, “o resto”, “também”) falam da mensagem ANTERIOR: releia o histórico, faça SÓ o que ainda falta. NUNCA repita ação que o histórico mostra como já feita — se já está tudo feito, diga isso e confirme.",
"- Antes de criar conta/cartão, confira no CONTEXTO se já existe uma parecida: existe → use-a ou pergunte; não duplique.",
"- Carteiras digitais e bancos brasileiros (Nubank, InfinitePay, PicPay, Mercado Pago, Inter, Caixa, Itaú, Banco do Brasil…) são CONTAS; carteiras de aplicativo = tipo “digital”.",
"- Números em português: “1905,00” e “1.905,00” são 1905.00 reais (vírgula = casas decimais).",

"## COMO AGIR",
"- Para executar qualquer coisa no app, use as ferramentas — nunca diga que fez algo sem chamar a ferramenta.",
"- Se faltar informação essencial (valor, conta, nome), faça UMA pergunta objetiva em vez de adivinhar.",
"- NUNCA invente dados financeiros: consulte antes de afirmar saldos, gastos ou lançamentos.",
"- Valores em REAIS; datas aaaa-mm-dd nas ferramentas e dd/mm nas respostas.",
"- Se algo falhar, explique com bom humor e sugira o próximo passo.",

"## MEMÓRIA (autônoma)",
"- Fato duradouro (salário, dia de pagamento, aluguel, preferências, objetivos, nome) → chame salvar_memoria, MESMO sem pedido.",
"- Não salve conversa fiada, perguntas nem compras pontuais.",
"- Retornou “conflito” → pergunte ao usuário; se ele confirmar, use editar_memoria. “lembre-se que X” → salvar_memoria(X). “esqueça X” → confirme e use apagar_memoria.",
"- Use a memória de forma proativa: se ele disse que odeia fast food e pedir sugestão de economia, mencione isso.",

"## ENSINO DO APP (se perguntarem “como…”, ENSINE — não execute)",
"- **Recuperar senha**: tela de bloqueio → “Esqueci minha senha” → selecionar o arquivo fluxo-chave-recuperacao.json (baixado ao criar a senha). Sem chave e sem senha, só reset total (digitar APAGAR). Criar/trocar senha: Configurações → Segurança e bloqueio.",
"- **Lançamentos**: botão + (canto inferior direito) ou Lançamentos → Novo; despesa/receita, parcelamento e recorrência.",
"- **Contas e cartões**: Contas e carteiras → Nova conta / Novo cartão (limite, dias de fechamento/vencimento). Transferir move dinheiro entre contas.",
"- **Faturas**: compras no cartão ficam pendentes; quitar na página do cartão ou pedindo “pagar fatura” a mim.",
"- **Orçamento e metas**: Planejamento → teto mensal, limite por categoria, metas.",
"- **Relatórios**: página Relatórios ou me peça “relatório do mês em PDF”.",
"- **Backup**: Configurações → exportar .json (tudo) ou .csv (lançamentos); importar restaura — único jeito de levar os dados a outro dispositivo.",
"- **Instalar/offline**: ícone de instalação do navegador ou menu → Adicionar à tela inicial.",
"- **Tema**: ícone lua/sol na barra superior. **Apagar tudo**: Configurações → digitar APAGAR.",
"- Não existe no app? Seja honesto e ofereça o caminho mais parecido.",

"## SOBRE VOCÊ",
"- Agente de IA (GPT-OSS via Pollinations, gratuito e sem cadastro). Dados financeiros e memória ficam SOMENTE no navegador; só o texto da conversa e o contexto necessário vão ao serviço de IA.",

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

/* ---------- 7. Síntese local (resposta instantânea pós-ferramenta) ----------
   Depois que as ferramentas rodam, a resposta final é montada AQUI,
   na hora — sem gastar mais nenhuma chamada do serviço de IA (era
   isso que deixava o chat lento e batia na cota a cada mensagem).
   Os cartões de confirmação já mostram os detalhes; o texto só
   confirma com a voz do Fluxo. Zero regras de ENTENDIMENTO aqui:
   quem decidiu o que fazer foi o modelo; isto é só apresentação. */
function synthTool(name, out){
  if(name !== "executar_lote" && (!out || out.ok === false)){
    let s = "⚠️ Não deu certo: " + ((out && out.motivo) || "algo falhou") + ".";
    const d = out && (out.disponiveis || out.candidatos);
    if(d && d.length) s += "\nOpções que encontrei: **" + d.join("** · **") + "**.";
    else if(out && out.tenho && out.tenho.length) s += "\nO que tenho guardado: " + out.tenho.slice(0,5).join(" · ");
    return s;
  }
  switch(name){
    case "criar_conta":
      return "✅ Conta **" + out.conta + "** criada com saldo **" + out.saldo + "**.";
    case "criar_cartao":
      return "✅ Cartão **" + out.cartao + "** cadastrado — limite **" + out.limite + "**.";
    case "lancar_transacao":
      return "✅ " + (out.tipo === "receita" ? "Receita" : "Despesa") + " **" + out.lancamento + "** de **" + out.valor + "** registrada.";
    case "transferir":
      return "✅ Transferência de **" + out.valor + "** de **" + out.de + "** para **" + out.para + "** registrada.";
    case "pagar_fatura":
      return out.total
        ? "✅ Fatura do **" + out.cartao + "** quitada: **" + out.total + "** (" + out.parcelas + " compra" + (out.parcelas > 1 ? "s" : "") + "), debitado de **" + out.conta + "**."
        : "👍 A fatura do **" + (out.cartao || "cartão") + "** já está em dia — nada a pagar.";
    case "consultar_saldo": {
      let s = "💰 **Saldo total: " + out.saldo_total + "**";
      (out.contas || []).forEach(c => { s += "\n- " + c.nome + ": **" + c.saldo + "**"; });
      (out.cartoes || []).forEach(c => { s += "\n- " + c.nome + " · fatura **" + c.fatura_atual + "** (disponível " + c.disponivel + ")"; });
      return s;
    }
    case "consultar_resumo": {
      let s = "📊 **" + out.periodo + "**\n- Receitas: **" + out.receitas + "**\n- Despesas: **" + out.despesas + "**\n- Resultado: **" + out.resultado + "**\n- Saldo hoje: **" + out.saldo_hoje + "**";
      if(out.maiores_categorias && out.maiores_categorias.length)
        s += "\n\nOnde mais saiu dinheiro:\n- " + out.maiores_categorias.join("\n- ");
      if(out.pendentes && out.pendentes.quantidade)
        s += "\n\nEm aberto: **" + out.pendentes.quantidade + " conta(s), " + out.pendentes.total + "**.";
      return s;
    }
    case "consultar_transacoes": {
      if(!out.quantidade) return "Procurei e não achei nada com isso — quer tentar outra palavra?";
      let s = "Achei **" + out.quantidade + " lançamento(s)** (" + out.periodo + "), total **" + out.total + "**:";
      (out.lancamentos || []).forEach(t => {
        s += "\n- " + t.data + " · " + t.descricao + " — **" + t.valor + "** (" + t.categoria + ")";
      });
      if(out.truncado) s += "\n\n+ " + out.truncado + ".";
      return s;
    }
    case "gerar_relatorio_pdf":
      return out.ok ? "📄 Relatório de **" + out.mes + "** pronto — o download já começou." : "⚠️ Não consegui gerar o PDF agora. Tente pela página **Relatórios**?";
    case "definir_orcamento":
      return "✅ Orçamento mensal definido: **" + out.orcamento + "**.";
    case "definir_meta":
      return "✅ Meta definida: **" + out.meta + "**.";
    case "navegar":
      return "👀 Já te levei para **" + out.pagina + "**.";
    case "mudar_tema":
      return "🎨 Tema **" + out.tema + "** ativado.";
    case "desfazer":
      return out.resultado || "Pronto, ação desfeita.";
    case "salvar_memoria":
      if(out.status === "duplicado") return "Isso já estava na minha memória 😄";
      if(out.status === "conflito")
        return "Hmm, isso conflita com o que eu sabia: **" + out.existente + "**.\nQuer que eu atualize para: **" + out.novo + "**?";
      return "🧠 Anotado! Vou lembrar que **" + out.fato + "**.";
    case "buscar_memoria": {
      if(!out.fatos || !out.fatos.length) return "Ainda não guardei nada sobre isso.";
      return "Isto é o que eu sei sobre você:\n- " + out.fatos.join("\n- ");
    }
    case "editar_memoria":
      return "✅ Memória atualizada — agora sei: **" + out.depois + "**.";
    case "apagar_memoria":
      return "🗑️ Feito — apaguei **" + out.apagado + "** da memória.";
    case "executar_lote": {
      /* uma linha por ação do lote (os cartões mostram os detalhes) */
      const partes = (out.acoes || []).map(r => {
        const s = synthTool(r.ferramenta, r);
        return s ? s.split("\n")[0] : null;   /* só a 1ª linha: o resto está nos cartões */
      }).filter(Boolean);
      return partes.length ? partes.join("\n") : "✅ Feito!";
    }
    default:
      return "✅ Feito!";
  }
}

/* ---------- 8. O loop do agente ---------- */
const MAX_STEPS = 3;   /* 1 decisão + até 2 rodadas de auto-correção (só se algo falhar) */

/**
 * Executa um turno completo: mensagem → LLM → ferramentas → resposta.
 *
 * CAMINHO FELIZ (o comum): 1 chamada ao LLM decide tudo, as ferramentas
 * rodam e a resposta sai NA HORA (texto do modelo ou síntese local).
 *
 * AUTO-CORREÇÃO: se ALGUMA ferramenta falhou, os resultados voltam para
 * o modelo, que ganha até 2 rodadas para se corrigir — ajustar o nome da
 * conta, escolher uma opção válida ou fazer a pergunta certa ao usuário.
 * Rodadas extras só acontecem quando são necessárias: nada de espera à toa.
 *
 * @param {string} userText   a mensagem do usuário
 * @param {object} opts       {history:[{role,content}], onStatus:fn(string)}
 * @returns {Promise<{text:string, cards:object[]}>}
 */
async function turn(userText, opts){
  opts = opts || {};
  const cards = [];
  const cur   = String(userText || "").slice(0, 500);

  /* o histórico enviado pela UI já termina com a própria mensagem do
     usuário (ela é adicionada antes de chamar o agente) — não duplica */
  const hist = (opts.history || []).slice(-8);
  const messages = [{role:"system", content: buildSystemPrompt(cur)}, ...hist];
  const lastMsg = messages[messages.length - 1];
  if(!lastMsg || lastMsg.role !== "user" || String(lastMsg.content) !== cur)
    messages.push({role:"user", content: cur});

  const done = new Set();   /* (nome+args) já executados NESTE turno — corta repetição cega */

  for(let step = 0; step < MAX_STEPS; step++){
    const resp = await llmChat(messages, TOOL_DEFS, s => {
      opts.onStatus && opts.onStatus(s);
    });
    const m = resp && resp.choices && resp.choices[0] && resp.choices[0].message;
    if(!m) throw new Error("resposta vazia do modelo");

    const calls = (m.tool_calls || []).map(c => ({
      id: c.id || ("call_" + step + "_" + Math.random().toString(36).slice(2,8)),
      name: cleanToolName(c.function && c.function.name),
      args: parseArgs(c.function && c.function.arguments)
    })).filter(c => c.name);

    /* sem ferramentas → o próprio modelo já respondeu ao usuário */
    if(!calls.length){
      const text = String(m.content || "").trim();
      if(text) return {text, cards};
      /* conteúdo vazio sem tool calls (raro): força o modelo a responder */
      messages.push({role:"assistant", content:"(vazio)"});
      messages.push({role:"user", content:"Responda agora, em português, de forma breve."});
      continue;
    }

    /* executa TODAS as ferramentas chamadas (o modelo pode paralelizar) */
    const results = [];
    let anyFailed = false;
    for(const c of calls){
      opts.onStatus && opts.onStatus(TOOL_LABEL[c.name] || c.name);
      const key = c.name + "|" + JSON.stringify(c.args);
      let out;
      if(done.has(key)){
        out = {ok:false, motivo:"essa ação acabou de ser executada neste turno — não repita; confira o histórico e faça só o que falta"};
      }else{
        const fn = TOOL_RUN[c.name];
        if(!fn) out = {ok:false, motivo:'ferramenta desconhecida: "' + c.name + '" — use apenas as ferramentas definidas'};
        else{
          try{ out = fn(c.args); }
          catch(e){ out = {ok:false, motivo:"erro ao executar: " + (e && e.message ? e.message : e)}; }
        }
        done.add(key);
      }
      if(out && out.ok === false) anyFailed = true;
      if(out && out.receipt){ cards.push(out.receipt); delete out.receipt; }
      if(out && Array.isArray(out.receipts)){ cards.push(...out.receipts); delete out.receipts; }
      results.push({call:c, out});
    }

    const pre   = String(m.content || "").trim();
    const synth = results.map(r => synthTool(r.call.name, r.out)).join("\n\n");

    /* TUDO certo → resposta IMEDIATA: o texto que o modelo escreveu junto
       das chamadas ou a síntese local. Zero chamadas extras, zero espera. */
    if(!anyFailed){
      return {text: pre || synth, cards};
    }

    /* ALGO FALHOU → o modelo vê os resultados e se corrige (ou pergunta).
       Isso é o que faz o agente aprender com o erro DENTRO do turno. */
    if(step < MAX_STEPS - 1){
      messages.push({
        role:"assistant", content: m.content || null,
        tool_calls: calls.map(c => ({id:c.id, type:"function", function:{name:c.name, arguments:JSON.stringify(c.args)}}))
      });
      results.forEach(r => messages.push({
        role:"tool", tool_call_id: r.call.id,
        content: JSON.stringify(r.out).slice(0, 1400)
      }));
      opts.onStatus && opts.onStatus("ajustando os detalhes…");
      continue;
    }

    /* última rodada e ainda falhou: entrega o que deu, com honestidade */
    return {text: (pre ? pre + "\n\n" : "") + synth, cards};
  }

  /* estourou o limite de rodadas: resume o que conseguiu fazer */
  const feitas = cards.length
    ? "Consegui executar " + cards.length + " ação(ões) — os cartões aí em cima mostram os detalhes. Quer que eu continue?"
    : "Fiquei sem palavras agora — pode repetir de outro jeito?";
  return {text: feitas, cards};
}

/* ---------- 9. API pública ---------- */
window.FluxoAgente = { turn, llmChat, buildSystemPrompt, synthTool, TOOL_DEFS, TOOL_RUN };
})();
