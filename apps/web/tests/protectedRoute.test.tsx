import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import { useAuthStore } from '../src/stores/useAuthStore';

describe('ProtectedRoute Route Guard', () => {
  it('renders full-page loading indicator while checking session', () => {
    useAuthStore.setState({
      status: 'loading',
      hasCheckedSession: false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Secret Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/loading focusforge/i)).toBeInTheDocument();
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is unauthenticated', () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      hasCheckedSession: true,
    });

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/tasks" element={<div>Private Tasks</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
    expect(screen.queryByText('Private Tasks')).not.toBeInTheDocument();
  });

  it('renders protected child component when in guest mode or authenticated', () => {
    useAuthStore.setState({
      status: 'guest',
      hasCheckedSession: true,
    });

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/tasks" element={<div>Guest Tasks Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Guest Tasks Content')).toBeInTheDocument();
  });
});
