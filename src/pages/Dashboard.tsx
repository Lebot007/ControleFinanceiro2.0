import React from 'react';
import { useFinancas } from '../context/FinancasContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { GraficoReceitasDespesas, GraficoDespesasPorTipo, GraficoEvolucaoSaldo } from '../components/ChartComponents';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { estado } = useFinancas();
  const { receitas, despesas, tiposDespesa, alertas } = estado;
  
  // Calcular saldo total
  const totalReceitas = receitas.reduce((total, receita) => total + receita.valor, 0);
  const totalDespesas = despesas.reduce((total, despesa) => total + despesa.valor, 0);
  const saldoTotal = totalReceitas - totalDespesas;
  
  // Despesas não pagas (contas a pagar)
  const despesasNaoPagas = despesas.filter(d => !d.pago);
  const totalDespesasNaoPagas = despesasNaoPagas.reduce((total, despesa) => total + despesa.valor, 0);
  
  // Alertas não lidos
  const alertasNaoLidos = alertas.filter(a => !a.lido);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <Link 
          to="/alertas" 
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
        >
          Ver todos os alertas
          {alertasNaoLidos.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {alertasNaoLidos.length}
            </span>
          )}
        </Link>
      </div>
      
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">Saldo Total</h2>
              <p className={`text-2xl font-bold ${saldoTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoTotal)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">Receitas</h2>
              <p className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
              <TrendingDown size={24} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">Despesas</h2>
              <p className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">Contas a Pagar</h2>
              <p className="text-2xl font-bold text-yellow-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesasNaoPagas)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Alertas recentes */}
      {alertasNaoLidos.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Alertas Recentes</h2>
          <div className="space-y-3">
            {alertasNaoLidos.slice(0, 3).map(alerta => (
              <div key={alerta.id} className="flex items-start p-3 bg-yellow-50 rounded-md">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                <div>
                  <p className="text-gray-800">{alerta.mensagem}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(parseISO(alerta.data), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            {alertasNaoLidos.length > 3 && (
              <Link
                to="/alertas"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium block text-center"
              >
                Ver todos os {alertasNaoLidos.length} alertas
              </Link>
            )}
          </div>
        </div>
      )}
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Receitas vs Despesas</h2>
          <GraficoReceitasDespesas receitas={receitas} despesas={despesas} />
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Despesas por Categoria</h2>
          <GraficoDespesasPorTipo despesas={despesas} tiposDespesa={tiposDespesa} />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Evolução do Saldo</h2>
        <GraficoEvolucaoSaldo receitas={receitas} despesas={despesas} />
      </div>
      
      {/* Transações recentes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Transações Recentes</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                ...receitas.map(r => ({ ...r, tipo: 'receita' })),
                ...despesas.map(d => ({ ...d, tipo: 'despesa' }))
              ]
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                .slice(0, 5)
                .map((transacao, idx) => {
                  const tipoDespesa = transacao.tipo === 'despesa' 
                    ? tiposDespesa.find(t => t.id === (transacao as any).tipoDespesaId)
                    : null;
                  
                  return (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(parseISO(transacao.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transacao.descricao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transacao.tipo === 'receita' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Receita
                          </span>
                        ) : tipoDespesa ? (
                          <span 
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: tipoDespesa.cor }}
                          >
                            {tipoDespesa.nome}
                          </span>
                        ) : null}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        transacao.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transacao.tipo === 'receita' ? '+' : '-'}
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        }).format(transacao.valor)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          
          {receitas.length === 0 && despesas.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              Nenhuma transação registrada ainda.
            </div>
          )}
          
          <div className="mt-4 flex justify-between">
            <Link to="/receitas" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Ver todas as receitas
            </Link>
            <Link to="/despesas" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Ver todas as despesas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;