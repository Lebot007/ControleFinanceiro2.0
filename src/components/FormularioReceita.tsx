import React, { useState } from 'react';
import { Receita } from '../types';

interface FormularioReceitaProps {
  receita?: Receita;
  onSalvar: (dados: Omit<Receita, 'id'> | Receita) => void;
  onCancelar: () => void;
}

const FormularioReceita: React.FC<FormularioReceitaProps> = ({ 
  receita, 
  onSalvar, 
  onCancelar 
}) => {
  const [descricao, setDescricao] = useState(receita?.descricao || '');
  const [valor, setValor] = useState(receita?.valor || 0);
  const [data, setData] = useState(receita?.data || new Date().toISOString().split('T')[0]);
  const [erro, setErro] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!descricao.trim()) {
      setErro('A descrição é obrigatória');
      return;
    }
    
    if (valor <= 0) {
      setErro('O valor deve ser maior que zero');
      return;
    }
    
    if (!data) {
      setErro('A data é obrigatória');
      return;
    }
    
    // Enviar dados
    if (receita) {
      onSalvar({
        ...receita,
        descricao,
        valor,
        data
      });
    } else {
      onSalvar({
        descricao,
        valor,
        data
      });
    }
    
    // Limpar formulário
    setDescricao('');
    setValor(0);
    setData(new Date().toISOString().split('T')[0]);
    setErro('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">
        {receita ? 'Editar Receita' : 'Nova Receita'}
      </h2>
      
      {erro && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
          {erro}
        </div>
      )}
      
      <div className="mb-4">
        <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
          Descrição
        </label>
        <input
          type="text"
          id="descricao"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Salário, Freelance, etc."
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="valor" className="block text-sm font-medium text-gray-700 mb-1">
          Valor (R$)
        </label>
        <input
          type="number"
          id="valor"
          step="0.01"
          min="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
        />
      </div>
      
      <div className="mb-6">
        <label htmlFor="data" className="block text-sm font-medium text-gray-700 mb-1">
          Data
        </label>
        <input
          type="date"
          id="data"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
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
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Salvar
        </button>
      </div>
    </form>
  );
};

export default FormularioReceita;