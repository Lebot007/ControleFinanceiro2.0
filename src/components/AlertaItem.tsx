import React from 'react';
import { AlertTriangle, Clock, TrendingUp, Check, X } from 'lucide-react';
import { Alerta } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertaItemProps {
  alerta: Alerta;
  onMarcarLido: (id: string) => void;
  onRemover: (id: string) => void;
}

const AlertaItem: React.FC<AlertaItemProps> = ({ alerta, onMarcarLido, onRemover }) => {
  const { id, tipo, mensagem, data, lido } = alerta;
  
  const dataFormatada = format(parseISO(data), "dd 'de' MMMM, HH:mm", { locale: ptBR });
  
  const renderIcone = () => {
    switch (tipo) {
      case 'vencimento':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'saldo':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'aumento':
        return <TrendingUp className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-blue-500" />;
    }
  };
  
  const obterCorBorda = () => {
    switch (tipo) {
      case 'vencimento':
        return 'border-l-yellow-500';
      case 'saldo':
        return 'border-l-red-500';
      case 'aumento':
        return 'border-l-orange-500';
      default:
        return 'border-l-blue-500';
    }
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 mb-3 border-l-4 ${obterCorBorda()} ${
      lido ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          {renderIcone()}
        </div>
        <div className="flex-grow">
          <p className="text-gray-800 font-medium">{mensagem}</p>
          <p className="text-gray-500 text-sm mt-1">{dataFormatada}</p>
        </div>
        <div className="flex space-x-2">
          {!lido && (
            <button
              onClick={() => onMarcarLido(id)}
              className="text-gray-400 hover:text-green-500 transition-colors"
              title="Marcar como lido"
            >
              <Check size={18} />
            </button>
          )}
          <button
            onClick={() => onRemover(id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Remover alerta"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertaItem;