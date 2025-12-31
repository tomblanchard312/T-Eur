import { useQuery } from '@tanstack/react-query';
import { teurApi } from '../lib/api';

const System = () => {
  const { data: status, refetch } = useQuery({
    queryKey: ['system-status'],
    queryFn: teurApi.getSystemStatus,
  });

  const handlePause = async () => {
    try {
      await teurApi.pauseSystem();
      alert('System paused');
      refetch();
    } catch (error) {
      alert('Error pausing system');
    }
  };

  const handleUnpause = async () => {
    try {
      await teurApi.unpauseSystem();
      alert('System unpaused');
      refetch();
    } catch (error) {
      alert('Error unpausing system');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">System</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">System Status</h2>
        {status ? (
          <div>
            <p>Token Paused: {status.token.isPaused ? 'Yes' : 'No'}</p>
            <p>Blockchain Height: {status.blockchain.blockNumber}</p>
            <p>Operator: {status.blockchain.operator}</p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={handlePause}
          className="bg-red-500 text-white px-4 py-2 rounded"
          disabled={status?.token.isPaused}
        >
          Pause System
        </button>
        <button
          onClick={handleUnpause}
          className="bg-green-500 text-white px-4 py-2 rounded"
          disabled={!status?.token.isPaused}
        >
          Unpause System
        </button>
      </div>
    </div>
  );
};

export default System;