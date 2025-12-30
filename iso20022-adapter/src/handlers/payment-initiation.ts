import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../logger';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/**
 * Process ISO 20022 pain.001.001.03 - Customer Credit Transfer Initiation
 * Maps SEPA Credit Transfer to tEUR transfer
 */
export async function processPaymentInitiation(xml: string): Promise<string> {
  try {
    const parsed = parser.parse(xml);
    const document = parsed.Document;
    const cstmrCdtTrfInitn = document.CstmrCdtTrfInitn;
    const pmtInf = cstmrCdtTrfInitn.PmtInf;
    
    // Extract payment information
    const msgId = cstmrCdtTrfInitn.GrpHdr.MsgId;
    const creationDateTime = cstmrCdtTrfInitn.GrpHdr.CreDtTm;
    const debtorAccount = pmtInf.DbtrAcct.Id.IBAN;
    
    // Process each credit transfer transaction
    const cdtTrfTxInfs = Array.isArray(pmtInf.CdtTrfTxInf) 
      ? pmtInf.CdtTrfTxInf 
      : [pmtInf.CdtTrfTxInf];
    
    const results = [];
    
    for (const txInf of cdtTrfTxInfs) {
      const creditorAccount = txInf.CdtrAcct.Id.IBAN;
      const amountCents = Math.round(parseFloat(txInf.Amt.InstdAmt['#text']) * 100);
      const endToEndId = txInf.PmtId.EndToEndId;
      
      // Map IBAN to tEUR wallet address (in production, use a registry)
      const fromAddress = ibanToAddress(debtorAccount);
      const toAddress = ibanToAddress(creditorAccount);
      
      try {
        // Execute tEUR transfer
        const response = await axios.post(
          `${config.teurApiUrl}/transfers`,
          {
            from: fromAddress,
            to: toAddress,
            amount: amountCents,
            idempotencyKey: endToEndId, // Use end-to-end ID as idempotency key
          },
          {
            headers: {
              'X-API-Key': config.teurApiKey,
            },
          }
        );
        
        results.push({
          endToEndId,
          status: 'ACCP', // Accepted
          txHash: response.data.data.txHash,
        });
        
        logger.info('ISO 20022 payment processed', {
          msgId,
          endToEndId,
          amount: amountCents,
          txHash: response.data.data.txHash,
        });
      } catch (error: any) {
        results.push({
          endToEndId,
          status: 'RJCT', // Rejected
          reason: error.message,
        });
        
        logger.error('ISO 20022 payment failed', {
          msgId,
          endToEndId,
          error: error.message,
        });
      }
    }
    
    // Generate pain.002 status response
    return generateStatusResponse(msgId, creationDateTime, results);
  } catch (error) {
    logger.error('Failed to parse ISO 20022 message', { error });
    throw error;
  }
}

/**
 * Generate ISO 20022 pain.002.001.03 - Payment Status Report
 */
function generateStatusResponse(
  originalMsgId: string,
  originalCreDtTm: string,
  transactions: Array<{ endToEndId: string; status: string; txHash?: string; reason?: string }>
): string {
  const statusReport = {
    Document: {
      '@_xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.002.001.03',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      CstmrPmtStsRpt: {
        GrpHdr: {
          MsgId: uuidv4(),
          CreDtTm: new Date().toISOString(),
        },
        OrgnlGrpInfAndSts: {
          OrgnlMsgId: originalMsgId,
          OrgnlMsgNmId: 'pain.001.001.03',
          OrgnlCreDtTm: originalCreDtTm,
          GrpSts: transactions.every(t => t.status === 'ACCP') ? 'ACCP' : 'PART',
        },
        OrgnlPmtInfAndSts: {
          TxInfAndSts: transactions.map(tx => ({
            OrgnlEndToEndId: tx.endToEndId,
            TxSts: tx.status,
            StsRsnInf: tx.reason ? {
              Rsn: {
                Cd: 'AC01', // IncorrectAccountNumber (generic error code)
              },
              AddtlInf: tx.reason,
            } : undefined,
            OrgnlTxRef: tx.txHash ? {
              PmtTpInf: {
                InstrPrty: 'NORM',
              },
              RmtInf: {
                Ustrd: `tEUR TxHash: ${tx.txHash}`,
              },
            } : undefined,
          })),
        },
      },
    },
  };
  
  return builder.build(statusReport);
}

/**
 * Map IBAN to tEUR wallet address
 * In production, this would query a registry or database
 */
function ibanToAddress(iban: string): string {
  // Simplified mapping - in production, use proper registry
  // For demo, hash IBAN to generate consistent address
  const hash = iban.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  return '0x' + Math.abs(hash).toString(16).padStart(40, '0');
}
