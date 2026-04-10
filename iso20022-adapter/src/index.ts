import express from 'express';
import { config } from './config';
import { logger } from './logger';
import { processPaymentInitiation } from './handlers/payment-initiation';
import { processPaymentStatus } from './handlers/payment-status';
import { generatePaymentStatusReport } from './handlers/payment-status-report';

const app = express();

app.use(express.text({ type: 'application/xml' }));
app.use(express.json());

// ISO 20022 pain.001 - Payment Initiation
app.post('/iso20022/pain.001', async (req, res) => {
  try {
    const result = await processPaymentInitiation(req.body);
    res.set('Content-Type', 'application/xml');
    res.send(result);
  } catch (error) {
    logger.error('Payment initiation failed', { error });
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// ISO 20022 pain.002 - Payment Status Report
app.post('/iso20022/pain.002', async (req, res) => {
  try {
    const result = await processPaymentStatus(req.body);
    res.set('Content-Type', 'application/xml');
    res.send(result);
  } catch (error) {
    logger.error('Payment status query failed', { error });
    res.status(500).json({ error: 'Status query failed' });
  }
});

// Get payment status by transaction ID
app.get('/payments/:txId/status', async (req, res) => {
  try {
    const txId = req.params.txId;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(txId)) {
      res.status(400).json({ error: 'Invalid transaction ID format' });
      return;
    }

    const statusReport = await generatePaymentStatusReport(txId);
    res.set('Content-Type', 'application/xml');
    res.send(statusReport);
  } catch (error) {
    logger.error('Status report generation failed', { error });
    res.status(500).json({ error: 'Status report failed' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'iso20022-adapter' });
});

app.listen(config.port, () => {
  logger.info(`ISO 20022 Adapter started on port ${config.port}`);
});
