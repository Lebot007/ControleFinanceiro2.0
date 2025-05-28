import React from 'react';
import { useFinancas } from '../context/FinancasContext';
import ConfiguracaoAlertas from '../components/ConfiguracaoAlertas';
import ImportExportData from '../components/ImportExportData';

const ConfiguracoesPage: React.FC = () => {
  const { estado, atualizarConfiguracaoAlertas, exportarDados, importarDados, resetarDados } = useFinancas();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <ConfiguracaoAlertas
            configuracao={estado.configuracao.alertas}
            onSalvar={atualizarConfiguracaoAlertas}
          />
        </div>
        
        <div>
          <ImportExportData
            onExportar={exportarDados}
            onImportar={importarDados}
            onResetar={resetarDados}
          />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Sobre o FinançasPro</h2>
        <p className="text-gray-700 mb-3">
          O FinançasPro é um aplicativo de gerenciamento financeiro pessoal que permite acompanhar receitas, 
          despesas, metas de poupança e receber alertas inteligentes sobre sua situação financeira.
        </p>
        <p className="text-gray-700 mb-3">
          Todos os seus dados são armazenados localmente no seu navegador. Faça backups regulares 
          utilizando a função de exportação de dados para evitar perda de informações.
        </p>
        <p className="text-gray-600 text-sm mt-6">
          Versão 1.0.0
        </p>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;