/* ============================================================
   Fluxo — Memória Persistente do Assistente (“Minha Memória”)
   ------------------------------------------------------------
   Camada de longo prazo do Assistente Fluxo (padrão RAG):

     • Fatos        — “meu salário é 3.000”
     • Preferências — “gosto de comprar no mercado do bairro”
     • Perfil       — metas e identidade (“quero juntar 10 mil”)

   Arquitetura híbrida de memória:
     1. Camada de SESSÃO      → histórico do chat (fluxo.chat.v1, no ai.js)
     2. Camada PERSISTENTE    → este módulo (localStorage “fluxo.memory.v1”)
     3. Camada de RECUPERAÇÃO → relevant() + systemPrompt(): antes de cada
        resposta, os fatos relevantes são buscados e injetados no prompt.

   Tudo fica no NAVEGADOR, no mesmo espírito do app: nenhum dado
   é enviado a servidores. Sem dependências externas.
   ============================================================ */
(function(){
"use strict";
if(window.FluxoMemoria) return;   /* evita instância dupla */

/* ---------- 1. Armazenamento (localStorage) ---------- */
const KEY      = "fluxo.memory.v1";
const MAX_FACTS = 200;            /* teto de segurança contra abuso */

let data = load();

function load(){
  try{
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if(d && Array.isArray(d.facts))
      return {v:1, facts:d.facts.filter(f => f && f.id && typeof f.text === "string")};
  }catch(e){ /* JSON corrompido: começa do zero */ }
  return {v:1, facts:[]};
}
function persist(){
  try{ localStorage.setItem(KEY, JSON.stringify(data)); }
  catch(e){ /* armazenamento cheio: memória fica só na sessão */ }
}

/* ---------- 2. Utilidades de texto ---------- */
/* normaliza para comparação: sem acentos, minúsculas, espaços simples */
const NORM = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const words = s => NORM(s).split(/[^a-z0-9]+/).filter(Boolean);
const mid = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);

/* palavras descartáveis para comparação de “assunto” */
const STOP = new Set((
  "meu,minha,meus,minhas,eu,voce,de,do,da,dos,das,no,na,nos,nas,em,um,uma,uns,umas,com,para,pra,por,pelo,pela,"+
  "que,e,é,ao,aos,as,os,o,a,isso,aquilo,quero,quero,gosto,gosta,gostou,sempre,tenho,faco,fazer,ser,me,te,se,"+
  "mais,menos,tambem,ja,foi,vai,vou,era,muito,pouco,todo,toda,todos,todas,aqui,la,agora,depois,antes,hoje"
).split(","));

/* palavras que formam o “assunto” de um fato */
const sigWords = t => words(t).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+[.,]?\d*$/.test(w));

/* assuntos sensíveis: mudança de valor nesses temas = conflito a confirmar */
const KEY_SUBJECTS = new Set("salario,ordenado,vencimento,aluguel,renda,rendimento,limite,nome,trabalho,emprego,cidade,banco,meta".split(","));

/* extrai o primeiro valor em dinheiro (centavos) ou null */
function moneyOf(text){
  const m = /(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d{1,3}(?:\.\d{3})+|\d+,\d{1,2}|\d+(?:\.\d{1,2})?)/.exec(String(text).replace(/r\$/gi," "));
  if(!m) return null;
  let r = m[1];
  if(r.includes(".") && r.includes(",")) return Math.round(parseFloat(r.replace(/\./g,"").replace(",","."))*100);
  if(r.includes(",")) return Math.round(parseFloat(r.replace(",","."))*100);
  if(r.includes(".")){
    const p = r.split(".");
    if((p.length === 2 && p[1].length === 3 && p[0].length <= 3) || p.length > 2) return parseInt(p.join(""),10)*100; /* 1.000 / 1.000.000 = mil/milhão */
    return Math.round(parseFloat(r)*100);
  }
  return parseInt(r,10)*100;
}

