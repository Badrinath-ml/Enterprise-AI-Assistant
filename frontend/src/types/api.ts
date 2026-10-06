export interface ApiError {
  timestamp?: string;
  status?: number;
  error?: string;
  message: string;
  path?: string;
  validationErrors?: Record<string, string>;
}

export interface HealthResponse {
  status: string;
  components?: Record<string, { status: string; details?: Record<string, unknown> }>;
}
