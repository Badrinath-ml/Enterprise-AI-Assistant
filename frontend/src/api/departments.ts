import { apiClient } from './client';
import { CreateDepartmentRequest, DepartmentResponse } from '../types/department';

export const departmentApi = {
  async getDepartments(): Promise<DepartmentResponse[]> {
    const response = await apiClient.get<DepartmentResponse[]>('/api/v1/departments');
    return response.data;
  },

  async createDepartment(payload: CreateDepartmentRequest): Promise<DepartmentResponse> {
    const response = await apiClient.post<DepartmentResponse>('/api/v1/departments', payload);
    return response.data;
  },
};
