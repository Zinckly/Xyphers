const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'xyphers-secret-key-12345';

app.use(cors());
app.use(express.json());

// Initialize PostgreSQL Connection using Pool for efficiency
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Check connection and initialize tables
async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS stats (
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
                CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);
        console.log('PostgreSQL tables initialized.');
    } catch (err) {
        console.error('Database initialization error:', err.message);
    }
}
initDb();

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.post('/api/auth/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );

        const userId = result.rows[0].id;
        await pool.query('INSERT INTO stats (user_id) VALUES ($1)', [userId]);

        const token = jwt.sign({ username, id: userId }, SECRET_KEY, { expiresIn: '7d' });
        res.status(201).json({ success: true, token, username });
    } catch (err) {
        if (err.code === '23505') { // PostgreSQL Unique Violation code
            return res.status(400).json({ message: 'Username already exists' });
        }
        console.error('Signup Database Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ message: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ message: 'Invalid username or password' });

        const token = jwt.sign({ username: user.username, id: user.id }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username });
    } catch (err) {
        console.error('Login Database Error:', err);
        res.status(500).json({ message: 'Database error', error: err.message });
    }
});

app.get('/api/user/stats', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT stats.* FROM stats JOIN users ON stats.user_id = users.id WHERE users.username = $1',
            [req.user.username]
        );
        const row = result.rows[0];

        if (!row) return res.status(404).json({ message: 'Stats not found' });

        res.json({
            totalSolved: row.total_solved,
            aristocrat: { time: row.aristocrat_time, solved: row.aristocrat_solved },
            patristocrat: { time: row.patristocrat_time, solved: row.patristocrat_solved },
            atbash: { time: row.atbash_time, solved: row.atbash_solved },
            baconian: { time: row.baconian_time, solved: row.baconian_solved }
        });
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
});

app.post('/api/user/stats', authenticateToken, async (req, res) => {
    const { cipherType, time } = req.body;
    if (!cipherType || time === undefined) return res.status(400).json({ message: 'Invalid data' });

    const timeCol = `${cipherType}_time`;
    const solvedCol = `${cipherType}_solved`;

    try {
        const statsResult = await pool.query('SELECT * FROM stats WHERE user_id = $1', [req.user.id]);
        const currentStats = statsResult.rows[0];

        if (!currentStats) return res.status(404).json({ message: 'Stats not found' });

        const currentSolved = currentStats[solvedCol];
        const currentAvgTime = currentStats[timeCol];
        const newSolved = currentSolved + 1;
        const newAvgTime = (currentAvgTime * currentSolved + time) / newSolved;

        await pool.query(
            `UPDATE stats SET total_solved = total_solved + 1, ${timeCol} = $1, ${solvedCol} = $2 WHERE user_id = $3`,
            [newAvgTime, newSolved, req.user.id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
