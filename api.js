/**
 * API Service Layer
 * Handles all communication with the backend API
 */
class ApiService {
    constructor(baseUrl = '/api/v1') {
        this.baseUrl = baseUrl;
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.onAuthChange = null; // Callback for auth state changes
    }

    // Token management
    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        if (this.onAuthChange) this.onAuthChange(null);
    }

    isAuthenticated() {
        return !!this.accessToken;
    }

    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
        if (this.onAuthChange) this.onAuthChange(user);
    }

    // HTTP request helper with auto-refresh
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const config = {
            method,
            headers,
            ...options
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            let response = await fetch(url, config);

            // If unauthorized, try to refresh token
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    headers['Authorization'] = `Bearer ${this.accessToken}`;
                    response = await fetch(url, { ...config, headers });
                } else {
                    this.clearTokens();
                    throw new Error('Session expired. Please login again.');
                }
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Request failed');
            }

            return result;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Network error. Please check your connection.');
            }
            throw error;
        }
    }

    // HTTP method shortcuts
    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    async post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }

    async patch(endpoint, data) {
        return this.request('PATCH', endpoint, data);
    }

    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }

    // Auth methods
    async register(email, password, name) {
        const result = await this.request('POST', '/auth/register', { email, password, name });
        if (result.success) {
            this.setTokens(result.data.accessToken, result.data.refreshToken);
            this.setUser(result.data.user);
        }
        return result;
    }

    async login(email, password) {
        const result = await this.request('POST', '/auth/login', { email, password });
        if (result.success) {
            this.setTokens(result.data.accessToken, result.data.refreshToken);
            this.setUser(result.data.user);
        }
        return result;
    }

    async logout() {
        try {
            await this.request('POST', '/auth/logout');
        } catch (e) {
            // Ignore errors - clear tokens anyway
        }
        this.clearTokens();
    }

    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (!response.ok) return false;

            const result = await response.json();
            if (result.success) {
                this.setTokens(result.data.accessToken, result.data.refreshToken);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    async getMe() {
        return this.get('/auth/me');
    }

    async updateMe(data) {
        return this.patch('/auth/me', data);
    }

    // Folder methods
    async getFolders() {
        return this.get('/folders');
    }

    async createFolder(folder) {
        return this.post('/folders', folder);
    }

    async updateFolder(id, data) {
        return this.patch(`/folders/${id}`, data);
    }

    async deleteFolder(id) {
        return this.delete(`/folders/${id}`);
    }

    // Set methods
    async getSets(folderId) {
        return this.get(`/folders/${folderId}/sets`);
    }

    async getSet(id) {
        return this.get(`/sets/${id}`);
    }

    async createSet(folderId, set) {
        return this.post(`/folders/${folderId}/sets`, set);
    }

    async updateSet(id, data) {
        return this.patch(`/sets/${id}`, data);
    }

    async deleteSet(id) {
        return this.delete(`/sets/${id}`);
    }

    // Card methods
    async getCards(setId, cursor = null, limit = 100) {
        let url = `/sets/${setId}/cards?limit=${limit}`;
        if (cursor) url += `&cursor=${cursor}`;
        return this.get(url);
    }

    async createCard(setId, card) {
        return this.post(`/sets/${setId}/cards`, card);
    }

    async bulkCreateCards(setId, cards) {
        return this.post(`/sets/${setId}/cards/bulk`, { cards });
    }

    async updateCard(id, data) {
        return this.patch(`/cards/${id}`, data);
    }

    async deleteCard(id) {
        return this.delete(`/cards/${id}`);
    }

    async reviewCard(id, quality, sr) {
        return this.post(`/cards/${id}/review`, { quality, sr });
    }

    async getDueCards() {
        return this.get('/cards/due');
    }

    // Sync methods
    async pullChanges(since = null) {
        let url = '/sync/pull';
        if (since) url += `?since=${since}`;
        return this.get(url);
    }

    async pushChanges(changes, lastSyncAt = null) {
        return this.post('/sync/push', { changes, lastSyncAt });
    }

    async fullSync() {
        return this.post('/sync/full');
    }
}

// Determine API URL based on environment
const API_URL = (() => {
    // Check if running on localhost
    const isLocalhost = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.protocol === 'file:';

    if (isLocalhost) {
        return 'http://localhost:3000/api/v1';
    }

    // Production: Use your deployed backend URL
    // Replace this with your actual Render backend URL after deployment
    return 'https://flashcard-api.onrender.com/api/v1';
})();

// Export singleton instance
const api = new ApiService(API_URL);

// Log which API is being used (for debugging)
console.log('API URL:', API_URL);
