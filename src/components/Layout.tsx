import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  TrendingUp, 
  TrendingDown, 
  Tags, 
  Bell, 
  Target, 
  Settings, 
  Menu, 
  X, 
  ChevronRight 
} from 'lucide-react';
import { useFinancas } from '../context/FinancasContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();
  const { estado } = useFinancas();
  
  const alertasNaoLidos = estado.alertas.filter(alerta => !alerta.lido).length;
  
  const menuItems = [
    { path: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { path: '/receitas', icon: <TrendingUp size={20} />, label: 'Receitas' },
    { path: '/despesas', icon: <TrendingDown size={20} />, label: 'Despesas' },
    { path: '/tipos-despesa', icon: <Tags size={20} />, label: 'Tipos de Despesa' },
    { path: '/alertas', icon: <Bell size={20} />, label: 'Alertas', badge: alertasNaoLidos > 0 ? alertasNaoLidos : undefined },
    { path: '/metas', icon: <Target size={20} />, label: 'Metas' },
    { path: '/configuracoes', icon: <Settings size={20} />, label: 'Configurações' },
  ];

  const toggleMenu = () => setMenuAberto(!menuAberto);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar para desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white shadow-md">
        <div className="p-4 border-b flex items-center">
          <TrendingUp className="h-8 w-8 text-blue-600 mr-2" />
          <h1 className="text-xl font-bold text-gray-800">FinançasPro</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul>
            {menuItems.map(item => (
              <li key={item.path} className="mb-2">
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors ${
                    location.pathname === item.path ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Menu para mobile */}
      <div className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
        menuAberto ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="absolute inset-0 bg-black opacity-50" onClick={toggleMenu}></div>
        <div className={`absolute inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-2" />
              <h1 className="text-xl font-bold text-gray-800">FinançasPro</h1>
            </div>
            <button
              onClick={toggleMenu}
              className="text-gray-500 hover:text-gray-800 focus:outline-none"
            >
              <X size={24} />
            </button>
          </div>
          <nav className="p-4">
            <ul>
              {menuItems.map(item => (
                <li key={item.path} className="mb-2">
                  <Link
                    to={item.path}
                    className={`flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors ${
                      location.pathname === item.path ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                    }`}
                    onClick={toggleMenu}
                  >
                    <span className="mr-3">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="ml-auto h-5 w-5" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b md:border-0 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={toggleMenu}
              className="md:hidden text-gray-600 focus:outline-none"
            >
              <Menu size={24} />
            </button>
            <div className="md:hidden flex items-center">
              <TrendingUp className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-lg font-bold text-gray-800">FinançasPro</h1>
            </div>
            <div className="md:flex md:items-center">
              <Link
                to="/alertas"
                className="relative text-gray-600 hover:text-gray-800 p-2"
              >
                <Bell size={20} />
                {alertasNaoLidos > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {alertasNaoLidos}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;