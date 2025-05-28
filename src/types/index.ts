import { Receita } from '../types';

export interface Receita {
  id: string;
  data: string;
  valor: number;
  descricao: string;
}

export interface TipoDespesa {
  id: string;
  nome: string;
  cor: string;
}

export interface Despesa {
  id: string;
  data: string;
  valor: number;
  tipoDespesaId: string;
  descricao: string;
  pago: boolean;
  vencimento?: string;
}

export interface Meta {
  id: string;
  nome: string;
  valorObjetivo: number;
  valorAtual: number;
  dataInicio: string;
  dataFim?: string;
  concluida: boolean;
}

export interface Alerta {
  id: string;
  tipo: 'vencimento' | 'saldo' | 'aumento';
  mensagem: string;
  data: string;
  lido: boolean;
  referencia?: string;
}

export interface ConfiguracaoAlertas {
  saldoMinimo: number;
  diasVencimento: number;
  percentualAumento: number;
  ativo: boolean;
  tiposAtivos: {
    vencimento: boolean;
    saldo: boolean;
    aumento: boolean;
  };
}

export interface EstadoFinancas {
  receitas: Receita[];
  despesas: Despesa[];
  tiposDespesa: TipoDespesa[];
  metas: Meta[];
  alertas: Alerta[];
  configuracao: {
    alertas: ConfiguracaoAlertas;
  };
}