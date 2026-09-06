import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  FileText,
  Receipt,
  ShoppingCart,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/productos', label: 'Productos', icon: Package, end: false },
  { to: '/stock', label: 'Stock', icon: Boxes, end: false },
  { to: '/acopios', label: 'Acopios', icon: Boxes, end: false },
  { to: '/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/presupuestos', label: 'Presupuestos', icon: FileText, end: false },
  { to: '/remitos', label: 'Remitos', icon: Receipt, end: false },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, end: false },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-white">Corralón</h1>
        {profile && <p className="text-sm text-gray-400 mt-1">{profile.name}</p>}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
