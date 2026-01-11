// Theme Toggle Logic
class ThemeManager {
    static THEME_KEY = 'xyphers_theme';

    static init() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem(this.THEME_KEY) || 'dark';
        this.setTheme(savedTheme);

        // Run sync in background after initialization
        if (typeof UserSession !== 'undefined') {
            UserSession.syncSettings();
        }
    }

    static setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.THEME_KEY, theme);

        // Push to cloud if logged in
        if (typeof UserSession !== 'undefined' && UserSession.isLoggedIn()) {
            UserSession.updateSettings({ theme });
        }
    }

    static toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    }

    static getCurrentTheme() {
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr) return attr;
        return localStorage.getItem(this.THEME_KEY) || 'dark';
    }
}

// Initialize theme immediately to prevent flashing and race conditions
ThemeManager.init();
