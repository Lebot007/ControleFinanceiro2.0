# 💰 Fluxo — Finanças Pessoais

Organizador financeiro pessoal completo que roda **100% no navegador**: contas, receitas, despesas, cartões de crédito, parcelas, orçamento, metas, relatórios e um **assistente com IA de verdade** (agente autônomo com Tool Calling) que automatiza tudo por conversa.

🔗 **Acesso o app:** <https://lebot007.github.io/ControleFinanceiro2.0/>

> 🔒 **Privacidade primeiro:** seus dados financeiros (lançamentos, contas, memória, relatórios) ficam salvos **apenas no seu navegador**. Para o assistente “pensar”, apenas o **texto da conversa + o contexto necessário** é enviado a um serviço de IA gratuito (sem cadastro, sem chave) — os dados em si nunca saem do seu computador.

---

## ✨ O que ele faz

### 📊 Organização financeira
- **Dashboard** com patrimônio, saldo previsto, contas em aberto, gráficos e insights automáticos
- **Contas e carteiras** (corrente, poupança, dinheiro, digital, investimentos) com saldo em tempo real
- **Contas a pagar** com vencidas/hoje/próximas 7 dias e pagamento em lote
- **Receitas** com pendentes, recebidas e recorrências
- **Cartões de crédito** com limite, fatura por ciclo de fechamento, parcelas e pagamento de fatura
- **Lançamentos** com filtros, busca, seleção em lote, parcelamento e recorrências
- **Transferências entre contas** (sem afetar patrimônio, como deve ser)
- **Planejamento**: orçamento mensal, limites por categoria e metas
- **Relatórios** com comparativos, evolução do patrimônio e exportação (impressão/PDF, CSV)
- **Backup** completo em JSON (com cópia automática antes de importar)
- **Segurança opcional**: senha de acesso local com chave de recuperação
- **PWA**: instala como aplicativo e funciona offline
- **Tema claro/escuro**

### 🤖 Assistente com IA (agente autônomo, estilo Pierre)
Um **agente de IA real** em português — nada de respostas programadas: ele **raciocina** sobre o que você escreve, **decide sozinho** o que fazer, executa ações de verdade no app (via *Tool Calling*) e **aprende** com a conversa. Com **memória persistente**, **modo ensino** e **planejamento contextual**, na estética minimalista que segue o tema do site:

| Você fala | Ele faz |
|---|---|
| “crie as contas Inter com 1905, Cauda com 255 e Infinitepay com 146” | **Multi-ação**: cria as 3 contas de uma vez |
| “criar cartão Nubank com limite 5000” | Cadastra o cartão |
| “cadastrar despesa de mercado 250,50” | Lança a despesa (infere categoria, data e conta) |
| “quanto sobrou do meu salário depois que paguei o aluguel?” | **Raciocina**: cruza memória + lançamentos reais |
| “gastei 30 com uber ontem” | Lança ontem, categoria Transporte |
| “recebi 3000 de salário” | Registra a receita e **memoriza o salário** |
| “comprei 200 no cartão Nubank” | Compra no cartão (pendente até a fatura) |
| “transferir 500 do Inter para a Poupança” | Transfere entre contas |
| “pagar fatura do Nubank” | Quita a fatura do ciclo atual |
| “relatório do mês em PDF” | **Gera e entrega o PDF no chat** |
| “qual meu saldo?” / “resumo do mês” | Consulta tudo |
| “lembre-se que meu salário é 3000” | **Memoriza** (e também aprende sozinho, sem comando) |
| “edite a memória: X para Y” / “esqueça X” | **Edita/apaga** fatos da memória |
| “o que você sabe sobre mim?” | Abre a **Minha Memória** (ver/editar/apagar) |
| “como recupero minha senha?” / “como cadastro um cartão?” | **Ensina o passo a passo** do site |
| “tenho apenas 40 reais para gastar” | **Planeja** com o contexto e com a memória |
| “orcamento 4000” / “meta de economia 500” | Define orçamento e metas |
| “desfazer” | Reverte a última ação |

**Como o agente funciona (arquitetura autônoma):**

1. **O cérebro** (`agente.js`) é um loop de agente no navegador: a mensagem (com **memória** e **contexto financeiro real** injetados no System Prompt) vai para um LLM gratuito e **sem chave nem cadastro** — a API pública da [Pollinations](https://pollinations.ai) (endpoint compatível com OpenAI, modelo GPT-OSS 20B com *Tool Calling*).
2. **As mãos** são 18 ferramentas que o modelo invoca sozinho — criar contas/cartões, lançar transações, transferir, pagar faturas, consultar saldos/resumos/lançamentos, gerar PDF, definir orçamento/metas, navegar, trocar tema, desfazer e **gerenciar a memória** (salvar/buscar/editar/apagar). O loop executa cada ferramenta no app e devolve o resultado ao modelo, quantas rodadas forem necessárias.
3. **A memória** (`memoria.js`) é a camada de longo prazo: fatos, preferências e perfil ficam no navegador (`fluxo.memory.v1`), são injetados a cada interação (padrão RAG) e o agente **aprende sozinho** — se você comentar que odeia fast food, ele guarda e usa no planejamento. Conflitos (salário antigo vs. novo) são confirmados antes de atualizar; fatos inúteis (“oi”) são rejeitados; tudo é visível e apagável no ícone de livro (**Minha Memória**).
4. **Resiliência**: se o serviço de IA estiver fora, o agente responde com bom humor (“meu cérebro deu um nó”) em vez de quebrar. O tier gratuito limita a ~1 geração a cada ~37 s por IP — ações com várias etapas podem levar alguns segundos a mais, e o painel mostra o que ele está fazendo a cada passo.

O histórico da conversa fica salvo no navegador, e o assistente segue o tema claro/escuro do site automaticamente.

---

## 🚀 Como usar

1. **Online:** acesse <https://lebot007.github.io/ControleFinanceiro2.0/>
2. **Local:** baixe os arquivos e abra o `index.html` no navegador — ou sirva com um servidor estático:
   ```bash
   npx serve .        # ou
   python3 -m http.server 8080
   ```
3. Na primeira abertura, escolha **“Começar do zero”** ou **“Ver com dados de exemplo”**.
4. Toque no botão **✨ do assistente** (canto inferior direito) e peça o que precisar.

---

## 🗂️ Estrutura

| Arquivo | Papel |
|---|---|
| `index.html` | Aplicação principal (SPA em arquivo único) |
| `agente.js` | **O cérebro do assistente**: loop de agente autônomo (LLM + 18 ferramentas de Tool Calling) |
| `ai.js` + `ai.css` | Interface do chat (painel, bolhas, cartões, PDF, modal de memória) — sem regras de conversa |
| `memoria.js` | **Memória persistente do assistente** (CRUD + validação + conflitos + RAG) |
| `relatorio-pdf.js` | Gerador de PDF sem dependências |
| `login.html` | Tela de desbloqueio por senha |
| `fluxo-cards.html` | “Grimório das Fortunas” — carta RPG gerada a partir de um backup |
| `sw.js` + `manifest.webmanifest` | Service worker (offline) e manifesto PWA |

## 🛠️ Tecnologias

HTML, CSS e JavaScript puros — sem frameworks, sem build. Gráficos em SVG, PDF gerado à mão (PDF 1.4 + Helvetica/WinAnsi). O agente de IA roda no navegador via API pública da Pollinations (OpenAI-compatível, tier gratuito anônimo, sem chave). Os dados persistem em `localStorage`.

## 📄 Licença

Distribuído sob a licença MIT — veja [LICENSE](LICENSE).
