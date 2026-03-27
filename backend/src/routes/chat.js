const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { chat } = require('../services/claude');

const router = express.Router();

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { patientId, message, conversationId } = req.body;

    if (!patientId || !message) {
      return res.status(400).json({ error: 'patientId and message are required' });
    }

    const db = getDb();

    // Verify patient exists
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get or create conversation
    let activeConversationId = conversationId;

    if (activeConversationId) {
      const existing = db.prepare(
        'SELECT id FROM conversations WHERE id = ? AND patient_id = ?'
      ).get(activeConversationId, patientId);

      if (!existing) {
        // Invalid conversation ID provided — create a new one
        activeConversationId = null;
      }
    }

    if (!activeConversationId) {
      activeConversationId = uuidv4();
      db.prepare(
        'INSERT INTO conversations (id, patient_id) VALUES (?, ?)'
      ).run(activeConversationId, patientId);
    }

    // Save user message
    const userMessageId = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(userMessageId, activeConversationId, 'user', message);

    // Get AI response
    const { assistantMessage, detectedState } = await chat({
      patientId,
      message,
      conversationId: activeConversationId,
    });

    // Save assistant message
    const assistantMessageId = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(assistantMessageId, activeConversationId, 'assistant', assistantMessage);

    return res.json({
      response: assistantMessage,
      conversationId: activeConversationId,
      detectedState,
    });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
