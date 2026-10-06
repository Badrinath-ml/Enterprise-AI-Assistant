import { apiClient } from './client';
import { CreateUserRequest, UserResponse } from '../types/user';

export const userApi = {
  async createUser(payload: CreateUserRequest): Promise<UserResponse> {
    const response = await apiClient.post<UserResponse>('/api/v1/users', payload);
    return response.data;
  },

  async getUsers(): Promise<UserResponse[]> {
    // Backend Level 1 does not yet expose GET /api/v1/users;
    // Calling this will return 404/405 until backend implements it.
    const response = await apiClient.get<UserResponse[]>('/api/v1/users');
    return response.data;
  },
};
