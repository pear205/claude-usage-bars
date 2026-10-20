import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])
const context = atom({ plugin: 'usage-bars', key: 'context' } as const, null as number | null)

const WIDTH = 8
const ROWS: { kind: string; label: string }[] = [
  { kind: 'five_hour', label: '5h' },
  { kind: 'seven_day', label: '주' },
]

function bar(pct: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((pct / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function colorFor(pct: number): 'success' | 'warning' | 'error' {
  return pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success'
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 초기화 시각: 오늘이면 ↻15:30, 다른 날이면 ↻목 15:30
function resetText(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const at = Date.parse(resetsAt)
  if (!Number.isFinite(at) || at <= now) return ''
  const d = new Date(at)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = d.toDateString() === new Date(now).toDateString()
  return ` ↻${sameDay ? '' : WEEKDAYS[d.getDay()] + ' '}${hm}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits.map(r => ({ ...r })))
    await update($, context, () => usage.context.percent ?? null)
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits.map(r => ({ ...r })))
    }
    if (e.changed.includes('context')) {
      await update($, context, () => e.context.percent ?? null)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const all = await read($, limits)
    const ctx = await read($, context)
    const shown = ROWS.flatMap(r => {
      const lim = all.find(l => l.kind === r.kind)
      return lim ? [{ ...r, lim }] : []
    })
    if (shown.length === 0 && ctx === null) return next(e)

    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)

    const cells = [
      ...(ctx !== null ? [{ key: 'ctx', label: 'ctx', pct: ctx, reset: '' }] : []),
      ...shown.map(({ kind, label, lim }) => ({
        key: kind,
        label,
        pct: lim.percentUsed,
        reset: resetText(lim.resetsAt, now),
      })),
    ]

    return (
      <Box flexDirection="row" justifyContent="flex-end" width={e.props.bodyColumns}>
        <Text>
          {cells.map((c, i) => (
            <Text key={c.key}>
              {i > 0 ? <Text dimColor>{'  │  '}</Text> : null}
              <Text dimColor>{c.label} </Text>
              <Text bold color={colorFor(c.pct)}>{Math.round(c.pct)}%</Text>
              <Text> </Text>
              <Text color={colorFor(c.pct)} dimColor>{bar(c.pct)}</Text>
              <Text dimColor>{c.reset}</Text>
            </Text>
          ))}
        </Text>
      </Box>
    )
  })
}
