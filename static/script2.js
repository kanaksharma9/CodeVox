document.addEventListener("DOMContentLoaded", () => {
  console.log("HTML is fully loaded.");

  setTimeout(() => {
    const chatContainer = document.querySelector(".chat-list");
    const micButton = document.querySelector("#voice-input-button");
    const historyBox = document.getElementById("history-box");

    // Detailed error checking
    if (!chatContainer) console.error("chatContainer (.chat-list) not found in DOM.");
    if (!micButton) console.error("micButton (#voice-input-button) not found in DOM.");
    if (!chatContainer || !micButton) {
      console.error("Error: Required elements not found in the DOM. Aborting script.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    if (recognition) {
      recognition.continuous = false;
      recognition.lang = "en-US";
      console.log("SpeechRecognition initialized successfully.");
    } else {
      console.warn("Speech Recognition not supported. Mic disabled.");
      micButton.classList.add("disabled");
      micButton.title = "Speech not supported in this browser";
    }

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: message })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const responseText = data.response || "Error: No response from AI.";
        responseDiv.querySelector(".text").textContent = responseText;

        try {
          const saveResponse = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message, result: responseText })
          });
          if (!saveResponse.ok) throw new Error('Failed to save to chat history');
          await updateHistory();
        } catch (error) {
          console.error("Error saving to backend:", error);
          responseDiv.querySelector(".text").textContent += "\n(Failed to save to history)";
        }

        // Preview logic
        const codeMatch = responseText.match(/```([\w-]+)\n([\s\S]*?)\n```/);
        let previewContent = '';

        if (codeMatch && codeMatch[2]) {
          const language = codeMatch[1].toLowerCase();
          const code = codeMatch[2].trim();

          if (language === "html") {
            previewContent = code.includes("<html") 
              ? code 
              : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview</title></head><body>${code}</body></html>`;
          } else {
            previewContent = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <title>Preview - ${language}</title>
                <style>
                  body { font-family: "Poppins", sans-serif; padding: 20px; background: #242424; color: #E3E3E3; }
                  pre { background: #383838; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                </style>
              </head>
              <body>
                <pre>${code}</pre>
              </body>
              </html>`;
          }
        } else {
          previewContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>Preview</title>
              <style>
                body { font-family: "Poppins", sans-serif; padding: 20px; background: #242424; color: #E3E3E3; }
                pre { background: #383838; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); white-space: pre-wrap; }
              </style>
            </head>
            <body>
              <pre>${responseText}</pre>
            </body>
            </html>`;
        }

        const previewWindow = document.createElement("div");
        previewWindow.classList.add("preview-window");
        previewWindow.innerHTML = `
          <div class="preview-content">
            <button class="close-preview">X</button>
            <iframe srcdoc="${encodeURIComponent(previewContent)}" sandbox="allow-scripts allow-same-origin"></iframe>
          </div>
        `;
        document.body.appendChild(previewWindow);
        previewWindow.querySelector(".close-preview").addEventListener("click", () => previewWindow.remove());

      } catch (error) {
        console.error("Gemini proxy error:", error);
        responseDiv.querySelector(".text").textContent = "Error: Unable to process request.";
      }
    };

    if (recognition) {
      micButton.addEventListener("click", () => {
        console.log("Mic button clicked.");
        if (!isRecognitionActive) {
          try {
            console.log("Starting speech recognition...");
            recognition.start();
            micButton.classList.add("listening");
            isRecognitionActive = true;
            recognitionTimeout = setTimeout(() => {
              console.log("Recognition timeout triggered.");
              recognition.stop();
            }, 5000);
          } catch (e) {
            console.error("Failed to start recognition:", e);
            alert("Microphone access denied or unavailable. Check permissions and network.");
            micButton.classList.remove("listening");
            isRecognitionActive = false;
          }
        }
      });

      recognition.onstart = () => {
        console.log("Speech recognition started.");
      };

      recognition.onresult = (event) => {
        console.log("Speech recognition result received.");
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
        console.error("Speech recognition error:", event.error);
        micButton.classList.remove("listening");
        isRecognitionActive = false;
        clearTimeout(recognitionTimeout);
        let errorMessage = "Speech recognition failed: ";
        switch (event.error) {
          case "network":
            errorMessage += "Network issue. Check your connection.";
            break;
          case "not-allowed":
          case "service-not-allowed":
            errorMessage += "Microphone access denied. Grant permissions.";
            break;
          case "no-speech":
            errorMessage += "No speech detected. Speak louder or closer.";
            break;
          default:
            errorMessage += event.error;
        }
        alert(errorMessage);
        recognition.stop();
      };

      recognition.onend = () => {
        console.log("Speech recognition ended.");
        micButton.classList.remove("listening");
        isRecognitionActive = false;
        clearTimeout(recognitionTimeout);
      };
    }
  }, 100);
});
