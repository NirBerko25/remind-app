require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { setupDatabase } = require('./db/database');

// Route imports
const chatRouter = require('./routes/chat');
const transcribeRouter = require('./routes/transcribe');
const sosRouter = require('./routes/sos');
const historyRouter = require('./routes/history');
const contextRouter = require('./routes/context');
const patientsRouter = require('./routes/patients');
const devicesRouter = require('./routes/devices');
const songRouter = require('./routes/song');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/chat', chatRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/sos', sosRouter);
app.use('/api/conversations', historyRouter);
app.use('/api/context', contextRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/song', songRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
setupDatabase();

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     ReMind Backend Server            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ missing ANTHROPIC_API_KEY'}`);
  console.log(`  OpenAI API:    ${process.env.OPENAI_API_KEY ? '✓ configured' : '⚠ missing (transcription disabled)'}`);
  console.log('');
});

module.exports = app;
