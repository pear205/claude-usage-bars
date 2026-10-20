import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])

const WIDTH = 20
const ROWS: { kind: string; label: string }[] = [
  { kind: 'five_hour', label: '5시간' },
  { kind: 'seven_day', label: '주간 ' },
]

function bar(pct: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((pct / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function colorFor(pct: number): 'success' | 'warning' | 'error' {
  return pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success'
}

function resetText(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  const left = d > 0 ? `${d}일 ${h}시간` : h > 0 ? `${h}시간 ${m}분` : `${m}분`
  return ` · ${left} 후 초기화`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits.map(r => ({ ...r })))
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits.map(r => ({ ...r })))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const all = await read($, limits)
    const shown = ROWS.map(r => ({ ...r, lim: all.find(l => l.kind === r.kind) }))
    if (shown.every(r => !r.lim)) return next(e)

    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {shown.map(({ kind, label, lim }) =>
          lim ? (
            <Text key={kind}>
              <Text dimColor>{label} </Text>
              <Text color={colorFor(lim.percentUsed)}>{bar(lim.percentUsed)}</Text>
              <Text> {Math.round(lim.percentUsed)}%</Text>
              <Text dimColor>{resetText(lim.resetsAt, now)}</Text>
            </Text>
          ) : (
            <Text key={kind} dimColor>{label} 아직 측정값 없음</Text>
          ),
        )}
      </Box>
    )
  })
}
