from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
import sqlite3
import os
from dotenv import load_dotenv
import requests

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "default_secret_key")

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  username TEXT UNIQUE, 
                  password TEXT, 
                  email TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS chat_history 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  user_id INTEGER, 
                  prompt TEXT, 
                  result TEXT, 
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id))''')
    conn.commit()
    conn.close()

# Initialize database on startup
with app.app_context():
    init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['GET', 'POST'])
def chat():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if request.method == 'POST':
        data = request.get_json()
        prompt = data.get('prompt')
        result = data.get('result')
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute("INSERT INTO chat_history (user_id, prompt, result) VALUES (?, ?, ?)",
                  (session['user_id'], prompt, result))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT id, prompt, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC",
              (session['user_id'],))
    history = c.fetchall()
    conn.close()
    return render_template('chat.html', history=history)

@app.route('/chat/history', methods=['GET'])
def get_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT id, prompt, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC",
              (session['user_id'],))
    history = c.fetchall()
    conn.close()
    return jsonify([{'id': h[0], 'prompt': h[1], 'timestamp': h[2]} for h in history])

@app.route('/api/gemini', methods=['POST'])
def gemini_proxy():
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    data = request.get_json()
    prompt = data.get('prompt')
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    try:
        response = requests.post(
            GEMINI_API_URL,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{
                    "parts": [{
                        "text": f"Generate a complete, renderable code snippet based on this prompt: \"{prompt}\". Provide the code within triple backticks (e.g., ```python ... ``` or ```html ... ```). If the prompt is vague, assume it refers to a simple webpage and return modern HTML with CSS (e.g., using Tailwind or Bootstrap). Ensure the output is executable or renderable."
                    }]
                }]
            }
        )
        response.raise_for_status()
        result = response.json()
        response_text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', 'Error: No response from AI.')
        return jsonify({'response': response_text})
    except requests.RequestException as e:
        return jsonify({'error': f"Gemini API error: {str(e)}"}), 500

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        email = request.form.get("email")
        if not (username and password and email):
            return render_template("register.html", message="All fields are required.")
        hashed_password = generate_password_hash(password)
        try:
            conn = sqlite3.connect('users.db')
            c = conn.cursor()
            c.execute("INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
                      (username, hashed_password, email))
            conn.commit()
            conn.close()
            return redirect("/login")
        except sqlite3.IntegrityError:
            return render_template("register.html", message="Username already exists.")
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = c.fetchone()
        conn.close()
        if user and check_password_hash(user[2], password):
            session["user_id"] = user[0]
            return redirect("/chat")
        return render_template("login.html", message="Invalid username or password.")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
