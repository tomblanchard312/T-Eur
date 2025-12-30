import { XMLParser } from 'fast-xml-parser';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/**
 * Process ISO 20022 pain.002 - Payment Status Inquiry
 */
export async function processPaymentStatus(xml: string): Promise<string> {
  try {
    const parsed = parser.parse(xml);
    // Extract transaction ID from status inquiry
    const txId = parsed.Document.CstmrPmtStsRpt.OrgnlPmtInfAndSts.TxInfAndSts.OrgnlEndToEndId;
    
    // Query tEUR API for transaction status
    const response = await axios.get(
      `${config.teurApiUrl}/transfers/${txId}`,
      {
        headers: {
          'X-API-Key': config.teurApiKey,
        },
      }
    );
    
    // Generate status response
    return generatePaymentStatusReport(txId, response.data.data);
  } catch (error: any) {
    logger.error('Payment status query failed', { error: error.message });
    throw error;
  }
}
