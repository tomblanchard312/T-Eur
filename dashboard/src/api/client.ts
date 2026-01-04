import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('teur_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('teur_admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: any;
  correlationId: string;
}

export interface SystemStatus {
  health: 'OK' | 'DEGRADED' | 'CRITICAL';
  network: 'ACTIVE' | 'INACTIVE';
  mintingEnabled: boolean;
  reserveBalance: string;
  escrowBalance: string;
}

export interface KeyInfo {
  keyId: string;
  role: string;
  status: 'ACTIVE' | 'REVOKED';
  lastRotated: string;
}
