"use strict";
/**
 * AgentPanelProvider — Primary Sidebar Chat Interface
 *
 * WebviewViewProvider rendering the main agent chat panel in the
 * EchoCoder Activity Bar container. This is the Cascade/Copilot Chat
 * equivalent — the primary surface for agent interaction.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentPanelProvider = void 0;
class AgentPanelProvider {
    constructor(extensionUri, processManager, eventRouter, promptAssembler, outputChannel) {
        this.extensionUri = extensionUri;
        this.processManager = processManager;
        this.eventRouter = eventRouter;
        this.promptAssembler = promptAssembler;
        this.outputChannel = outputChannel;
        this.wireEvents();
    }
    /**
     * Wire EventRouter events to the webview.
     */
    wireEvents() {
        this.eventRouter.onTextDelta((event) => {
            this.postMessage({ type: 'streamChunk', text: event.text });
        });
        this.eventRouter.onToolCall((event) => {
            this.postMessage({
                type: 'toolProgress',
                tool: event.tool,
                input: event.input,
                status: 'running',
            });
        });
        this.eventRouter.onToolResult((event) => {
            this.postMessage({
                type: 'toolResult',
                toolCallId: event.tool_call_id,
                output: event.output,
                isError: event.is_error,
            });
        });
        this.eventRouter.onFileEdit((event) => {
            this.postMessage({
                type: 'fileChange',
                action: 'edit',
                path: event.path,
            });
        });
        this.eventRouter.onFileCreate((event) => {
            this.postMessage({
                type: 'fileChange',
                action: 'create',
                path: event.path,
            });
        });
        this.eventRouter.onUsage((event) => {
            this.postMessage({
                type: 'usageUpdate',
                inputTokens: event.usage.input_tokens,
                outputTokens: event.usage.output_tokens,
            });
        });
        this.eventRouter.onSuccess(() => {
            this.postMessage({ type: 'agentComplete' });
        });
        this.eventRouter.onError((event) => {
            this.postMessage({ type: 'agentError', error: event.error });
        });
    }
    resolveWebviewView(webviewView, _context, _token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            this.handleWebviewMessage(message);
        });
    }
    /**
     * Handle messages from the webview UI.
     */
    async handleWebviewMessage(message) {
        switch (message.type) {
            case 'sendPrompt': {
                const prompt = message.text;
                if (!prompt || prompt.trim().length === 0) {
                    return;
                }
                this.postMessage({ type: 'userMessage', text: prompt });
                this.postMessage({ type: 'agentThinking' });
                try {
                    const assembled = await this.promptAssembler.assembleChatPrompt(prompt);
                    await this.processManager.ensureReady({ cwd: assembled.cwd });
                    await this.processManager.spawn({ prompt: assembled.prompt, cwd: assembled.cwd, mode: 'panel' });
                }
                catch (err) {
                    this.postMessage({
                        type: 'agentError',
                        error: `Failed to start agent: ${err}`,
                    });
                }
                break;
            }
            case 'cancelRequest': {
                this.processManager.abort();
                this.postMessage({ type: 'agentCancelled' });
                break;
            }
            case 'newSession': {
                this.processManager.abort();
                this.eventRouter.resetTokens();
                this.postMessage({ type: 'sessionCleared' });
                break;
            }
        }
    }
    /**
     * Post a message to the webview.
     */
    postMessage(message) {
        this.view?.webview.postMessage(message);
    }
    /**
     * Generate the HTML content for the agent panel webview.
     */
    getHtmlContent(webview) {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>EchoCoder Agent</title>
    <style>
      :root {
        --echo-bg: var(--vscode-editor-background);
        --echo-fg: var(--vscode-editor-foreground);
        --echo-border: var(--vscode-panel-border, rgba(128,128,128,0.2));
        --echo-input-bg: var(--vscode-input-background);
        --echo-input-fg: var(--vscode-input-foreground);
        --echo-input-border: var(--vscode-input-border, rgba(128,128,128,0.3));
        --echo-button-bg: var(--vscode-button-background);
        --echo-button-fg: var(--vscode-button-foreground);
        --echo-button-hover: var(--vscode-button-hoverBackground);
        --echo-accent: var(--vscode-focusBorder, #007acc);
        --echo-user-bg: rgba(0, 122, 204, 0.08);
        --echo-agent-bg: rgba(255, 255, 255, 0.03);
        --echo-tool-bg: rgba(255, 193, 7, 0.06);
        --echo-error-bg: rgba(220, 53, 69, 0.08);
        --echo-success: #28a745;
        --echo-warning: #ffc107;
        --echo-danger: #dc3545;
      }

      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        background: var(--echo-bg);
        color: var(--echo-fg);
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: var(--vscode-font-size, 13px);
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Header */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid var(--echo-border);
        background: rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
      }
      .header-title {
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        opacity: 0.8;
      }
      .header-actions button {
        background: none;
        border: none;
        color: var(--echo-fg);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        opacity: 0.7;
        transition: all 0.2s;
      }
      .header-actions button:hover {
        opacity: 1;
        background: rgba(255,255,255,0.08);
      }

      /* Messages area */
      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        scroll-behavior: smooth;
      }
      .messages::-webkit-scrollbar { width: 6px; }
      .messages::-webkit-scrollbar-thumb {
        background: rgba(128,128,128,0.3);
        border-radius: 3px;
      }

      .message {
        margin-bottom: 16px;
        padding: 10px 14px;
        border-radius: 8px;
        animation: fadeIn 0.3s ease-out;
        line-height: 1.6;
        word-wrap: break-word;
      }
      .message.user {
        background: var(--echo-user-bg);
        border-left: 3px solid var(--echo-accent);
      }
      .message.agent {
        background: var(--echo-agent-bg);
        border-left: 3px solid var(--echo-success);
      }
      .message.error {
        background: var(--echo-error-bg);
        border-left: 3px solid var(--echo-danger);
      }
      .message.tool {
        background: var(--echo-tool-bg);
        border-left: 3px solid var(--echo-warning);
        font-size: 12px;
        opacity: 0.85;
      }

      .message-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        opacity: 0.6;
      }

      /* Code blocks */
      .message pre {
        background: rgba(0,0,0,0.2);
        padding: 10px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 8px 0;
        font-family: var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', monospace);
        font-size: 12px;
        line-height: 1.5;
      }
      .message code {
        font-family: var(--vscode-editor-font-family, 'Cascadia Code', monospace);
        font-size: 12px;
        padding: 2px 5px;
        border-radius: 3px;
        background: rgba(0,0,0,0.15);
      }

      /* Thinking indicator */
      .thinking {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        opacity: 0.7;
        font-style: italic;
      }
      .thinking-dots {
        display: flex;
        gap: 4px;
      }
      .thinking-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--echo-accent);
        animation: bounce 1.4s infinite ease-in-out;
      }
      .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
      .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }

      /* Token meter */
      .token-meter {
        padding: 6px 12px;
        font-size: 11px;
        opacity: 0.5;
        text-align: center;
        border-top: 1px solid var(--echo-border);
        flex-shrink: 0;
      }

      /* Input area */
      .input-area {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid var(--echo-border);
        background: rgba(0, 0, 0, 0.05);
        flex-shrink: 0;
      }
      .input-area textarea {
        flex: 1;
        background: var(--echo-input-bg);
        color: var(--echo-input-fg);
        border: 1px solid var(--echo-input-border);
        border-radius: 6px;
        padding: 8px 12px;
        font-family: inherit;
        font-size: 13px;
        resize: none;
        min-height: 38px;
        max-height: 150px;
        outline: none;
        transition: border-color 0.2s;
      }
      .input-area textarea:focus {
        border-color: var(--echo-accent);
      }
      .input-area textarea::placeholder {
        opacity: 0.4;
      }
      .input-area button {
        background: var(--echo-button-bg);
        color: var(--echo-button-fg);
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        transition: background 0.2s;
        align-self: flex-end;
      }
      .input-area button:hover {
        background: var(--echo-button-hover);
      }
      .input-area button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* File change cards */
      .file-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: rgba(0,0,0,0.1);
        border-radius: 6px;
        margin: 4px 0;
        font-size: 12px;
      }
      .file-card .icon { opacity: 0.6; }

      /* Animations */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      /* Welcome screen */
      .welcome {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        padding: 24px;
        opacity: 0.6;
      }
      .welcome h2 { margin-bottom: 8px; font-size: 16px; }
      .welcome p { font-size: 12px; line-height: 1.6; max-width: 280px; }
      .welcome .shortcuts {
        margin-top: 16px;
        font-size: 11px;
        text-align: left;
      }
      .welcome .shortcuts kbd {
        display: inline-block;
        padding: 2px 6px;
        background: rgba(128,128,128,0.2);
        border-radius: 3px;
        font-family: monospace;
        font-size: 11px;
      }
    </style>
