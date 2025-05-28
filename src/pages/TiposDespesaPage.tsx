import React, { useState } from 'react';
import { useFinancas } from '../context/FinancasContext';
import { Plus, Edit, Trash2 } from 'lucide-react';
import FormularioTipoDespesa from '../components/FormularioTipoDespesa';
import { TipoDespesa } from '../types';

const TiposDespesaPage: React.FC = () => {
  const { estado, adicionarTipoDespesa, atualizarTipoDespesa, removerTipoDespesa } = useFinancas();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tipoEmEdicao, setTipoEmEdicao] = useState<TipoDespesa | undefined>(undefined);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string | null>(null);
  
  const handleSalvar = (dados: Omit<TipoDespesa, 'id'> | TipoDespesa) => {
    if ('id' in dados) {
      atualizarTipoDespesa(dados);
    } else {
      adicionarTipoDespesa(dados);
    }
    setMostrarFormulario(false);
    setTipoEmEdicao(undefined);
  };
  
  const handleCancelar = () => {
    setMostrarFormulario(false);
    setTipoEmEdicao(undefined);
  };
  
  const handleEditar = (tipo: TipoDespesa) => {
    setTipoEmEdicao(tipo);
    setMostrarFormulario(true);
  };
  
  const handleExcluir = (id: string) => {
    // Verificar se o tipo está sendo usado em alguma despesa
    const despesasComTipo = estado.despesas.filter(d => d.tipoDespesaId === id);
    
    if (despesasComTipo.length > 0) {
      alert(`Não é possível excluir este tipo pois está sendo usado em ${despesasComTipo.length} despesa(s).`);
      return;
    }
    
    setConfirmacaoExclusao(id);
  };
  
  const confirmarExclusao = () => {
    if (confirmacaoExclusao) {
      removerTipoDespesa(confirmacaoExclusao);
      setConfirmacaoExclusao(null);
    }
  };
  
  // Ordenar tipos por nome
  const tiposOrdenados = [...estado.tiposDespesa].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tipos de Despesa</h1>
        <button
          onClick={() => {
            setTipoEmEdicao(undefined);
            setMostrarFormulario(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus size={20} className="mr-1" />
          Novo Tipo
        </button>
      </div>
      
      {/* Formulário */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <FormularioTipoDespesa
              tipo={tipoEmEdicao}
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
              Tem certeza que deseja excluir este tipo de despesa? Esta ação não pode ser desfeita.
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
      
      {/* Lista de tipos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tiposOrdenados.map((tipo) => {
          // Contar despesas com este tipo
          const despesasComTipo = estado.despesas.filter(d => d.tipoDespesaId === tipo.id);
          const totalValor = despesasComTipo.reduce((total, d) => total + d.valor, 0);
          
          return (
            <div 
              key={tipo.id} 
              className="bg-white rounded-lg shadow p-6 flex flex-col"
              style={{ borderLeft: `4px solid ${tipo.cor}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{tipo.nome}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditar(tipo)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleExcluir(tipo.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>Total:</span>
                  <span className="font-medium text-gray-700">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL' 
                    }).format(totalValor)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Despesas:</span>
                  <span className="font-medium text-gray-700">{despesasComTipo.length}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {tiposOrdenados.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          <p className="text-lg">Nenhum tipo de despesa personalizado</p>
          <p className="mt-2">Clique em "Novo Tipo" para adicionar</p>
        </div>
      )}
    </div>
  );
};

export default TiposDespesaPage;