import React, { useState } from 'react';
import { Meta } from '../types';

interface FormularioMetaProps {
  meta?: Meta;
  onSalvar: (dados: Omit<Meta, 'id'> | Meta) => void;
  onCancelar: () => void;
}

const FormularioMeta: React.FC<FormularioMetaProps> = ({ 
  meta, 
  onSalvar, 
  onCancelar 
}) => {
  const [nome, setNome] = useState(meta?.nome || '');
  const [valorObjetivo, setValorObjetivo] = useState(meta?.valorObjetivo || 0);
  const [valorAtual, setValorAtual] = useState(meta?.valorAtual || 0);
  const [dataInicio, setDataInicio] = useState(meta?.dataInicio || new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(meta?.dataFim || '');
  const [concluida, setConcluida] = useState(meta?.concluida || false);
  const [erro, setErro] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!nome.trim()) {
      setErro('O nome da meta é obrigatório');
      return;
    }
    
    if (valorObjetivo <= 0) {
      setErro('O valor objetivo deve ser maior que zero');
      return;
    }
    
    if (valorAtual < 0) {
      setErro('O valor atual não pode ser negativo');
      return;
    }
    
    if (!dataInicio) {
      setErro('A data de início é obrigatória');
      return;
    }
    
    // Verificar se concluiu automaticamente
    const metaConcluida = concluida || valorAtual >= valorObjetivo;
    
    // Enviar dados
    const dadosSalvar = {
      nome,
      valorObjetivo,
      valorAtual,
      dataInicio,
      dataFim: dataFim || undefined,
      concluida: metaConcluida
    };
    
    if (meta) {
      onSalvar({
        ...meta,
        ...dadosSalvar
      });
    } else {
      onSalvar(dadosSalvar);
    }
    
    // Limpar formulário
    setNome('');
    setValorObjetivo(0);
    setValorAtual(0);
    setDataInicio(new Date().toISOString().split('T')[0]);
    setDataFim('');
    setConcluida(false);
    setErro('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">
        {meta ? 'Editar Meta' : 'Nova Meta'}
      </h2>
      
      {erro && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
          {erro}
        </div>
      )}
      
      <div className="mb-4">
        <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
          Nome da Meta
        </label>
        <input
          type="text"
          id="nome"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Viagem, Carro novo, etc."
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="valorObjetivo" className="block text-sm font-medium text-gray-700 mb-1">
          Valor Objetivo (R$)
        </label>
        <input
          type="number"
          id="valorObjetivo"
          step="0.01"
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={valorObjetivo}
          onChange={(e) => setValorObjetivo(Number(e.target.value))}
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="valorAtual" className="block text-sm font-medium text-gray-700 mb-1">
          Valor Atual (R$)
        </label>
        <input
          type="number"
          id="valorAtual"
          step="0.01"
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={valorAtual}
          onChange={(e) => setValorAtual(Number(e.target.value))}
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="dataInicio" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Início
        </label>
        <input
          type="date"
          id="dataInicio"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="dataFim" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Término (opcional)
        </label>
        <input
          type="date"
          id="dataFim"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
        />
      </div>
      
      <div className="mb-6 flex items-center">
        <input
          type="checkbox"
          id="concluida"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={concluida}
          onChange={(e) => setConcluida(e.target.checked)}
        />
        <label htmlFor="concluida" className="ml-2 text-sm font-medium text-gray-700">
          Meta concluída
        </label>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Salvar
        </button>
      </div>
    </form>
  );
};

export default FormularioMeta;