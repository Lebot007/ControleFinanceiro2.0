import { Alerta, Despesa, Receita, TipoDespesa, ConfiguracaoAlertas } from '../types';
import { addDays, format, isAfter, isBefore, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função para gerar todos os alertas
export const gerarAlertas = (
  despesas: Despesa[],
  receitas: Receita[],
  tiposDespesa: TipoDespesa[],
  config: ConfiguracaoAlertas
): Alerta[] => {
  const alertas: Alerta[] = [];
  const hoje = new Date();
  
  // Gerar alertas apenas para os tipos ativos
  if (config.tiposAtivos.vencimento) {
    alertas.push(...gerarAlertasVencimento(despesas, config.diasVencimento));
  }
  
  if (config.tiposAtivos.saldo) {
    const alertaSaldo = gerarAlertaSaldoBaixo(despesas, receitas, config.saldoMinimo);
    if (alertaSaldo) alertas.push(alertaSaldo);
  }
  
  if (config.tiposAtivos.aumento) {
    alertas.push(...gerarAlertasAumentoAnormal(despesas, tiposDespesa, config.percentualAumento));
  }
  
  return alertas;
};

// Função para gerar alertas de vencimentos próximos
const gerarAlertasVencimento = (despesas: Despesa[], diasVencimento: number): Alerta[] => {
  const hoje = new Date();
  const limiteData = addDays(hoje, diasVencimento);
  const alertas: Alerta[] = [];
  
  despesas.forEach(despesa => {
    if (!despesa.vencimento || despesa.pago) return;
    
    const dataVencimento = parseISO(despesa.vencimento);
    
    if (isAfter(dataVencimento, hoje) && isBefore(dataVencimento, limiteData)) {
      alertas.push({
        id: Math.random().toString(36).substring(2, 11),
        tipo: 'vencimento',
        mensagem: `Despesa "${despesa.descricao}" vence em ${format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}`,
        data: new Date().toISOString(),
        lido: false,
        referencia: despesa.id
      });
    }
  });
  
  return alertas;
};

// Função para gerar alerta de saldo baixo
const gerarAlertaSaldoBaixo = (despesas: Despesa[], receitas: Receita[], saldoMinimo: number): Alerta | null => {
  const totalReceitas = receitas.reduce((total, receita) => total + receita.valor, 0);
  const totalDespesas = despesas.reduce((total, despesa) => total + despesa.valor, 0);
  const saldoAtual = totalReceitas - totalDespesas;
  
  if (saldoAtual < saldoMinimo) {
    return {
      id: Math.random().toString(36).substring(2, 11),
      tipo: 'saldo',
      mensagem: `Seu saldo atual de R$ ${saldoAtual.toFixed(2)} está abaixo do limite mínimo de R$ ${saldoMinimo.toFixed(2)}`,
      data: new Date().toISOString(),
      lido: false
    };
  }
  
  return null;
};

// Função para gerar alertas de aumento anormal de despesas
const gerarAlertasAumentoAnormal = (
  despesas: Despesa[], 
  tiposDespesa: TipoDespesa[],
  percentualAumento: number
): Alerta[] => {
  const alertas: Alerta[] = [];
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoMesAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;
  
  // Agrupa despesas por tipo e por mês
  const despesasPorTipo: Record<string, { atual: number, anterior: number }> = {};
  
  tiposDespesa.forEach(tipo => {
    despesasPorTipo[tipo.id] = { atual: 0, anterior: 0 };
  });
  
  despesas.forEach(despesa => {
    const data = parseISO(despesa.data);
    const mes = data.getMonth();
    const ano = data.getFullYear();
    
    if (ano === anoAtual && mes === mesAtual) {
      despesasPorTipo[despesa.tipoDespesaId].atual += despesa.valor;
    } else if (ano === anoMesAnterior && mes === mesAnterior) {
      despesasPorTipo[despesa.tipoDespesaId].anterior += despesa.valor;
    }
  });
  
  // Verifica aumento anormal
  Object.entries(despesasPorTipo).forEach(([tipoId, valores]) => {
    if (valores.anterior > 0 && valores.atual > 0) {
      const aumento = ((valores.atual - valores.anterior) / valores.anterior) * 100;
      
      if (aumento > percentualAumento) {
        const tipo = tiposDespesa.find(t => t.id === tipoId);
        
        if (tipo) {
          alertas.push({
            id: Math.random().toString(36).substring(2, 11),
            tipo: 'aumento',
            mensagem: `Aumento de ${aumento.toFixed(0)}% nas despesas de ${tipo.nome} em relação ao mês anterior`,
            data: new Date().toISOString(),
            lido: false,
            referencia: tipoId
          });
        }
      }
    }
  });
  
  return alertas;
};