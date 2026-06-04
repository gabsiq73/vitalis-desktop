import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastContainer } from './components/ToastContainer';
import { useAuth } from './hooks/useAuth';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { StockPage } from './pages/StockPage';
import { BottlesPage } from './pages/BottlesPage';
import { ProductsPage } from './pages/ProductsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { GasSettlementsPage } from './pages/GasSettlementsPage';
import { ReportsPage } from './pages/ReportsPage';
import { CashRegisterPage } from './pages/CashRegisterPage';

function ProtectedLayout() {
  const { isAuthenticated, validating } = useAuth();

  if (validating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-body-md">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  return (
    <NotificationProvider>
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/bottles" element={<BottlesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/gas-settlements" element={<GasSettlementsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/cash-register" element={<CashRegisterPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
      <ToastContainer />
    </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
