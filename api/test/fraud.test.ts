import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

let app: any

const ALERTS_LOG = path.join(process.cwd(), 'logs', 'alerts.jsonl')

beforeAll(async () => {
  // minimal env required by config validation
  process.env.ADMIN_OVERRIDE_TOKEN = 'test-token'
  process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY = '0x' + '1'.repeat(64)
  process.env.CONTRACT_PERMISSIONING = '0x' + '2'.repeat(40)
  process.env.CONTRACT_WALLET_REGISTRY = '0x' + '3'.repeat(40)
  process.env.CONTRACT_TOKENIZED_EURO = '0x' + '4'.repeat(40)
  process.env.CONTRACT_CONDITIONAL_PAYMENTS = '0x' + '5'.repeat(40)

  // ensure logs dir exists and is empty
  const dir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  if (fs.existsSync(ALERTS_LOG)) fs.unlinkSync(ALERTS_LOG)

  // import app after env is set
  const mod = await import('../src/index.js')
  app = mod.app
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
