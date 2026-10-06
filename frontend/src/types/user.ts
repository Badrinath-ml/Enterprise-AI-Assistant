import { UserRole } from './auth';

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  departmentId?: string | null;
  role: UserRole;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  active: boolean;
  createdAt?: string;
}
