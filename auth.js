const API_URL = 'https://xyphers.onrender.com/api';

class UserSession {
    static async signup(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('xyphers_token', data.token);
                localStorage.setItem('xyphers_current_user', data.username);
                return { success: true };
            }
            return { success: false, message: data.message };
        } catch (error) {
            return { success: false, message: 'Server unreachable' };
        }
    }

    static async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('xyphers_token', data.token);
                localStorage.setItem('xyphers_current_user', data.username);
                return { success: true };
            }
            return { success: false, message: data.message };
        } catch (error) {
            return { success: false, message: 'Server unreachable' };
        }
    }

    static logout() {
        localStorage.removeItem('xyphers_token');
        localStorage.removeItem('xyphers_current_user');
    }

    static isLoggedIn() {
        return !!localStorage.getItem('xyphers_token');
    }

    static getCurrentUser() {
        return localStorage.getItem('xyphers_current_user');
    }

    static async getStats() {
        const token = localStorage.getItem('xyphers_token');
        if (!token) return null;

        try {
            const response = await fetch(`${API_URL}/user/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
        return null;
    }

    static async updateStats(cipherType, time) {
        const token = localStorage.getItem('xyphers_token');
        if (!token) return false;

        try {
            const response = await fetch(`${API_URL}/user/stats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cipherType, time })
            });
            return response.ok;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
        return false;
    }
}
