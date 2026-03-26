const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db/database');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EMERGENCY_KEYWORDS = ['emergency', 'help', 'hurt', 'pain', 'fell', 'danger', 'please help'];
const CONFUSED_KEYWORDS = ['lost', 'scared', "don't know", 'where am i', 'confused', 'frightened', 'afraid', 'alone'];

function detectState(text) {
  const lower = text.toLowerCase();
  if (EMERGENCY_KEYWORDS.some(k => lower.includes(k))) return 'emergency';
  if (CONFUSED_KEYWORDS.some(k => lower.includes(k))) return 'confused';
  return 'normal';
}

async function getAIResponse(patientId, message, conversationId = null) {
  const contextRow = db.prepare('SELECT * FROM patient_context WHERE patient_id = ?').get(patientId);
  const patientRow = db.prepare('SELECT name FROM patients WHERE id = ?').get(patientId);
  const patientName = patientRow?.name || 'the patient';

  const systemPrompt = `You are a compassionate AI companion for ${patientName}, an elderly person with Alzheimer's disease.
Your role is to provide comfort, answer questions simply, and help them feel safe and oriented.
Keep responses short (2-3 sentences max), warm, and easy to understand.
Never correct them harshly. Always reassure.${contextRow ? `\n\nPatient context: ${contextRow.notes || ''}` : ''}`;

  const messages = [{ role: 'user', content: message }];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0]?.text || '';
  const detectedState = detectState(message);

  return { response: text, detectedState };
}

module.exports = { getAIResponse };
