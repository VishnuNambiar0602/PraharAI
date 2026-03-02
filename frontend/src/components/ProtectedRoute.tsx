import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './common/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  if (isLoading) {
    console.log('ProtectedRoute - showing loading spinner');
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute - not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute - authenticated, rendering children');
  return <>{children}</>;
}
