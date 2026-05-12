// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — Backend: Location Breach Reporting
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { sendBreachNotifications } = require('../services/notifications');
const { emitToPatient } = require('../services/sseManager');

const router = express.Router();

// POST /api/location/breach
// Called by the patient device when they exit all safe zones.
router.post('/breach', async (req, res) => {
  try {
    const { patientId, latitude, longitude } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    const db = getDb();
    const patient = db.prepare('SELECT id, name FROM patients WHERE id = ?').get(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const id = uuidv4();
    db.prepare(
      'INSERT INTO location_breaches (id, patient_id, latitude, longitude) VALUES (?, ?, ?, ?)'
    ).run(id, patientId, latitude ?? null, longitude ?? null);

    const notificationsSent = await sendBreachNotifications(patientId);

    emitToPatient(patientId, 'location_breach', {
      patientId,
      patientName: patient.name,
      latitude,
      longitude,
      triggeredAt: Date.now(),
      message: `${patient.name} may have left their safe zone.`,
    });

    db.prepare('UPDATE location_breaches SET notifications_sent = ? WHERE id = ?')
      .run(notificationsSent, id);

    console.log(`[Location] Breach for patient ${patientId} — notified ${notificationsSent} caregivers`);
    return res.json({ success: true, notificationsSent });
  } catch (err) {
    console.error('[Location] Breach error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/location/breaches?patientId=xxx
router.get('/breaches', (req, res) => {
  try {
    const { patientId } = req.query;
    const db = getDb();
    const query = patientId
      ? `SELECT b.*, p.name as patient_name FROM location_breaches b
         JOIN patients p ON p.id = b.patient_id
         WHERE b.patient_id = ?
         ORDER BY b.triggered_at DESC LIMIT 50`
      : `SELECT b.*, p.name as patient_name FROM location_breaches b
         JOIN patients p ON p.id = b.patient_id
         ORDER BY b.triggered_at DESC LIMIT 50`;

    const breaches = patientId
      ? db.prepare(query).all(patientId)
      : db.prepare(query).all();

    return res.json(breaches);
  } catch (err) {
    console.error('[Location] Breaches fetch error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
