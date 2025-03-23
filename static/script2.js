document.addEventListener("DOMContentLoaded", () => {
  console.log("HTML is fully loaded.");

  setTimeout(() => {
    const chatContainer = document.querySelector(".chat-list");
    const micButton = document.querySelector("#voice-input-button");
    const historyBox = document.getElementById("history-box");

    if (!chatContainer || !micButton) {
      console.error("Error: Required elements not found in the DOM.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    let isRecognitionActive = false;
    let recognitionTimeout;

    const createMessageElement = (content, type) => {
      const messageDiv = document.createElement("div");
      messageDiv.classList.add("message", type);
      messageDiv.innerHTML = `
        <div class="message-content">
          <img class="avatar" src="${type === 'outgoing'
            ? 'https://i.ibb.co/7nQRLhC/a331a8d0a8ff50827c6cb3437f336a30.jpg'
            : 'https://i.ibb.co/tJSzrmY/am-i-the-only-one-whos-annoyed-by-the-stroke-contrast-in-v0-t855aw6ntuha1.webp'}" 
               alt="Avatar" onerror="this.src='fallback.jpg';">
          <p class="text">${content}</p>
        </div>
      `;
      chatContainer.appendChild(messageDiv);
      chatContainer.scrollTo(0, chatContainer.scrollHeight);
      return messageDiv;
    };

    const updateHistory = async () => {
      if (!historyBox) return;
      try {
        const response = await fetch('/chat/history', { method: 'GET' });
        const history = await response.json();
        historyBox.querySelector('.history-content').innerHTML = history.map(h => `
          <a href="/chat/${h.id}" class="history-entry">
            <div class="message incoming">
              <div class="message-content">
                <div class="text">${h.prompt ? h.prompt.slice(0, 50) + (h.prompt.length > 50 ? '...' : '') : 'No prompt'}<br><small>${h.timestamp}</small></div>
              </div>
            </div>
          </a>
        `).join('');
      } catch (error) {
        console.error("Failed to update history:", error);
      }
    };

    const fetchGeminiResponse = async (message) => {
      const responseDiv = createMessageElement("...", "incoming");
      chatContainer.appendChild(responseDiv);
      chatContainer.scrollTo(0, chatContainer.scrollHeight);

      try {
        const response = await fetch('/api/gemini', {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt: message })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.response || "Error: No response from AI.";
        responseDiv.querySelector(".text").textContent = responseText;

        try {
          const saveResponse = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message, result: responseText })
          });
          if (!saveResponse.ok) {
            throw new Error('Failed to save to chat history');
          }
          await updateHistory();
        } catch (error) {
          console.error("Error saving to backend:", error);
          responseDiv.querySelector(".text").textContent += "\n(Failed to save to history)";
        }

        const codeMatch = responseText.match(/```([\w-]+)\n([\s\S]*?)\n```/);
        let previewContent = '';

        if (codeMatch && codeMatch[2]) {
          const language = codeMatch[1].toLowerCase();
          const code = codeMatch[2];

          if (language === "html") {
            // Ensure full HTML structure for rendering
            previewContent = code.includes("<!DOCTYPE") || code.includes("<html")
              ? code
              : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview</title></head><body>${code}</body></html>`;
          } else if (language === "javascript") {
            // Execute JavaScript in iframe with console output
            previewContent = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <title>Preview - JavaScript</title>
                <style>
                  body { font-family: monospace; padding: 20px; background: #242424; color: #E3E3E3; }
                  pre { background: #383838; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                </style>
              </head>
              <body>
                <pre id="output"></pre>
                <script>
                  try {
                    const log = console.log;
                    console.log = (...args) => {
                      document.getElementById('output').textContent += args.join(' ') + '\\n';
                      log(...args);
                    };
                    ${code}
                  } catch (e) {
                    document.getElementById('output').textContent = 'Error: ' + e.message;
                  }
                </script>
              </body>
              </html>
            `;
          } else if (language === "python") {
            // Display Python as syntax-highlighted text (no execution in browser)
            previewContent = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <title>Preview - Python</title>
                <style>
                  body { font-family: monospace; padding: 20px; background: #242424; color: #E3E3E3; }
                  pre { background: #383838; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                  .keyword { color: #ff79c6; }
                  .string { color: #f1fa8c; }
                  .comment { color: #6272a4; }
                </style>
              </head>
              <body>
                <pre>${highlightPython(code)}</pre>
              </body>
              </html>
            `;
          } else {
            // Generic code preview with monospace styling
            previewContent = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <title>Preview - ${language}</title>
                <style>
                  body { font-family: monospace; padding: 20px; background: #242424; color: #E3E3E3; }
                  pre { background: #383838; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                </style>
              </head>
              <body>
                <pre>${code}</pre>
              </body>
              </html>
            `;
          }
        } else {
          // Non-code response preview
          previewContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>Preview</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #242424; color: #E3E3E3; }
                pre { background: #383838; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); white-space: pre-wrap; }
              </style>
            </head>
            <body>
              <pre>${responseText}</pre>
            </body>
            </html>
          `;
        }

        if (previewContent) {
          const previewWindow = document.createElement("div");
          previewWindow.classList.add("preview-window");
          // Double-escape quotes to ensure srcdoc works
          const escapedContent = previewContent.replace(/"/g, '&quot;');
          previewWindow.innerHTML = `
            <div class="preview-content">
              <button class="close-preview">X</button>
              <iframe srcdoc="${escapedContent}" sandbox="allow-scripts allow-popups allow-same-origin"></iframe>
            </div>
          `;
          document.body.appendChild(previewWindow);

          previewWindow.querySelector(".close-preview").addEventListener("click", () => {
            previewWindow.remove();
          });
        }
      } catch (error) {
        console.error("Gemini proxy error:", error);
        responseDiv.querySelector(".text").textContent = "Error: Unable to process request.";
      }
    };

    // Simple Python syntax highlighting (client-side)
    function highlightPython(code) {
      return code
        .replace(/\b(def|class|if|else|elif|for|while|try|except|with|return|import|from|as)\b/g, '<span class="keyword">$1</span>')
        .replace(/"([^"]*)"|'([^']*)'/g, '<span class="string">"$1$2"</span>')
        .replace(/#.*$/gm, '<span class="comment">$&</span>');
    }

    micButton.addEventListener("click", () => {
      if (!isRecognitionActive) {
        recognition.start();
        micButton.classList.add("listening");
        isRecognitionActive = true;

        recognitionTimeout = setTimeout(() => {
          recognition.stop();
        }, 5000);
      }
    });

    recognition.onresult = (event) => {
      micButton.classList.remove("listening");
      isRecognitionActive = false;
      clearTimeout(recognitionTimeout);
      const transcript = event.results[0][0].transcript;
      const userMessageDiv = createMessageElement(transcript, "outgoing");
      chatContainer.appendChild(userMessageDiv);
      chatContainer.scrollTo(0, chatContainer.scrollHeight);
      fetchGeminiResponse(transcript);
    };

    recognition.onerror = (event) => {
      micButton.classList.remove("listening");
      isRecognitionActive = false;
      clearTimeout(recognitionTimeout);
      console.error("Speech recognition error:", event.error);
      alert("Speech recognition error. Please try again.");
      recognition.stop();
    };

    recognition.onend = () => {
      micButton.classList.remove("listening");
      isRecognitionActive = false;
      clearTimeout(recognitionTimeout);
      console.log("Speech recognition ended. You can restart it by clicking the button.");
    };
  }, 100);
});