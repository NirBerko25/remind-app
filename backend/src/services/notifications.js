const { getDb } = require('../db/database');

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

async function sendExpoNotification(token, title, body) {
  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data: { type: 'sos' },
  };

  const response = await fetch(EXPO_PUSH_API, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const data = await response.json();
  return data;
}

async function sendSOSNotifications(patientId) {
  const db = getDb();

  // Get patient name
  const patient = db.prepare('SELECT name FROM patients WHERE id = ?').get(patientId);
  const patientName = patient?.name || 'Patient';

  // Get all caregiver devices for this patient
  const caregiverDevices = db.prepare(`
    SELECT expo_push_token FROM devices
    WHERE patient_id = ? AND role = 'caregiver'
  `).all(patientId);

  if (caregiverDevices.length === 0) {
    return 0;
  }

  const title = 'SOS Alert';
  const body = `SOS Alert: ${patientName} needs help!`;

  const notificationPromises = caregiverDevices.map(device =>
    sendExpoNotification(device.expo_push_token, title, body).catch(err => {
      console.error(`[Notifications] Failed to send to token ${device.expo_push_token}:`, err.message);
      return null;
    })
  );

  const results = await Promise.all(notificationPromises);
  const successCount = results.filter(r => r !== null).length;

  console.log(`[Notifications] Sent SOS to ${successCount}/${caregiverDevices.length} caregivers for patient ${patientId}`);

  return successCount;
}

module.exports = { sendSOSNotifications };
