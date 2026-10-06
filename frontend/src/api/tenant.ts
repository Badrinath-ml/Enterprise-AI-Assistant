import { apiClient } from './client';
import { TenantResponse } from '../types/tenant';

export const tenantApi = {
  async getCurrentTenant(): Promise<TenantResponse> {
    const response = await apiClient.get<TenantResponse>('/api/v1/tenant/me');
    return response.data;
  },
};
