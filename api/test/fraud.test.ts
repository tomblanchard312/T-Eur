import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/index.js'
import fs from 'fs'
import path from 'path'

const ALERTS_LOG = path.join(process.cwd(), 'logs', 'alerts.jsonl')

beforeAll(() => {
  process.env.ADMIN_OVERRIDE_TOKEN = 'test-token'
  // ensure logs dir exists and is empty
  const dir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  if (fs.existsSync(ALERTS_LOG)) fs.unlinkSync(ALERTS_LOG)
})

describe('fraud endpoints', () => {
  it('creates an alert for high amount', async () => {
    const tx = { amount: 200000, from: '0xabc', to: '0xdef' }
    const res = await request(app).post('/api/v1/fraud/analyze').send(tx)
    expect([201, 204]).toContain(res.status)
    if (res.status === 201) {
      expect(res.body).toHaveProperty('id')
    }
  })

  it('can override an alert', async () => {
    // create alert first
    const tx = { amount: 200000, from: '0xaaa', to: '0xbbb' }
    const create = await request(app).post('/api/v1/fraud/analyze').send(tx)
    if (create.status !== 201) return
    const id = create.body.id

    const override = await request(app)
      .post(`/api/v1/fraud/alerts/${id}/override`)
      .set('Authorization', 'Bearer test-token')
      .send({ agent_id: 'cs-agent-1', reason: 'tested override' })

    expect(override.status).toBe(200)
    expect(override.body.updated).toBeDefined()
    expect(override.body.updated.status).toBe('overridden')
  })
})
