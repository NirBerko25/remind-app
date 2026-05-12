'use strict';

jest.mock('../../src/db/database', () => ({
  setupDatabase: jest.fn(),
  getDb: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  sendSOSNotifications: jest.fn().mockResolvedValue(0),
  sendBreachNotifications: jest.fn().mockResolvedValue(2),
}));
jest.mock('../../src/services/sseManager', () => ({
  addClient: jest.fn(),
  removeClient: jest.fn(),
  emitToPatient: jest.fn().mockReturnValue(0),
}));

const request = require('supertest');
const app = require('../../src/index');
const { getDb } = require('../../src/db/database');
const { sendBreachNotifications } = require('../../src/services/notifications');
const { emitToPatient } = require('../../src/services/sseManager');

describe('POST /api/location/breach', () => {
  afterEach(() => jest.clearAllMocks());

  it('records a breach, notifies caregivers, and emits SSE', async () => {
    let callCount = 0;
    const db = {
      prepare: jest.fn(() => {
        callCount++;
        if (callCount === 1) return { get: jest.fn().mockReturnValue({ id: 'p1', name: 'Demo Patient' }) };
        return { run: jest.fn() };
      }),
    };
    getDb.mockReturnValue(db);

    const res = await request(app)
      .post('/api/location/breach')
      .send({ patientId: 'demo-patient-1', latitude: 32.2, longitude: 34.9 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notificationsSent).toBe(2);
    expect(sendBreachNotifications).toHaveBeenCalledWith('demo-patient-1');
    expect(emitToPatient).toHaveBeenCalledWith(
      'demo-patient-1',
      'location_breach',
      expect.objectContaining({ patientId: 'demo-patient-1' })
    );
  });

  it('accepts breach without latitude/longitude', async () => {
    let callCount = 0;
    const db = {
      prepare: jest.fn(() => {
        callCount++;
        if (callCount === 1) return { get: jest.fn().mockReturnValue({ id: 'p1', name: 'Demo' }) };
        return { run: jest.fn() };
      }),
    };
    getDb.mockReturnValue(db);

    const res = await request(app)
      .post('/api/location/breach')
      .send({ patientId: 'demo-patient-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when patientId is missing', async () => {
    const res = await request(app).post('/api/location/breach').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown patient', async () => {
    const db = { prepare: jest.fn(() => ({ get: jest.fn().mockReturnValue(null) })) };
    getDb.mockReturnValue(db);

    const res = await request(app)
      .post('/api/location/breach')
      .send({ patientId: 'ghost', latitude: 0, longitude: 0 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/location/breaches', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns breaches filtered by patientId', async () => {
    const fakeBreaches = [
      { id: 'b1', patient_id: 'demo-patient-1', patient_name: 'Demo Patient',
        latitude: 32.2, longitude: 34.9, triggered_at: 1000, notifications_sent: 2 },
    ];
    const db = { prepare: jest.fn(() => ({ all: jest.fn().mockReturnValue(fakeBreaches) })) };
    getDb.mockReturnValue(db);

    const res = await request(app).get('/api/location/breaches?patientId=demo-patient-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].patient_name).toBe('Demo Patient');
  });

  it('returns all breaches when no patientId filter given', async () => {
    const db = { prepare: jest.fn(() => ({ all: jest.fn().mockReturnValue([]) })) };
    getDb.mockReturnValue(db);

    const res = await request(app).get('/api/location/breaches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
