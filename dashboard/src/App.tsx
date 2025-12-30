import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Wallets from './pages/Wallets';
import Transfers from './pages/Transfers';
import Payments from './pages/Payments';
import System from './pages/System';
import Roles from './pages/Roles';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/wallets" element={<Wallets />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/system" element={<System />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;