</head>
<body>
    <div class="header">
      <span class="header-title">🤖 EchoCoder</span>
      <div class="header-actions">
        <button id="btn-new-session" title="New Session">🔄 New</button>
      </div>
    </div>

    <div class="messages" id="messages">
      <div class="welcome" id="welcome">
        <h2>🤖 EchoCoder Agent</h2>
        <p>Your AI-native coding partner. Ask me to write, refactor, debug, or explain code.</p>
        <div class="shortcuts">
          <p><kbd>Ctrl+K</kbd> Inline Edit</p>
          <p><kbd>Ctrl+I</kbd> Inline Chat</p>
          <p><kbd>Ctrl+L</kbd> Focus this panel</p>
          <p><kbd>Ctrl+Shift+K</kbd> Explain selection</p>
        </div>
      </div>
    </div>

    <div class="token-meter" id="token-meter" style="display:none">
      📊 Tokens: <span id="token-count">0</span>
    </div>

    <div class="input-area">
      <textarea id="prompt-input" placeholder="Ask EchoCoder anything... (Enter to send, Shift+Enter for newline)" rows="1"></textarea>
      <button id="btn-send">Send</button>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const messagesEl = document.getElementById('messages');
      const welcomeEl = document.getElementById('welcome');
      const inputEl = document.getElementById('prompt-input');
      const sendBtn = document.getElementById('btn-send');
      const newSessionBtn = document.getElementById('btn-new-session');
      const tokenMeter = document.getElementById('token-meter');
      const tokenCount = document.getElementById('token-count');

      let currentAgentMsg = null;
      let isAgentWorking = false;

      // Auto-resize textarea
      inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
      });

      // Send on Enter, newline on Shift+Enter
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      sendBtn.addEventListener('click', sendMessage);

      newSessionBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'newSession' });
      });

      function sendMessage() {
        const text = inputEl.value.trim();
        if (!text || isAgentWorking) return;

        vscode.postMessage({ type: 'sendPrompt', text });
        inputEl.value = '';
        inputEl.style.height = 'auto';
      }

      function addMessage(role, content) {
        if (welcomeEl) welcomeEl.style.display = 'none';

        const el = document.createElement('div');
        el.className = 'message ' + role;

        const label = document.createElement('div');
        label.className = 'message-label';
        label.textContent = role === 'user' ? '👤 You' : role === 'agent' ? '🤖 EchoCoder' : role === 'tool' ? '🔧 Tool' : '❌ Error';

        const body = document.createElement('div');
        body.innerHTML = simpleMarkdown(content);

        el.appendChild(label);
        el.appendChild(body);
        messagesEl.appendChild(el);
        scrollToBottom();
        return el;
      }

      function startAgentMessage() {
        if (welcomeEl) welcomeEl.style.display = 'none';
        currentAgentMsg = addMessage('agent', '');
        isAgentWorking = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Stop';
        sendBtn.onclick = () => vscode.postMessage({ type: 'cancelRequest' });
      }

      function appendToAgentMessage(text) {
        if (!currentAgentMsg) startAgentMessage();
        const body = currentAgentMsg.querySelector('div:last-child');
        body.innerHTML = simpleMarkdown((body._rawText || '') + text);
        body._rawText = (body._rawText || '') + text;
        scrollToBottom();
      }

      function endAgentMessage() {
        currentAgentMsg = null;
        isAgentWorking = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        sendBtn.onclick = sendMessage;
      }

      function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function simpleMarkdown(text) {
        if (!text) return '';
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\`\`\`(\\w*)\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
          .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
          .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
          .replace(/\\n/g, '<br>');
      }

      // Handle messages from extension host
      window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.type) {
          case 'userMessage':
            addMessage('user', msg.text);
            break;
          case 'agentThinking':
            startAgentMessage();
            appendToAgentMessage('*Thinking...*');
            break;
          case 'streamChunk':
            if (!currentAgentMsg) startAgentMessage();
            // Clear "Thinking..." on first real chunk
            if (currentAgentMsg.querySelector('div:last-child')._rawText === '*Thinking...*') {
              currentAgentMsg.querySelector('div:last-child')._rawText = '';
              currentAgentMsg.querySelector('div:last-child').innerHTML = '';
            }
            appendToAgentMessage(msg.text);
            break;
          case 'toolProgress':
            addMessage('tool', '🔧 Running: ' + msg.tool + '(' + JSON.stringify(msg.input).substring(0, 100) + '...)');
            break;
          case 'toolResult':
            addMessage('tool', (msg.isError ? '❌ ' : '✅ ') + msg.output.substring(0, 300));
            break;
          case 'fileChange':
            addMessage('tool', (msg.action === 'create' ? '📄 Created: ' : '✏️ Edited: ') + msg.path);
            break;
          case 'usageUpdate':
            tokenMeter.style.display = 'block';
            tokenCount.textContent = (msg.inputTokens + msg.outputTokens).toLocaleString();
            break;
          case 'agentComplete':
            endAgentMessage();
            break;
          case 'agentError':
            endAgentMessage();
            addMessage('error', msg.error);
            break;
          case 'agentCancelled':
            endAgentMessage();
            addMessage('error', 'Request cancelled.');
            break;
          case 'sessionCleared':
            messagesEl.innerHTML = '';
            if (welcomeEl) {
              messagesEl.appendChild(welcomeEl);
              welcomeEl.style.display = 'flex';
            }
            tokenMeter.style.display = 'none';
            endAgentMessage();
            break;
        }
      });

      // Focus input on load
      inputEl.focus();
    </script>
</body>
</html>`;
    }
    dispose() {
        // Cleanup handled by VS Code
    }
}
exports.AgentPanelProvider = AgentPanelProvider;
AgentPanelProvider.viewType = 'echocoder.agentPanel';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
