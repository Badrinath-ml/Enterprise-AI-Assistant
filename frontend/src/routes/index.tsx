import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { UsersPage } from '../pages/users/UsersPage';
import { DepartmentsPage } from '../pages/departments/DepartmentsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { NotFoundPage } from '../pages/error/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { PublicRoute } from './PublicRoute';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Authenticated Application Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* ADMIN only: User management */}
        <Route
          path="/users"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <UsersPage />
            </RoleRoute>
          }
        />

        {/* ADMIN and MANAGER: Departments */}
        <Route
          path="/departments"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'MANAGER']}>
              <DepartmentsPage />
            </RoleRoute>
          }
        />

        {/* All authenticated roles: Profile */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
