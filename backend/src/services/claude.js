const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/database');

const ALZHEIMER_RULES = fs.readFileSync(
  path.join(__dirname, '../../ALZHEIMER_RULES.md'),
  'utf8'
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Hebrew: עזרה=help, חירום=emergency, כואב=hurts, נפלתי=I fell, סכנה=danger
// Hebrew: אבוד/ה=lost, מפוחד/ת=scared, לא יודע/ת=don't know, איפה אני=where am I, לבד=alone, לא זוכר/ת=can't remember
const EMERGENCY_KEYWORDS = [
  'emergency', 'help', 'hurt', 'pain', 'fell', 'danger', 'please help',
  'עזרה', 'חירום', 'כואב', 'כואבת', 'נפלתי', 'סכנה', 'עזרו לי',
];
const CONFUSION_KEYWORDS = [
  'lost', 'scared', "don't know", 'dont know', 'where am i', 'confused',
  'frightened', 'afraid', 'alone', "can't remember", 'cant remember',
  'אבוד', 'אבודה', 'מפוחד', 'מפוחדת', 'לא יודע', 'לא יודעת',
  'איפה אני', 'בלבול', 'לבד', 'לא זוכר', 'לא זוכרת',
];

function detectState(message) {
  const lowerMessage = message.toLowerCase();
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lowerMessage.includes(keyword)) return 'emergency';
  }
  for (const keyword of CONFUSION_KEYWORDS) {
    if (lowerMessage.includes(keyword)) return 'confused';
  }
  return 'normal';
}

function buildSystemPrompt(context) {
  const name = context?.name || 'the patient';
  const age = context?.age || 'unknown age';
  const address = context?.address || 'address not provided';
  const dailyRoutine = context?.daily_routine || 'routine not specified';

  let familyStr = 'not specified';
  if (context?.family) {
    try {
      const family = JSON.parse(context.family);
      if (Array.isArray(family) && family.length > 0) {
        familyStr = family.map(f => `${f.name} (${f.relation})`).join(', ');
      }
    } catch {
      familyStr = context.family;
    }
  }

  let medicationsStr = 'none specified';
  if (context?.medications) {
    try {
      const meds = JSON.parse(context.medications);
      if (Array.isArray(meds) && meds.length > 0) {
        medicationsStr = Array.isArray(meds) && typeof meds[0] === 'string'
          ? meds.join(', ')
          : meds.map(m => `${m.name} ${m.dosage} (${m.time})`).join(', ');
      }
    } catch {
      medicationsStr = context.medications;
    }
  }

  const baselineRules = context?.baseline_rules || 'Speak slowly and clearly. Be patient and reassuring.';

  return `You are ReMind, a gentle and calm AI assistant helping ${name}.

IMPORTANT: Always respond in Hebrew, regardless of what language the patient uses.

Patient context:
- Name: ${name}
- Age: ${age}
- Home address: ${address}
- Daily routine: ${dailyRoutine}
- Family: ${familyStr}
- Medications (for context only — never mention these to the patient): ${medicationsStr}

Caregiver instructions: ${baselineRules}

---

${ALZHEIMER_RULES}`;
}

async function getConversationHistory(conversationId, limit = 20) {
  const db = getDb();
  const messages = db.prepare(`
    SELECT role, content FROM messages
    WHERE conversation_id = ?
    ORDER BY timestamp ASC LIMIT ?
  `).all(conversationId, limit);

  return messages.map(msg => ({ role: msg.role, content: msg.content }));
}

async function chat({ patientId, message, conversationId }) {
  const db = getDb();

  const context = db.prepare('SELECT * FROM patient_context WHERE patient_id = ?').get(patientId);
  const systemPrompt = buildSystemPrompt(context);

  let history = [];
  if (conversationId) {
    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND patient_id = ?').get(conversationId, patientId);
    if (conversation) {
      history = await getConversationHistory(conversationId);
    }
  }

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ],
  });

  const assistantMessage = response.choices[0]?.message?.content || 'I am here to help you.';
  const detectedState = detectState(message);

  return { assistantMessage, detectedState };
}

module.exports = { chat, detectState };
