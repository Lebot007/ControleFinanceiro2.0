import { createContext, useContext, useEffect, useState } from 'react';
import { EstadoFinancas, Receita, Despesa, TipoDespesa, Meta, Alerta, ConfiguracaoAlertas } from '../types';
import { gerarAlertas } from '../services/AlertaService';

// Estado inicial padrão
const estadoInicial: EstadoFinancas = {
  receitas: [],
  despesas: [],
  tiposDespesa: [
    { id: '1', nome: 'Alimentação', cor: '#F59E0B' },
    { id: '2', nome: 'Transporte', cor: '#3B82F6' },
    { id: '3', nome: 'Moradia', cor: '#10B981' },
    { id: '4', nome: 'Lazer', cor: '#EC4899' },
    { id: '5', nome: 'Saúde', cor: '#EF4444' },
    { id: '6', nome: 'Educação', cor: '#8B5CF6' },
    { id: '7', nome: 'Contas Fixas', cor: '#6B7280' },
    { id: '8', nome: 'Outros', cor: '#9CA3AF' },
  ],
  metas: [],
  alertas: [],
  configuracao: {
    alertas: {
      saldoMinimo: 500,
      diasVencimento: 5,
      percentualAumento: 30,
      ativo: true,
      tiposAtivos: {
        vencimento: true,
        saldo: true,
        aumento: true
      }
    }
  }
};

interface FinancasContextType {
  estado: EstadoFinancas;
  adicionarReceita: (receita: Omit<Receita, 'id'>) => void;
  atualizarReceita: (receita: Receita) => void;
  removerReceita: (id: string) => void;
  
  adicionarDespesa: (despesa: Omit<Despesa, 'id'>) => void;
  atualizarDespesa: (despesa: Despesa) => void;
  removerDespesa: (id: string) => void;
  
  adicionarTipoDespesa: (tipo: Omit<TipoDespesa, 'id'>) => void;
  atualizarTipoDespesa: (tipo: TipoDespesa) => void;
  removerTipoDespesa: (id: string) => void;
  
  adicionarMeta: (meta: Omit<Meta, 'id'>) => void;
  atualizarMeta: (meta: Meta) => void;
  removerMeta: (id: string) => void;
  
  atualizarAlertas: () => void;
  marcarAlertaLido: (id: string) => void;
  removerAlerta: (id: string) => void;
  
  atualizarConfiguracaoAlertas: (config: ConfiguracaoAlertas) => void;
  
  exportarDados: () => void;
  importarDados: (dados: string) => boolean;
  resetarDados: () => void;
}

const FinancasContext = createContext<FinancasContextType | undefined>(undefined);

