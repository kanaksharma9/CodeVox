# CodeVox 🎙️➡️💻

## Speech to Code Generator

CodeVox is a web application that allows users to generate code through voice commands. By speaking into a microphone, users can describe what they want to create, and the application will generate the corresponding code and provide an immediate preview.

## Features

- **Speech Recognition**: Converts spoken instructions into text using the Web Speech API
- **Code Generation**: Transforms speech into functional code via Google's Gemini 1.5 Flash API
- **Live Preview**: Renders generated code in real-time for immediate visual feedback
- **User Accounts**: Personal accounts to save and manage code history
- **History Tracking**: Access to previously generated code snippets

## Technical Stack

- **Backend**: Flask web framework
- **Database**: SQLite for data storage
- **Authentication**: Werkzeug security for password hashing
- **Frontend**: HTML, CSS, JavaScript
- **APIs**: Web Speech API for voice recognition, Google Gemini 1.5 Flash for code generation

## System Architecture

The application follows a client-server architecture:

1. The Flask server handles user authentication, session management, and data persistence
2. Frontend JavaScript manages speech recognition and API communication
3. When a user speaks, their voice is converted to text using the Web Speech API
4. The text is sent to the Gemini API with a prompt engineered for code generation
5. Generated code is displayed in the chat interface and stored in the database
6. A preview is created using a sandboxed iframe for immediate visualization

## Database Structure

CodeVox uses two main database tables:
- `users`: Stores user credentials and profile information
- `chat_history`: Records all code generations with timestamps and user associations

## Implementation Details

### Speech Recognition
The application uses the Web Speech API (specifically the SpeechRecognition interface) to capture and process voice input from the user's microphone. The recognition is configured for English language processing with a focus on technical terminology.

### Code Generation
Voice input is sent to the Google Gemini 1.5 Flash API with specific instructions to generate complete, renderable code snippets. The API prompt is engineered to handle vague requests by defaulting to web components when appropriate.

### Preview Functionality
Generated code is automatically rendered in a sandboxed iframe, allowing users to see their creation without leaving the application. This preview system supports HTML, CSS, and JavaScript rendering.

### User Authentication
The application implements a secure login and registration system using Werkzeug's password hashing functions to protect user credentials. Session management keeps users authenticated between visits.

## Setup Instructions

```bash
# Clone the repositoryhttps://github.com/kanaksharma9/voice-to-code-converter
git clone https://github.com/kanaksharma9/voice-to-code-converter

# Navigate to project directory
cd voice-to-code-converter

# Install dependencies
pip install -r requirements.txt

# Set up the database
python -c "from app import init_db; init_db()"

# Start the application
python app.py
```

Then open `http://localhost:5000` in your browser to access the application.

## Usage Guide

1. Register for an account or log in
2. Click the microphone button at the bottom of the screen
3. Speak your code request clearly (e.g., "Create a login form with email and password fields")
4. Wait for the system to process your request and generate code
5. View the generated code and its preview
6. Access your history by clicking the "Chat History" button in the navigation bar

## File Structure

```
codevox/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies          # SQLite database
├── static/
│   ├── style.css       # Application styling
│   └── script2.js      # Frontend functionality
└── templates/
    ├── index.html      # Landing page
    ├── login.html      # Login page
    ├── register.html   # Registration page
    ├── chat.html       # Main application interface
    └── view_chat.html  # History view page
```

## Requirements

- Python 3.6+
- Flask
- SQLite3
- Modern web browser with microphone access
- Internet connection for API access

## Contributors

- Kanak
- Priya
- Anamika
- Sneha
- Rishika
