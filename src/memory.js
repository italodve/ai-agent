// In-memory session storage using Map.
// To migrate to Redis, replace the Map operations in each method
// with equivalent Redis commands (e.g., LPUSH, LRANGE, DEL).

export class SessionMemory {
  constructor() {
    this.sessions = new Map();
  }

  getHistory(sessionId) {
    return this.sessions.get(sessionId) || [];
  }

  addMessage(sessionId, role, content) {
    const history = this.getHistory(sessionId);
    history.push({ role, content });
    this.sessions.set(sessionId, history);
  }

  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}
