import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-4 text-2xl font-bold">
        404
      </div>
      <h1 className="text-xl font-bold text-text mb-2">Page Not Found</h1>
      <p className="text-sm text-text-muted max-w-sm mb-6">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link to="/">
        <Button className="gap-2">
          <Home className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Button>
      </Link>
    </div>
  );
}
