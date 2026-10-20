import { test, expect, mock } from 'claude-code/testing'

const NOW = Date.parse('2026-10-20T06:00:00Z') // 15:00 KST
const SURFACES = ['terminal', 'desktop'] as const

test('한 줄 표시: 초기화 지나면 0%, 비용·경과, 좁으면 바 생략', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('session.usage', async () => ({ value: {
    startedAt: NOW - 72 * 60000,
    context: { window: 200000, tokens: 84000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 63, resetsAt: '2026-10-20T06:30:00Z' },
      { kind: 'seven_day', percentUsed: 12, resetsAt: '2026-10-22T00:00:00Z' },
    ],
    cost: { usd: 1.239 },
  } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('ui.render', async ($$, e) => { const { Text } = $$.ui.resolve(e); return <Text>engine</Text> })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })

  const uis = await Promise.all(SURFACES.map(surface => $.ui.mount({
    plugin: 'usage-bars',
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, bodyColumns: 200 } as never,
  })))
  for (const ui of uis) {
    const text = (await ui.find({ type: 'Text' }))?.text ?? ''
    expect(text).toContain('ctx 42%')
    expect(text).toContain('5h 63% █████░░░ ↻15:30')
    expect(text).toContain('주 12%')
    expect(text).toContain('↻목 09:00')
    expect(text).toContain('$1.24')
    expect(text).toContain('⏱1h12m')
  }

  await clock.advance(31 * 60000)
  for (const ui of uis) {
    const text = (await ui.find({ type: 'Text' }))?.text ?? ''
    expect(text).toContain('5h 0%')
    expect(text).not.toContain('↻15:30')
    expect(text).toContain('⏱1h43m')

    await ui.redraw({ hasSurvey: false, bodyColumns: 50 } as never)
    expect((await ui.find({ type: 'Text' }))?.text ?? '').not.toContain('█')
    await ui.unmount()
  }
})
