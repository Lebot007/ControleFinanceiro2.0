import React from 'react';
import { useFinancas } from '../context/FinancasContext';
import { RefreshCw, Trash2 } from 'lucide-react';
import AlertaItem from '../components/AlertaItem';

const AlertasPage: React.FC = () => {
  const { estado, atualizarAlertas, marcarAlertaLido, removerAlerta } = useFinancas();
  const { alertas } = estado;
  
  // Ordenar alertas por data (mais recentes primeiro)
  const alertasOrdenados = [...alertas].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
  
  const alertasNaoLidos = alertasOrdenados.filter(a => !a.lido);
  const alertasLidos = alertasOrdenados.filter(a => a.lido);
  
  const handleAtualizarAlertas = () => {
    atualizarAlertas();
  };
  
  const handleLimparLidos = () => {
    alertasLidos.forEach(alerta => removerAlerta(alerta.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Alertas</h1>
        <button
          onClick={handleAtualizarAlertas}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <RefreshCw size={20} className="mr-1" />
          Atualizar Alertas
        </button>
      </div>
      
      {/* Alertas não lidos */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Alertas Não Lidos</h2>
          <span className="text-sm bg-red-100 text-red-800 py-1 px-2 rounded-full">
            {alertasNaoLidos.length}
          </span>
        </div>
        
        <div className="space-y-3">
          {alertasNaoLidos.map(alerta => (
            <AlertaItem
              key={alerta.id}
              alerta={alerta}
              onMarcarLido={marcarAlertaLido}
              onRemover={removerAlerta}
            />
          ))}
          
          {alertasNaoLidos.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Não há alertas não lidos</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Alertas lidos */}
      {alertasLidos.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Alertas Lidos</h2>
            <button
              onClick={handleLimparLidos}
              className="flex items-center text-sm text-red-600 hover:text-red-800"
            >
              <Trash2 size={16} className="mr-1" />
              Limpar lidos
            </button>
          </div>
          
          <div className="space-y-3">
            {alertasLidos.map(alerta => (
              <AlertaItem
                key={alerta.id}
                alerta={alerta}
                onMarcarLido={marcarAlertaLido}
                onRemover={removerAlerta}
              />
            ))}
          </div>
        </div>
      )}
      
      {alertasNaoLidos.length === 0 && alertasLidos.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-lg text-gray-600 mb-4">Não há alertas registrados</p>
          <p className="text-gray-500">
            Clique em "Atualizar Alertas" para verificar se há novas notificações com base nas suas finanças
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertasPage;