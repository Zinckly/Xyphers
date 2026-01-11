const API_URL = 'https://xyphers.onrender.com/api';

class UserSession {
    static async signup(username, password) {
        try {
            console.log(`Sending signup request to: ${API_URL}/auth/signup`);
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('xyphers_token', data.token);
                localStorage.setItem('xyphers_current_user', data.username);
                // Store initial settings
                if (data.settings) {
                    localStorage.setItem('xyphers_theme', data.settings.theme);
                    localStorage.setItem('xyphers_settings', JSON.stringify({
                        highlightSame: data.settings.highlightSame,
                        autofill: data.settings.autofill
                    }));
                }
                return { success: true };
            }
            return { success: false, message: data.message };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, message: 'Server unreachable' };
        }
    }

    static async login(username, password) {
        try {
            console.log(`Sending login request to: ${API_URL}/auth/login`);
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('xyphers_token', data.token);
                localStorage.setItem('xyphers_current_user', data.username);
                // Sync cloud settings to local storage
                if (data.settings) {
                    localStorage.setItem('xyphers_theme', data.settings.theme);
                    // Merge with existing local settings if any (mostly for cipherType)
                    const localSettingsStr = localStorage.getItem('xyphers_settings');
                    const localSettings = localSettingsStr ? JSON.parse(localSettingsStr) : {};
                    localStorage.setItem('xyphers_settings', JSON.stringify({
                        ...localSettings,
                        highlightSame: data.settings.highlightSame,
                        autofill: data.settings.autofill
                    }));
                }
                return { success: true };
            }
            return { success: false, message: data.message };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Server unreachable' };
        }
    }

    static logout() {
        localStorage.removeItem('xyphers_token');
        localStorage.removeItem('xyphers_current_user');
        // Optional: clear settings or keep them as "guest" settings?
        // Let's keep them so they don't lose preferences immediately, 
        // but they won't sync anymore.
    }

    static isLoggedIn() {
        return !!localStorage.getItem('xyphers_token');
    }

    static getCurrentUser() {
        return localStorage.getItem('xyphers_current_user');
    }

    static async getSettings() {
        const token = localStorage.getItem('xyphers_token');
        if (!token) return null;

        try {
            const response = await fetch(`${API_URL}/user/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
        return null;
    }

    static async updateSettings(settings) {
        const token = localStorage.getItem('xyphers_token');
        if (!token) return false;

        try {
            const response = await fetch(`${API_URL}/user/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            return response.ok;
        } catch (error) {
            console.error('Error updating settings:', error);
        }
        return false;
    }

    static async syncSettings() {
        const token = localStorage.getItem('xyphers_token');
        if (!token) return;

        const settings = await this.getSettings();
        if (settings) {
            // Update Theme (if changed)
            if (settings.theme) {
                const localTheme = localStorage.getItem('xyphers_theme');
                if (settings.theme !== localTheme) {
                    localStorage.setItem('xyphers_theme', settings.theme);
                    document.documentElement.setAttribute('data-theme', settings.theme);
                }
            }

            // Update Game Settings (if changed)
            const localSettingsStr = localStorage.getItem('xyphers_settings');
            const localSettings = localSettingsStr ? JSON.parse(localSettingsStr) : {};
            if (settings.highlightSame !== localSettings.highlightSame ||
                settings.autofill !== localSettings.autofill) {

                localStorage.setItem('xyphers_settings', JSON.stringify({
                    ...localSettings,
                    highlightSame: settings.highlightSame,
                    autofill: settings.autofill
                }));
            }
        }
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
            console.log(`Updating stats for ${cipherType}: ${time}s`);
            const response = await fetch(`${API_URL}/user/stats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cipherType, time })
            });
            console.log('Stats update response:', response.status);
            return response.ok;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
        return false;
    }
}
