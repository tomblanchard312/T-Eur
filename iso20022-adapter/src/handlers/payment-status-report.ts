import { XMLBuilder } from 'fast-xml-parser';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../logger';

const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/**
 * Generate ISO 20022 camt.053.001.02 - Bank to Customer Statement
 * Converts tEUR transaction to ISO 20022 format
 */
export async function generatePaymentStatusReport(txId: string, txData?: any): Promise<string> {
  try {
    // If transaction data not provided, fetch it
    if (!txData) {
      const response = await axios.get(
        `${config.teurApiUrl}/transfers/${txId}`,
        {
          headers: {
            'X-API-Key': config.teurApiKey,
          },
        }
      );
      txData = response.data.data;
    }
    
    const statement = {
      Document: {
        '@_xmlns': 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.02',
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        BkToCstmrStmt: {
          GrpHdr: {
            MsgId: uuidv4(),
            CreDtTm: new Date().toISOString(),
            MsgRcpt: {
              Nm: config.institutionName,
              Id: {
                OrgId: {
                  BICOrBEI: config.bicCode,
                },
              },
            },
          },
          Stmt: {
            Id: txId,
            CreDtTm: txData.timestamp || new Date().toISOString(),
            Acct: {
              Id: {
                Othr: {
                  Id: txData.from,
                  Issr: 'tEUR',
                },
              },
              Ccy: 'EUR',
            },
            Bal: [
              {
                Tp: {
                  CdOrPrtry: {
                    Cd: 'OPBD', // Opening booked
                  },
                },
                Amt: {
                  '@_Ccy': 'EUR',
                  '#text': (txData.fromBalanceBefore / 100).toFixed(2),
                },
                CdtDbtInd: 'CRDT',
                Dt: {
                  Dt: new Date(txData.timestamp).toISOString().split('T')[0],
                },
              },
              {
                Tp: {
                  CdOrPrtry: {
                    Cd: 'CLBD', // Closing booked
                  },
                },
                Amt: {
                  '@_Ccy': 'EUR',
                  '#text': (txData.fromBalanceAfter / 100).toFixed(2),
                },
                CdtDbtInd: 'CRDT',
                Dt: {
                  Dt: new Date(txData.timestamp).toISOString().split('T')[0],
                },
              },
            ],
            Ntry: {
              Amt: {
                '@_Ccy': 'EUR',
                '#text': (txData.amount / 100).toFixed(2),
              },
              CdtDbtInd: 'DBIT', // Debit from sender's perspective
              Sts: 'BOOK', // Booked
              BookgDt: {
                Dt: new Date(txData.timestamp).toISOString().split('T')[0],
              },
              ValDt: {
                Dt: new Date(txData.timestamp).toISOString().split('T')[0],
              },
              BkTxCd: {
                Domn: {
                  Cd: 'PMNT',
                  Fmly: {
                    Cd: 'ICDT',
                    SubFmlyCd: 'ESCT', // SEPA Credit Transfer
                  },
                },
              },
              NtryDtls: {
                TxDtls: {
                  Refs: {
                    EndToEndId: txId,
                    TxId: txData.txHash,
                  },
                  AmtDtls: {
                    TxAmt: {
                      Amt: {
                        '@_Ccy': 'EUR',
                        '#text': (txData.amount / 100).toFixed(2),
                      },
                    },
                  },
                  RltdPties: {
                    Dbtr: {
                      Nm: 'tEUR Wallet',
                      Id: {
                        OrgId: {
                          Othr: {
                            Id: txData.from,
                          },
                        },
                      },
                    },
                    Cdtr: {
                      Nm: 'tEUR Wallet',
                      Id: {
                        OrgId: {
                          Othr: {
                            Id: txData.to,
                          },
                        },
                      },
                    },
                  },
                  RmtInf: {
                    Ustrd: `tEUR Digital Euro Transfer - TxHash: ${txData.txHash}`,
                  },
                },
              },
            },
          },
        },
      },
    };
    
    logger.info('Generated ISO 20022 statement', { txId, txHash: txData.txHash });
    return builder.build(statement);
  } catch (error: any) {
    logger.error('Failed to generate payment status report', { txId, error: error.message });
    throw error;
  }
}
