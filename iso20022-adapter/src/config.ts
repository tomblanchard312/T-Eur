import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  teurApiUrl: process.env.TEUR_API_URL || 'http://localhost:3000/api/v1',
  teurApiKey: process.env.TEUR_API_KEY || 'demo-bank-key',
  bicCode: process.env.BIC_CODE || 'TEURDE00XXX',
  institutionId: process.env.INSTITUTION_ID || 'bank-de-01',
  institutionName: process.env.INSTITUTION_NAME || 'tEUR Test Bank',
  sepaCreditorId: process.env.SEPA_CREDITOR_ID || 'DE98ZZZ09999999999',
};
