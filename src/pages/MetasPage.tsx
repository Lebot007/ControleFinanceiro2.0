import React, { useState } from 'react';
import { useFinancas } from '../context/FinancasContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit, Trash2 } from 'lucide-react';
import FormularioMeta from '../components/FormularioMeta';
import { GraficoProgressoMeta } from '../components/ChartComponents';
import { Meta } from '../types';

const MetasPage: React.FC = () => {
  const { estado, adicionarMeta, atualizarMeta, removerMeta } = useFinancas();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [metaEmEdicao, setMetaEmEdicao] = useState<Meta | undefined>(undefined);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string | null>(null);
  
  const handleSalvar = (dados: Omit<Meta, 'id'> | Meta) => {
    if ('id' in dados) {
      atualizarMeta(dados);
    } else {
      adicionarMeta(dados);
    }
    setMostrarFormulario(false);
    setMetaEmEdicao(undefined);
  };
  
  const handleCancelar = () => {
    setMostrarFormulario(false);
    setMetaEmEdicao(undefined);
  };
  
  const handleEditar = (meta: Meta) => {
    setMetaEmEdicao(meta);
    setMostrarFormulario(true);
  };
  
  const handleExcluir = (id: string) => {
    setConfirmacaoExclusao(id);
  };
  
  const confirmarExclusao = () => {
    if (confirmacaoExclusao) {
      removerMeta(confirmacaoExclusao);
      setConfirmacaoExclusao(null);
    }
  };
  
  // Separar metas em ativas e concluídas
  const metasAtivas = estado.metas.filter(meta => !meta.concluida);
  const metasConcluidas = estado.metas.filter(meta => meta.concluida);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Metas de Poupança</h1>
        <button
          onClick={() => {
            setMetaEmEdicao(undefined);
            setMostrarFormulario(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus size={20} className="mr-1" />
          Nova Meta
        </button>
      </div>
      
      {/* Formulário */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <FormularioMeta
              meta={metaEmEdicao}
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
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
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
      
      {/* Metas ativas */}
      <h2 className="text-xl font-medium text-gray-800">Metas em Andamento</h2>
      
      {metasAtivas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metasAtivas.map((meta) => {
            const percentual = Math.min(100, (meta.valorAtual / meta.valorObjetivo) * 100);
            const dataFormatada = format(parseISO(meta.dataInicio), "dd 'de' MMMM, yyyy", { locale: ptBR });
            const dataFimFormatada = meta.dataFim 
              ? format(parseISO(meta.dataFim), "dd 'de' MMMM, yyyy", { locale: ptBR }) 
              : null;
            
            return (
              <div key={meta.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{meta.nome}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditar(meta)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleExcluir(meta.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <GraficoProgressoMeta valorAtual={meta.valorAtual} valorObjetivo={meta.valorObjetivo} />
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Valor atual:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        }).format(meta.valorAtual)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Objetivo:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        }).format(meta.valorObjetivo)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Falta:</span>
                      <span className="text-sm font-medium text-red-600">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        }).format(meta.valorObjetivo - meta.valorAtual)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Início:</span>
                      <span className="text-sm text-gray-900">{dataFormatada}</span>
                    </div>
                    
                    {dataFimFormatada && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Prazo:</span>
                        <span className="text-sm text-gray-900">{dataFimFormatada}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-lg text-gray-600 mb-4">Nenhuma meta em andamento</p>
          <p className="text-gray-500">
            Clique em "Nova Meta" para definir seus objetivos financeiros
          </p>
        </div>
      )}
      
      {/* Metas concluídas */}
      {metasConcluidas.length > 0 && (
        <>
          <h2 className="text-xl font-medium text-gray-800 mt-8">Metas Concluídas</h2>
          
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Objetivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Início
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conclusão
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metasConcluidas.map((meta) => (
                    <tr key={meta.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {meta.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Intl.NumberFormat('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        }).format(meta.valorObjetivo)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(parseISO(meta.dataInicio), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {meta.dataFim 
                          ? format(parseISO(meta.dataFim), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleExcluir(meta.id)}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MetasPage;