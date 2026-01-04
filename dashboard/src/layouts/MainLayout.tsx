import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, Role } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Coins, 
  ShieldAlert, 
  Lock, 
  Key, 
  History, 
  LogOut,
  Globe
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: any;
  label: string;
  roles: Role[];
}

export const MainLayout: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem('teur_admin_token');
    navigate('/login');
  };

  const toggleLanguage = () => {
    const langs = ['en', 'fr', 'de'];
    const next = langs[(langs.indexOf(i18n.language) + 1) % langs.length];
    i18n.changeLanguage(next);
  };

  const navItems: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), roles: ['ECB_OPERATOR', 'AUDITOR', 'PARTICIPANT'] },
    { to: '/monetary', icon: Coins, label: t('nav.monetaryOps'), roles: ['ECB_OPERATOR'] },
    { to: '/sanctions', icon: ShieldAlert, label: t('nav.sanctions'), roles: ['ECB_OPERATOR'] },
    { to: '/escrow', icon: Lock, label: t('nav.escrow'), roles: ['ECB_OPERATOR'] },
    { to: '/security', icon: Key, label: t('nav.security'), roles: ['ECB_OPERATOR'] },
    { to: '/audit', icon: History, label: t('nav.audit'), roles: ['ECB_OPERATOR', 'AUDITOR'] },
  ];

  const filteredNavItems = navItems.filter(item => hasRole(item.roles));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-xl font-bold text-blue-900">tEUR Sovereign</span>
        </div>
        <nav className="mt-6 space-y-1 px-3">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-64 border-t p-4 space-y-2">
          <button
            onClick={toggleLanguage}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Globe className="h-5 w-5" />
            {i18n.language.toUpperCase()}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
};
