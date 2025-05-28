import React, { useState } from 'react';
import { TipoDespesa } from '../types';

interface FormularioTipoDespesaProps {
  tipo?: TipoDespesa;
  onSalvar: (dados: Omit<TipoDespesa, 'id'> | TipoDespesa) => void;
  onCancelar: () => void;
}

const coresPadrao = [
  '#F59E0B', '#3B82F6', '#10B981', '#EC4899', 
  '#EF4444', '#8B5CF6', '#6B7280', '#9CA3AF',
  '#F97316', '#14B8A6', '#A855F7', '#F43F5E',
];

const FormularioTipoDespesa: React.FC<FormularioTipoDespesaProps> = ({ 
  tipo, 
  onSalvar, 
  onCancelar 
}) => {
  const [nome, setNome] = useState(tipo?.nome || '');
  const [cor, setCor] = useState(tipo?.cor || coresPadrao[0]);
  const [erro, setErro] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!nome.trim()) {
      setErro('O nome do tipo de despesa é obrigatório');
      return;
    }
    
    // Enviar dados
    if (tipo) {
      onSalvar({
        ...tipo,
        nome,
        cor
      });
    } else {
      onSalvar({
        nome,
        cor
      });
    }
    
    // Limpar formulário
    setNome('');
    setCor(coresPadrao[0]);
    setErro('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">
        {tipo ? 'Editar Tipo de Despesa' : 'Novo Tipo de Despesa'}
      </h2>
      
      {erro && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
          {erro}
        </div>
      )}
      
      <div className="mb-4">
        <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
          Nome
        </label>
        <input
          type="text"
          id="nome"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Alimentação, Transporte, etc."
        />
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cor
        </label>
        <div className="grid grid-cols-4 gap-2">
          {coresPadrao.map((corOpcao) => (
            <button
              key={corOpcao}
              type="button"
              className={`h-10 rounded-md border-2 ${
                corOpcao === cor ? 'border-gray-900' : 'border-transparent'
              }`}
              style={{ backgroundColor: corOpcao }}
              onClick={() => setCor(corOpcao)}
            />
          ))}
        </div>
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

export default FormularioTipoDespesa;