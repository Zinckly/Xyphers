-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_solved INTEGER DEFAULT 0,
    aristocrat_time REAL DEFAULT 0,
    aristocrat_solved INTEGER DEFAULT 0,
    patristocrat_time REAL DEFAULT 0,
    patristocrat_solved INTEGER DEFAULT 0,
    atbash_time REAL DEFAULT 0,
    atbash_solved INTEGER DEFAULT 0,
    baconian_time REAL DEFAULT 0,
    baconian_solved INTEGER DEFAULT 0
);
