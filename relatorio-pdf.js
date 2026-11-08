/* ============================================================
   Fluxo — Gerador de Relatório em PDF (sem dependências)
   Escreve o PDF "na mão" (sintaxe PDF 1.4, fontes Helvetica
   padrão com WinAnsiEncoding). Funciona 100% offline.

   Módulo puro: recebe dados já formatados, devolve bytes.
   Uso: FluxoPDF.buildMonthlyReport(dados) -> {bytes, filename}
   ============================================================ */
(function(){
"use strict";

/* ---------- Métricas das fontes (larguras AFM /1000) ---------- */
const HW = {32:278,33:278,34:355,35:556,36:556,37:889,38:667,39:191,40:333,41:333,42:389,43:584,44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,56:556,57:556,58:278,59:278,60:584,61:584,62:584,63:556,64:1015,65:667,66:667,67:722,68:722,69:667,70:611,71:778,72:722,73:278,74:500,75:667,76:556,77:833,78:722,79:778,80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:278,92:278,93:278,94:469,95:556,96:333,97:556,98:556,99:500,100:556,101:556,102:278,103:556,104:556,105:222,106:222,107:500,108:222,109:833,110:556,111:556,112:556,113:556,114:333,115:500,116:278,117:556,118:500,119:722,120:500,121:500,122:500,123:334,124:260,125:334,126:584};
const HWB = {32:278,33:333,34:474,35:556,36:556,37:889,38:722,39:238,40:333,41:333,42:389,43:584,44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,52:556,53:556,54:556,55:556,56:556,57:556,58:333,59:333,60:584,61:584,62:584,63:611,64:975,65:722,66:722,67:722,68:722,69:667,70:611,71:778,72:722,73:278,74:556,75:722,76:611,77:833,78:722,79:778,80:667,81:778,82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:333,92:278,93:333,94:584,95:556,96:333,97:556,98:611,99:556,100:611,101:556,102:333,103:611,104:611,105:278,106:278,107:556,108:278,109:889,110:611,111:611,112:611,113:611,114:389,115:556,116:333,117:611,118:556,119:778,120:556,121:556,122:500,123:389,124:280,125:389,126:584};

function textWidth(s, font, size){
  const T = font === "F2" ? HWB : HW;
  let w = 0;
  for(let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    w += T[c] || 556;
  }
  return w * size / 1000;
}

/* ---------- Sanitização para WinAnsi (Latin-1) ---------- */
const SUBST = {"\u2014":"-","\u2013":"-","\u2212":"-","\u201C":'"',"\u201D":'"',"\u2018":"'","\u2019":"'","\u2026":"...","\u2022":"-","\u00B7":"-","\u2192":"->","\u20A2":""};
function latin(s){
  let out = "";
  s = String(s ?? "");
  for(let i = 0; i < s.length; i++){
    const ch = s[i];
    if(SUBST[ch] !== undefined){ out += SUBST[ch]; continue; }
    const c = ch.charCodeAt(0);
    out += c <= 255 ? ch : "?";
  }
  return out;
}
function escPdf(s){
  return latin(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/* ---------- Paleta ---------- */
const PW = 595.28, PH = 841.89, M = 46;
const BRAND = [0.055, 0.42, 0.31];
const INK   = [0.09, 0.14, 0.12];
const MUTED = [0.36, 0.43, 0.39];
const SOFT  = [0.937, 0.949, 0.933];
const ZEBRA = [0.965, 0.973, 0.962];
const LINEC = [0.82, 0.85, 0.82];
const UP    = [0.05, 0.51, 0.37];
const DOWN  = [0.80, 0.25, 0.25];

/* ---------- Construtor do documento ---------- */
function buildMonthlyReport(d){
  const pageContents = [];
  let ops = [];
  let y = M;

  const fx = n => (Math.round(n * 100) / 100).toString();

  function newPage(){ if(ops.length) pageContents.push(ops.join("\n")); ops = []; y = M; }
  function ensure(h){ if(y + h > PH - M - 34) newPage(); }
  function fill(c){ ops.push(fx(c[0]) + " " + fx(c[1]) + " " + fx(c[2]) + " rg"); }
  function text(x, yy, str, o){
    o = o || {};
    const f = o.bold ? "F2" : "F1";
    const size = o.size || 9;
    fill(o.color || INK);
    ops.push("BT /" + f + " " + fx(size) + " Tf 1 0 0 1 " + fx(x) + " " + fx(PH - yy) + " Tm (" + escPdf(str) + ") Tj ET");
  }
  function textR(xRight, yy, str, o){
    o = o || {};
    text(xRight - textWidth(latin(str), o.bold ? "F2" : "F1", o.size || 9), yy, str, o);
  }
  function rect(x, yy, w, h, c){ fill(c); ops.push(fx(x) + " " + fx(PH - yy - h) + " " + fx(w) + " " + fx(h) + " re f"); }
  function hline(x1, x2, yy, c, w){
    ops.push(fx(w || 0.7) + " w " + fx(c[0]) + " " + fx(c[1]) + " " + fx(c[2]) + " RG " + fx(x1) + " " + fx(PH - yy) + " m " + fx(x2) + " " + fx(PH - yy) + " l S");
  }
  function fit(str, font, size, maxW){
    str = latin(String(str ?? ""));
    if(textWidth(str, font, size) <= maxW) return str;
    let s = str;
    while(s.length > 1 && textWidth(s + "...", font, size) > maxW) s = s.slice(0, -1);
    return s + "...";
  }

  /* cabeçalho */
  function header(){
    rect(0, 0, PW, 96, BRAND);
    rect(0, 96, PW, 3, [0.12, 0.77, 0.55]);
    text(M, 38, d.titulo || "Relatório Financeiro", {bold:true, size:17, color:[1,1,1]});
    text(M, 58, d.periodo || "", {size:10, color:[0.80, 0.90, 0.85]});
    textR(PW - M, 38, "Gerado em " + (d.geradoEm || ""), {size:9, color:[0.80, 0.90, 0.85]});
    textR(PW - M, 54, "Fluxo · finanças pessoais · dados locais", {size:8, color:[0.55, 0.72, 0.66]});
    y = 96 + 30;
  }

  function sectionTitle(t){
    ensure(56);
    rect(M, y + 1.5, 3.5, 13, BRAND);
    text(M + 11, y + 12, t, {bold:true, size:11.5, color:BRAND});
    y += 25;
  }

  function boxes(items){
    ensure(64);
    const gap = 9;
    const w = (PW - M*2 - gap * (items.length - 1)) / items.length;
    items.forEach((it, i) => {
      const x = M + i * (w + gap);
      rect(x, y, w, 47, SOFT);
      text(x + 11, y + 16, String(it.label).toUpperCase(), {size:6.8, color:MUTED});
      text(x + 11, y + 38, fit(it.value, "F2", 12.5, w - 22), {bold:true, size:12.5, color: it.color || INK});
    });
    y += 47 + 20;
  }

  function table(cols, rows, opts){
    opts = opts || {};
    const rowH = 15.2, headH = 17;
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const startX = M;
    function drawHead(){
      ensure(headH + rowH * 2);
      rect(startX, y, totalW, headH, SOFT);
      let x = startX;
      cols.forEach(c => {
        if(c.align === "R") textR(x + c.w - 7, y + 11.8, c.label, {bold:true, size:7.4, color:MUTED});
        else text(x + 7, y + 11.8, c.label, {bold:true, size:7.4, color:MUTED});
        x += c.w;
      });
      y += headH;
    }
    drawHead();
    let idx = 0;
    rows.forEach(r => {
      if(y + rowH > PH - M - 34){ newPage(); drawHead(); }
      if(idx % 2 === 1) rect(startX, y, totalW, rowH, ZEBRA);
      let x = startX;
      r.forEach((cell, ci) => {
        const c = cols[ci];
        const o = (cell && typeof cell === "object") ? cell : {t: cell};
        const val = String(o.t ?? "");
        const oo = {size: 8.6, color: o.color || INK, bold: o.bold};
        if(c.align === "R") textR(x + c.w - 7, y + 10.8, val, oo);
        else text(x + 7, y + 10.8, fit(val, o.bold ? "F2" : "F1", 8.6, c.w - 14), oo);
        x += c.w;
      });
      y += rowH;
      idx++;
    });
    hline(startX, startX + totalW, y, LINEC, 0.7);
    y += 16;
  }

  function note(t){
    ensure(26);
    text(M, y + 10, t, {size:8.6, color:MUTED});
    y += 24;
  }

  /* ---------- Montagem ---------- */
  header();

  boxes(d.resumo || []);

  sectionTitle("Despesas por categoria");
  if((d.despesasCategoria || []).length){
    table(
      [{label:"CATEGORIA", w:260}, {label:"VALOR", w:120, align:"R"}, {label:"%", w:70, align:"R"}],
      d.despesasCategoria.map(x => [x.nome, {t:x.valor, color:DOWN}, x.pct])
        .concat([[{t:"Total", bold:true}, {t:d.totalDespesas, bold:true, color:DOWN}, {t:"100%", bold:true}]])
    );
  } else note("Sem despesas no período.");

  if((d.receitasCategoria || []).length){
    sectionTitle("Receitas por categoria");
    table(
      [{label:"CATEGORIA", w:260}, {label:"VALOR", w:120, align:"R"}, {label:"%", w:70, align:"R"}],
      d.receitasCategoria.map(x => [x.nome, {t:x.valor, color:UP}, x.pct])
        .concat([[{t:"Total", bold:true}, {t:d.totalReceitas, bold:true, color:UP}, {t:"100%", bold:true}]])
    );
  }

  if((d.contas || []).length){
    sectionTitle("Saldos por conta");
    table(
      [{label:"CONTA", w:200}, {label:"TIPO", w:150}, {label:"SALDO", w:100, align:"R"}],
      d.contas.map(x => [x.nome, {t:x.tipo, color:MUTED}, {t:x.saldo, color: x.neg ? DOWN : INK}])
    );
  }

  if((d.cartoes || []).length){
    sectionTitle("Cartões de crédito");
    table(
      [{label:"CARTÃO", w:150}, {label:"FATURA ATUAL", w:100, align:"R"}, {label:"EM ABERTO", w:95, align:"R"}, {label:"DISPONÍVEL", w:105, align:"R"}],
      d.cartoes.map(x => [x.nome, {t:x.fatura, color:DOWN}, {t:x.aberto, color:MUTED}, {t:x.disponivel, color:UP}])
    );
  }

  sectionTitle("Lançamentos do período");
  if((d.lancamentos || []).length){
    table(
      [{label:"DATA", w:58}, {label:"DESCRIÇÃO", w:236}, {label:"CATEGORIA", w:105}, {label:"VALOR", w:60, align:"R"}],
      d.lancamentos.map(x => [
        {t:x.data, color:MUTED}, x.desc, {t:x.categoria, color:MUTED},
        {t:(x.tipo === "receita" ? "+ " : "- ") + x.valor, color: x.tipo === "receita" ? UP : DOWN, bold:true}
      ])
    );
  } else note("Nenhum lançamento no período.");

  if((d.transferencias || []).length){
    sectionTitle("Transferências entre contas");
    table(
      [{label:"DATA", w:58}, {label:"DESCRIÇÃO", w:170}, {label:"FLUXO", w:190}, {label:"VALOR", w:45, align:"R"}],
      d.transferencias.map(x => [{t:x.data, color:MUTED}, x.desc, {t:x.fluxo, color:MUTED}, {t:x.valor, color:[0.23,0.43,0.66]}])
    );
  }

  /* rodapé em todas as páginas */
  if(ops.length) pageContents.push(ops.join("\n"));
  const total = pageContents.length;
  pageContents.forEach((pc, i) => {
    const pg = "Página " + (i + 1) + " de " + total;
    const foot =
      "0.82 0.85 0.82 RG 0.7 w " + fx(M) + " 34 m " + fx(PW - M) + " 34 l S\n" +
      "0.36 0.43 0.39 rg BT /F1 8 Tf 1 0 0 1 " + fx(M) + " 22 Tm (" + escPdf("Fluxo — Finanças Pessoais · relatório gerado localmente no navegador") + ") Tj ET\n" +
      "0.36 0.43 0.39 rg BT /F1 8 Tf 1 0 0 1 " + fx(PW - M - textWidth(pg, "F1", 8)) + " 22 Tm (" + escPdf(pg) + ") Tj ET";
    pageContents[i] = pc + "\n" + foot;
  });

  /* ---------- Serialização ---------- */
  const F1 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  const F2 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const firstPage = 6; /* 1 cat, 2 pages, 3 F1, 4 F2, (5 livre) */
  const pageNums = [], contNums = [];
  for(let i = 0; i < total; i++){ pageNums.push(firstPage + i * 2); contNums.push(firstPage + i * 2 + 1); }

  let out = "%PDF-1.4\n";
  const offsets = {};
  function push(num, body){
    offsets[num] = out.length;
    out += num + " 0 obj\n" + body + "\nendobj\n";
  }
  push(1, "<< /Type /Catalog /Pages 2 0 R >>");
  push(2, "<< /Type /Pages /Kids [" + pageNums.map(n => n + " 0 R").join(" ") + "] /Count " + total + " >>");
  push(3, F1);
  push(4, F2);
  pageContents.forEach((pc, i) => {
    push(pageNums[i], "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + fx(PW) + " " + fx(PH) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contNums[i] + " 0 R >>");
    push(contNums[i], "<< /Length " + pc.length + " >>\nstream\n" + pc + "\nendstream");
  });
  const maxObj = firstPage + total * 2 - 1;
  const xrefPos = out.length;
  out += "xref\n0 " + (maxObj + 1) + "\n0000000000 65535 f \n";
  for(let i = 1; i <= maxObj; i++){
    out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  out += "trailer\n<< /Size " + (maxObj + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";

  const bytes = new Uint8Array(out.length);
  for(let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
  return {bytes, filename: d.filename || "relatorio-fluxo.pdf"};
}

const API = { buildMonthlyReport };
if(typeof window !== "undefined") window.FluxoPDF = API;
if(typeof module !== "undefined" && module.exports) module.exports = API;
})();
