# 💰 Fluxo — Finanças Pessoais

Organizador financeiro pessoal completo que roda **100% no navegador**: contas, receitas, despesas, cartões de crédito, parcelas, orçamento, metas, relatórios e um **assistente com IA que automatiza tudo por conversa**.

🔗 **Acesso o app:** <https://lebot007.github.io/ControleFinanceiro2.0/>

> 🔒 **Privacidade primeiro:** todos os dados ficam salvos apenas no seu navegador (localStorage). Nada é enviado a servidores — nem lançamentos, nem conversas com o assistente, nem relatórios.

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

### 🤖 Assistente com IA (chat)
Um assistente em português que entende comandos em linguagem natural e **faz tudo sem você tocar em menus**:

| Você fala | Ele faz |
|---|---|
| “criar conta no Inter com 500” | Cria a conta com saldo inicial |
| “criar cartão Nubank com limite 5000” | Cadastra o cartão |
| “cadastrar despesa de mercado 250,50” | Lança a despesa (infere categoria, data e conta) |
| “gastei 30 com uber ontem” | Lança ontem, categoria Transporte |
| “recebi 3000 de salário” | Registra a receita |
| “comprei 200 no cartão Nubank” | Compra no cartão (pendente até a fatura) |
| “transferir 500 do Inter para a Poupança” | Transfere entre contas |
| “pagar fatura do Nubank” | Quita a fatura do ciclo atual |
| “paguei o aluguel” | Marca o lançamento pendente como pago |
| “relatório do mês em PDF” | **Gera e entrega o PDF no chat** |
| “qual meu saldo?” / “resumo do mês” | Consulta tudo |
| “orcamento 4000” / “meta de economia 500” | Define orçamento e metas |
| “abrir cartões” / “modo escuro” | Navega e ajusta o app |
| “desfazer” | Reverte a última ação |

Ele conversa: se faltar informação, pergunta (com sugestões clicáveis) e nada é salvo sem confirmação dos dados no cartão de resposta. O histórico da conversa fica salvo no navegador.

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
| `ai.js` + `ai.css` | Assistente conversacional (NLP local + chat) |
| `relatorio-pdf.js` | Gerador de PDF sem dependências |
| `login.html` | Tela de desbloqueio por senha |
| `fluxo-cards.html` | “Grimório das Fortunas” — carta RPG gerada a partir de um backup |
| `sw.js` + `manifest.webmanifest` | Service worker (offline) e manifesto PWA |

## 🛠️ Tecnologias

HTML, CSS e JavaScript puros — sem frameworks, sem build, sem dependências externas. Gráficos em SVG, PDF gerado à mão (PDF 1.4 + Helvetica/WinAnsi), NLP com regras e distância de edição (Levenshtein). Os dados persistem em `localStorage`.

## 📄 Licença

Distribuído sob a licença MIT — veja [LICENSE](LICENSE).
