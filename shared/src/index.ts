/**
 * Shared Package Entry Point
 * Exports all types, utilities, and services
 */

// Types
export * from './types';

// API Clients (main exports)
export * from './api-client/llm';
export * from './api-client/tts';
export * from './api-client/avatar';

// Utilities
export * from './utils/constants';
export * from './skin';

// Avatar Services (commented out for smoke test)
// export * from './avatar/lightLipSync';

// Voice Chat Services (unified hook)
export * from './voice/useVoiceChat';

// Coaching Rules
export * from './coaching/rules';
