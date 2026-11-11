import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Mail, Info } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password"
      description="Password recovery status"
    >
      <div className="space-y-4 text-sm text-text">
        <div className="p-3.5 bg-primary-soft/40 border border-primary/20 rounded-button flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-text text-xs sm:text-sm">
              Email verification & reset is coming soon
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              Automated password recovery via email is planned for our next infrastructure release.
              For this preview release, your account credentials are kept secure with Argon2id-grade
              hashing.
            </p>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          If you have forgotten your password during evaluation, you can create a new account or
          continue using FocusForge in guest/offline mode with full feature parity.
        </p>

        <div className="pt-2 flex justify-end">
          <Button onClick={onClose} className="gap-2">
            <Mail className="w-4 h-4" />
            <span>Understood</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
