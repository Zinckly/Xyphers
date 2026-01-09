const API_URL = 'http://127.0.0.1:5000/api';

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
            return { success: false, message: "Server unreachable" };
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
            return { success: false, message: "Server unreachable" };
        }
    }

    static logout() {
        localStorage.removeItem('xyphers_token');
        localStorage.removeItem('xyphers_current_user');
    }

    static isLoggedIn() {
        user.stats.totalSolved += 1;

        this.saveUsers(users);
    }
}
