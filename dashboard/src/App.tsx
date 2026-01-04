import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { MonetaryOps } from './pages/MonetaryOps';
import { Sanctions } from './pages/Sanctions';
import { Escrow } from './pages/Escrow';
import { Security } from './pages/Security';
import { Audit } from './pages/Audit';
import './i18n';

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monetary" element={<MonetaryOps />} />
          <Route path="/sanctions" element={<Sanctions />} />
          <Route path="/escrow" element={<Escrow />} />
          <Route path="/security" element={<Security />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;
