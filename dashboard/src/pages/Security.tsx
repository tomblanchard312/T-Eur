import React from 'react';
import { useTranslation } from 'react-i18next';
import { Key, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { toast } from 'sonner';

export const Security: React.FC = () => {
  const { t } = useTranslation();
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    type: 'rotate' | 'revoke';
    target?: string;
  }>({ isOpen: false, type: 'rotate' });

  const handleAction = (justification: string) => {
    console.log(`Executing ${modalConfig.type} on ${modalConfig.target} with justification: ${justification}`);
    toast.success(t('common.success'));
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('security.title')}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-green-100 p-3 text-green-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('security.hsmStatus')}</p>
              <p className="text-lg font-bold text-gray-900">ONLINE</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('security.activeKeys')}</p>
              <p className="text-lg font-bold text-gray-900">12</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-orange-100 p-3 text-orange-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('security.pendingRotations')}</p>
              <p className="text-lg font-bold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t('security.keyManagement')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{t('common.id')}</th>
                <th className="px-6 py-3 font-medium">{t('common.type')}</th>
                <th className="px-6 py-3 font-medium">{t('common.status')}</th>
                <th className="px-6 py-3 font-medium text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-6 py-4 font-mono">ECB-MINT-01</td>
                <td className="px-6 py-4">HSM-RSA-4096</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">ACTIVE</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setModalConfig({ isOpen: true, type: 'rotate', target: 'ECB-MINT-01' })}
                      className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t('security.rotate')}
                    </button>
                    <button
                      onClick={() => setModalConfig({ isOpen: true, type: 'revoke', target: 'ECB-MINT-01' })}
                      className="flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {t('security.revoke')}
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
        title={t(`security.confirm${modalConfig.type.charAt(0).toUpperCase() + modalConfig.type.slice(1)}`)}
        description={t(`security.${modalConfig.type}Description`)}
        onConfirm={handleAction}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
        isDestructive={modalConfig.type === 'revoke'}
      />
    </div>
  );
};
