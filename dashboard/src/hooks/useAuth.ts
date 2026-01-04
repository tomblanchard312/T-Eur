import { useState, useEffect } from 'react';

export type Role = 'ECB_OPERATOR' | 'AUDITOR' | 'PARTICIPANT' | 'NONE';

interface User {
  id: string;
  role: Role;
  name: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching user from token
    const token = localStorage.getItem('teur_admin_token');
    if (token) {
      // In a real app, decode JWT or call /me endpoint
      // For now, we mock based on token content for testing
      if (token === 'mock-ecb-token') {
        setUser({ id: '1', role: 'ECB_OPERATOR', name: 'ECB Op' });
      } else if (token === 'mock-auditor-token') {
        setUser({ id: '2', role: 'AUDITOR', name: 'Auditor' });
      } else {
        setUser({ id: '3', role: 'PARTICIPANT', name: 'Participant' });
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  const hasRole = (roles: Role[]) => {
    return user && roles.includes(user.role);
  };

  return { user, loading, hasRole };
};
