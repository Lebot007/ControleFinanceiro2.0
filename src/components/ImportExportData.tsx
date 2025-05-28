import React, { useState, useRef } from 'react';

interface ImportExportDataProps {
  onExportar: () => void;
  onImportar: (dados: string) => boolean;
  onResetar: () => void;
}

const ImportExportData: React.FC<ImportExportDataProps> = ({ 
  onExportar, 
  onImportar,
  onResetar
}) => {
  const [message, setMessage] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const conteudo = event.target?.result as string;
        const sucesso = onImportar(conteudo);
        
        if (sucesso) {
          setMessage({ tipo: 'sucesso', texto: 'Dados importados com sucesso!' });
        } else {
          setMessage({ tipo: 'erro', texto: 'Formato de arquivo inválido. Verifique se é um backup válido.' });
        }
      } catch (error) {
        setMessage({ tipo: 'erro', texto: 'Erro ao ler o arquivo.' });
      }
      
      // Limpar o input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    
    reader.onerror = () => {
      setMessage({ tipo: 'erro', texto: 'Erro ao ler o arquivo.' });
    };
    
    reader.readAsText(file);
  };
  
  const handleExportar = () => {
    onExportar();
    setMessage({ tipo: 'sucesso', texto: 'Dados exportados com sucesso!' });
    setTimeout(() => setMessage(null), 3000);
  };
  
  const handleResetar = () => {
    onResetar();
    setShowConfirmReset(false);
    setMessage({ tipo: 'sucesso', texto: 'Todos os dados foram resetados!' });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">Importar/Exportar Dados</h2>
      
      {message && (
        <div className={`p-3 rounded-md mb-4 ${
          message.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {message.texto}
        </div>
      )}
      
      <div className="space-y-6">
        <div>
          <h3 className="text-md font-medium mb-2">Backup dos Dados</h3>
          <p className="text-sm text-gray-600 mb-3">
            Faça o backup dos seus dados para guardar em segurança ou transferir para outro dispositivo.
          </p>
          <button
            onClick={handleExportar}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Exportar Dados
          </button>
        </div>
        
        <div className="border-t pt-6">
          <h3 className="text-md font-medium mb-2">Restaurar Backup</h3>
          <p className="text-sm text-gray-600 mb-3">
            Restaure seus dados a partir de um arquivo de backup previamente gerado.
          </p>
          <div>
            <input
              type="file"
              id="importFile"
              ref={fileInputRef}
              onChange={handleImportar}
              accept=".json"
              className="hidden"
            />
            <label
              htmlFor="importFile"
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 cursor-pointer"
            >
              Importar Dados
            </label>
          </div>
        </div>
        
        <div className="border-t pt-6">
          <h3 className="text-md font-medium mb-2 text-red-600">Resetar Dados</h3>
          <p className="text-sm text-gray-600 mb-3">
            Esta ação irá apagar todos os seus dados e não pode ser desfeita!
          </p>
          
          {!showConfirmReset ? (
            <button
              onClick={() => setShowConfirmReset(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Resetar Todos os Dados
            </button>
          ) : (
            <div className="bg-red-50 p-4 rounded-md">
              <p className="text-sm text-red-700 font-medium mb-3">
                Tem certeza que deseja apagar todos os dados? Esta ação não pode ser desfeita.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleResetar}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Sim, Resetar Tudo
                </button>
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExportData;