import { useQuery } from '@tanstack/react-query';
import { Activity, Coins, Wallet, Lock } from 'lucide-react';
import { teurApi } from '../lib/api';

export default function Dashboard() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['system-status'],
    queryFn: teurApi.getSystemStatus,
    refetchInterval: 10000,
  });

  const { data: supply } = useQuery({
    queryKey: ['total-supply'],
    queryFn: teurApi.getTotalSupply,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const stats = [
    {
      title: 'Total Supply',
      value: supply?.totalSupplyFormatted || '€0.00',
      icon: Coins,
      description: 'Total tEUR in circulation',
      color: 'text-blue-600',
    },
    {
      title: 'Blockchain Height',
      value: status?.blockchain.blockNumber.toLocaleString() || '0',
      icon: Activity,
      description: 'Current block number',
      color: 'text-green-600',
    },
    {
      title: 'System Status',
      value: status?.token.isPaused ? 'Paused' : 'Active',
      icon: status?.token.isPaused ? Lock : Activity,
      description: 'Token operation status',
      color: status?.token.isPaused ? 'text-red-600' : 'text-green-600',
    },
    {
      title: 'Operator',
      value: `${status?.blockchain.operator.slice(0, 6)}...${status?.blockchain.operator.slice(-4)}`,
      icon: Wallet,
      description: 'API operator address',
      color: 'text-purple-600',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">tEUR Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">{stat.title}</h3>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">System Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Chain ID</p>
            <p className="font-mono text-lg">{status?.blockchain.chainId || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Gas Price</p>
            <p className="font-mono text-lg">{status?.blockchain.gasPrice} wei</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">API Uptime</p>
            <p className="font-mono text-lg">{Math.floor(status?.api.uptime || 0)}s</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">API Version</p>
            <p className="font-mono text-lg">{status?.api.version}</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Activity className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">ECB Digital Euro Compliance</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Individual holding limit: €3,000.00</li>
                <li>Merchant holding limit: €30,000.00</li>
                <li>Waterfall/Reverse-waterfall enabled</li>
                <li>Conditional payments active</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
