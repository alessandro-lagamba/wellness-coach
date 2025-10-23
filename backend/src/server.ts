/**
 * WellnessCoach Backend - Secure API Server
 * All API keys handled server-side only
 */

import express from 'express';
import cors from 'cors';
import avatarRoutes from './routes/avatar.routes';
import chatRoutes from './routes/chat.routes';
import chatFastRoutes from './routes/chat-fast.routes';
import ttsRoutes from './routes/tts.routes';
import emotionRoutes from './routes/emotion.routes';
import skinRoutes from './routes/skin.routes';
import speechRoutes from './routes/speech.routes';
import googleSpeechRoutes from './routes/google-speech.routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'WellnessCoach Backend is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/avatar', avatarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat', chatFastRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/emotion', emotionRoutes);
app.use('/api/skin', skinRoutes);
app.use('/api/speech', speechRoutes);
app.use('/api/speech', googleSpeechRoutes);

// Basic error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WellnessCoach Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🔒 Security: API keys are server-side only`);
});
