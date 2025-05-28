import React, { useState } from 'react';
import { useFinancas } from '../context/FinancasContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit, Trash2, CheckCircle, Clock } from 'lucide-react';
import FormularioDespesa from '../components/FormularioDespesa';
import { Despesa } from '../types';

const DespesasPage: React.FC = () => {
  const { estado, adicionarDespesa, atualizarDespesa, removerDespesa } = useFinancas();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [despesaEmEdicao, setDespesaEmEdicao] = useState<Despesa | undefined>(undefined);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pagas' | 'nao-pagas'>('todas');
  
  const handleSalvar = (dados: Omit<Despesa, 'id'> | Despesa) => {
    if ('id' in dados) {
      atualizarDespesa(dados);
    } else {
      adicionarDespesa(dados);
    }
    setMostrarFormulario(false);
    setDespesaEmEdicao(undefined);
  };
  
  const handleCancelar = () => {
    setMostrarFormulario(false);
    setDespesaEmEdicao(undefined);
  };
  
  const handleEditar = (despesa: Despesa) => {
    setDespesaEmEdicao(despesa);
    setMostrarFormulario(true);
  };
  
  const handleExcluir = (id: string) => {
    setConfirmacaoExclusao(id);
  };
  
  const confirmarExclusao = () => {
    if (confirmacaoExclusao) {
      removerDespesa(confirmacaoExclusao);
      setConfirmacaoExclusao(null);
    }
  };
  
  const handleAlternarPago = (despesa: Despesa) => {
    atualizarDespesa({
      ...despesa,
      pago: !despesa.pago
    });
  };
  
  // Ordenar despesas por data (mais recentes primeiro)
  const despesasOrdenadas = [...estado.despesas].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
  
  // Aplicar filtro
  const despesasFiltradas = despesasOrdenadas.filter(despesa => {
    if (filtro === 'todas') return true;
    if (filtro === 'pagas') return despesa.pago;
    if (filtro === 'nao-pagas') return !despesa.pago;
    return true;
  });
  
  // Totais
  const totalDespesas = despesasOrdenadas.reduce((total, despesa) => total + despesa.valor, 0);
  const totalPagas = despesasOrdenadas.filter(d => d.pago).reduce((total, despesa) => total + despesa.valor, 0);
  const totalNaoPagas = despesasOrdenadas.filter(d => !d.pago).reduce((total, despesa) => total + despesa.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Despesas</h1>
        <button
          onClick={() => {
            setDespesaEmEdicao(undefined);
            setMostrarFormulario(true);
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <Plus size={20} className="mr-1" />
          Nova Despesa
        </button>
      </div>
      
      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Total de Despesas</h2>
          <p className="text-2xl font-bold text-red-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Despesas Pagas</h2>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPagas)}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">A Pagar</h2>
          <p className="text-2xl font-bold text-yellow-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalNaoPagas)}
          </p>
        </div>
      </div>
      
      {/* Formulário */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <FormularioDespesa
              despesa={despesaEmEdicao}
              tiposDespesa={estado.tiposDespesa}
              onSalvar={handleSalvar}
              onCancelar={handleCancelar}
            />
          </div>
        </div>
      )}
      
      {/* Confirmação de exclusão */}
      {confirmacaoExclusao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-700 mb-4">
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmacaoExclusao(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Filtros */}
      <div className="flex border-b border-gray-200">
        <button
          className={`py-3 px-4 text-sm font-medium ${
            filtro === 'todas' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFiltro('todas')}
        >
          Todas
        </button>
        <button
          className={`py-3 px-4 text-sm font-medium ${
            filtro === 'pagas' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFiltro('pagas')}
        >
          Pagas
        </button>
        <button
          className={`py-3 px-4 text-sm font-medium ${
            filtro === 'nao-pagas' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFiltro('nao-pagas')}
        >
          A Pagar
        </button>
      </div>
      
      {/* Lista de despesas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {despesasFiltradas.map((despesa) => {
                const tipoDespesa = estado.tiposDespesa.find(t => t.id === despesa.tipoDespesaId);
                
                return (
                  <tr key={despesa.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleAlternarPago(despesa)}
                        className={`${
                          despesa.pago 
                            ? 'text-green-600 hover:text-green-800' 
                            : 'text-yellow-500 hover:text-yellow-700'
                        }`}
                        title={despesa.pago ? 'Pago' : 'Pendente'}
                      >
                        {despesa.pago ? <CheckCircle size={18} /> : <Clock size={18} />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(despesa.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {despesa.descricao}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tipoDespesa && (
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: tipoDespesa.cor }}
                        >
                          {tipoDespesa.nome}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      }).format(despesa.valor)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {despesa.vencimento 
                        ? format(parseISO(despesa.vencimento), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditar(despesa)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleExcluir(despesa.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {despesasFiltradas.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Nenhuma despesa encontrada</p>
              <p className="mt-2">
                {filtro === 'todas' 
                  ? 'Clique em "Nova Despesa" para adicionar'
                  : filtro === 'pagas'
                    ? 'Não há despesas pagas registradas'
                    : 'Não há despesas a pagar registradas'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DespesasPage;