export const FinancasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<EstadoFinancas>(() => {
    try {
      const dadosSalvos = localStorage.getItem('financasPro');
      if (!dadosSalvos) return estadoInicial;

      const dadosParsed = JSON.parse(dadosSalvos);
      
      return {
        ...estadoInicial,
        ...dadosParsed,
        configuracao: {
          alertas: {
            ...estadoInicial.configuracao.alertas,
            ...(dadosParsed.configuracao?.alertas || {}),
            tiposAtivos: {
              ...estadoInicial.configuracao.alertas.tiposAtivos,
              ...(dadosParsed.configuracao?.alertas?.tiposAtivos || {})
            }
          }
        }
      };
    } catch (e) {
      console.error('Erro ao carregar dados do localStorage:', e);
      return estadoInicial;
    }
  });

  // Persistir estado no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem('financasPro', JSON.stringify(estado));
  }, [estado]);

  const gerarId = () => Math.random().toString(36).substring(2, 11);

  // Funções para gerenciar receitas
  const adicionarReceita = (receita: Omit<Receita, 'id'>) => {
    const novaReceita = { ...receita, id: gerarId() };
    setEstado(prev => ({
      ...prev,
      receitas: [...prev.receitas, novaReceita]
    }));
  };

  const atualizarReceita = (receita: Receita) => {
    setEstado(prev => ({
      ...prev,
      receitas: prev.receitas.map(r => r.id === receita.id ? receita : r)
    }));
  };

  const removerReceita = (id: string) => {
    setEstado(prev => ({
      ...prev,
      receitas: prev.receitas.filter(r => r.id !== id)
    }));
  };

  // Funções para gerenciar despesas
  const adicionarDespesa = (despesa: Omit<Despesa, 'id'>) => {
    const novaDespesa = { ...despesa, id: gerarId() };
    setEstado(prev => ({
      ...prev,
      despesas: [...prev.despesas, novaDespesa]
    }));
  };

  const atualizarDespesa = (despesa: Despesa) => {
    setEstado(prev => ({
      ...prev,
      despesas: prev.despesas.map(d => d.id === despesa.id ? despesa : d)
    }));
  };

  const removerDespesa = (id: string) => {
    setEstado(prev => ({
      ...prev,
      despesas: prev.despesas.filter(d => d.id !== id)
    }));
  };

  // Funções para gerenciar tipos de despesa
  const adicionarTipoDespesa = (tipo: Omit<TipoDespesa, 'id'>) => {
    const novoTipo = { ...tipo, id: gerarId() };
    setEstado(prev => ({
      ...prev,
      tiposDespesa: [...prev.tiposDespesa, novoTipo]
    }));
  };

  const atualizarTipoDespesa = (tipo: TipoDespesa) => {
    setEstado(prev => ({
      ...prev,
      tiposDespesa: prev.tiposDespesa.map(t => t.id === tipo.id ? tipo : t)
    }));
  };

  const removerTipoDespesa = (id: string) => {
    setEstado(prev => ({
      ...prev,
      tiposDespesa: prev.tiposDespesa.filter(t => t.id !== id)
    }));
  };

  // Funções para gerenciar metas
  const adicionarMeta = (meta: Omit<Meta, 'id'>) => {
    const novaMeta = { ...meta, id: gerarId() };
    setEstado(prev => ({
      ...prev,
      metas: [...prev.metas, novaMeta]
    }));
  };

  const atualizarMeta = (meta: Meta) => {
    setEstado(prev => ({
      ...prev,
      metas: prev.metas.map(m => m.id === meta.id ? meta : m)
    }));
  };

  const removerMeta = (id: string) => {
    setEstado(prev => ({
      ...prev,
      metas: prev.metas.filter(m => m.id !== id)
    }));
  };

  // Funções para gerenciar alertas
  const atualizarAlertas = () => {
    if (!estado.configuracao?.alertas?.ativo) return;
    
    const novosAlertas = gerarAlertas(
      estado.despesas, 
      estado.receitas, 
      estado.tiposDespesa,
      estado.configuracao.alertas
    );
    
    setEstado(prev => ({
      ...prev,
      alertas: novosAlertas
    }));
  };

  const marcarAlertaLido = (id: string) => {
    setEstado(prev => ({
      ...prev,
      alertas: prev.alertas.map(a => a.id === id ? { ...a, lido: true } : a)
    }));
  };

  const removerAlerta = (id: string) => {
    setEstado(prev => ({
      ...prev,
      alertas: prev.alertas.filter(a => a.id !== id)
    }));
  };

  // Funções para gerenciar configurações
  const atualizarConfiguracaoAlertas = (config: ConfiguracaoAlertas) => {
    setEstado(prev => ({
      ...prev,
      configuracao: {
        ...prev.configuracao,
        alertas: config
      }
    }));
  };

  // Funções para importar/exportar dados
  const exportarDados = () => {
    const dataStr = JSON.stringify(estado);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `financas_pro_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importarDados = (dados: string) => {
    try {
      const dadosParsed = JSON.parse(dados);
      
      if (!dadosParsed.receitas || !dadosParsed.despesas || !dadosParsed.tiposDespesa) {
        return false;
      }
      
      setEstado({
        ...estadoInicial,
        ...dadosParsed,
        configuracao: {
          alertas: {
            ...estadoInicial.configuracao.alertas,
            ...(dadosParsed.configuracao?.alertas || {}),
            tiposAtivos: {
              ...estadoInicial.configuracao.alertas.tiposAtivos,
              ...(dadosParsed.configuracao?.alertas?.tiposAtivos || {})
            }
          }
        }
      });
      return true;
    } catch (e) {
      console.error('Erro ao importar dados:', e);
      return false;
    }
  };

  const resetarDados = () => {
    setEstado(estadoInicial);
  };

  return (
    <FinancasContext.Provider value={{
      estado,
      adicionarReceita,
      atualizarReceita,
      removerReceita,
      adicionarDespesa,
      atualizarDespesa,
      removerDespesa,
      adicionarTipoDespesa,
      atualizarTipoDespesa,
      removerTipoDespesa,
      adicionarMeta,
      atualizarMeta,
      removerMeta,
      atualizarAlertas,
      marcarAlertaLido,
      removerAlerta,
      atualizarConfiguracaoAlertas,
      exportarDados,
      importarDados,
      resetarDados
    }}>
      {children}
    </FinancasContext.Provider>
  );
};

export const useFinancas = () => {
  const context = useContext(FinancasContext);
  if (context === undefined) {
    throw new Error('useFinancas deve ser usado dentro de um FinancasProvider');
  }
  return context;
};