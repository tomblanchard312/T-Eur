import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Filter, Search } from 'lucide-react';

export const Audit: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('audit.title')}</h1>
        <button className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Download className="h-4 w-4" />
          {t('audit.export')}
        </button>
      </header>

      <div className="flex gap-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder={t('audit.searchPlaceholder')}
          />
        </div>
        <button className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          {t('audit.filter')}
        </button>
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{t('common.date')}</th>
                <th className="px-6 py-3 font-medium">{t('common.operator')}</th>
                <th className="px-6 py-3 font-medium">{t('common.action')}</th>
                <th className="px-6 py-3 font-medium">{t('common.justification')}</th>
                <th className="px-6 py-3 font-medium text-right">{t('common.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">2026-01-03 14:22:10</td>
                <td className="px-6 py-4">ecb-op-01</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">MINT</span>
                </td>
                <td className="px-6 py-4 max-w-xs truncate">Quarterly liquidity adjustment per Council Decision 2025/88</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:underline" title={t('common.viewDetails')}>
                    <FileText className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">2026-01-03 10:15:45</td>
                <td className="px-6 py-4">ecb-op-02</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">FREEZE</span>
                </td>
                <td className="px-6 py-4 max-w-xs truncate">Compliance with EU Sanction List Update 2026-01-03</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:underline" title={t('common.viewDetails')}>
                    <FileText className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
