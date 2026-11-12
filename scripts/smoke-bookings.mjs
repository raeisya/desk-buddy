#!/usr/bin/env node
// Smoke test for "take a desk" (bookings). Run against your LOCAL stack: `npm run smoke`.
// It creates and releases real bookings, so it refuses
// to run against anything but localhost unless SMOKE_ALLOW_REMOTE=1.
//
// NOTE: once login is cookie-based and the bookings API stops reading `userId` from the body,
// update `as()` below to log in first and send the cookie.

const BASE = (process.env.SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '') + '/api'
const host = new URL(BASE).hostname
if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.SMOKE_ALLOW_REMOTE !== '1') {
  console.error(`Refusing to run against ${host}: this writes bookings. Set SMOKE_ALLOW_REMOTE=1 if you really mean it.`)
  process.exit(2)
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
const as = (userId) => ({
  take: (deskId) => call('POST', '/bookings', { deskId, userId }),
  leave: (deskId) => call('POST', '/bookings/release', { deskId, userId }),
})
const floor = async () => (await call('GET', '/floor')).data.desks
const stateOf = async (id) => (await floor()).find((d) => d.id === id)?.state

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : `  → ${detail}`}`)
}
const show = (r) => `${r.status} ${typeof r.data === 'object' ? JSON.stringify(r.data) : r.data}`

const made = [] // [userId, deskId] to clean up whatever happens
async function cleanup() {
  for (const [u, d] of made) await as(u).leave(d).catch(() => {})
}

try {
  const health = await call('GET', '/health')
  if (health.status !== 200) throw new Error(`API not healthy at ${BASE}: ${show(health)}`)

  const [desks, users] = [await floor(), (await call('GET', '/users')).data]
  const owners = new Set(desks.map((d) => d.owner?.id).filter(Boolean))
  const sitting = new Set(desks.map((d) => d.occupant?.id).filter(Boolean))
  const pool = users.map((u) => u.id).filter((id) => !owners.has(id) && !sitting.has(id))
  const free = desks.filter((d) => d.state === 'available' || d.state === 'unassigned')
  if (pool.length < 3 || free.length < 3) throw new Error(`Need 3 deskless users and 3 free desks (have ${pool.length}, ${free.length})`)
  const [u1, u2, u3] = pool
  const [d1, d2, d3] = free.map((d) => d.id)

  // 1. take a free desk
  let r = await as(u1).take(d1)
  if (r.status === 201) made.push([u1, d1])
  check(`take a free desk (${u1} → ${d1})`, r.status === 201, show(r))
  check('desk shows hot-seated', (await stateOf(d1)) === 'hot-seated')

  // 2. someone else can't take it
  r = await as(u2).take(d1)
  check('second person is refused the same desk', r.status === 409, show(r))

  // 3. one desk per person
  r = await as(u1).take(d2)
  check('same person is refused a second desk', r.status === 409, show(r))

  // 4. can't release someone else's desk
  r = await as(u2).leave(d1)
  check("can't leave someone else's desk", r.status === 403, show(r))

  // 5. leave your own
  r = await as(u1).leave(d1)
  check('leave your own desk', r.status === 200, show(r))
  if (r.status === 200) made.splice(made.findIndex(([u, d]) => u === u1 && d === d1), 1)
  check('desk is free again', ['available', 'unassigned'].includes(await stateOf(d1)))

  // 6. bad input
  r = await call('POST', '/bookings', { deskId: d1 })
  check('missing userId → 400', r.status === 400, show(r))
  r = await as(u1).take('D-NOPE')
  check('unknown desk → 404', r.status === 404, show(r))

  // 7. race: two people tap the same desk at the same instant
  let badRounds = 0
  for (let i = 0; i < 10; i++) {
    const [a, b] = await Promise.all([as(u2).take(d3), as(u3).take(d3)])
    const winners = [a, b].filter((x) => x.status === 201).length
    if (winners !== 1) badRounds++
    if (a.status === 201) await as(u2).leave(d3)
    if (b.status === 201) await as(u3).leave(d3)
  }
  check('race ×10: exactly one winner every round', badRounds === 0, `${badRounds} bad round(s)`)

  // 8. an owner who's in (silent or IN_OFFICE, no booking) keeps their desk: nobody else can take it
  const ownersDesk = (await floor()).find((d) => d.state === 'occupied' && d.owner && !d.occupant)
  if (!ownersDesk) {
    console.log('⏭️  skipped "owner is in" check: no owner-occupied desk right now')
  } else {
    r = await as(u1).take(ownersDesk.id)
    if (r.status === 201) made.push([u1, ownersDesk.id])
    check(`can't take a desk whose owner is in (${ownersDesk.id})`, r.status === 409, show(r))

    // 9. that owner is already seated (no booking needed), so they can't also take a second desk
    const owner = ownersDesk.owner.id
    r = await as(owner).take(d2)
    if (r.status === 201) made.push([owner, d2])
    check(`owner already at their desk can't take another (${owner} → ${d2})`, r.status === 409, show(r))
  }

  // 11. saying you're out (WFH/MC/LEAVE/OUTSTATION — Me page or Slack) releases the desk you booked today
  for (const status of ['WFH', 'MC', 'LEAVE', 'OUTSTATION']) {
    r = await as(u1).take(d1)
    if (r.status === 201) made.push([u1, d1])
    await call('POST', '/presence', { userId: u1, status })
    const stillThere = (await floor()).some((d) => d.occupant?.id === u1)
    check(`posting ${status} releases your booking`, !stillThere)
    if (!stillThere) made.splice(made.findIndex(([u, d]) => u === u1 && d === d1), 1)
  }
  await call('POST', '/presence', { userId: u1, status: 'IN_OFFICE' }) // leave the test user "in"

  // 10. one person taps two different desks at the same instant: exactly one succeeds
  const [x, y] = await Promise.all([as(u2).take(d2), as(u2).take(d3)])
  if (x.status === 201) made.push([u2, d2])
  if (y.status === 201) made.push([u2, d3])
  const loser = x.status === 201 ? y : x
  check('same person, two desks at once: exactly one succeeds', [x, y].filter((q) => q.status === 201).length === 1, `${show(x)} | ${show(y)}`)
  check('…and the loser is told they already have a desk', /already have/.test(String(loser.data?.message ?? '')), show(loser))
} catch (e) {
  failed++
  console.error(`❌ ${e.message}`)
} finally {
  await cleanup()
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll booking checks passed')
process.exit(failed ? 1 : 0)
