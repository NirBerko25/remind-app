/**
 * Simple SSE (Server-Sent Events) manager.
 * Tracks active browser connections keyed by patientId + role so
 * the SOS route can push real-time alerts to caregiver browser tabs.
 */

// Map<patientId, Set<res>>
const clients = new Map();

function addClient(patientId, res) {
  if (!clients.has(patientId)) {
    clients.set(patientId, new Set());
  }
  clients.get(patientId).add(res);
  console.log(`[SSE] Caregiver connected for patient ${patientId} (total: ${clients.get(patientId).size})`);
}

function removeClient(patientId, res) {
  const set = clients.get(patientId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(patientId);
  }
  console.log(`[SSE] Caregiver disconnected for patient ${patientId}`);
}

function emitToPatient(patientId, event, data) {
  const set = clients.get(patientId);
  if (!set || set.size === 0) return 0;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (const res of set) {
    try {
      res.write(payload);
      sent++;
    } catch (err) {
      console.error('[SSE] Failed to write to client:', err.message);
      set.delete(res);
    }
  }
  return sent;
}

module.exports = { addClient, removeClient, emitToPatient };
