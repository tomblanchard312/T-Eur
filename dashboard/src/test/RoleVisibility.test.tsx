import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MainLayout } from '../layouts/MainLayout';
import { BrowserRouter } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
};

describe('Role Visibility Enforcement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows all ECB actions for ECB_OPERATOR role', () => {
    localStorage.setItem('teur_admin_token', 'mock-ecb-token');
    renderWithProviders(<MainLayout><div>Test</div></MainLayout>);
    
    expect(screen.getByText(/Monetary/i)).toBeInTheDocument();
    expect(screen.getByText(/Sanctions/i)).toBeInTheDocument();
    expect(screen.getByText(/Escrow/i)).toBeInTheDocument();
    expect(screen.getByText(/Security/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit/i)).toBeInTheDocument();
  });

  it('hides ECB-only actions for AUDITOR role', () => {
    localStorage.setItem('teur_admin_token', 'mock-auditor-token');
    renderWithProviders(<MainLayout><div>Test</div></MainLayout>);
    
    expect(screen.queryByText(/Monetary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sanctions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Escrow/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Security/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Audit/i)).toBeInTheDocument();
  });

  it('hides all sensitive actions for non-privileged roles', () => {
    localStorage.setItem('teur_admin_token', 'mock-participant-token');
    renderWithProviders(<MainLayout><div>Test</div></MainLayout>);
    
    expect(screen.queryByText(/Monetary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sanctions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Audit/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
  });
});
