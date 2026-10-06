import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/auth';
import { AccessDeniedPage } from '../pages/error/AccessDeniedPage';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
};
