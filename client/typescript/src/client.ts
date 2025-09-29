import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Event,
  WriteResult,
  QueryRequest,
  QueryResponse,
  ClientConfig,
  HealthStatus,
  Metrics,
  ActorDBError,
} from './types';

export class ActorDBClient {
  private http: AxiosInstance;

  constructor(config: ClientConfig) {
    this.http = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Set authorization token if provided
    if (config.token) {
      this.setToken(config.token);
    }

    // Add response interceptor for error handling
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new ActorDBError(
            error.response.data?.error || error.message,
            error.response.status,
            error.response.data
          );
        }
        throw new ActorDBError(error.message);
      }
    );
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.http.defaults.headers.common['Authorization'] = token;
  }

  /**
   * Remove authentication token
   */
  clearToken(): void {
    delete this.http.defaults.headers.common['Authorization'];
  }

  /**
   * Write an event to an actor's event stream
   */
  async writeEvent(event: Omit<Event, 'timestamp'>): Promise<WriteResult> {
    const response = await this.http.post<WriteResult>('/events', {
      ...event,
      timestamp: new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * Write multiple events in batch
   */
  async writeEventsBatch(events: Omit<Event, 'timestamp'>[]): Promise<WriteResult[]> {
    const eventsWithTimestamp = events.map(event => ({
      ...event,
      timestamp: new Date().toISOString(),
    }));

    const response = await this.http.post<WriteResult[]>('/events/batch', {
      events: eventsWithTimestamp,
    });
    return response.data;
  }

  /**
   * Read events for an aggregate
   */
  async readEvents(aggregateId: string, fromSequence: number = 1): Promise<Event[]> {
    const response = await this.http.get<Event[]>('/events', {
      params: {
        aggregate_id: aggregateId,
        from_sequence: fromSequence,
      },
    });
    return response.data;
  }

  /**
   * Execute a query
   */
  async query(request: QueryRequest): Promise<QueryResponse> {
    const response = await this.http.post<QueryResponse>('/query', request);
    return response.data;
  }

  /**
   * Execute a SQL query (convenience method)
   */
  async executeSQL(sql: string, parameters?: Record<string, any>): Promise<QueryResponse> {
    return this.query({ sql, parameters });
  }

  /**
   * Get health status of all services
   */
  async getHealth(): Promise<HealthStatus[]> {
    const response = await this.http.get<{ services: HealthStatus[] }>('/health');
    return response.data.services;
  }

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<Metrics> {
    const response = await this.http.get<Metrics>('/metrics');
    return response.data;
  }

  /**
   * Create a new actor aggregate
   */
  async createAggregate(aggregateId: string, aggregateType: string): Promise<void> {
    await this.http.post('/aggregates', {
      aggregate_id: aggregateId,
      aggregate_type: aggregateType,
    });
  }

  /**
   * Get aggregate state
   */
  async getAggregateState(aggregateId: string): Promise<any> {
    const response = await this.http.get(`/aggregates/${aggregateId}/state`);
    return response.data;
  }

  /**
   * Register a projection
   */
  async registerProjection(projection: any): Promise<void> {
    await this.http.post('/projections', projection);
  }

  /**
   * List projections
   */
  async listProjections(): Promise<string[]> {
    const response = await this.http.get<string[]>('/projections');
    return response.data;
  }

  /**
   * Get projection state
   */
  async getProjectionState(projectionName: string): Promise<any> {
    const response = await this.http.get(`/projections/${projectionName}/state`);
    return response.data;
  }

  /**
   * Validate token (security gateway)
   */
  async validateToken(token?: string): Promise<{ valid: boolean; context?: any }> {
    const headers = token ? { Authorization: token } : undefined;
    const response = await this.http.post('/security/validate', {}, { headers });
    return response.data;
  }

  /**
   * Raw HTTP request (for advanced usage)
   */
  async request<T = any>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    data?: any;
    params?: Record<string, any>;
    headers?: Record<string, string>;
  }): Promise<AxiosResponse<T>> {
    return this.http.request<T>(config);
  }
}

// Factory function for easy client creation
export function createClient(config: ClientConfig): ActorDBClient {
  return new ActorDBClient(config);
}

// Default client configuration
export const defaultConfig: Partial<ClientConfig> = {
  timeout: 30000,
  headers: {
    'User-Agent': 'ActorDB-Client/1.0.0',
  },
};
