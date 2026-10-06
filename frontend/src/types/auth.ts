export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string | null;
}

export interface LoginRequest {
  tenantSlug: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
}

export interface RegisterRequest {
  tenantName: string;
  tenantSlug: string;
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
}

export interface DecodedJwtPayload {
  sub: string;
  tenant_id?: string;
  role?: string;
  department_id?: string;
  exp?: number;
  iat?: number;
}
