import { apiClient } from './client';
import { CreateUserRequest, UserResponse } from '../types/user';

export const userApi = {
  async createUser(payload: CreateUserRequest): Promise<UserResponse> {
    const response = await apiClient.post<UserResponse>('/api/v1/users', payload);
    return response.data;
  },

  async getUsers(departmentId?: string): Promise<UserResponse[]> {
    const response = await apiClient.get<UserResponse[]>('/api/v1/users', {
      params: departmentId ? { departmentId } : undefined,
    });
    return response.data;
  },
};
