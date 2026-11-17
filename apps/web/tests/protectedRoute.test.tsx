import { describe, it, expect } from 'vitest';
import { lazy } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import { AuthLayout } from '../src/components/auth/AuthLayout';
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

  it('handles unauthenticated redirect safely with v7_startTransition enabled', () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      hasCheckedSession: true,
    });

    render(
      <MemoryRouter initialEntries={['/tasks']} future={{ v7_startTransition: true }}>
        <Routes>
          <Route path="/login" element={<div>Safe Login Destination</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/tasks" element={<div>Private Tasks</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Safe Login Destination')).toBeInTheDocument();
    expect(screen.queryByText('Private Tasks')).not.toBeInTheDocument();
  });

  it('renders AuthLayout with suspense fallback when child page suspends', () => {
    // Component that suspends indefinitely
    const SuspendingComponent = lazy(
      () => new Promise<{ default: React.ComponentType }>(() => {})
    );

    render(
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true }}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<SuspendingComponent />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: /loading authentication form/i })).toBeInTheDocument();
  });
});
