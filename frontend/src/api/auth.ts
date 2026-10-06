import { apiClient } from './client';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../types/auth';

export const authApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', payload);
    return response.data;
  },

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/api/v1/auth/register', payload);
    return response.data;
  },
};
