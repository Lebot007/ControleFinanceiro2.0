// ==================== CONFIGURAÇÕES GLOBAIS ====================
const STORAGE_KEY = {
    RECEITAS: 'fincontrol_receitas',
    DESPESAS: 'fincontrol_despesas',
    CARTOES: 'fincontrol_cartoes',
    CATEGORIAS: 'fincontrol_categorias',
    ALERTAS: 'fincontrol_alertas'
};

// Categorias padrão
const DEFAULT_CATEGORIAS = [
    { id: 1, nome: 'Salário', emoji: '💳', tipo: 'receita' },
    { id: 2, nome: 'Freelance', emoji: '💻', tipo: 'receita' },
    { id: 3, nome: 'Investimento', emoji: '📈', tipo: 'receita' },
    { id: 4, nome: 'Alimentação', emoji: '🍔', tipo: 'despesa' },
    { id: 5, nome: 'Roupas', emoji: '👕', tipo: 'despesa' },
    { id: 6, nome: 'Moradia', emoji: '🏠', tipo: 'despesa' },
    { id: 7, nome: 'Transporte', emoji: '🚗', tipo: 'despesa' },
    { id: 8, nome: 'Saúde', emoji: '💊', tipo: 'despesa' },
    { id: 9, nome: 'Educação', emoji: '🎓', tipo: 'despesa' },
    { id: 10, nome: 'Entretenimento', emoji: '🎮', tipo: 'despesa' }
];

// ==================== CLASSE DE DADOS ====================
class FinanceManager {
    constructor() {
        this.receitas = this.loadFromStorage(STORAGE_KEY.RECEITAS) || [];
        this.despesas = this.loadFromStorage(STORAGE_KEY.DESPESAS) || [];
        this.cartoes = this.loadFromStorage(STORAGE_KEY.CARTOES) || [];
        this.categorias = this.loadFromStorage(STORAGE_KEY.CATEGORIAS) || DEFAULT_CATEGORIAS;
        this.alertas = this.loadFromStorage(STORAGE_KEY.ALERTAS) || [];
        this.nextId = {
            receita: this.getMaxId(this.receitas) + 1,
            despesa: this.getMaxId(this.despesas) + 1,
            cartao: this.getMaxId(this.cartoes) + 1,
            categoria: this.getMaxId(this.categorias) + 1,
            alerta: this.getMaxId(this.alertas) + 1
        };
    }

    getMaxId(arr) {
        return arr.length > 0 ? Math.max(...arr.map(item => item.id)) : 0;
    }

    loadFromStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            console.error('Erro ao carregar do localStorage:', e);
            return null;
        }
    }

    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Erro ao salvar no localStorage:', e);
            alert('Espaço de armazenamento cheio!');
        }
    }

    // ==================== RECEITAS ====================
    adicionarReceita(dados) {
        const receita = {
            id: this.nextId.receita++,
            ...dados,
            data: new Date(dados.data).getTime()
        };
        this.receitas.push(receita);
        this.saveToStorage(STORAGE_KEY.RECEITAS, this.receitas);
        return receita;
    }

    editarReceita(id, dados) {
        const index = this.receitas.findIndex(r => r.id === id);
        if (index !== -1) {
            this.receitas[index] = {
                ...this.receitas[index],
                ...dados,
                data: new Date(dados.data).getTime()
            };
            this.saveToStorage(STORAGE_KEY.RECEITAS, this.receitas);
            return this.receitas[index];
        }
    }

    deletarReceita(id) {
        this.receitas = this.receitas.filter(r => r.id !== id);
        this.saveToStorage(STORAGE_KEY.RECEITAS, this.receitas);
    }

    // ==================== DESPESAS ====================
    adicionarDespesa(dados) {
        const despesa = {
            id: this.nextId.despesa++,
            ...dados,
            data: new Date(dados.data).getTime()
        };
        this.despesas.push(despesa);
        this.saveToStorage(STORAGE_KEY.DESPESAS, this.despesas);
        return despesa;
    }

    editarDespesa(id, dados) {
        const index = this.despesas.findIndex(d => d.id === id);
        if (index !== -1) {
            this.despesas[index] = {
                ...this.despesas[index],
                ...dados,
                data: new Date(dados.data).getTime()
            };
            this.saveToStorage(STORAGE_KEY.DESPESAS, this.despesas);
            return this.despesas[index];
        }
    }

    deletarDespesa(id) {
        this.despesas = this.despesas.filter(d => d.id !== id);
        this.saveToStorage(STORAGE_KEY.DESPESAS, this.despesas);
    }

    // ==================== CARTÕES ====================
    adicionarCartao(dados) {
        const cartao = {
            id: this.nextId.cartao++,
            ...dados
        };
        this.cartoes.push(cartao);
        this.saveToStorage(STORAGE_KEY.CARTOES, this.cartoes);
        return cartao;
    }

    editarCartao(id, dados) {
        const index = this.cartoes.findIndex(c => c.id === id);
        if (index !== -1) {
            this.cartoes[index] = { ...this.cartoes[index], ...dados };
            this.saveToStorage(STORAGE_KEY.CARTOES, this.cartoes);
            return this.cartoes[index];
        }
    }

    deletarCartao(id) {
        this.cartoes = this.cartoes.filter(c => c.id !== id);
        this.saveToStorage(STORAGE_KEY.CARTOES, this.cartoes);
    }

    // ==================== CATEGORIAS ====================
    adicionarCategoria(dados) {
        const categoria = {
            id: this.nextId.categoria++,
            ...dados
        };
        this.categorias.push(categoria);
        this.saveToStorage(STORAGE_KEY.CATEGORIAS, this.categorias);
        return categoria;
    }

    editarCategoria(id, dados) {
        const index = this.categorias.findIndex(c => c.id === id);
        if (index !== -1) {
            this.categorias[index] = { ...this.categorias[index], ...dados };
            this.saveToStorage(STORAGE_KEY.CATEGORIAS, this.categorias);
            return this.categorias[index];
        }
    }

    deletarCategoria(id) {
        this.categorias = this.categorias.filter(c => c.id !== id);
        this.saveToStorage(STORAGE_KEY.CATEGORIAS, this.categorias);
    }

    // ==================== ALERTAS ====================
    adicionarAlerta(dados) {
        const alerta = {
            id: this.nextId.alerta++,
            ...dados,
            dataCriacao: Date.now(),
            data: new Date(dados.data).getTime()
        };
        this.alertas.push(alerta);
        this.saveToStorage(STORAGE_KEY.ALERTAS, this.alertas);
        return alerta;
    }

    editarAlerta(id, dados) {
        const index = this.alertas.findIndex(a => a.id === id);
        if (index !== -1) {
            this.alertas[index] = {
                ...this.alertas[index],
                ...dados,
                data: new Date(dados.data).getTime()
            };
            this.saveToStorage(STORAGE_KEY.ALERTAS, this.alertas);
            return this.alertas[index];
        }
    }

    deletarAlerta(id) {
        this.alertas = this.alertas.filter(a => a.id !== id);
        this.saveToStorage(STORAGE_KEY.ALERTAS, this.alertas);
    }

    // ==================== CÁLCULOS ====================
    getTotalReceitas(mes = null) {
        return this.receitas
            .filter(r => !mes || this.getMesAno(r.data) === mes)
            .reduce((total, r) => total + parseFloat(r.valor || 0), 0);
    }

    getTotalDespesas(mes = null) {
        return this.despesas
            .filter(d => !mes || this.getMesAno(d.data) === mes)
            .reduce((total, d) => total + parseFloat(d.valor || 0), 0);
    }

    getSaldo() {
        return this.getTotalReceitas() - this.getTotalDespesas();
    }

    getMesAno(timestamp) {
        const data = new Date(timestamp);
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    }

    getCategoriasAtivas(tipo) {
        return this.categorias.filter(c => c.tipo === tipo);
    }

    getDespesasPorCartao(cartaoId) {
        return this.despesas.filter(d => d.cartaoId === cartaoId && d.tipo === 'cartao');
    }

    getTotalPorCategoria(tipo = 'despesa') {
        const dados = tipo === 'despesa' ? this.despesas : this.receitas;
        const totais = {};
        dados.forEach(item => {
            totais[item.categoriaId] = (totais[item.categoriaId] || 0) + parseFloat(item.valor || 0);
        });
        return totais;
    }

    exportarDados() {
        return {
            receitas: this.receitas,
            despesas: this.despesas,
            cartoes: this.cartoes,
            categorias: this.categorias,
            alertas: this.alertas,
            dataExport: new Date().toISOString()
        };
    }

    importarDados(dados) {
        try {
            this.receitas = dados.receitas || [];
            this.despesas = dados.despesas || [];
            this.cartoes = dados.cartoes || [];
            this.categorias = dados.categorias || DEFAULT_CATEGORIAS;
            this.alertas = dados.alertas || [];

            this.saveToStorage(STORAGE_KEY.RECEITAS, this.receitas);
            this.saveToStorage(STORAGE_KEY.DESPESAS, this.despesas);
            this.saveToStorage(STORAGE_KEY.CARTOES, this.cartoes);
            this.saveToStorage(STORAGE_KEY.CATEGORIAS, this.categorias);
            this.saveToStorage(STORAGE_KEY.ALERTAS, this.alertas);

            return true;
        } catch (e) {
            console.error('Erro ao importar dados:', e);
            return false;
        }
    }

    limparTudo() {
        this.receitas = [];
        this.despesas = [];
        this.cartoes = [];
        this.categorias = DEFAULT_CATEGORIAS;
        this.alertas = [];
        this.nextId = { receita: 1, despesa: 1, cartao: 1, categoria: 11, alerta: 1 };

        localStorage.clear();
    }
}

// ==================== GERENCIADOR DE UI ====================
class UIManager {
    constructor(financeManager) {
        this.fm = financeManager;
        this.chartInstances = {};
        this.currentEditingId = null;
        this.editingType = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.atualizarData();
        this.renderDashboard();
    }

