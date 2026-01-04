import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Activity, 
  ShieldCheck, 
  AlertCircle, 
  TrendingUp, 
  Lock,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  // Mock data for demonstration (in real app, fetch from API)
  const status = {
    health: 'OK',
    network: 'ACTIVE',
    mintingEnabled: true,
    reserveBalance: '1,250,000,000.00',
    escrowBalance: '45,200,000.00',
  };

  const stats = [
    { 
      label: t('dashboard.reserveBalance'), 
      value: `${status.reserveBalance} tEUR`, 
      icon: TrendingUp,
      color: 'text-blue-600'
    },
    { 
      label: t('dashboard.escrowBalance'), 
      value: `${status.escrowBalance} tEUR`, 
      icon: Lock,
      color: 'text-orange-600'
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
      </header>

      {/* System Status Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">{t('dashboard.systemHealth')}</span>
            <Activity className="h-5 w-5 text-green-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-lg font-bold text-gray-900">{t('dashboard.ok')}</span>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">{t('dashboard.networkStatus')}</span>
            <ShieldCheck className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
            <span className="text-lg font-bold text-gray-900">{t('dashboard.active')}</span>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">{t('dashboard.mintingStatus')}</span>
            <AlertCircle className={status.mintingEnabled ? 'text-green-500' : 'text-red-500'} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {status.mintingEnabled ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-lg font-bold text-gray-900">
              {status.mintingEnabled ? t('dashboard.enabled') : t('dashboard.suspended')}
            </span>
          </div>
        </div>
      </div>

      {/* Balances Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`rounded-full bg-gray-50 p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t('dashboard.activeAlerts')}</h2>
        </div>
        <div className="divide-y">
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="rounded-full bg-yellow-50 p-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">High-value transfer detected</p>
              <p className="text-xs text-gray-500">5,000,000.00 tEUR (Bank A -&gt; Bank B) | 2026-01-03 10:45 UTC</p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="rounded-full bg-blue-50 p-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Key rotation scheduled</p>
              <p className="text-xs text-gray-500">Operational key rotation due in 12 days | 2026-01-15</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
