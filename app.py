import sqlite3
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import bcrypt

app = Flask(__name__)
CORS(app)

# Setup JWT
app.config['JWT_SECRET_KEY'] = 'xyphers-secret-key-12345'  # In production, use an environment variable
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)
jwt = JWTManager(app)

DB_NAME = 'xyphers.db'

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        conn.execute('''
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
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        conn.commit()

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed))
            user_id = cursor.lastrowid
            cursor.execute("INSERT INTO stats (user_id) VALUES (?)", (user_id,))
            conn.commit()
            
            access_token = create_access_token(identity=username)
            return jsonify({"success": True, "token": access_token, "username": username}), 201
    except sqlite3.IntegrityError:
        return jsonify({"message": "Username already exists"}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        
    if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        access_token = create_access_token(identity=username)
        return jsonify({"success": True, "token": access_token, "username": username}), 200
    
    return jsonify({"message": "Invalid username or password"}), 401

@app.route('/api/user/stats', methods=['GET'])
@jwt_required()
def get_stats():
    username = get_jwt_identity()
    with get_db() as conn:
        row = conn.execute('''
            SELECT total_solved, 
                   aristocrat_time, aristocrat_solved,
                   patristocrat_time, patristocrat_solved,
                   atbash_time, atbash_solved,
                   baconian_time, baconian_solved
            FROM stats 
            JOIN users ON stats.user_id = users.id 
            WHERE users.username = ?
        ''', (username,)).fetchone()
    
    if row:
        return jsonify({
            "totalSolved": row['total_solved'],
            "aristocrat": {"time": row['aristocrat_time'], "solved": row['aristocrat_solved']},
            "patristocrat": {"time": row['patristocrat_time'], "solved": row['patristocrat_solved']},
            "atbash": {"time": row['atbash_time'], "solved": row['atbash_solved']},
            "baconian": {"time": row['baconian_time'], "solved": row['baconian_solved']}
        })
    return jsonify({"message": "Stats not found"}), 404

@app.route('/api/user/stats', methods=['POST'])
@jwt_required()
def update_stats():
    username = get_jwt_identity()
    data = request.get_json()
    cipher_type = data.get('cipherType')
    solve_time = data.get('time')
    
    if not cipher_type or solve_time is None:
        return jsonify({"message": "Invalid data"}), 400

    # Map cipher types to column names
    col_map = {
        'aristocrat': ('aristocrat_time', 'aristocrat_solved'),
        'patristocrat': ('patristocrat_time', 'patristocrat_solved'),
        'atbash': ('atbash_time', 'atbash_solved'),
        'baconian': ('baconian_time', 'baconian_solved')
    }
    
    if cipher_type not in col_map:
        return jsonify({"message": "Unknown cipher type"}), 400
        
    time_col, solved_col = col_map[cipher_type]
    
    with get_db() as conn:
        # Get current stats
        stats = conn.execute('''
            SELECT * FROM stats 
            JOIN users ON stats.user_id = users.id 
            WHERE users.username = ?
        ''', (username,)).fetchone()
        
        if not stats:
            return jsonify({"message": "Stats not found"}), 404
            
        new_total_solved = stats['total_solved'] + 1
        current_solved = stats[solved_col]
        current_avg_time = stats[time_col]
        
        # Calculate new average time
        new_avg_time = (current_avg_time * current_solved + solve_time) / (current_solved + 1)
        new_cipher_solved = current_solved + 1
        
        conn.execute(f'''
            UPDATE stats SET total_solved = ?, {time_col} = ?, {solved_col} = ?
            WHERE user_id = ?
        ''', (new_total_solved, new_avg_time, new_cipher_solved, stats['id']))
        conn.commit()
            
    return jsonify({"success": True}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
