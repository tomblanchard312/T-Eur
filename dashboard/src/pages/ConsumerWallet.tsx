import { useState } from 'react';
import { teurApi } from '../lib/api';

const ConsumerWallet = () => {
  const [amount, setAmount] = useState(0);
  const [payee, setPayee] = useState('');
  const [paymentId, setPaymentId] = useState('');

  const handleNFCPayment = async () => {
    // Simulate NFC payment initiation
    try {
      const payment = await teurApi.createPayment({
        payer: 'consumer-wallet-address', // In real app, get from wallet
        payee,
        amount,
        description: 'NFC Payment'
      });
      setPaymentId(payment.id);
      // In real NFC, this data would be sent via NFC
      alert(`Payment initiated. ID: ${payment.id}. Tap device to complete.`);
    } catch (error) {
      alert('Error initiating payment');
    }
  };

  const handleCompletePayment = async () => {
    // Simulate receiving payment completion from device
    try {
      await teurApi.releasePayment({ paymentId, secret: 'nfc-secret' });
      alert('Payment completed successfully');
    } catch (error) {
      alert('Error completing payment');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Consumer Wallet - NFC Payments</h1>

      <div className="bg-white p-4 rounded-lg shadow max-w-md">
        <h2 className="text-lg font-semibold mb-4">Make NFC Payment</h2>
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value))}
          className="w-full p-2 border rounded mb-2"
        />
        <input
          type="text"
          placeholder="Payee Address"
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          className="w-full p-2 border rounded mb-2"
        />
        <button onClick={handleNFCPayment} className="bg-blue-500 text-white px-4 py-2 rounded w-full mb-2">
          Initiate NFC Payment
        </button>
        {paymentId && (
          <div>
            <p className="mb-2">Payment ID: {paymentId}</p>
            <button onClick={handleCompletePayment} className="bg-green-500 text-white px-4 py-2 rounded w-full">
              Complete Payment (Simulate Device Tap)
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-4">NFC Integration Notes</h2>
        <p>In a real implementation:</p>
        <ul className="list-disc list-inside">
          <li>Use Web NFC API or native NFC libraries</li>
          <li>Send payment data via NFC to Clover device</li>
          <li>Clover processes the payment using the custom tender</li>
        </ul>
      </div>
    </div>
  );
};

export default ConsumerWallet;