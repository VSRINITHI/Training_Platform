import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { LoadingState } from '../components/ui/LoadingState';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Verifying permissions..." />
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    // Redirect to default home for their role, or learner home
    if (role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (role === 'INSTRUCTOR') return <Navigate to="/instructor" replace />;
    return <Navigate to="/learner" replace />;
  }

  return <>{children}</>;
};
