const DB_KEY_USERS = 'xyphers_users';
const DB_KEY_CURRENT_USER = 'xyphers_current_user';

class UserSession {
    static getUsers() {
        const users = localStorage.getItem(DB_KEY_USERS);
        return users ? JSON.parse(users) : {};
    }

    static saveUsers(users) {
        localStorage.setItem(DB_KEY_USERS, JSON.stringify(users));
    }

    static getCurrentUser() {
        return localStorage.getItem(DB_KEY_CURRENT_USER);
    }

    static setCurrentUser(username) {
        if (username) {
            localStorage.setItem(DB_KEY_CURRENT_USER, username);
        } else {
            localStorage.removeItem(DB_KEY_CURRENT_USER);
        }
    }

    static login(username, password) {
        const users = this.getUsers();
        if (users[username] && users[username].password === password) {
            this.setCurrentUser(username);
            return { success: true };
        }
        return { success: false, message: "Invalid username or password" };
    }

    static signup(username, password) {
        const users = this.getUsers();
        if (users[username]) {
            return { success: false, message: "Username already exists" };
        }
        users[username] = {
            password: password,
            stats: {
                totalSolved: 0,
                aristocrat: { solved: 0, time: 0 },
                patristocrat: { solved: 0, time: 0 },
                atbash: { solved: 0, time: 0 },
                baconian: { solved: 0, time: 0 }
            }
        };
        this.saveUsers(users);
        this.setCurrentUser(username);
        return { success: true };
    }

    static logout() {
        this.setCurrentUser(null);
    }

    static isLoggedIn() {
        return !!this.getCurrentUser();
    }

    static getStats() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return null;
        const users = this.getUsers();
        return users[currentUser] ? users[currentUser].stats : null;
    }

    static updateStats(cipherType, timeSeconds) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return;

        const users = this.getUsers();
        const user = users[currentUser];

        if (!user.stats[cipherType]) {
            user.stats[cipherType] = { solved: 0, time: 0 };
        }

        // Update specific cipher stats
        const currentStats = user.stats[cipherType];
        const newSolvedCount = currentStats.solved + 1;
        // Average time calculation: (old_avg * old_count + new_time) / new_count
        const newAvgTime = ((currentStats.time * currentStats.solved) + timeSeconds) / newSolvedCount;

        currentStats.solved = newSolvedCount;
        currentStats.time = newAvgTime;

        // Update total
        user.stats.totalSolved += 1;

        this.saveUsers(users);
    }
}
