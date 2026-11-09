# Bateria de 100 Cenários — Relatório Final

**Data:** 9 de novembro de 2026
**Resultado: ✅ 100/100 cenários passaram** (LLM real, sem simulações de resposta)

| Faixa etária | Cenários | Passaram |
|---|---:|---:|
| Adolescentes (14–17) — mesada, gíria, emoji, joguinho | 18 | 18 |
| Jovens (18–25) — primeiro salário, streaming, pix, faculdade | 20 | 20 |
| Adultos (26–40) — contas da casa, cartão, transferências | 25 | 25 |
| Meia-idade (41–59) — linguagem formal, financiamentos, investimentos | 19 | 19 |
| Idosos (60+) — CAPS LOCK, erros de digitação, INSS, paciência | 18 | 18 |
| **Total** | **100** | **100** |

## Como foi testado

- O **agente real** (`agente.js`) rodou com o **LLM real** (GPT-OSS via Pollinations — o mesmo serviço gratuito do app), um cenário por vez, em processo isolado.
- Cada cenário monta um "navegador de mentira" com dados financeiros realistas (contas, cartões, lançamentos, memória) e envia a mensagem **como um usuário daquela idade escreveria** — incluindo CAPS LOCK, erros de digitação ("reccebi 1500 do alugel"), gírias ("30 paus", "30 conto") e emoji.
- A verificação é pelo **resultado essencial**: a conta certa foi criada? o valor certo foi lançado? ele **perguntou** em vez de chutar? usou o **histórico da conversa** para entender "e a outra?" e "transfere pra ela"? não duplicou? não inventou?
- 6 cenários validam especificamente o **contexto de conversa** (o agente recebe as últimas 8 mensagens do histórico a cada turno — cenários 13, 34, 52, 78, 93 e 99).

## O que a bateria provocou de melhorias no agente

Cada falha descoberta virou correção real no `agente.js` (todas as 100 passaram **depois** destas correções):

1. **Lote truncado** — `max_tokens: 800` cortava o JSON de lotes grandes no meio (multitarefa falhava). Corrigido para 4000.
2. **Loop de raciocínio travado** — em pedidos complexos o modelo estourava o próprio limite de tokens (`output_token_limit_exceeded`). Agora cada tentativa usa **semente única** (o serviço cacheia respostas **e erros** por corpo idêntico — sem isso um erro ficaria "colado" o dia todo) e o 400 vira retentativa.
3. **Vazamento do formato interno do modelo** — o GPT-OSS às vezes deixa tokens internos (`<|channel|>commentary`) dentro dos argumentos, quebrando campos como `tipo`. Agora os argumentos são higienizados e `tipo`/`status` aceitam sinônimos naturais (entrada/saída, paid/quitado).
4. **Duplicação na auto-correção** — ao reenviar um lote após uma ação falhar, ações já concluídas podiam repetir. Agora cada ação tem uma **chave semântica** (tipo+valor+data+descrição) e sucessos não se repetem no mesmo turno.
5. **Consulta embrulhada em lote** — o resumo de uma consulta dentro de `executar_lote` era cortado na 1ª linha. Agora consultas dentro de lote devolvem o texto completo.
6. **Períodos por ano** — "quanto gastei de farmácia **este ano**?" não tinha suporte; o agente perguntava o período. Agora aceita `2026`, "este ano", "ano passado".
7. **Regras de inteligência (prompt)** — nomes implícitos ("conta da mesada" → Mesada), categoria escolhida sozinha (nunca pergunta), conta única usada sem perguntar, gírias de dinheiro ("30 paus" = R$ 30), meta definida sem interrogar prazo, memória **adicional** (nunca substitui o lançamento), "esqueça X" executa direto, e a distinção entre pergunta de **QUANTO** (consulta os dados) e **COMO FAZER** (ensina o caminho).
8. **Fila do serviço gratuito** — paciência ampliada de 55s para 120s (IPs compartilhados — faculdade, escritório — esbarram mais no limite de 1 geração/45s por IP).

## Cenários de destaque

- **#13** (Adolescente, contexto): "quero criar duas contas: picpay com 20 e lanche com 50" → "e a outra?" → o agente lê o histórico e cria só a que faltava.
- **#39** (Adulto): o clássico "Crie as contas Inter com 1905,00 e InfinitePay com 146,15" — lote com 2 contas numa tacada.
- **#61/#62** (Adulto): "gastei 50" com 2 contas → **pergunta** em qual conta (não chuta).
- **#43/#80** (Adulto/meia-idade): "notebook 3200 em 10x" e "consórcio 12x de 120" — registra no cartão ou explica, **sem inventar** valor.
- **#93** (Idoso, paciência): repete a mesma pergunta de saldo — o agente responde de novo, com gentileza.
- **#99** (Idoso, coreferência): "crie uma poupança com 10.000" → "e transfere 2000 da caixa **pra ela**" → entende que "ela" é a Poupança.
- **#100** (Idoso, multitarefa máxima): 4 pedidos numa frase (receita + 2 despesas + meta) — tudo num lote só.

## Como rodar de novo

```bash
node testes/cenarios-100.js              # todos os 100
node testes/cenarios-100.js --only 13,40 # só alguns
```

Requisitos: Node 18+ e internet (o LLM é o serviço real do app — o tier gratuito limita ~1 geração/45s por IP, então a bateria completa leva ~30–40 min). O resultado detalhado fica em `testes/ultimo-resultado.json`.
