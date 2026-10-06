import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { UsersPage } from '../pages/users/UsersPage';
import { DepartmentsPage } from '../pages/departments/DepartmentsPage';
import { DocumentsPage } from '../pages/documents/DocumentsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { NotFoundPage } from '../pages/error/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { PublicRoute } from './PublicRoute';

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route element={<PublicRoute><AuthLayout /></PublicRoute>}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/users" element={<RoleRoute allowedRoles={['ADMIN']}><UsersPage /></RoleRoute>} />
      <Route path="/team" element={<RoleRoute allowedRoles={['MANAGER']}><UsersPage /></RoleRoute>} />
      <Route path="/departments" element={<RoleRoute allowedRoles={['ADMIN']}><DepartmentsPage /></RoleRoute>} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
