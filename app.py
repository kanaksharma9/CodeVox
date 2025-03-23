from flask import Flask, request, render_template, redirect, url_for, session, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
import sqlite3
import os
from dotenv import load_dotenv
import requests

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")  # Load secret key from .env

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
                  message TEXT, 
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users(id))''')
    try:
        c.execute("ALTER TABLE chat_history ADD COLUMN prompt TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE chat_history ADD COLUMN result TEXT")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['GET', 'POST'])
def chat():
    if request.method == 'POST' and 'user_id' in session:
        data = request.get_json()
        prompt = data.get('prompt')
        result = data.get('result')
        if prompt and result:
            conn = sqlite3.connect('users.db')
            c = conn.cursor()
            c.execute("INSERT INTO chat_history (user_id, prompt, result) VALUES (?, ?, ?)",
                     (session['user_id'], prompt, result))
            conn.commit()
            conn.close()
        return jsonify({'status': 'success'})

    history = []
    if 'user_id' in session:
        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute("SELECT id, prompt, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC",
                 (session['user_id'],))
        history = c.fetchall()
        conn.close()

    return render_template('chat.html', history=history)

@app.route('/chat/<int:chat_id>')
def view_chat(chat_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT prompt, result, timestamp FROM chat_history WHERE id = ? AND user_id = ?",
             (chat_id, session['user_id']))
    chat = c.fetchone()
    conn.close()

    if not chat:
        return "Chat not found or unauthorized", 404

    # Pass prompt, result, and timestamp to the template
    return render_template('view_chat.html', prompt=chat[0], result=chat[1], timestamp=chat[2])

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
        else:
            return render_template("login.html", message="Invalid username or password.")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/chat")

@app.route('/chat/history', methods=['GET'])
def chat_history():
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
def proxy_gemini():
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

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))  # For Render
    app.run(host="0.0.0.0", port=port, debug=True)