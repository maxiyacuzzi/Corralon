import { Navigate, Outlet, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Suppliers } from './pages/Suppliers';
import { Stock } from './pages/Stock';
import { Stockpiles } from './pages/Stockpiles';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { Quotes } from './pages/Quotes';
import { DeliveryNotes } from './pages/DeliveryNotes';
import { Sales } from './pages/Sales';
import { Checks } from './pages/Checks';

function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="productos" element={<Products />} />
              <Route path="categorias" element={<Categories />} />
              <Route path="proveedores" element={<Suppliers />} />
              <Route path="stock" element={<Stock />} />
              <Route path="acopios" element={<Stockpiles />} />
              <Route path="clientes" element={<Clients />} />
              <Route path="clientes/:id" element={<ClientDetail />} />
              <Route path="presupuestos" element={<Quotes />} />
              <Route path="remitos" element={<DeliveryNotes />} />
              <Route path="ventas" element={<Sales />} />
              <Route path="valores" element={<Checks />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
