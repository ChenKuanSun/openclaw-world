interface ChatLogAPI {
  addMessage(agentId: string, text: string): void;
  addSystem(text: string): void;
}

/**
 * Scrollable chat log panel (bottom-left).
 * Shows broadcast messages and system events.
 */
export function setupChatLog(): ChatLogAPI {
  const container = document.getElementById("chat-log")!;

  const titleEl = document.createElement("div");
  titleEl.className = "chat-title";
  titleEl.textContent = "World Chat";
  container.appendChild(titleEl);

  const messagesEl = document.createElement("div");
  messagesEl.className = "chat-messages";
  container.appendChild(messagesEl);

  function addEntry(className: string, content: string): void {
    const el = document.createElement("div");
    el.className = `chat-entry ${className}`;
    el.textContent = content;
    messagesEl.appendChild(el);

    // Keep max 100 entries
    while (messagesEl.children.length > 100) {
      messagesEl.removeChild(messagesEl.firstChild!);
    }

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  return {
    addMessage(agentId: string, text: string) {
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      addEntry("chat-msg", `[${time}] ${agentId}: ${text}`);
    },
    addSystem(text: string) {
      addEntry("chat-system", `— ${text}`);
    },
  };
}
