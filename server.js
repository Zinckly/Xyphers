const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'xyphers-secret-key-12345';

app.use(cors());
app.use(express.json());

// Initialize Database
const dbPath = path.resolve(__dirname, 'xyphers.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS stats (
            user_id INTEGER PRIMARY KEY,
            total_solved INTEGER DEFAULT 0,
            aristocrat_time REAL DEFAULT 0,
            aristocrat_solved INTEGER DEFAULT 0,
            patristocrat_time REAL DEFAULT 0,
            patristocrat_solved INTEGER DEFAULT 0,
            atbash_time REAL DEFAULT 0,
            atbash_solved INTEGER DEFAULT 0,
            baconian_time REAL DEFAULT 0,
            baconian_solved INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
    });
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(0o1).json({ message: 'Access denied' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Routes
app.post('/api/auth/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ message: 'Username already exists' });
                }
                return res.status(500).json({ message: 'Database error' });
            }

            const userId = this.lastID;
            db.run(`INSERT INTO stats (user_id) VALUES (?)`, [userId]);

            const token = jwt.sign({ username, id: userId }, SECRET_KEY, { expiresIn: '7d' });
            res.status(201).json({ success: true, token, username });
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!user) return res.status(401).json({ message: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ message: 'Invalid username or password' });

        const token = jwt.sign({ username: user.username, id: user.id }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username });
    });
});

app.get('/api/user/stats', authenticateToken, (req, res) => {
    db.get(`SELECT stats.* FROM stats JOIN users ON stats.user_id = users.id WHERE users.username = ?`,
        [req.user.username], (err, row) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (!row) return res.status(404).json({ message: 'Stats not found' });

            res.json({
                totalSolved: row.total_solved,
                aristocrat: { time: row.aristocrat_time, solved: row.aristocrat_solved },
                patristocrat: { time: row.patristocrat_time, solved: row.patristocrat_solved },
                atbash: { time: row.atbash_time, solved: row.atbash_solved },
                baconian: { time: row.baconian_time, solved: row.baconian_solved }
            });
        });
});

app.post('/api/user/stats', authenticateToken, (req, res) => {
    const { cipherType, time } = req.body;
    if (!cipherType || time === undefined) return res.status(400).json({ message: 'Invalid data' });

    const timeCol = `${cipherType}_time`;
    const solvedCol = `${cipherType}_solved`;

    db.get(`SELECT * FROM stats WHERE user_id = ?`, [req.user.id], (err, currentStats) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!currentStats) return res.status(404).json({ message: 'Stats not found' });

        const currentSolved = currentStats[solvedCol];
        const currentAvgTime = currentStats[timeCol];
        const newSolved = currentSolved + 1;
        const newAvgTime = (currentAvgTime * currentSolved + time) / newSolved;

        db.run(`UPDATE stats SET total_solved = total_solved + 1, ${timeCol} = ?, ${solvedCol} = ? WHERE user_id = ?`,
            [newAvgTime, newSolved, req.user.id], function (err) {
                if (err) return res.status(500).json({ message: 'Database error' });
                res.json({ success: true });
            });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
