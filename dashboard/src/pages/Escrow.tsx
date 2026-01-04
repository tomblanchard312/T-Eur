import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Flame, History } from 'lucide-react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { toast } from 'sonner';

export const Escrow: React.FC = () => {
  const { t } = useTranslation();
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    type: 'release' | 'burn';
    targetId?: string;
  }>({ isOpen: false, type: 'release' });

  const handleAction = (justification: string) => {
    console.log(`Executing ${modalConfig.type} on ${modalConfig.targetId} with justification: ${justification}`);
    toast.success(t('common.success'));
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('escrow.title')}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('escrow.totalLocked')}</p>
              <p className="text-2xl font-bold text-gray-900">€ 1,250,000.00</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-orange-100 p-3 text-orange-600">
              <History className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('escrow.pendingActions')}</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t('escrow.activeEscrows')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{t('common.id')}</th>
                <th className="px-6 py-3 font-medium">{t('common.address')}</th>
                <th className="px-6 py-3 font-medium">{t('common.amount')}</th>
                <th className="px-6 py-3 font-medium">{t('common.status')}</th>
                <th className="px-6 py-3 font-medium text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-6 py-4 font-mono">ESC-9921</td>
                <td className="px-6 py-4 font-mono text-xs text-gray-500">0x7890...efgh</td>
                <td className="px-6 py-4 font-bold">€ 50,000.00</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">LOCKED</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setModalConfig({ isOpen: true, type: 'release', targetId: 'ESC-9921' })}
                      className="rounded p-1 text-blue-600 hover:bg-blue-50"
                      title={t('escrow.release')}
                    >
                      <Unlock className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setModalConfig({ isOpen: true, type: 'burn', targetId: 'ESC-9921' })}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      title={t('escrow.burn')}
                    >
                      <Flame className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={t(`escrow.confirm${modalConfig.type.charAt(0).toUpperCase() + modalConfig.type.slice(1)}`)}
        description={t(`escrow.${modalConfig.type}Description`)}
        onConfirm={handleAction}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
        isDestructive={modalConfig.type === 'burn'}
      />
    </div>
  );
};
