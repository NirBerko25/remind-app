const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { sendSOSNotifications } = require('../services/notifications');
const { addClient, removeClient, emitToPatient } = require('../services/sseManager');

const router = express.Router();

// POST /api/sos
router.post('/', async (req, res) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const db = getDb();

    // Verify patient exists
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create SOS event record
    const sosId = uuidv4();
    db.prepare(
      'INSERT INTO sos_events (id, patient_id) VALUES (?, ?)'
    ).run(sosId, patientId);

    // Get patient name for notifications
    const patientName = patient?.name || 'Patient';

    // Push via Expo (native devices)
    const notificationsSent = await sendSOSNotifications(patientId);

    // Push via SSE (browser/web caregivers)
    const sseSent = emitToPatient(patientId, 'sos', {
      patientId,
      patientName,
      triggeredAt: Date.now(),
      message: `SOS Alert: ${patientName} needs help!`,
    });

    // Update the SOS event with notifications sent count
    db.prepare(
      'UPDATE sos_events SET notifications_sent = ? WHERE id = ?'
    ).run(notificationsSent + sseSent, sosId);

    console.log(`[SOS] Event for patient ${patientId} — push: ${notificationsSent}, SSE: ${sseSent}`);

    return res.json({
      success: true,
      notificationsSent,
    });
  } catch (err) {
    console.error('[SOS] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// GET /api/sos/stream?patientId=xxx  — SSE endpoint for caregiver browsers
router.get('/stream', (req, res) => {
  const { patientId } = req.query;
  if (!patientId) {
    return res.status(400).json({ error: 'patientId query param is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  addClient(patientId, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(patientId, res);
  });
});

// GET /api/sos/alerts  — alert history for caregiver view
router.get('/alerts', (req, res) => {
  try {
    const db = getDb();
    const alerts = db.prepare(`
      SELECT s.id, s.patient_id, s.triggered_at, s.notifications_sent, s.resolved_at, p.name as patient_name
      FROM sos_events s
      JOIN patients p ON p.id = s.patient_id
      ORDER BY s.triggered_at DESC
      LIMIT 50
    `).all();
    return res.json(alerts.map(a => ({ ...a, resolved: !!a.resolved_at })));
  } catch (err) {
    console.error('[SOS] Alerts fetch error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/sos/alerts/:id/resolve  — mark an alert as handled
router.patch('/alerts/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const alert = db.prepare('SELECT id, resolved_at FROM sos_events WHERE id = ?').get(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    db.prepare('UPDATE sos_events SET resolved_at = ? WHERE id = ?').run(Date.now(), id);
    console.log(`[SOS] Alert ${id} marked as resolved`);
    return res.json({ success: true });
  } catch (err) {
    console.error('[SOS] Resolve error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
