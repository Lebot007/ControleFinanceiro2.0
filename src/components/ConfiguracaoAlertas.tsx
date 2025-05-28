import React, { useState } from 'react';
import { ConfiguracaoAlertas as IConfiguracaoAlertas } from '../types';

interface ConfiguracaoAlertasProps {
  configuracao: IConfiguracaoAlertas;
  onSalvar: (config: IConfiguracaoAlertas) => void;
}

const ConfiguracaoAlertas: React.FC<ConfiguracaoAlertasProps> = ({ 
  configuracao, 
  onSalvar 
}) => {
  const [saldoMinimo, setSaldoMinimo] = useState(configuracao.saldoMinimo);
  const [diasVencimento, setDiasVencimento] = useState(configuracao.diasVencimento);
  const [percentualAumento, setPercentualAumento] = useState(configuracao.percentualAumento);
  const [ativo, setAtivo] = useState(configuracao.ativo);
  const [tiposAtivos, setTiposAtivos] = useState(configuracao.tiposAtivos);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSalvar({
      saldoMinimo,
      diasVencimento,
      percentualAumento,
      ativo,
      tiposAtivos
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">Configuração de Alertas</h2>
      
      <div className="mb-6 flex items-center">
        <input
          type="checkbox"
          id="ativo"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        <label htmlFor="ativo" className="ml-2 text-sm font-medium text-gray-700">
          Sistema de alertas ativo
        </label>
      </div>
      
      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Tipos de Alertas Ativos</h3>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="alertaVencimento"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            checked={tiposAtivos.vencimento}
            onChange={(e) => setTiposAtivos(prev => ({ ...prev, vencimento: e.target.checked }))}
          />
          <label htmlFor="alertaVencimento" className="ml-2 text-sm text-gray-700">
            Alertas de vencimento
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="alertaSaldo"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            checked={tiposAtivos.saldo}
            onChange={(e) => setTiposAtivos(prev => ({ ...prev, saldo: e.target.checked }))}
          />
          <label htmlFor="alertaSaldo" className="ml-2 text-sm text-gray-700">
            Alertas de saldo baixo
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="alertaAumento"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            checked={tiposAtivos.aumento}
            onChange={(e) => setTiposAtivos(prev => ({ ...prev, aumento: e.target.checked }))}
          />
          <label htmlFor="alertaAumento" className="ml-2 text-sm text-gray-700">
            Alertas de aumento de despesas
          </label>
        </div>
      </div>
      
      <div className="mb-4">
        <label htmlFor="saldoMinimo" className="block text-sm font-medium text-gray-700 mb-1">
          Saldo Mínimo (R$)
        </label>
        <input
          type="number"
          id="saldoMinimo"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={saldoMinimo}
          onChange={(e) => setSaldoMinimo(Number(e.target.value))}
          min="0"
        />
        <p className="text-sm text-gray-500 mt-1">
          Alerta quando o saldo total estiver abaixo deste valor
        </p>
      </div>
      
      <div className="mb-4">
        <label htmlFor="diasVencimento" className="block text-sm font-medium text-gray-700 mb-1">
          Dias de Antecedência para Vencimentos
        </label>
        <input
          type="number"
          id="diasVencimento"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={diasVencimento}
          onChange={(e) => setDiasVencimento(Number(e.target.value))}
          min="1"
          max="30"
        />
        <p className="text-sm text-gray-500 mt-1">
          Alerta sobre contas a vencer neste número de dias de antecedência
        </p>
      </div>
      
      <div className="mb-6">
        <label htmlFor="percentualAumento" className="block text-sm font-medium text-gray-700 mb-1">
          Percentual de Aumento (%)
        </label>
        <input
          type="number"
          id="percentualAumento"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={percentualAumento}
          onChange={(e) => setPercentualAumento(Number(e.target.value))}
          min="5"
          max="100"
        />
        <p className="text-sm text-gray-500 mt-1">
          Alerta quando houver aumento de despesas acima deste percentual em relação ao mês anterior
        </p>
      </div>
      
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Salvar Configurações
        </button>
      </div>
    </form>
  );
};

export default ConfiguracaoAlertas;