    setupEventListeners() {
        // Navigation - com fechamento automático em mobile
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.mudarPagina(e);
                // Fechar sidebar em mobile após clicar
                if (window.innerWidth <= 768) {
                    document.querySelector('.sidebar').classList.remove('active');
                    document.getElementById('sidebarOverlay').classList.remove('active');
                }
            });
        });

        // Menu toggle
        document.getElementById('btnMenuToggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
            document.getElementById('sidebarOverlay').classList.toggle('active');
        });

        // Sidebar overlay click to close
        document.getElementById('sidebarOverlay').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
        });

        // Sidebar collapse toggle (desktop)
        const btnCollapseSidebar = document.getElementById('btnCollapseSidebar');
        if (btnCollapseSidebar) {
            btnCollapseSidebar.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const sidebar = document.querySelector('.sidebar');
                sidebar.classList.toggle('collapsed');
                // Salvar preferência do usuário
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            });
        }

        // Restaurar estado da sidebar ao carregar
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            document.querySelector('.sidebar').classList.add('collapsed');
        }

        // Dashboard - Receitas
        document.getElementById('btnNovaReceita').addEventListener('click', () => {
            this.mostrarFormReceita();
        });
        document.getElementById('btnCancelReceita').addEventListener('click', () => {
            this.esconderFormReceita();
        });
        document.getElementById('formReceita').addEventListener('submit', (e) => {
            this.salvarReceita(e);
        });

        // Dashboard - Despesas
        document.getElementById('btnNovaDespesa').addEventListener('click', () => {
            this.mostrarFormDespesa();
        });
        document.getElementById('btnCancelDespesa').addEventListener('click', () => {
            this.esconderFormDespesa();
        });
        document.getElementById('despesaTipo').addEventListener('change', (e) => {
            document.getElementById('groupCartaoDespesa').style.display =
                e.target.value === 'cartao' ? 'block' : 'none';
        });
        document.getElementById('formDespesa').addEventListener('submit', (e) => {
            this.salvarDespesa(e);
        });

        // Cartões
        document.getElementById('btnNovoCartao').addEventListener('click', () => {
            this.mostrarFormCartao();
        });
        document.getElementById('btnCancelCartao').addEventListener('click', () => {
            this.esconderFormCartao();
        });
        document.getElementById('formCartao').addEventListener('submit', (e) => {
            this.salvarCartao(e);
        });

        // Categorias
        document.getElementById('btnNovaCategoria').addEventListener('click', () => {
            this.mostrarFormCategoria();
        });
        document.getElementById('btnCancelCategoria').addEventListener('click', () => {
            this.esconderFormCategoria();
        });
        document.getElementById('formCategoria').addEventListener('submit', (e) => {
            this.salvarCategoria(e);
        });

        // Alertas
        document.getElementById('btnNovoAlerta').addEventListener('click', () => {
            this.abrirModalAlerta();
        });
        document.getElementById('formAlerta').addEventListener('submit', (e) => {
            this.salvarAlerta(e);
        });

        // Busca e filtros
        document.getElementById('searchReceitas')?.addEventListener('input', () => {
            this.renderReceitas();
        });
        document.getElementById('filterReceitaCategoria')?.addEventListener('change', () => {
            this.renderReceitas();
        });
        document.getElementById('searchDespesas')?.addEventListener('input', () => {
            this.renderDespesas();
        });
        document.getElementById('filterDespesaCategoria')?.addEventListener('change', () => {
            this.renderDespesas();
        });

        // Dados
        document.getElementById('btnSelectImport').addEventListener('click', () => {
            document.getElementById('inputImportFile').click();
        });
        document.getElementById('inputImportFile').addEventListener('change', (e) => {
            this.importarDados(e);
        });
        document.getElementById('btnExportData').addEventListener('click', () => {
            this.exportarDados();
        });
        document.getElementById('btnClearAll').addEventListener('click', () => {
            if (confirm('Tem certeza? Esta ação não pode ser desfeita!')) {
                this.limparTudo();
            }
        });

        // Modais
        document.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                document.getElementById(modalId).classList.remove('active');
            });
        });

        document.querySelectorAll('[data-modal]').forEach(btn => {
            if (btn.classList.contains('btn-secondary')) {
                btn.addEventListener('click', (e) => {
                    const modalId = e.target.getAttribute('data-modal');
                    document.getElementById(modalId).classList.remove('active');
                });
            }
        });

        // Fechar modal ao clicar fora
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    atualizarData() {
        const hoje = new Date();
        const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
        document.getElementById('dateToday').textContent = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
    }

    mudarPagina(e) {
        e.preventDefault();
        const pagina = e.currentTarget.getAttribute('data-page');
        
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pagina).classList.add('active');

        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');

        document.getElementById('pageTitle').textContent =
            e.currentTarget.querySelector('span').textContent;

        document.querySelector('.sidebar').classList.remove('active');

        switch (pagina) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'receitas':
                this.renderReceitas();
                break;
            case 'despesas':
                this.renderDespesas();
                break;
            case 'cartoes':
                this.renderCartoes();
                break;
            case 'categorias':
                this.renderCategorias();
                break;
            case 'graficos':
                this.renderGraficos();
                break;
            case 'dados':
                this.atualizarInfoArmazenamento();
                break;
        }
    }

    // ==================== DASHBOARD ====================
    renderDashboard() {
        this.atualizarStats();
        this.renderAlerts();
        this.renderRecentTransactions();
        this.renderCategorySummary();
    }

    atualizarStats() {
        const totalReceita = this.fm.getTotalReceitas();
        const totalDespesa = this.fm.getTotalDespesas();
        const saldo = this.fm.getSaldo();

        document.getElementById('statReceita').textContent = this.formatarMoeda(totalReceita);
        document.getElementById('statDespesa').textContent = this.formatarMoeda(totalDespesa);
        document.getElementById('statSaldo').textContent = this.formatarMoeda(saldo);
        document.getElementById('statCartoes').textContent = this.fm.cartoes.length;
    }

    renderAlerts() {
        const alertsList = document.getElementById('alertsList');
        const alertas = this.fm.alertas.sort((a, b) => new Date(a.data) - new Date(b.data));

        if (alertas.length === 0) {
            alertsList.innerHTML = '<p class="empty-state">Nenhum alerta no momento</p>';
            return;
        }

        alertsList.innerHTML = alertas.map(alerta => {
            const data = new Date(alerta.data);
            const dataFormatada = data.toLocaleDateString('pt-BR');
            return `
                <div class="alert-card ${alerta.prioridade}">
                    <div class="alert-content">
                        <div class="alert-title">${this.escaparHtml(alerta.titulo)}</div>
                        <div class="alert-date">📅 ${dataFormatada}</div>
                        ${alerta.descricao ? `<div class="alert-desc">${this.escaparHtml(alerta.descricao)}</div>` : ''}
                    </div>
                    <div class="alert-actions">
                        <button class="btn-xs btn-edit" onclick="uiManager.editarAlerta(${alerta.id})">✏️</button>
                        <button class="btn-xs btn-delete" onclick="uiManager.deletarAlertaUI(${alerta.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentTransactions() {
        const listContainer = document.getElementById('transactionsList');
        const todasTransacoes = [
            ...this.fm.receitas.map(r => ({
                ...r,
                tipo: 'receita',
                emoji: this.getEmojiCategoria(r.categoriaId)
            })),
            ...this.fm.despesas.map(d => ({
                ...d,
                tipo: 'despesa',
                emoji: this.getEmojiCategoria(d.categoriaId)
            }))
        ].sort((a, b) => b.data - a.data).slice(0, 5);

        if (todasTransacoes.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">Nenhuma transação registrada</p>';
            return;
        }

        listContainer.innerHTML = todasTransacoes.map(transacao => {
            const categoria = this.getCategoria(transacao.categoriaId);
            const data = new Date(transacao.data).toLocaleDateString('pt-BR');
            return `
                <div class="transaction-item">
                    <div class="transaction-left">
                        <div class="transaction-icon">${transacao.emoji}</div>
                        <div class="transaction-info">
                            <h4>${categoria?.nome || 'Sem categoria'}</h4>
                            <p>${data}</p>
                        </div>
                    </div>
                    <div class="transaction-value ${transacao.tipo}">
                        ${transacao.tipo === 'receita' ? '+' : '-'} ${this.formatarMoeda(transacao.valor)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderCategorySummary() {
        const summaryContainer = document.getElementById('categorySummary');
        const totaisPorCategoria = this.fm.getTotalPorCategoria('despesa');

        if (Object.keys(totaisPorCategoria).length === 0) {
            summaryContainer.innerHTML = '<p class="empty-state">Nenhuma categoria com dados</p>';
            return;
        }

        summaryContainer.innerHTML = Object.entries(totaisPorCategoria)
            .sort((a, b) => b[1] - a[1])
            .map(([catId, total]) => {
                const categoria = this.getCategoria(parseInt(catId));
                return `
                    <div class="summary-item">
                        <div class="summary-emoji">${categoria?.emoji}</div>
                        <div class="summary-name">${categoria?.nome}</div>
                        <div class="summary-value">${this.formatarMoeda(total)}</div>
                    </div>
                `;
            }).join('');
    }

    // ==================== RECEITAS ====================
    mostrarFormReceita() {
        this.currentEditingId = null;
        this.editingType = 'receita';
        document.getElementById('formReceita').reset();
        document.getElementById('receitaData').valueAsDate = new Date();
        this.atualizarSelectCategorias('receita', 'receitaCategoria');
        document.querySelector('.form-receita').style.display = 'block';
        document.querySelector('.form-receita').scrollIntoView({ behavior: 'smooth' });
    }

    esconderFormReceita() {
        document.querySelector('.form-receita').style.display = 'none';
        this.currentEditingId = null;
    }

    salvarReceita(e) {
        e.preventDefault();
        const valor = parseFloat(document.getElementById('receitaValor').value);
        const data = document.getElementById('receitaData').value;
        const categoriaId = parseInt(document.getElementById('receitaCategoria').value);
        const descricao = document.getElementById('receitaDescricao').value;

        if (this.currentEditingId) {
            this.fm.editarReceita(this.currentEditingId, { valor, data, categoriaId, descricao });
        } else {
            this.fm.adicionarReceita({ valor, data, categoriaId, descricao });
        }

        this.esconderFormReceita();
        this.renderDashboard();
        this.renderReceitas();
    }

    renderReceitas() {
        this.atualizarSelectCategorias('receita', 'filterReceitaCategoria');
        const searchTerm = (document.getElementById('searchReceitas')?.value || '').toLowerCase();
        const categoriaFilter = document.getElementById('filterReceitaCategoria')?.value;

        let receitas = this.fm.receitas;

        if (searchTerm) {
            receitas = receitas.filter(r => {
                const categoria = this.getCategoria(r.categoriaId);
                return categoria?.nome.toLowerCase().includes(searchTerm) ||
                    r.descricao?.toLowerCase().includes(searchTerm);
            });
        }

        if (categoriaFilter) {
            receitas = receitas.filter(r => r.categoriaId === parseInt(categoriaFilter));
        }

        receitas.sort((a, b) => b.data - a.data);

        const container = document.getElementById('receitasList');
        if (receitas.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma receita cadastrada</p>';
            return;
        }

        container.innerHTML = receitas.map(receita => {
            const categoria = this.getCategoria(receita.categoriaId);
            const data = new Date(receita.data).toLocaleDateString('pt-BR');
            return `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-item-icon">${categoria?.emoji}</div>
                        <div class="list-item-content">
                            <div class="list-item-name">${categoria?.nome}</div>
                            <div class="list-item-desc">${data} ${receita.descricao ? '- ' + receita.descricao : ''}</div>
                        </div>
                    </div>
                    <div class="list-item-right">
                        <div class="list-item-value receita">+${this.formatarMoeda(receita.valor)}</div>
                        <div class="list-item-actions">
                            <button class="btn-icon" onclick="uiManager.editarReceita(${receita.id})">✏️</button>
                            <button class="btn-icon" onclick="uiManager.deletarReceitaUI(${receita.id})">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    editarReceita(id) {
        const receita = this.fm.receitas.find(r => r.id === id);
        if (!receita) return;

        this.currentEditingId = id;
        this.editingType = 'receita';
        document.getElementById('receitaValor').value = receita.valor;
        document.getElementById('receitaData').valueAsDate = new Date(receita.data);
        document.getElementById('receitaCategoria').value = receita.categoriaId;
        document.getElementById('receitaDescricao').value = receita.descricao || '';

        document.querySelector('.form-receita').style.display = 'block';
        document.querySelector('.form-receita').scrollIntoView({ behavior: 'smooth' });
    }

    deletarReceitaUI(id) {
        if (confirm('Tem certeza que deseja deletar esta receita?')) {
            this.fm.deletarReceita(id);
            this.renderDashboard();
            this.renderReceitas();
        }
    }

    // ==================== DESPESAS ====================
    mostrarFormDespesa() {
        this.currentEditingId = null;
        this.editingType = 'despesa';
        document.getElementById('formDespesa').reset();
        document.getElementById('despesaData').valueAsDate = new Date();
        document.getElementById('despesaTipo').value = 'normal';
        document.getElementById('groupCartaoDespesa').style.display = 'none';
        this.atualizarSelectCategorias('despesa', 'despesaCategoria');
        this.atualizarSelectCartoes('despesaCartao');
        document.querySelector('.form-despesa').style.display = 'block';
        document.querySelector('.form-despesa').scrollIntoView({ behavior: 'smooth' });
    }

    esconderFormDespesa() {
        document.querySelector('.form-despesa').style.display = 'none';
        this.currentEditingId = null;
    }

    salvarDespesa(e) {
        e.preventDefault();
        const valor = parseFloat(document.getElementById('despesaValor').value);
        const data = document.getElementById('despesaData').value;
        const categoriaId = parseInt(document.getElementById('despesaCategoria').value);
        const tipo = document.getElementById('despesaTipo').value;
        const cartaoId = tipo === 'cartao' ? parseInt(document.getElementById('despesaCartao').value) : null;
        const descricao = document.getElementById('despesaDescricao').value;

        if (this.currentEditingId) {
            this.fm.editarDespesa(this.currentEditingId, { valor, data, categoriaId, tipo, cartaoId, descricao });
        } else {
            this.fm.adicionarDespesa({ valor, data, categoriaId, tipo, cartaoId, descricao });
        }

        this.esconderFormDespesa();
        this.renderDashboard();
        this.renderDespesas();
        this.renderCartoes();
    }

    renderDespesas() {
        this.atualizarSelectCategorias('despesa', 'filterDespesaCategoria');
        const searchTerm = (document.getElementById('searchDespesas')?.value || '').toLowerCase();
        const categoriaFilter = document.getElementById('filterDespesaCategoria')?.value;

        let despesas = this.fm.despesas;

        if (searchTerm) {
            despesas = despesas.filter(d => {
                const categoria = this.getCategoria(d.categoriaId);
                return categoria?.nome.toLowerCase().includes(searchTerm) ||
                    d.descricao?.toLowerCase().includes(searchTerm);
            });
        }

        if (categoriaFilter) {
            despesas = despesas.filter(d => d.categoriaId === parseInt(categoriaFilter));
        }

        despesas.sort((a, b) => b.data - a.data);

        const container = document.getElementById('despesasList');
        if (despesas.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma despesa cadastrada</p>';
            return;
        }

        container.innerHTML = despesas.map(despesa => {
            const categoria = this.getCategoria(despesa.categoriaId);
            const data = new Date(despesa.data).toLocaleDateString('pt-BR');
            const cartao = despesa.tipo === 'cartao' ? this.fm.cartoes.find(c => c.id === despesa.cartaoId) : null;
            return `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-item-icon">${categoria?.emoji}</div>
                        <div class="list-item-content">
                            <div class="list-item-name">${categoria?.nome}</div>
                            <div class="list-item-desc">${data} ${cartao ? `- ${cartao.nome}` : ''} ${despesa.descricao ? '- ' + despesa.descricao : ''}</div>
                        </div>
                    </div>
                    <div class="list-item-right">
                        <div class="list-item-value despesa">-${this.formatarMoeda(despesa.valor)}</div>
                        <div class="list-item-actions">
                            <button class="btn-icon" onclick="uiManager.editarDespesa(${despesa.id})">✏️</button>
                            <button class="btn-icon" onclick="uiManager.deletarDespesaUI(${despesa.id})">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    editarDespesa(id) {
        const despesa = this.fm.despesas.find(d => d.id === id);
        if (!despesa) return;

        this.currentEditingId = id;
        this.editingType = 'despesa';
        document.getElementById('despesaValor').value = despesa.valor;
        document.getElementById('despesaData').valueAsDate = new Date(despesa.data);
        document.getElementById('despesaCategoria').value = despesa.categoriaId;
        document.getElementById('despesaTipo').value = despesa.tipo || 'normal';
        document.getElementById('groupCartaoDespesa').style.display = despesa.tipo === 'cartao' ? 'block' : 'none';
        this.atualizarSelectCartoes('despesaCartao');
        if (despesa.cartaoId) document.getElementById('despesaCartao').value = despesa.cartaoId;
        document.getElementById('despesaDescricao').value = despesa.descricao || '';

        document.querySelector('.form-despesa').style.display = 'block';
        document.querySelector('.form-despesa').scrollIntoView({ behavior: 'smooth' });
    }

    deletarDespesaUI(id) {
        if (confirm('Tem certeza que deseja deletar esta despesa?')) {
            this.fm.deletarDespesa(id);
            this.renderDashboard();
            this.renderDespesas();
            this.renderCartoes();
        }
    }

    // ==================== CARTÕES ====================
    mostrarFormCartao() {
        this.currentEditingId = null;
        document.getElementById('formCartao').reset();
        document.getElementById('cartaoCor').value = '#4CAF50';
        document.querySelector('.form-cartao').style.display = 'block';
        document.querySelector('.form-cartao').scrollIntoView({ behavior: 'smooth' });
    }

    esconderFormCartao() {
        document.querySelector('.form-cartao').style.display = 'none';
        this.currentEditingId = null;
    }

    salvarCartao(e) {
        e.preventDefault();
        const nome = document.getElementById('cartaoNome').value;
        const banda = document.getElementById('cartaoBanda').value;
        const limite = parseFloat(document.getElementById('cartaoLimite').value);
        const vencimento = parseInt(document.getElementById('cartaoVencimento').value);
        const cor = document.getElementById('cartaoCor').value;

        if (this.currentEditingId) {
            this.fm.editarCartao(this.currentEditingId, { nome, banda, limite, vencimento, cor });
        } else {
            this.fm.adicionarCartao({ nome, banda, limite, vencimento, cor });
        }

        this.esconderFormCartao();
        this.renderCartoes();
        this.renderDashboard();
    }

    renderCartoes() {
        const container = document.getElementById('cartoesGrid');
        if (this.fm.cartoes.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum cartão cadastrado</p>';
            return;
        }

        container.innerHTML = this.fm.cartoes.map(cartao => {
            const despesasCartao = this.fm.getDespesasPorCartao(cartao.id);
            const totalGasto = despesasCartao.reduce((total, d) => total + parseFloat(d.valor || 0), 0);
            const percentualUso = ((totalGasto / cartao.limite) * 100).toFixed(0);

            return `
                <div class="cartao-card" style="background: linear-gradient(135deg, ${cartao.cor} 0%, ${this.escurecer(cartao.cor)} 100%);">
                    <div class="cartao-header">
                        <div class="cartao-bandeira">${cartao.banda.toUpperCase()}</div>
                        <div class="cartao-actions">
                            <button onclick="uiManager.editarCartao(${cartao.id})" style="cursor: pointer;">✏️</button>
                            <button onclick="uiManager.deletarCartaoUI(${cartao.id})" style="cursor: pointer;">🗑️</button>
                        </div>
                    </div>
                    <div class="cartao-info">
                        <div class="cartao-nome">${this.escaparHtml(cartao.nome)}</div>
                        <div class="cartao-numero">•••• •••• •••• ••••</div>
                    </div>
                    <div class="cartao-footer">
                        <div class="cartao-vencimento">Vence no dia ${cartao.vencimento}</div>
                        <div class="cartao-limite">
                            <span class="cartao-limite-label">Gasto (${percentualUso}%)</span>
                            <span class="cartao-limite-valor">${this.formatarMoeda(totalGasto)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Renderizar despesas por cartão
        const despesasSection = document.getElementById('cartaoDespesasSection');
        const cartaoDespesasList = document.getElementById('cartaoDespesasList');

        if (this.fm.cartoes.length > 0) {
            despesasSection.style.display = 'block';
            cartaoDespesasList.innerHTML = this.fm.cartoes.map(cartao => {
                const despesas = this.fm.getDespesasPorCartao(cartao.id);
                const total = despesas.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0);

                if (despesas.length === 0) return '';

                return `
                    <div style="margin-bottom: 24px;">
                        <h4>${this.escaparHtml(cartao.nome)}</h4>
                        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                            Total: ${this.formatarMoeda(total)}
                        </p>
                        ${despesas.map(d => {
                            const cat = this.getCategoria(d.categoriaId);
                            const data = new Date(d.data).toLocaleDateString('pt-BR');
                            return `
                                <div style="font-size: 13px; padding: 8px; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 4px;">
                                    ${cat?.emoji} ${cat?.nome} - ${this.formatarMoeda(d.valor)} (${data})
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }).join('');
        }
    }

    editarCartao(id) {
        const cartao = this.fm.cartoes.find(c => c.id === id);
        if (!cartao) return;

        this.currentEditingId = id;
        document.getElementById('cartaoNome').value = cartao.nome;
        document.getElementById('cartaoBanda').value = cartao.banda;
        document.getElementById('cartaoLimite').value = cartao.limite;
        document.getElementById('cartaoVencimento').value = cartao.vencimento;
        document.getElementById('cartaoCor').value = cartao.cor;

        document.querySelector('.form-cartao').style.display = 'block';
        document.querySelector('.form-cartao').scrollIntoView({ behavior: 'smooth' });
    }

    deletarCartaoUI(id) {
        if (confirm('Tem certeza que deseja deletar este cartão? As despesas não serão deletadas.')) {
            this.fm.deletarCartao(id);
            this.renderCartoes();
            this.renderDashboard();
        }
    }

    // ==================== CATEGORIAS ====================
    mostrarFormCategoria() {
        this.currentEditingId = null;
        document.getElementById('formCategoria').reset();
        document.querySelector('.form-categoria').style.display = 'block';
        document.querySelector('.form-categoria').scrollIntoView({ behavior: 'smooth' });
    }

    esconderFormCategoria() {
        document.querySelector('.form-categoria').style.display = 'none';
        this.currentEditingId = null;
    }

    salvarCategoria(e) {
        e.preventDefault();
        const nome = document.getElementById('categoriaNome').value;
        const emoji = document.getElementById('categoriaEmoji').value;
        const tipo = document.getElementById('categoriaTipo').value;

        if (this.currentEditingId) {
            this.fm.editarCategoria(this.currentEditingId, { nome, emoji, tipo });
        } else {
            this.fm.adicionarCategoria({ nome, emoji, tipo });
        }

        this.esconderFormCategoria();
        this.renderCategorias();
        this.renderReceitas();
        this.renderDespesas();
        this.renderDashboard();
    }

    renderCategorias() {
        const receitaList = document.getElementById('categoriasReceitaList');
        const despesaList = document.getElementById('categoriasDepesaList');

        const categoriasReceita = this.fm.getCategoriasAtivas('receita');
        const categoriasDespesa = this.fm.getCategoriasAtivas('despesa');

        receitaList.innerHTML = categoriasReceita.length === 0
            ? '<p class="empty-state">Nenhuma categoria de receita</p>'
            : categoriasReceita.map(cat => this.renderCategoriaItem(cat)).join('');

        despesaList.innerHTML = categoriasDespesa.length === 0
            ? '<p class="empty-state">Nenhuma categoria de despesa</p>'
            : categoriasDespesa.map(cat => this.renderCategoriaItem(cat)).join('');
    }

    renderCategoriaItem(cat) {
        return `
            <div class="categoria-item">
                <div class="categoria-left">
                    <div class="categoria-emoji">${cat.emoji}</div>
                    <div class="categoria-nome">${this.escaparHtml(cat.nome)}</div>
                </div>
                <div class="categoria-actions">
                    <button class="btn-icon" onclick="uiManager.editarCategoria(${cat.id})">✏️</button>
                    <button class="btn-icon" onclick="uiManager.deletarCategoriaUI(${cat.id})">🗑️</button>
                </div>
            </div>
        `;
    }

    editarCategoria(id) {
        const categoria = this.fm.categorias.find(c => c.id === id);
        if (!categoria) return;

        this.currentEditingId = id;
        document.getElementById('categoriaNome').value = categoria.nome;
        document.getElementById('categoriaEmoji').value = categoria.emoji;
        document.getElementById('categoriaTipo').value = categoria.tipo;

        document.querySelector('.form-categoria').style.display = 'block';
        document.querySelector('.form-categoria').scrollIntoView({ behavior: 'smooth' });
    }

    deletarCategoriaUI(id) {
        if (confirm('Tem certeza que deseja deletar esta categoria?')) {
            this.fm.deletarCategoria(id);
            this.renderCategorias();
            this.renderDashboard();
        }
    }

    // ==================== GRÁFICOS ====================
    renderGraficos() {
        setTimeout(() => {
            this.criarGraficoPizza();
            this.criarGraficoLinha();
            this.criarGraficoBarras();
            this.criarGraficoCartao();
        }, 100);
    }

    criarGraficoPizza() {
        const ctx = document.getElementById('chartPie');
        if (!ctx) return;

        const totais = this.fm.getTotalPorCategoria('despesa');
        const labels = [];
        const dados = [];
        const cores = [];

        Object.entries(totais).forEach(([catId, total]) => {
            const categoria = this.getCategoria(parseInt(catId));
            labels.push(categoria?.nome || 'Sem categoria');
            dados.push(total);
            cores.push(this.gerarCor(parseInt(catId)));
        });

        if (this.chartInstances.pie) this.chartInstances.pie.destroy();

        this.chartInstances.pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: dados,
                    backgroundColor: cores,
                    borderColor: 'var(--bg-primary)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    criarGraficoLinha() {
        const ctx = document.getElementById('chartLine');
        if (!ctx) return;

        const ultimosMeses = this.getUltimosMeses(6);
        const receitas = ultimosMeses.map(mes => this.fm.getTotalReceitas(mes));
        const despesas = ultimosMeses.map(mes => this.fm.getTotalDespesas(mes));

        if (this.chartInstances.line) this.chartInstances.line.destroy();

        this.chartInstances.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ultimosMeses.map(m => {
                    const [ano, mes] = m.split('-');
                    return new Date(ano, parseInt(mes) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                }),
                datasets: [
                    {
                        label: 'Receitas',
                        data: receitas,
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Despesas',
                        data: despesas,
                        borderColor: '#F44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => 'R$ ' + value.toFixed(0)
                        }
                    }
                }
            }
        });
    }

    criarGraficoBarras() {
        const ctx = document.getElementById('chartBar');
        if (!ctx) return;

        const totais = this.fm.getTotalPorCategoria('despesa');
        const labels = [];
        const dados = [];
        const cores = [];

        Object.entries(totais)
            .sort((a, b) => b[1] - a[1])
            .forEach(([catId, total]) => {
                const categoria = this.getCategoria(parseInt(catId));
                labels.push(categoria?.nome || 'Sem categoria');
                dados.push(total);
                cores.push(this.gerarCor(parseInt(catId)));
            });

        if (this.chartInstances.bar) this.chartInstances.bar.destroy();

        this.chartInstances.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Despesa (R$)',
                    data: dados,
                    backgroundColor: cores,
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => 'R$ ' + value.toFixed(0)
                        }
                    }
                }
            }
        });
    }

    criarGraficoCartao() {
        const ctx = document.getElementById('chartCartao');
        if (!ctx) return;

        const labels = [];
        const dados = [];
        const cores = [];

        this.fm.cartoes.forEach((cartao, index) => {
            const despesas = this.fm.getDespesasPorCartao(cartao.id);
            const total = despesas.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0);
            labels.push(cartao.nome);
            dados.push(total);
            cores.push(cartao.cor);
        });

        if (this.chartInstances.cartao) this.chartInstances.cartao.destroy();

        if (labels.length === 0) {
            document.getElementById('chartCartao').parentElement.innerHTML = '<p class="empty-state">Nenhum cartão com despesas</p>';
            return;
        }

        this.chartInstances.cartao = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'Gastos (R$)',
                    data: dados,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => 'R$ ' + value.toFixed(0)
                        }
                    }
                }
            }
        });
    }

    // ==================== ALERTAS ====================
    abrirModalAlerta() {
        this.currentEditingId = null;
        document.getElementById('formAlerta').reset();
        document.getElementById('alertaData').valueAsDate = new Date();
        document.getElementById('alertaPrioridade').value = 'media';
        document.getElementById('modalAlerta').classList.add('active');
    }

    salvarAlerta(e) {
        e.preventDefault();
        const titulo = document.getElementById('alertaTitulo').value;
        const data = document.getElementById('alertaData').value;
        const descricao = document.getElementById('alertaDescricao').value;
        const prioridade = document.getElementById('alertaPrioridade').value;

        if (this.currentEditingId) {
            this.fm.editarAlerta(this.currentEditingId, { titulo, data, descricao, prioridade });
        } else {
            this.fm.adicionarAlerta({ titulo, data, descricao, prioridade });
        }

        document.getElementById('modalAlerta').classList.remove('active');
        this.renderAlerts();
        this.renderDashboard();
    }

    editarAlerta(id) {
        const alerta = this.fm.alertas.find(a => a.id === id);
        if (!alerta) return;

        this.currentEditingId = id;
        document.getElementById('alertaTitulo').value = alerta.titulo;
        document.getElementById('alertaData').valueAsDate = new Date(alerta.data);
        document.getElementById('alertaDescricao').value = alerta.descricao || '';
        document.getElementById('alertaPrioridade').value = alerta.prioridade;
        document.getElementById('modalAlerta').classList.add('active');
    }

    deletarAlertaUI(id) {
        if (confirm('Tem certeza que deseja deletar este alerta?')) {
            this.fm.deletarAlerta(id);
            this.renderAlerts();
        }
    }

    // ==================== DADOS ====================
    exportarDados() {
        const dados = this.fm.exportarDados();
        const dataStr = JSON.stringify(dados, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fincontrol-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        alert('Dados exportados com sucesso!');
    }

    importarDados(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const dados = JSON.parse(event.target.result);
                if (this.fm.importarDados(dados)) {
                    alert('Dados importados com sucesso!');
                    location.reload();
                } else {
                    alert('Erro ao importar dados!');
                }
            } catch (error) {
                alert('Arquivo inválido!');
            }
        };
        reader.readAsText(file);
    }

    limparTudo() {
        this.fm.limparTudo();
        alert('Todos os dados foram deletados!');
        location.reload();
    }

    atualizarInfoArmazenamento() {
        const dados = this.fm.exportarDados();
        const tamanho = JSON.stringify(dados).length;
        const limite = 5242880; // 5MB
        const percentual = ((tamanho / limite) * 100).toFixed(1);

        const storageUsed = document.getElementById('storageUsed');
        storageUsed.style.width = percentual + '%';

        const storageInfo = document.getElementById('storageInfo');
        storageInfo.textContent = `${(tamanho / 1024).toFixed(2)} KB de 5 MB utilizados (${percentual}%)`;
    }

    // ==================== UTILITÁRIOS ====================
    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    }

    escaparHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    getCategoria(id) {
        return this.fm.categorias.find(c => c.id === id);
    }

    getEmojiCategoria(id) {
        const categoria = this.getCategoria(id);
        return categoria?.emoji || '📌';
    }

    atualizarSelectCategorias(tipo, elementId) {
        const select = document.getElementById(elementId);
        if (!select) return;

        const categorias = this.fm.getCategoriasAtivas(tipo);
        const currentValue = select.value;

        if (elementId.includes('filter')) {
            select.innerHTML = '<option value="">Todas as categorias</option>';
            categorias.forEach(cat => {
                select.innerHTML += `<option value="${cat.id}">${cat.emoji} ${cat.nome}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">Selecione uma categoria</option>';
            categorias.forEach(cat => {
                select.innerHTML += `<option value="${cat.id}">${cat.emoji} ${cat.nome}</option>`;
            });
        }

        if (currentValue) select.value = currentValue;
    }

    atualizarSelectCartoes(elementId) {
        const select = document.getElementById(elementId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione um cartão</option>';
        this.fm.cartoes.forEach(cartao => {
            select.innerHTML += `<option value="${cartao.id}">${cartao.nome}</option>`;
        });

        if (currentValue) select.value = currentValue;
    }

    gerarCor(id) {
        const cores = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52C0A1'
        ];
        return cores[id % cores.length];
    }

    escurecer(cor) {
        const rgb = parseInt(cor.slice(1), 16);
        const r = Math.max(0, (rgb >> 16) - 30);
        const g = Math.max(0, ((rgb >> 8) & 0x00FF) - 30);
        const b = Math.max(0, (rgb & 0x0000FF) - 30);
        return `rgb(${r}, ${g}, ${b})`;
    }

    getUltimosMeses(quantidade) {
        const meses = [];
        const hoje = new Date();
        for (let i = quantidade - 1; i >= 0; i--) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const ano = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            meses.push(`${ano}-${mes}`);
        }
        return meses;
    }
}

// ==================== INICIALIZAÇÃO ====================
const financeManager = new FinanceManager();
const uiManager = new UIManager(financeManager);

// Verificar alertas diários ao carregar
window.addEventListener('load', () => {
    const hoje = new Date().toISOString().split('T')[0];
    const alertasHoje = financeManager.alertas.filter(a => {
        const dataAlerta = new Date(a.data).toISOString().split('T')[0];
        return dataAlerta === hoje;
    });

    if (alertasHoje.length > 0) {
        console.log(`Você tem ${alertasHoje.length} alerta(s) para hoje!`);
    }
});

// Auto-save a cada 30 segundos
setInterval(() => {
    financeManager.saveToStorage(STORAGE_KEY.RECEITAS, financeManager.receitas);
    financeManager.saveToStorage(STORAGE_KEY.DESPESAS, financeManager.despesas);
    financeManager.saveToStorage(STORAGE_KEY.CARTOES, financeManager.cartoes);
    financeManager.saveToStorage(STORAGE_KEY.CATEGORIAS, financeManager.categorias);
    financeManager.saveToStorage(STORAGE_KEY.ALERTAS, financeManager.alertas);
}, 30000);
