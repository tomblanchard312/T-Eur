import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const API_KEY = import.meta.env.VITE_API_KEY || 'demo-ecb-key';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-API-Key': API_KEY,
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || error.message;
    return Promise.reject(new Error(message));
  }
);

// API Methods
export const teurApi = {
  // System
  getSystemStatus: () => api.get('/admin/system/status').then(r => r.data.data),
  pauseSystem: () => api.post('/admin/system/pause').then(r => r.data.data),
  unpauseSystem: () => api.post('/admin/system/unpause').then(r => r.data.data),
  
  // Wallets
  getWallet: (address: string) => api.get(`/wallets/${address}`).then(r => r.data.data),
  registerWallet: (data: any) => api.post('/wallets', data).then(r => r.data.data),
  deactivateWallet: (data: any) => api.post(`/wallets/${data.wallet}/deactivate`, data).then(r => r.data.data),
  
  // Transfers
  getTotalSupply: () => api.get('/transfers/total-supply').then(r => r.data.data),
  mint: (data: any) => api.post('/transfers/mint', data).then(r => r.data.data),
  burn: (data: any) => api.post('/transfers/burn', data).then(r => r.data.data),
  transfer: (data: any) => api.post('/transfers', data).then(r => r.data.data),
  executeWaterfall: (wallet: string) => api.post('/transfers/waterfall', { wallet }).then(r => r.data.data),
  
  // Payments
  getPayment: (paymentId: string) => api.get(`/payments/${paymentId}`).then(r => r.data.data),
  createPayment: (data: any) => api.post('/payments', data).then(r => r.data.data),
  releasePayment: (data: any) => api.post(`/payments/${data.paymentId}/release`, data).then(r => r.data.data),
  cancelPayment: (paymentId: string) => api.post(`/payments/${paymentId}/cancel`).then(r => r.data.data),
  
  // Roles
  getAvailableRoles: () => api.get('/admin/roles/available').then(r => r.data.data.roles),
  checkRole: (role: string, account: string) => api.get('/admin/roles/check', { params: { role, account } }).then(r => r.data.data),
  grantRole: (data: { role: string; account: string }) => api.post('/admin/roles/grant', data).then(r => r.data.data),
  revokeRole: (data: { role: string; account: string }) => api.post('/admin/roles/revoke', data).then(r => r.data.data),
};
