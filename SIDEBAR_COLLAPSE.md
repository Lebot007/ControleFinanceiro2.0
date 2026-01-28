# Sistema de Expandir/Colapsar Sidebar - FinControl

## ✨ Funcionalidades Implementadas

### 1. **Collapse/Expand da Sidebar (Desktop)**
- Botão toggle localizado no cabeçalho da sidebar
- Muda entre modo expandido (280px) e colapsado (80px)
- Animações suaves com transições CSS (0.3s)
- Persistência do estado no localStorage

### 2. **Menu Mobile Responsivo**
- Em dispositivos ≤768px:
  - Sidebar aparece como overlay flutuante
  - Animação slide-in suave
  - Overlay semi-transparente para fechar
  - Fecha automaticamente ao selecionar menu item

### 3. **Tooltips Inteligentes**
- Ao colapsar a sidebar, aparecem tooltips ao passar mouse
- Mostram o nome da página em um badge verde
- Posicionados à direita dos ícones
- Funcionam apenas em modo colapsado

### 4. **Ícones e Labels Dinâmicos**
- Na sidebar colapsada: apenas ícones SVG
- Na sidebar expandida: ícones + textos
- Transições suaves entre estados
- Setas de rotação no botão toggle

## 🎯 Comportamento por Dispositivo

### Desktop (> 768px)
```
Estado Expandido:
┌──────────────┐
│ 🟢 FinControl│ ◀️
│              │
│ 📊 Dashboard │
│ ➕ Receitas  │
│ ✔️ Despesas  │
│ 💳 Cartões   │
│ ⚙️ Categorias │
│ 📈 Gráficos  │
│ 📥 Dados     │
└──────────────┘

Estado Colapsado:
┌──┐
│🟢│◀️
│  │
│📊│ ← Tooltip ao hover
│➕│
│✔️│
│💳│
│⚙️│
│📈│
│📥│
└──┘
```

### Mobile (≤ 768px)
- Sidebar oculta por padrão (transform: translateX(-100%))
- Aparece com overlay semitransparente
- Botão hamburger no header para toggle
- Não permite collapse, apenas expand/collapse via menu
- Fecha ao clicar em item ou no overlay

## 🔧 Tecnologias Utilizadas

### CSS
- CSS Transitions para animações suaves
- Media queries responsivas
- Grid e Flexbox para layout
- Pseudo-elementos para tooltips (::after)

### JavaScript
- localStorage para persistência
- Event listeners para interações
- Manipulação de classList
- Detecção de breakpoints

## 💾 Persistência

A preferência do usuário é salva em localStorage:
```javascript
localStorage.setItem('sidebarCollapsed', true/false)
```

O estado é restaurado ao recarregar a página.

## 🎨 Componentes CSS

### Classes Principais
- `.sidebar` - Container da sidebar
- `.sidebar.collapsed` - Estado colapsado
- `.sidebar.active` - Sidebar visível em mobile
- `.sidebar-overlay` - Overlay de overlay
- `.btn-collapse-sidebar` - Botão toggle
- `.nav-item::after` - Tooltip

### Transições
- Duração padrão: 0.3s
- Easing: cubic-bezier(0.4, 0, 0.2, 1)
- Propriedades: width, transform, opacity, background

## 📱 Breakpoints

- **Desktop**: > 1024px (Sidebar: 280px, Colapsada: 80px)
- **Tablet**: 768px - 1024px (Sidebar: 240px)
- **Mobile**: < 768px (Sidebar: 100% com overlay)

## 🔄 Fluxo de Interação

### Desktop
1. Usuário clica no botão toggle
2. Sidebar alterna entre expandido/colapsado
3. Estado é salvo no localStorage
4. Ao recarregar, estado é restaurado

### Mobile
1. Usuário clica no ícone hamburger
2. Sidebar desliza para dentro
3. Overlay aparece semi-transparente
4. Clicar no item ou overlay fecha a sidebar
5. Nenhuma persistência em mobile

## 🚀 Performance

- Animações CSS (GPU accelerated)
- Sem layout shifts desnecessários
- Transições suaves sem lag
- localStorage leve e rápido

## 🐛 Compatibilidade

- Chrome/Edge: ✅ Total
- Firefox: ✅ Total
- Safari: ✅ Total
- Mobile browsers: ✅ Total

---

**Desenvolvido para o FinControl - Gestor Financeiro Inteligente**
