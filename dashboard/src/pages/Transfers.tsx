import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teurApi } from '../lib/api';

const Transfers = () => {
  const [mintData, setMintData] = useState({ to: '', amount: 0, key: '' });
  const [burnData, setBurnData] = useState({ from: '', amount: 0 });
  const [transferData, setTransferData] = useState({ from: '', to: '', amount: 0 });
  const [waterfallWallet, setWaterfallWallet] = useState('');

  const { data: supply } = useQuery({
    queryKey: ['total-supply'],
    queryFn: teurApi.getTotalSupply,
  });

  const handleMint = async () => {
    try {
      await teurApi.mint(mintData);
      alert('Mint successful');
    } catch (error) {
      alert('Error minting');
    }
  };

  const handleBurn = async () => {
    try {
      await teurApi.burn(burnData);
      alert('Burn successful');
    } catch (error) {
      alert('Error burning');
    }
  };

  const handleTransfer = async () => {
    try {
      await teurApi.transfer(transferData);
      alert('Transfer successful');
    } catch (error) {
      alert('Error transferring');
    }
  };

  const handleWaterfall = async () => {
    try {
      await teurApi.executeWaterfall(waterfallWallet);
      alert('Waterfall executed');
    } catch (error) {
      alert('Error executing waterfall');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Transfers</h1>

      <div className="mb-6">
        <h2 className="text-lg font-semibold">Total Supply: {supply?.totalSupplyFormatted || '€0.00'}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mint */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Mint</h2>
          <input
            type="text"
            placeholder="To Address"
            value={mintData.to}
            onChange={(e) => setMintData({ ...mintData, to: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="number"
            placeholder="Amount"
            value={mintData.amount}
            onChange={(e) => setMintData({ ...mintData, amount: parseInt(e.target.value) })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Key"
            value={mintData.key}
            onChange={(e) => setMintData({ ...mintData, key: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleMint} className="bg-blue-500 text-white px-4 py-2 rounded">
            Mint
          </button>
        </div>

        {/* Burn */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Burn</h2>
          <input
            type="text"
            placeholder="From Address"
            value={burnData.from}
            onChange={(e) => setBurnData({ ...burnData, from: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="number"
            placeholder="Amount"
            value={burnData.amount}
            onChange={(e) => setBurnData({ ...burnData, amount: parseInt(e.target.value) })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleBurn} className="bg-red-500 text-white px-4 py-2 rounded">
            Burn
          </button>
        </div>

        {/* Transfer */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Transfer</h2>
          <input
            type="text"
            placeholder="From Address"
            value={transferData.from}
            onChange={(e) => setTransferData({ ...transferData, from: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="To Address"
            value={transferData.to}
            onChange={(e) => setTransferData({ ...transferData, to: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="number"
            placeholder="Amount"
            value={transferData.amount}
            onChange={(e) => setTransferData({ ...transferData, amount: parseInt(e.target.value) })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleTransfer} className="bg-green-500 text-white px-4 py-2 rounded">
            Transfer
          </button>
        </div>

        {/* Execute Waterfall */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Execute Waterfall</h2>
          <input
            type="text"
            placeholder="Wallet Address"
            value={waterfallWallet}
            onChange={(e) => setWaterfallWallet(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleWaterfall} className="bg-purple-500 text-white px-4 py-2 rounded">
            Execute Waterfall
          </button>
        </div>
      </div>
    </div>
  );
};

export default Transfers;