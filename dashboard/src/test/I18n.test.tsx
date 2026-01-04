import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MainLayout } from '../layouts/MainLayout';
import { BrowserRouter } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
};

describe('Internationalization', () => {
  it('renders in English by default', () => {
    renderWithProviders(<MainLayout><div>Test</div></MainLayout>);
    // Check for a known English string from the sidebar
    // Since we mocked i18n in setup.ts, we might need to provide real translations or check keys
    expect(screen.getByText(/EN/i)).toBeInTheDocument();
  });

  it('switches language correctly', async () => {
    renderWithProviders(<MainLayout><div>Test</div></MainLayout>);
    
    const langButton = screen.getByText(/EN/i);
    fireEvent.click(langButton);
    
    // Should switch to FR (based on our toggleLanguage logic)
    expect(screen.getByText(/FR/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText(/FR/i));
    expect(screen.getByText(/DE/i)).toBeInTheDocument();
  });

  it('does not have missing translation keys in critical views', () => {
    // This is a bit harder to test without the full i18n setup
    // But we can check if any text starts with 'nav.' or 'common.' which usually indicates a missing key
    renderWithProviders(<MainLayout><div>Test</div></MainLayout>);
    const allText = document.body.textContent;
    expect(allText).not.toContain('nav.');
    expect(allText).not.toContain('common.');
  });
});
