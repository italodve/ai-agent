const MAX_MESSAGE_LENGTH = 1000;

export function validateChatInput(body) {
  const { sessionId, message } = body || {};

  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'sessionId is required and must be a string' };
  }

  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'message is required and must be a string' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }

  return { valid: true };
}
