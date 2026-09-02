import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/ui/LoadingState';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Intercept invited members who have not yet set their password.
  // IMPORTANT: Only check user_metadata here, NOT app_metadata.
  // supabase.auth.updateUser({ data: {...} }) from the client can only write
  // to user_metadata. app_metadata is immutable from the client SDK and can
  // only be changed via the server-side Admin API. After SetPasswordPage calls
  // updateUser({ data: { needs_password: false } }), user_metadata is cleared
  // but app_metadata retains the old value. Checking app_metadata here would
  // cause an infinite redirect loop back to /set-password.
  const needsPassword =
    user.user_metadata?.needs_password === true ||
    user.user_metadata?.is_invited === true;

  if (needsPassword && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />;
  }

  return <>{children}</>;
};
