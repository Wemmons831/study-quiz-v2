// src/services/api.js

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Token management
const TOKEN_KEY = 'studyquiz_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
  exists: () => !!localStorage.getItem(TOKEN_KEY)
};

// Custom error class for API errors
export class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

// Main API call function
export const apiCall = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {},
    skipAuth = false,
    skipContentType = false,
    timeout = 30000
  } = options;

  // Build the full URL
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  // Build headers
  const requestHeaders = { ...headers };

  // Add authentication token if available and not skipped
  if (!skipAuth && tokenStorage.exists()) {
    requestHeaders.Authorization = `Bearer ${tokenStorage.get()}`;
  }

  // Add content type for JSON requests
  if (!skipContentType && body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // Build request configuration
  const config = {
    method: method.toUpperCase(),
    headers: requestHeaders,
    credentials: 'include' // Include cookies for session management
  };

  // Add body if provided
  if (body) {
    if (body instanceof FormData) {
      config.body = body;
    } else if (typeof body === 'object') {
      config.body = JSON.stringify(body);
    } else {
      config.body = body;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  config.signal = controller.signal;

  // Set timeout
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    // Handle different response types
    if (response.status === 204) {
      // No content response
      return null;
    }

    let responseData;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage = responseData?.error || responseData?.message || response.statusText || 'Request failed';
      const errorDetails = responseData?.details || null;
      
      // Handle authentication errors
      if (response.status === 401) {
        tokenStorage.remove();
        // Optionally redirect to login or emit an event
        window.dispatchEvent(new CustomEvent('auth-error', { detail: 'Token expired or invalid' }));
      }
      
      throw new APIError(errorMessage, response.status, errorDetails);
    }

    return responseData;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new APIError('Request timeout', 408);
    }
    
    if (error instanceof APIError) {
      throw error;
    }
    
    // Network or other errors
    throw new APIError(error.message || 'Network error occurred', 0);
  }
};

// Authentication API methods
export const auth = {
  login: async (email, password) => {
    const response = await apiCall('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true
    });
    
    if (response.token) {
      tokenStorage.set(response.token);
    }
    
    return response;
  },

  register: async (userData) => {
    const response = await apiCall('/auth/register', {
      method: 'POST',
      body: userData,
      skipAuth: true
    });
    
    if (response.token) {
      tokenStorage.set(response.token);
    }
    
    return response;
  },

  logout: async () => {
    try {
      await apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      tokenStorage.remove();
    }
  },

  getProfile: () => apiCall('/auth/me'),

  refreshToken: async () => {
    const response = await apiCall('/auth/refresh', { method: 'POST' });
    if (response.token) {
      tokenStorage.set(response.token);
    }
    return response;
  }
};

// User API methods
export const users = {
  getProfile: () => apiCall('/users/profile'),
  
  updateProfile: (data) => apiCall('/users/profile', {
    method: 'PUT',
    body: data
  }),
  
  changePassword: (currentPassword, newPassword) => apiCall('/users/password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword }
  }),
  
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    return apiCall('/users/profile-picture', {
      method: 'POST',
      body: formData,
      skipContentType: true
    });
  },
  
  getStats: () => apiCall('/users/stats'),
  
  getUserById: (id) => apiCall(`/users/${id}`)
};

// Study Sets API methods
export const studySets = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/studysets${queryString ? `?${queryString}` : ''}`);
  },
  
  getMy: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/studysets/my${queryString ? `?${queryString}` : ''}`);
  },
  
  getById: (id) => apiCall(`/studysets/${id}`),
  
  create: (data) => apiCall('/studysets', {
    method: 'POST',
    body: data
  }),
  
  update: (id, data) => apiCall(`/studysets/${id}`, {
    method: 'PUT',
    body: data
  }),
  
  delete: (id) => apiCall(`/studysets/${id}`, {
    method: 'DELETE'
  }),
  
  fork: (id) => apiCall(`/studysets/${id}/fork`, {
    method: 'POST'
  }),
  
  importCSV: (file) => {
    const formData = new FormData();
    formData.append('csvFile', file);
    return apiCall('/studysets/import-csv', {
      method: 'POST',
      body: formData,
      skipContentType: true
    });
  }
};

// Discovery API methods
export const discover = {
  getPopular: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/discover/popular${queryString ? `?${queryString}` : ''}`);
  },
  
  getRecent: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/discover/recent${queryString ? `?${queryString}` : ''}`);
  },
  
  search: (query, params = {}) => {
    const allParams = { q: query, ...params };
    const queryString = new URLSearchParams(allParams).toString();
    return apiCall(`/discover/search?${queryString}`);
  },
  
  getByTag: (tag, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/discover/tag/${encodeURIComponent(tag)}${queryString ? `?${queryString}` : ''}`);
  },
  
  getTags: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/discover/tags${queryString ? `?${queryString}` : ''}`);
  },
  
  getStats: () => apiCall('/discover/stats')
};

// Leaderboards API methods
export const leaderboards = {
  getQuestions: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/leaderboards/questions${queryString ? `?${queryString}` : ''}`);
  },
  
  getTime: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/leaderboards/time${queryString ? `?${queryString}` : ''}`);
  },
  
  getUserRank: () => apiCall('/leaderboards/me'),
  
  triggerReset: () => apiCall('/leaderboards/reset', {
    method: 'POST'
  })
};

// Progress tracking API methods
export const progress = {
  updateProgress: (questionId, data) => apiCall(`/progress/${questionId}`, {
    method: 'PUT',
    body: data
  }),
  
  getProgress: (studySetId) => apiCall(`/progress/studyset/${studySetId}`),
  
  startSession: (studySetId) => apiCall('/progress/session/start', {
    method: 'POST',
    body: { studySetId }
  }),
  
  endSession: (sessionId) => apiCall(`/progress/session/${sessionId}/end`, {
    method: 'PUT'
  })
};

// Utility functions
export const utils = {
  // Check if user is authenticated
  isAuthenticated: () => tokenStorage.exists(),
  
  // Get current user token
  getToken: () => tokenStorage.get(),
  
  // Set token manually
  setToken: (token) => tokenStorage.set(token),
  
  // Clear authentication
  clearAuth: () => tokenStorage.remove(),
  
  // Format API errors for display
  formatError: (error) => {
    if (error instanceof APIError) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },
  
  // Health check
  healthCheck: () => apiCall('/health', { skipAuth: true })
};

// Default export for backward compatibility
export default apiCall;