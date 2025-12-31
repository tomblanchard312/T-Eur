import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teurApi } from '../lib/api';

const Wallets = () => {
  const [address, setAddress] = useState('');
  const [registerData, setRegisterData] = useState({ address: '', balance: 0 });
  const [deactivateData, setDeactivateData] = useState({ wallet: '', reason: '' });

  const { data: wallet, refetch } = useQuery({
    queryKey: ['wallet', address],
    queryFn: () => teurApi.getWallet(address),
    enabled: !!address,
  });

  const handleGetWallet = () => {
    if (address) refetch();
  };

  const handleRegister = async () => {
    try {
      await teurApi.registerWallet(registerData);
      alert('Wallet registered successfully');
    } catch (error) {
      alert('Error registering wallet');
    }
  };

  const handleDeactivate = async () => {
    try {
      await teurApi.deactivateWallet(deactivateData);
      alert('Wallet deactivated successfully');
    } catch (error) {
      alert('Error deactivating wallet');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Wallets</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Get Wallet */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Get Wallet</h2>
          <input
            type="text"
            placeholder="Wallet Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleGetWallet} className="bg-blue-500 text-white px-4 py-2 rounded">
            Get Wallet
          </button>
          {wallet && (
            <div className="mt-4">
              <p>Address: {wallet.address}</p>
              <p>Balance: {wallet.balance}</p>
              <p>Status: {wallet.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          )}
        </div>

        {/* Register Wallet */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Register Wallet</h2>
          <input
            type="text"
            placeholder="Address"
            value={registerData.address}
            onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="number"
            placeholder="Initial Balance"
            value={registerData.balance}
            onChange={(e) => setRegisterData({ ...registerData, balance: parseInt(e.target.value) })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleRegister} className="bg-green-500 text-white px-4 py-2 rounded">
            Register
          </button>
        </div>

        {/* Deactivate Wallet */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Deactivate Wallet</h2>
          <input
            type="text"
            placeholder="Wallet Address"
            value={deactivateData.wallet}
            onChange={(e) => setDeactivateData({ ...deactivateData, wallet: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Reason"
            value={deactivateData.reason}
            onChange={(e) => setDeactivateData({ ...deactivateData, reason: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleDeactivate} className="bg-red-500 text-white px-4 py-2 rounded">
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Wallets;