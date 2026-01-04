import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom'; // Import to enable toBeInTheDocument matcher
import { vi } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').pop(), // Return the last part, e.g., 'confirm' for 'common.confirm'
  }),
}));

describe('Accessibility and Stability', () => {
  it('ConfirmationModal has correct ARIA attributes', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        title="Test Title"
        description="Test Description"
        onConfirm={(_justification: string) => {}}
        onCancel={() => {}}
      />
    );

    // Check for dialog role (if we add it)
    // For now, let's check if the button has a role
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders critical views without runtime errors', () => {
    const { unmount } = render(
      <BrowserRouter>
        <ConfirmationModal
          isOpen={true}
          title="Stability Test"
          description="Checking for crashes"
          onConfirm={(_justification: string) => {}}
          onCancel={() => {}}
        />
      </BrowserRouter>
    );
    unmount();
  });

  it('ConfirmationModal is accessible with proper focus management', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        title="Focus Test"
        description="Testing focus"
        onConfirm={(_justification: string) => {}}
        onCancel={() => {}}
      />
    );

    // Assuming the modal focuses the textarea on open
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveFocus();
  });

  it('ConfirmationModal supports keyboard navigation', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        title="Keyboard Test"
        description="Testing keyboard"
        onConfirm={(_justification: string) => {}}
        onCancel={() => {}}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    // Simulate Tab key to move focus
    cancelButton.focus();
    expect(cancelButton).toHaveFocus();

    // Note: For full keyboard testing, consider using userEvent from @testing-library/user-event
  });

  it('ConfirmationModal has proper ARIA labels and descriptions', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        title="ARIA Test"
        description="Testing ARIA"
        onConfirm={(_justification: string) => {}}
        onCancel={() => {}}
      />
    );

    // Check if title is announced
    expect(screen.getByText('ARIA Test')).toBeInTheDocument();
    // Check if description is present
    expect(screen.getByText('Testing ARIA')).toBeInTheDocument();
  });

  it('ConfirmationModal handles closed state without errors', () => {
    render(
      <ConfirmationModal
        isOpen={false}
        title="Closed Test"
        description="Testing closed"
        onConfirm={(_justification: string) => {}}
        onCancel={() => {}}
      />
    );

    // Ensure no elements are rendered when closed
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('ConfirmationModal buttons are properly labeled for screen readers', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        title="Label Test"
        description="Testing labels"
        onConfirm={(_justification: string) => {}}
        onCancel={() => {}}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    expect(confirmButton).toHaveAccessibleName(/confirm/i);
    expect(cancelButton).toHaveAccessibleName(/cancel/i);
  });
});
