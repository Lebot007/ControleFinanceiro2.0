import React, { useState } from 'react';
import { useFinancas } from '../context/FinancasContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit, Trash2 } from 'lucide-react';
import FormularioReceita from '../components/FormularioReceita';
import { Receita } from '../types';

const ReceitasPage: React.FC = () => {
  const { estado, adicionarReceita, atualizarReceita, removerReceita } = useFinancas();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [receitaEmEdicao, setReceitaEmEdicao] = useState<Receita | undefined>(undefined);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string | null>(null);
  
  const handleSalvar = (dados: Omit<Receita, 'id'> | Receita) => {
    if ('id' in dados) {
      atualizarReceita(dados);
    } else {
      adicionarReceita(dados);
    }
    setMostrarFormulario(false);
    setReceitaEmEdicao(undefined);
  };
  
  const handleCancelar = () => {
    setMostrarFormulario(false);
    setReceitaEmEdicao(undefined);
  };
  
  const handleEditar = (receita: Receita) => {
    setReceitaEmEdicao(receita);
    setMostrarFormulario(true);
  };
  
  const handleExcluir = (id: string) => {
    setConfirmacaoExclusao(id);
  };
  
  const confirmarExclusao = () => {
    if (confirmacaoExclusao) {
      removerReceita(confirmacaoExclusao);
      setConfirmacaoExclusao(null);
    }
  };
  
  // Ordenar receitas por data (mais recentes primeiro)
  const receitasOrdenadas = [...estado.receitas].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
  
  const totalReceitas = receitasOrdenadas.reduce((total, receita) => total + receita.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Receitas</h1>
        <button
          onClick={() => {
            setReceitaEmEdicao(undefined);
            setMostrarFormulario(true);
          }}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <Plus size={20} className="mr-1" />
          Nova Receita
        </button>
      </div>
      
      {/* Total */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-medium text-gray-500">Total de Receitas</h2>
        <p className="text-2xl font-bold text-green-600">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
        </p>
      </div>
      
      {/* Formulário */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <FormularioReceita
              receita={receitaEmEdicao}
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
              Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita.
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
      
      {/* Lista de receitas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  Valor
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receitasOrdenadas.map((receita) => (
                <tr key={receita.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(receita.data), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {receita.descricao}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL' 
                    }).format(receita.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditar(receita)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleExcluir(receita.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {receitasOrdenadas.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Nenhuma receita registrada</p>
              <p className="mt-2">Clique em "Nova Receita" para adicionar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceitasPage;