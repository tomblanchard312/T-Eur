import React from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Ban, Play, Trash2 } from 'lucide-react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { toast } from 'sonner';

export const MonetaryOps: React.FC = () => {
  const { t } = useTranslation();
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    type: 'mint' | 'burn' | 'suspend' | 'resume';
  }>({ isOpen: false, type: 'mint' });

  const handleAction = (justification: string) => {
    // In real app, call API here
    console.log(`Executing ${modalConfig.type} with justification: ${justification}`);
    toast.success(t('common.success'));
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  const actions = [
    {
      id: 'mint',
      title: t('monetary.mint'),
      description: t('monetary.mintDescription'),
      icon: Coins,
      color: 'bg-blue-600',
    },
    {
      id: 'burn',
      title: t('monetary.burn'),
      description: t('monetary.burnDescription'),
      icon: Trash2,
      color: 'bg-red-600',
    },
    {
      id: 'suspend',
      title: t('monetary.suspend'),
      description: t('monetary.suspendDescription'),
      icon: Ban,
      color: 'bg-orange-600',
    },
    {
      id: 'resume',
      title: t('monetary.resume'),
      description: t('monetary.resumeDescription'),
      icon: Play,
      color: 'bg-green-600',
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('monetary.title')}</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {actions.map((action) => (
          <div key={action.id} className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50">
              <action.icon className={`h-6 w-6 ${action.color.replace('bg-', 'text-')}`} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{action.title}</h3>
            <p className="mt-2 text-sm text-gray-500">{action.description}</p>
            <button
              onClick={() => setModalConfig({ isOpen: true, type: action.id as any })}
              className={`mt-6 w-full rounded-md px-4 py-2 text-sm font-medium text-white ${action.color} hover:opacity-90`}
            >
              {action.title}
            </button>
          </div>
        ))}
      </div>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={t(`monetary.confirm${modalConfig.type.charAt(0).toUpperCase() + modalConfig.type.slice(1)}`)}
        description={t(`monetary.${modalConfig.type}Description`)}
        onConfirm={handleAction}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
        isDestructive={modalConfig.type === 'burn' || modalConfig.type === 'suspend'}
      />
    </div>
  );
};
