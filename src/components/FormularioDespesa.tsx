import React, { useState } from 'react';
import { Despesa, TipoDespesa } from '../types';

interface FormularioDespesaProps {
  despesa?: Despesa;
  tiposDespesa: TipoDespesa[];
  onSalvar: (dados: Omit<Despesa, 'id'> | Despesa) => void;
  onCancelar: () => void;
}

const FormularioDespesa: React.FC<FormularioDespesaProps> = ({ 
  despesa, 
  tiposDespesa,
  onSalvar, 
  onCancelar 
}) => {
  const [descricao, setDescricao] = useState(despesa?.descricao || '');
  const [valor, setValor] = useState(despesa?.valor === undefined ? '' : despesa.valor.toString());
  const [data, setData] = useState(despesa?.data || new Date().toISOString().split('T')[0]);
  const [tipoDespesaId, setTipoDespesaId] = useState(despesa?.tipoDespesaId || tiposDespesa[0]?.id || '');
  const [pago, setPago] = useState(despesa?.pago || false);
  const [vencimento, setVencimento] = useState(despesa?.vencimento || '');
  const [erro, setErro] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!descricao.trim()) {
      setErro('A descrição é obrigatória');
      return;
    }
    
    if (valor === '' || Number(valor) <= 0) {
      setErro('O valor deve ser maior que zero');
      return;
    }
    
    if (!data) {
      setErro('A data é obrigatória');
      return;
    }
    
    if (!tipoDespesaId) {
      setErro('O tipo de despesa é obrigatório');
      return;
    }
    
    // Enviar dados
    const dadosSalvar = {
      descricao: descricao.trim(),
      valor: Number(valor),
      data,
      tipoDespesaId,
      pago,
      vencimento: vencimento || undefined,
    };
    
    if (despesa) {
      onSalvar({
        ...despesa,
        ...dadosSalvar
      });
    } else {
      onSalvar(dadosSalvar);
    }
    
    // Limpar formulário
    setDescricao('');
    setValor('');
    setData(new Date().toISOString().split('T')[0]);
    setTipoDespesaId(tiposDespesa[0]?.id || '');
    setPago(false);
    setVencimento('');
    setErro('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">
        {despesa ? 'Editar Despesa' : 'Nova Despesa'}
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
          placeholder="Ex: Supermercado, Aluguel, etc."
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
          onChange={(e) => setValor(e.target.value)}
        />
      </div>
      
      <div className="mb-4">
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
      
      <div className="mb-4">
        <label htmlFor="tipoDespesa" className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Despesa
        </label>
        <select
          id="tipoDespesa"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={tipoDespesaId}
          onChange={(e) => setTipoDespesaId(e.target.value)}
        >
          {tiposDespesa.map(tipo => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nome}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-4">
        <label htmlFor="vencimento" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Vencimento (opcional)
        </label>
        <input
          type="date"
          id="vencimento"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
        />
        <p className="text-sm text-gray-500 mt-1">
          Preencha apenas se for uma conta a pagar com data de vencimento
        </p>
      </div>
      
      <div className="mb-6 flex items-center">
        <input
          type="checkbox"
          id="pago"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={pago}
          onChange={(e) => setPago(e.target.checked)}
        />
        <label htmlFor="pago" className="ml-2 text-sm font-medium text-gray-700">
          Despesa já paga
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
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Salvar
        </button>
      </div>
    </form>
  );
};

export default FormularioDespesa;