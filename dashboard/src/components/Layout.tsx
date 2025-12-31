import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Wallet, ArrowLeftRight, FileText, Settings, Users, LayoutDashboard, Menu, X, Euro, Smartphone } from 'lucide-react';
import { cn } from '../lib/utils';

const navigation = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Wallets', to: '/wallets', icon: Wallet },
  { name: 'Transfers', to: '/transfers', icon: ArrowLeftRight },
  { name: 'Payments', to: '/payments', icon: FileText },
  { name: 'Consumer Wallet', to: '/consumer-wallet', icon: Smartphone },
  { name: 'Roles', to: '/roles', icon: Users },
  { name: 'System', to: '/system', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <div className="flex items-center space-x-2">
              <Euro className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold">tEUR Admin</span>
            </div>
            <button
              type="button"
              aria-label="Close sidebar menu"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r">
          <div className="flex h-16 items-center px-6 border-b">
            <Euro className="w-8 h-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold">tEUR Admin</span>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="text-xs text-gray-500">
              <p>European Central Bank</p>
              <p className="mt-1">Digital Euro Infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white shadow lg:hidden">
          <button
            type="button"
            aria-label="Open sidebar menu"
            onClick={() => setSidebarOpen(true)}
            className="px-4 text-gray-500 focus:outline-none lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-1 items-center justify-between px-4">
            <span className="text-lg font-semibold">tEUR Admin</span>
          </div>
        </div>

        <main className="flex-1">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
