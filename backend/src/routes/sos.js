const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendPushNotification } = require('../services/notifications');

router.post('/', async (req, res) => {
  const { patientId } = req.body;
  if (!patientId) return res.status(400).json({ error: 'patientId required' });

  try {
    const patient = db.prepare('SELECT name FROM patients WHERE id = ?').get(patientId);
    const patientName = patient?.name || 'Unknown';

    const event = db.prepare(
      'INSERT INTO sos_events (patient_id, triggered_at) VALUES (?, ?)'
    ).run(patientId, Date.now());

    const devices = db.prepare(
      "SELECT expo_push_token FROM devices WHERE patient_id = ? AND role = 'caregiver'"
    ).all(patientId);

    let notificationsSent = 0;
    for (const device of devices) {
      if (device.expo_push_token) {
        await sendPushNotification(device.expo_push_token, {
          title: 'SOS Alert',
          body: `${patientName} needs help!`,
        });
        notificationsSent++;
      }
    }

    res.json({ success: true, notificationsSent });
  } catch (err) {
    console.error('[SOS]', err);
    res.status(500).json({ error: 'SOS failed' });
  }
});

router.get('/alerts', (req, res) => {
  try {
    const alerts = db.prepare(`
      SELECT s.id, s.patient_id, s.triggered_at, s.notifications_sent, p.name as patient_name
      FROM sos_events s
      LEFT JOIN patients p ON s.patient_id = p.id
      ORDER BY s.triggered_at DESC
    `).all();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

module.exports = router;
