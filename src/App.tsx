import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FinancasProvider } from './context/FinancasContext';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ReceitasPage from './pages/ReceitasPage';
import DespesasPage from './pages/DespesasPage';
import TiposDespesaPage from './pages/TiposDespesaPage';
import AlertasPage from './pages/AlertasPage';
import MetasPage from './pages/MetasPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';

function App() {
  return (
    <FinancasProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/receitas" element={<ReceitasPage />} />
            <Route path="/despesas" element={<DespesasPage />} />
            <Route path="/tipos-despesa" element={<TiposDespesaPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/metas" element={<MetasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </FinancasProvider>
  );
}

export default App;