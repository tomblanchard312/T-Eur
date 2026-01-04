import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { toast } from 'sonner';

export const Sanctions: React.FC = () => {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    type: 'freeze' | 'unfreeze';
    target?: string;
  }>({ isOpen: false, type: 'freeze' });

  const handleAction = (justification: string) => {
    console.log(`Executing ${modalConfig.type} on ${modalConfig.target} with justification: ${justification}`);
    toast.success(t('common.success'));
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('sanctions.title')}</h1>
      </header>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder={t('sanctions.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {search && (
          <div className="mt-8 rounded-lg border bg-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{t('common.address')}</p>
                <p className="font-mono text-lg font-bold text-gray-900">{search}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                <ShieldCheck className="h-3 w-3" />
                {t('dashboard.active').toUpperCase()}
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setModalConfig({ isOpen: true, type: 'freeze', target: search })}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <ShieldAlert className="h-4 w-4" />
                {t('sanctions.freeze')}
              </button>
              <button
                onClick={() => setModalConfig({ isOpen: true, type: 'unfreeze', target: search })}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {t('sanctions.unfreeze')}
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t('sanctions.recentActions')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{t('common.date')}</th>
                <th className="px-6 py-3 font-medium">{t('common.address')}</th>
                <th className="px-6 py-3 font-medium">{t('common.status')}</th>
                <th className="px-6 py-3 font-medium">{t('sanctions.scope')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-6 py-4">2026-01-03 10:15</td>
                <td className="px-6 py-4 font-mono">0x1234...abcd</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">FROZEN</span>
                </td>
                <td className="px-6 py-4">Sanction List v2.1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={t(`sanctions.confirm${modalConfig.type.charAt(0).toUpperCase() + modalConfig.type.slice(1)}`)}
        description={t(`sanctions.${modalConfig.type}Description`)}
        onConfirm={handleAction}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
        isDestructive={modalConfig.type === 'freeze'}
      />
    </div>
  );
};
