/**
 * API Client
 * Base configuration for API requests
 */

export const apiClient = {
  get baseURL() {
    return import.meta.env.VITE_API_BASE_URL ?? '/api';
  },

  /**
   * Make an API request
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // Only set Content-Type to application/json if:
    // 1. No Content-Type header was provided by caller
    // 2. Body is not FormData (browser will set correct multipart boundary)
    const isFormData = options.body instanceof FormData;
    const hasContentType = options.headers && 'Content-Type' in options.headers;

    const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
    if (!isFormData && !hasContentType) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Request failed' }))) as { error?: string };
      throw new Error(error.error ?? `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  },

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'POST',
    };
    // If data is provided, stringify it. 
    // If data is strictly undefined, don't send body. 
    // Note: If the backend requires a JSON body but none is provided, 
    // the caller should pass {} explicitly, or we could default to {} if needed.
    // However, some POSTs might not require a body at all. 
    // The Fastify error "Body cannot be empty when content-type is set to 'application/json'"
    // implies we are sending the header but no body. 
    // Let's ensure if we send the header, we send at least '{}' if data is undefined.
    
    // BUT: changing this behavior globally might affect other endpoints.
    // The safer fix is to update call sites to pass {} when they mean "empty JSON object".
    
    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, requestOptions);
  },

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'PUT',
    };
    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, requestOptions);
  },

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'PATCH',
    };
    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, requestOptions);
  },

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
