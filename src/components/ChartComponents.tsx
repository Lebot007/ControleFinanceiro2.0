import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement,
  PointElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Despesa, Receita, TipoDespesa } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Opções padrão para gráficos
const opcoesPadrao: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            }).format(context.parsed.y);
          }
          return label;
        }
      }
    }
  },
};

// Função para agrupar dados por mês
const agruparPorMes = (dados: Array<Receita | Despesa>) => {
  const meses: Record<string, number> = {};
  
  dados.forEach(item => {
    const data = parseISO(item.data);
    const mesAno = format(data, 'MMM yyyy', { locale: ptBR });
    
    if (!meses[mesAno]) {
      meses[mesAno] = 0;
    }
    
    meses[mesAno] += item.valor;
  });
  
  // Ordenar por data
  const mesesOrdenados = Object.entries(meses)
    .sort(([mesAnoA], [mesAnoB]) => {
      const [mesA, anoA] = mesAnoA.split(' ');
      const [mesB, anoB] = mesAnoB.split(' ');
      return new Date(`${anoA}-${mesA}-01`).getTime() - new Date(`${anoB}-${mesB}-01`).getTime();
    });
  
  return {
    labels: mesesOrdenados.map(([mesAno]) => mesAno),
    valores: mesesOrdenados.map(([, valor]) => valor)
  };
};

// Gráfico de receitas e despesas por mês
export const GraficoReceitasDespesas: React.FC<{
  receitas: Receita[];
  despesas: Despesa[];
}> = ({ receitas, despesas }) => {
  const dadosReceitas = agruparPorMes(receitas);
  const dadosDespesas = agruparPorMes(despesas);
  
  // Obter todos os meses únicos combinados
  const todosMeses = [...new Set([...dadosReceitas.labels, ...dadosDespesas.labels])].sort();
  
  // Mapear valores para cada mês
  const valoresReceitas = todosMeses.map(mes => {
    const index = dadosReceitas.labels.indexOf(mes);
    return index !== -1 ? dadosReceitas.valores[index] : 0;
  });
  
  const valoresDespesas = todosMeses.map(mes => {
    const index = dadosDespesas.labels.indexOf(mes);
    return index !== -1 ? dadosDespesas.valores[index] : 0;
  });
  
  const data: ChartData<'bar'> = {
    labels: todosMeses,
    datasets: [
      {
        label: 'Receitas',
        data: valoresReceitas,
        backgroundColor: 'rgba(56, 161, 105, 0.6)',
        borderColor: 'rgba(56, 161, 105, 1)',
        borderWidth: 1,
      },
      {
        label: 'Despesas',
        data: valoresDespesas,
        backgroundColor: 'rgba(229, 62, 62, 0.6)',
        borderColor: 'rgba(229, 62, 62, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  return (
    <div className="h-64">
      <Bar data={data} options={opcoesPadrao} />
    </div>
  );
};

// Gráfico de despesas por tipo
export const GraficoDespesasPorTipo: React.FC<{
  despesas: Despesa[];
  tiposDespesa: TipoDespesa[];
}> = ({ despesas, tiposDespesa }) => {
  // Agrupar despesas por tipo
  const despesasPorTipo: Record<string, number> = {};
  
  tiposDespesa.forEach(tipo => {
    despesasPorTipo[tipo.id] = 0;
  });
  
  despesas.forEach(despesa => {
    despesasPorTipo[despesa.tipoDespesaId] += despesa.valor;
  });
  
  // Filtrar tipos com valores
  const tiposComValores = tiposDespesa.filter(tipo => despesasPorTipo[tipo.id] > 0);
  
  const data: ChartData<'doughnut'> = {
    labels: tiposComValores.map(tipo => tipo.nome),
    datasets: [
      {
        data: tiposComValores.map(tipo => despesasPorTipo[tipo.id]),
        backgroundColor: tiposComValores.map(tipo => tipo.cor),
        borderColor: tiposComValores.map(tipo => tipo.cor),
        borderWidth: 1,
      },
    ],
  };
  
  const options = {
    ...opcoesPadrao,
    plugins: {
      ...opcoesPadrao.plugins,
      legend: {
        position: 'right' as const,
      },
    },
  };
  
  return (
    <div className="h-64">
      <Doughnut data={data} options={options} />
    </div>
  );
};

// Gráfico de evolução do saldo
export const GraficoEvolucaoSaldo: React.FC<{
  receitas: Receita[];
  despesas: Despesa[];
}> = ({ receitas, despesas }) => {
  // Combinar receitas e despesas
  const todasTransacoes = [
    ...receitas.map(r => ({ ...r, tipo: 'receita' })),
    ...despesas.map(d => ({ ...d, tipo: 'despesa' })),
  ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  
  // Calcular saldo acumulado
  let saldoAcumulado = 0;
  const dadosSaldo = todasTransacoes.reduce((acc: {data: string, saldo: number}[], transacao) => {
    if (transacao.tipo === 'receita') {
      saldoAcumulado += transacao.valor;
    } else {
      saldoAcumulado -= transacao.valor;
    }
    
    const dataFormatada = format(parseISO(transacao.data), 'dd/MM/yyyy');
    
    // Verificar se já existe um registro para esta data
    const indexExistente = acc.findIndex(item => item.data === dataFormatada);
    
    if (indexExistente !== -1) {
      // Atualizar saldo existente
      acc[indexExistente].saldo = saldoAcumulado;
    } else {
      // Adicionar novo registro
      acc.push({ data: dataFormatada, saldo: saldoAcumulado });
    }
    
    return acc;
  }, []);
  
  // Limitar a últimos 10 pontos se houver muitos dados
  const dadosExibidos = dadosSaldo.length > 10 
    ? dadosSaldo.slice(dadosSaldo.length - 10) 
    : dadosSaldo;
  
  const data: ChartData<'line'> = {
    labels: dadosExibidos.map(d => d.data),
    datasets: [
      {
        label: 'Saldo',
        data: dadosExibidos.map(d => d.saldo),
        borderColor: 'rgba(49, 130, 206, 1)',
        backgroundColor: 'rgba(49, 130, 206, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };
  
  const options = {
    ...opcoesPadrao,
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };
  
  return (
    <div className="h-64">
      <Line data={data} options={options} />
    </div>
  );
};

// Gráfico de progresso de metas
export const GraficoProgressoMeta: React.FC<{
  valorAtual: number;
  valorObjetivo: number;
}> = ({ valorAtual, valorObjetivo }) => {
  const percentual = Math.min(100, (valorAtual / valorObjetivo) * 100);
  
  const data: ChartData<'doughnut'> = {
    labels: ['Progresso', 'Restante'],
    datasets: [
      {
        data: [valorAtual, Math.max(0, valorObjetivo - valorAtual)],
        backgroundColor: [
          'rgba(49, 130, 206, 0.8)',
          'rgba(226, 232, 240, 0.5)',
        ],
        borderColor: [
          'rgba(49, 130, 206, 1)',
          'rgba(226, 232, 240, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  const options = {
    ...opcoesPadrao,
    cutout: '70%',
    plugins: {
      ...opcoesPadrao.plugins,
      tooltip: {
        callbacks: {
          label: function(context) {
            const valor = context.raw as number;
            return new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            }).format(valor);
          }
        }
      },
      legend: {
        display: false,
      },
    },
  };
  
  return (
    <div className="h-40 relative">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-3xl font-bold text-blue-600">{percentual.toFixed(0)}%</span>
        <span className="text-sm text-gray-500">Concluído</span>
      </div>
    </div>
  );
};