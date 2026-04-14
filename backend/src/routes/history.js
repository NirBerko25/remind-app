const express = require('express');
const { getDb } = require('../db/database');

const router = express.Router();

// GET /api/conversations/detail/:conversationId
router.get('/detail/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const db = getDb();

    const conversation = db.prepare('SELECT id, patient_id, started_at FROM conversations WHERE id = ?').get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = db.prepare(`
      SELECT role, content, timestamp
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `).all(conversationId);

    return res.json({
      id: conversation.id,
      patientId: conversation.patient_id,
      startedAt: conversation.started_at,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    });
  } catch (err) {
    console.error('[History] Detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// GET /api/conversations/summary/:conversationId
router.get('/summary/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const db = getDb();

    const conversation = db.prepare('SELECT id, patient_id, tldr, summary FROM conversations WHERE id = ?').get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Return cached summary if it exists
    if (conversation.tldr && conversation.summary) {
      return res.json({ tldr: conversation.tldr, summary: conversation.summary, cached: true });
    }

    const messages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `).all(conversationId);

    if (messages.length === 0) {
      return res.json({ tldr: 'Empty conversation.', summary: 'No messages in this conversation.' });
    }

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 250,
      messages: [
        {
          role: 'system',
          content: 'You are a medical assistant summarizing conversations between an Alzheimer\'s patient and their AI companion. Respond with JSON only in this exact format: {"tldr": "one sentence max 12 words", "summary": "2-3 sentences for caregiver noting mood, confusion/distress, key topics"}',
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    let tldr = 'No summary available.';
    let summary = 'No summary available.';
    try {
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      tldr = parsed.tldr || tldr;
      summary = parsed.summary || summary;
    } catch {}

    // Cache in DB
    db.prepare('UPDATE conversations SET tldr = ?, summary = ? WHERE id = ?').run(tldr, summary, conversationId);

    return res.json({ tldr, summary, cached: false });
  } catch (err) {
    console.error('[Summary] Error:', err.message);
    return res.status(500).json({ error: 'Could not generate summary', details: err.message });
  }
});

// GET /api/conversations/:patientId
router.get('/:patientId', (req, res) => {
  try {
    const { patientId } = req.params;

    const db = getDb();

    // Verify patient exists
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get all conversations for the patient
    const conversations = db.prepare(`
      SELECT id, started_at
      FROM conversations
      WHERE patient_id = ?
      ORDER BY started_at DESC
    `).all(patientId);

    // For each conversation, get its messages
    const result = conversations.map(conv => {
      const messages = db.prepare(`
        SELECT role, content, timestamp
        FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `).all(conv.id);

      return {
        id: conv.id,
        startedAt: conv.started_at,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('[History] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