/* limpa o texto de um fato: espaços, aspas e pontuação das pontas */
function clean(s){
  return String(s ?? "").replace(/\s+/g," ").replace(/^["“”'·]+/,"").replace(/["“”'·,;:!?.]+$/,"").trim();
}

/* ---------- 3. Validação (não guardar conversa fiada) ---------- */
const NOISE = new Set((
  "oi,ola,opa,eae,e ai,ei,hey,bom dia,boa tarde,boa noite,salve,tudo bem,tudo bom,tudo certo,beleza,blz,"+
  "sim,nao,ok,certo,perfeito,show,top,demais,obrigado,obrigada,valeu,vlw,agradecido,ajuda,help,socorro,"+
  "comandos,exemplos,exemplo,tchau,adeus,ate logo,ate mais,bye,quem e voce,quem es voce,o que voce faz,"+
  "me ajuda,me ensina,ensina,explica,fala,verdade,sera,serio,hmm,hum,ah,eh,ih,uau,nossa,caramba,entendi,"+
  "blz entao,beleza entao,ta bom,tá bom,ta certo,nada,esquece,deixa quieto,nao sei,talvez,quem sabe"
).split(","));

/**
 * Valida se o texto é um fato útil para memorizar.
 * @returns {{ok:true, text:string}} ou {{ok:false, reason:string}}
 */
function valid(rawText){
  const t = clean(rawText);
  if(!t)                         return {ok:false, reason:"vazio"};
  if(t.length < 5)               return {ok:false, reason:"curto demais"};
  if(t.length > 220)             return {ok:false, reason:"longo demais"};
  const n = NORM(t);
  if(t.includes("?") || /^(quem|o que|onde|quando|como|qual|quais|por que|porque|quanto)\b/.test(n))
                                 return {ok:false, reason:"é uma pergunta, não um fato"};
  if(NOISE.has(n))               return {ok:false, reason:"conversa fiada"};
  const letters = (t.match(/[a-zà-ú]/gi) || []).length;
  if(letters < 3)                return {ok:false, reason:"sem conteúdo"};
  if(sigWords(t).length === 0 && !moneyOf(t))
                                 return {ok:false, reason:"genérico demais"};
  return {ok:true, text:t};
}

/* ---------- 4. Classificação do fato (Fato / Preferência / Perfil) ---------- */
function kindOf(text){
  const t = NORM(text);
  if(/\b(meta|objetivo|sonho|patrimonio|juntar|economizar|planejo|quero chegar|minha meta)\b/.test(t)) return "perfil";
  if(/\b(gosto|gostei|gosta|nao gosto|nao gosto|prefiro|preferencia|odeio|detesto|costumo|habito|sempre compro|frequento|vivo)\b/.test(t)) return "preferencia";
  return "fato";
}
const KIND_LABEL = {fato:"Fato", preferencia:"Preferência", perfil:"Perfil"};

/* ---------- 5. CRUD ---------- */
function all(){ return data.facts.slice(); }
function count(){ return data.facts.length; }

function add(rawText){
  const v = valid(rawText);
  if(!v.ok) return {ok:false, reason:v.reason};
  const dup = duplicateOf(v.text);
  if(dup) return {ok:true, status:"duplicate", fact:dup};   /* já sabia */
  if(data.facts.length >= MAX_FACTS) data.facts.shift();     /* teto de segurança */
  const fact = {id: mid(), kind: kindOf(v.text), text: v.text, createdAt: new Date().toISOString(), updatedAt: null};
  data.facts.push(fact); persist();
  return {ok:true, status:"added", fact};
}
function update(id, rawText){
  const f = data.facts.find(x => x.id === id);
  if(!f) return {ok:false, reason:"fato não encontrado"};
  const v = valid(rawText);
  if(!v.ok) return {ok:false, reason:v.reason};
  f.text = v.text; f.kind = kindOf(v.text); f.updatedAt = new Date().toISOString();
  persist();
  return {ok:true, fact:f};
}
function remove(id){
  const i = data.facts.findIndex(x => x.id === id);
  if(i < 0) return null;
  const [f] = data.facts.splice(i,1); persist();
  return f;
}
function clear(){ data.facts = []; persist(); }

/* ---------- 6. Busca fuzzy e relevância (camada RAG) ---------- */
function scoreOf(fact, qWords, qNorm){
  let s = 0;
  const fw = sigWords(fact.text);
  qWords.forEach(w => { if(fw.includes(w)) s += 2; });
  if(qNorm && NORM(fact.text).includes(qNorm)) s += 3;
  return s;
}
/** Fatos que casam com a consulta, ordenados por relevância. */
function find(query){
  const qWords = sigWords(query), qNorm = NORM(query);
  if(!qWords.length && !qNorm) return [];
  return data.facts
    .map(f => ({fact:f, score:scoreOf(f, qWords, qNorm)}))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score);
}
/**
 * Camada de recuperação: fatos relevantes para a mensagem atual.
 * Se nada pontuar, devolve os mais recentes (contexto geral de perfil).
 */
function relevant(msg, n){
  n = n || 8;
  const scored = data.facts
    .map(f => ({fact:f, score:scoreOf(f, sigWords(msg), NORM(msg))}))
    .sort((a,b) => b.score - a.score || (b.fact.createdAt||"").localeCompare(a.fact.createdAt||""));
  const hit = scored.filter(x => x.score > 0).slice(0, n).map(x => x.fact);
  if(hit.length) return hit;
  return data.facts.slice(-Math.min(n, 3)).reverse();
}

/* ---------- 7. Duplicatas e conflitos ---------- */
/** Mesmo fato (texto igual ou mesmo assunto + mesmo valor)? */
function duplicateOf(text){
  const tN = NORM(text), tW = sigWords(text), tM = moneyOf(text);
  for(const f of data.facts){
    if(tN === NORM(f.text)) return f;
    const fW = sigWords(f.text), fM = moneyOf(f.text);
    if(tW.some(w => fW.includes(w)) && tM != null && fM != null && tM === fM) return f;
  }
  return null;
}
/**
 * Conflito: mesmo assunto com valor/conteúdo diferente.
 * Ex.: memória “salário é 3000” + nova frase “meu salário é 5000”.
 * @returns {{fact:object, subject:string}|null}
 */
function conflictFor(text){
  const tN = NORM(text), tW = sigWords(text), tM = moneyOf(text);
  for(const f of data.facts){
    if(tN === NORM(f.text)) continue;               /* idêntico = duplicata, não conflito */
    const fW = sigWords(f.text), fM = moneyOf(f.text);
    const overlap = tW.filter(w => fW.includes(w));
    if(!overlap.length) continue;
    /* valor diferente para o mesmo assunto */
    if(tM != null && fM != null && tM !== fM) return {fact:f, subject:overlap[0]};
    /* assunto-chave (nome, trabalho…) com texto diferente e sem valores */
    if(tM == null && fM == null && overlap.some(w => KEY_SUBJECTS.has(w)))
      return {fact:f, subject:overlap[0]};
  }
  return null;
}

/* ---------- 8. Nome conhecido (para saudação personalizada) ---------- */
function knownName(){
  for(const f of data.facts){
    const m = /(?:meu nome (?:e|é)|me chamo|pode me chamar de|meu apelido (?:e|é))\s+(.+)$/i.exec(f.text);
    if(m) return m[1].split(/\s+/).slice(0,2).join(" ").replace(/[.,!?;:]+$/,"");
  }
  return null;
}

/* ---------- 9. System Prompt (enviado ao GLM 5.3 a cada interação) ---------- */
/**
 * Monta o prompt de sistema completo, com persona, regras de memória,
 * conhecimento do app, memória recuperada (RAG) e contexto financeiro.
 * @param {string} userMsg  mensagem atual do usuário
 * @param {object} ctx      contexto do app {saldoTotal, gastosCiclo, orcamento, ciclo, contas, cartoes}
 */
function systemPrompt(userMsg, ctx){
  ctx = ctx || {};
  const facts = data.facts.slice(-15);
  const memList = facts.length
    ? facts.map(f => "- [" + (KIND_LABEL[f.kind] || f.kind) + "] " + f.text).join("\n")
    : "(vazia — nada memorizado ainda)";

  return [
"Você é o **Fluxo**, assistente financeiro pessoal do app Fluxo (controle de finanças 100% local, os dados ficam só no navegador do usuário).",

"## PERSONA",
"- Tom: amigável, direto e educacional — um **mentor financeiro**.",
"- Estética: minimalismo conversacional dark com verde-menta (padrão Pierre).",
"- Idioma: português do Brasil. Respostas curtas; use **negrito** nos números-chave e bullets “- ” para passos.",
"- Você faz três coisas: **executa** comandos financeiros, **explica** o app passo a passo e **planeja** gastos com o usuário.",

"## MEMÓRIA (regras invioláveis)",
"1. NUNCA invente fatos sobre o usuário — use apenas a seção MEMÓRIA DO USUÁRIO abaixo.",
"2. Comando “lembre-se que [fato]” → salve e confirme: “✓ Anotado! Vou lembrar que [fato]”.",
"3. Comando “edite a memória: [fato antigo] para [fato novo]” → atualize e confirme o antes/depois.",
"4. Comando “esqueça [fato]” → apague permanentemente e confirme.",
"5. Antes de salvar, valide: não guarde conversa fiada (“oi”, “obrigado”) nem perguntas.",
"6. Conflito (mesmo assunto, valor diferente): pergunte antes de atualizar. Ex.: memória dizia salário 3.000 e o usuário diz 5.000 → “Você mudou de emprego? Devo atualizar seu salário para R$ 5.000?”.",
"7. Use a memória de forma proativa no planejamento (se ele disse que tem R$ 40, considere isso ao sugerir).",

"## O QUE VOCÊ SABE FAZER NO APP",
"- Criar contas e cartões; lançar despesas e receitas; transferir entre contas; pagar faturas; gerar relatório mensal em PDF.",
"- Consultar saldos, resumo do ciclo, gastos por categoria e contas em aberto.",
"- Definir orçamento e metas; navegar entre páginas; alternar tema claro/escuro.",
"- Ensinar qualquer funcionalidade: senha de acesso, recuperação por chave, backup, parcelas, recorrências, instalação PWA…",

"## MEMÓRIA DO USUÁRIO (RAG — fatos recuperados para esta conversa)",
memList,

"## CONTEXTO FINANCEIRO ATUAL",
"- Saldo total: " + (ctx.saldoTotal ?? "—"),
"- Gastos no ciclo: " + (ctx.gastosCiclo ?? "—") + (ctx.orcamento ? " · orçamento: " + ctx.orcamento : ""),
"- Ciclo: " + (ctx.ciclo ?? "—") + " · Contas: " + (ctx.contas ?? "—") + " · Cartões: " + (ctx.cartoes ?? "—"),

"## COMO RESPONDER A ESTA MENSAGEM",
"Mensagem do usuário: “" + (userMsg || "") + "”",
"- Comando financeiro → execute e mostre o cartão de confirmação com os dados.",
"- Pergunta sobre o app → PARE os comandos e ensine passo a passo, em bullets curtos.",
"- Pouco dinheiro disponível → planeje com o contexto + memória; sugira prioridades e ofereça reservar o valor.",
"- Não souber → seja honesto: “Ainda não aprendi isso, mas posso te mostrar onde encontrar no site.”"
  ].join("\n\n");
}

/* ---------- 10. API pública ---------- */
window.FluxoMemoria = {
  all, count, add, update, remove, clear,
  find, relevant, duplicateOf, conflictFor,
  valid, clean, kindOf, knownName, systemPrompt,
  KIND_LABEL
};
})();
