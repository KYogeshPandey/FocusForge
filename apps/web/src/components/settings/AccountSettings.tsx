import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  type ChangePasswordInput,
  type DeleteAccountInput,
} from '@focusforge/shared';
import { useAuthStore } from '../../stores/useAuthStore';
import { useToastStore } from '../../stores/useToastStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import {
  KeyRound,
  LogOut,
  Trash2,
  AlertTriangle,
  Lock,
  LogIn,
} from 'lucide-react';
import { ApiError } from '../../services/api/apiError';

export function AccountSettings() {
  const navigate = useNavigate();
  const { user, status, logout, changePassword, deleteAccount } = useAuthStore();
  const { addToast } = useToastStore();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAuthenticated = status === 'authenticated' && user !== null;

  // Change password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordInputSchema),
  });

  // Delete account form
  const {
    register: registerDelete,
    handleSubmit: handleDeleteSubmit,
    reset: resetDeleteForm,
    formState: { errors: deleteErrors, isSubmitting: isSubmittingDelete },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(DeleteAccountInputSchema),
  });

  const onChangePassword = async (data: ChangePasswordInput) => {
    setPasswordError(null);
    try {
      await changePassword(data);
      resetPasswordForm();
      setShowPasswordModal(false);
      addToast({
        type: 'success',
        title: 'Password updated',
        message: 'Your account password has been changed successfully.',
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Failed to change password. Please verify current password.');
      }
    }
  };

  const onDeleteAccount = async (data: DeleteAccountInput) => {
    setDeleteError(null);
    try {
      await deleteAccount(data);
      resetDeleteForm();
      setShowDeleteModal(false);
      addToast({
        type: 'success',
        title: 'Account deleted',
        message: 'Your account and all associated records have been removed.',
      });
      navigate('/login');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete account. Please verify your password.');
      }
    }
  };

  const handleSignOut = async () => {
    await logout();
    addToast({
      type: 'info',
      title: 'Signed out',
      message: 'You have been signed out.',
    });
    navigate('/login');
  };

  if (!isAuthenticated) {
    return (
      <Card className="border-border">
        <CardHeader>
          <div>
            <CardTitle>Account & Synchronization</CardTitle>
            <CardDescription>
              Sync your study habits, tasks, and timer statistics across devices.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text">Currently in Guest Mode</p>
            <p className="text-xs text-text-muted">
              Data is saved in this browser&apos;s local storage. Create an account to back up and
              sync your progress.
            </p>
          </div>

          <NavLink to="/login">
            <Button type="button" className="gap-2 shrink-0">
              <LogIn className="w-4 h-4" />
              <span>Sign In / Register</span>
            </Button>
          </NavLink>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border">
        <CardHeader>
          <div>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Manage your personal credentials, security, and account status.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4 pt-2">
          {/* User Profile Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-surface-2 rounded-card gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-text">{user.name}</p>
                <p className="text-xs text-text-muted">{user.email}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 self-start sm:self-center"
            >
              <LogOut className="w-3.5 h-3.5 text-danger" />
              <span>Sign Out</span>
            </Button>
          </div>

          {/* Security & Danger Zone Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPasswordError(null);
                resetPasswordForm();
                setShowPasswordModal(true);
              }}
              className="gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Change Password</span>
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setDeleteError(null);
                resetDeleteForm();
                setShowDeleteModal(true);
              }}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
        description="Ensure your account is protected with a secure password."
      >
        <form onSubmit={handlePasswordSubmit(onChangePassword)} className="space-y-4 pt-1">
          {passwordError && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-button flex items-start gap-2.5 text-xs text-danger font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <Input
            id="current-password"
            label="Current Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={passwordErrors.currentPassword?.message}
            required
            {...registerPassword('currentPassword')}
          />

          <Input
            id="new-password"
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            hint="Must be at least 8 characters long"
            error={passwordErrors.newPassword?.message}
            required
            {...registerPassword('newPassword')}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
              disabled={isSubmittingPassword}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingPassword}
              disabled={isSubmittingPassword}
              className="gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Update Password</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
        description="Permanent and irreversible account removal"
      >
        <form onSubmit={handleDeleteSubmit(onDeleteAccount)} className="space-y-4 pt-1">
          <div className="p-3.5 bg-danger/10 border border-danger/30 rounded-card flex items-start gap-3 text-danger">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">Warning: This action cannot be undone.</p>
              <p className="leading-relaxed">
                All your study sessions, tasks, habits, streak statistics, and personal profile
                records will be permanently erased immediately from our database.
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-button flex items-start gap-2.5 text-xs text-danger font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <Input
            id="confirm-delete-password"
            label="Confirm Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your current password to confirm"
            hint="Type your password to verify ownership before deletion"
            error={deleteErrors.password?.message}
            required
            {...registerDelete('password')}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={isSubmittingDelete}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isSubmittingDelete}
              disabled={isSubmittingDelete}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Permanently Delete</span>
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
