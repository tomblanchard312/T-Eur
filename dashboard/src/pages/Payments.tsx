import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teurApi } from '../lib/api';

const Payments = () => {
  const [paymentId, setPaymentId] = useState('');
  const [createData, setCreateData] = useState({ payer: '', payee: '', amount: 0, description: '' });
  const [releaseData, setReleaseData] = useState({ paymentId: '', secret: '' });
  const [cancelId, setCancelId] = useState('');

  const { data: payment, refetch } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => teurApi.getPayment(paymentId),
    enabled: !!paymentId,
  });

  const handleGetPayment = () => {
    if (paymentId) refetch();
  };

  const handleCreate = async () => {
    try {
      await teurApi.createPayment(createData);
      alert('Payment created successfully');
    } catch (error) {
      alert('Error creating payment');
    }
  };

  const handleRelease = async () => {
    try {
      await teurApi.releasePayment(releaseData);
      alert('Payment released successfully');
    } catch (error) {
      alert('Error releasing payment');
    }
  };

  const handleCancel = async () => {
    try {
      await teurApi.cancelPayment(cancelId);
      alert('Payment cancelled successfully');
    } catch (error) {
      alert('Error cancelling payment');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Payments</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Get Payment */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Get Payment</h2>
          <input
            type="text"
            placeholder="Payment ID"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleGetPayment} className="bg-blue-500 text-white px-4 py-2 rounded">
            Get Payment
          </button>
          {payment && (
            <div className="mt-4">
              <p>ID: {payment.id}</p>
              <p>Payer: {payment.payer}</p>
              <p>Payee: {payment.payee}</p>
              <p>Amount: {payment.amount}</p>
              <p>Status: {payment.status}</p>
            </div>
          )}
        </div>

        {/* Create Payment */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Create Payment</h2>
          <input
            type="text"
            placeholder="Payer"
            value={createData.payer}
            onChange={(e) => setCreateData({ ...createData, payer: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Payee"
            value={createData.payee}
            onChange={(e) => setCreateData({ ...createData, payee: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="number"
            placeholder="Amount"
            value={createData.amount}
            onChange={(e) => setCreateData({ ...createData, amount: parseInt(e.target.value) })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Description"
            value={createData.description}
            onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleCreate} className="bg-green-500 text-white px-4 py-2 rounded">
            Create
          </button>
        </div>

        {/* Release Payment */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Release Payment</h2>
          <input
            type="text"
            placeholder="Payment ID"
            value={releaseData.paymentId}
            onChange={(e) => setReleaseData({ ...releaseData, paymentId: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Secret"
            value={releaseData.secret}
            onChange={(e) => setReleaseData({ ...releaseData, secret: e.target.value })}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleRelease} className="bg-yellow-500 text-white px-4 py-2 rounded">
            Release
          </button>
        </div>

        {/* Cancel Payment */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Cancel Payment</h2>
          <input
            type="text"
            placeholder="Payment ID"
            value={cancelId}
            onChange={(e) => setCancelId(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button onClick={handleCancel} className="bg-red-500 text-white px-4 py-2 rounded">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payments;