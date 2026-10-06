import { apiClient } from './client';
import { HealthResponse } from '../types/api';

export const systemApi = {
  async getHealth(): Promise<HealthResponse> {
    const response = await apiClient.get<HealthResponse>('/actuator/health');
    return response.data;
  },
};
