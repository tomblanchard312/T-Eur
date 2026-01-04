import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: (justification: string) => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isDestructive = false,
}) => {
  const { t } = useTranslation();
  const [justification, setJustification] = React.useState('');

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          {isDestructive && <AlertTriangle className="h-6 w-6 text-red-600" />}
          <h3 id="modal-title" className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        
        <p className="mb-6 text-sm text-gray-600">{description}</p>
        
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t('common.justification')} <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={t('common.required')}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm(justification)}
            disabled={!justification.trim()}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
