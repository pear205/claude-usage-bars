import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])
const context = atom({ plugin: 'usage-bars', key: 'context' } as const, null as number | null)
const costUsd = atom({ plugin: 'usage-bars', key: 'costUsd' } as const, null as number | null)
const startedAt = atom({ plugin: 'usage-bars', key: 'startedAt' } as const, null as number | null)
// 분 단위 시계: 바뀔 때마다 다시 그려서 초기화·경과 시간을 응답 없이도 갱신
const minute = atom({ plugin: 'usage-bars', key: 'minute' } as const, 0)

const WIDTH = 8
const SEP = '  │  '
const ROWS: { kind: string; label: string }[] = [
  { kind: 'five_hour', label: '5h' },
  { kind: 'seven_day', label: '주' },
]
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function bar(pct: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((pct / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function colorFor(pct: number): 'success' | 'warning' | 'error' {
  return pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success'
}

// 초기화 시각: 오늘이면 ↻15:30, 다른 날이면 ↻목 15:30
function resetText(at: number, now: number): string {
  const d = new Date(at)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = d.toDateString() === new Date(now).toDateString()
  return ` ↻${sameDay ? '' : WEEKDAYS[d.getDay()] + ' '}${hm}`
}

function elapsedText(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  return min >= 60 ? `⏱${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}m` : `⏱${min}m`
}

// 터미널 칸 수: 한글은 2칸
function cols(s: string): number {
  let n = 0
  for (const ch of s) n += /[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? 2 : 1
  return n
}

type Cell = { key: string; label: string; pct?: number; reset?: string; text?: string }

function cellText(c: Cell, withBar: boolean): string {
  if (c.pct === undefined) return c.text ?? ''
  return `${c.label} ${Math.round(c.pct)}%${withBar ? ' ' + bar(c.pct) : ''}${c.reset ?? ''}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits.map(r => ({ ...r })))
    await update($, context, () => usage.context.percent ?? null)
    await update($, costUsd, () => usage.cost?.usd ?? null)
    await update($, startedAt, () => usage.startedAt)
    $.clock.every(15000, async () => {
      const m = Math.floor((await $.clock.now()) / 60000)
      await update($, minute, prev => (prev === m ? prev : m))
    })
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits.map(r => ({ ...r })))
    }
    if (e.changed.includes('context')) {
      await update($, context, () => e.context.percent ?? null)
    }
    if (e.changed.includes('cost')) {
      await update($, costUsd, () => e.cost?.usd ?? null)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const all = await read($, limits)
    const ctx = await read($, context)
    const cost = await read($, costUsd)
    const started = await read($, startedAt)
    await read($, minute)
    const now = await $.clock.now()

    const cells: Cell[] = []
    if (ctx !== null) cells.push({ key: 'ctx', label: 'ctx', pct: ctx })
    for (const r of ROWS) {
      const lim = all.find(l => l.kind === r.kind)
      if (!lim) continue
      const at = lim.resetsAt ? Date.parse(lim.resetsAt) : NaN
      // 초기화 시각이 지났으면 다음 응답 전이라도 0%
      const passed = Number.isFinite(at) && at <= now
      cells.push({
        key: r.kind,
        label: r.label,
        pct: passed ? 0 : lim.percentUsed,
        reset: Number.isFinite(at) && !passed ? resetText(at, now) : '',
      })
    }
    if (cells.length === 0) return next(e)
    if (cost !== null) cells.push({ key: 'cost', label: '', text: `$${cost.toFixed(2)}` })
    if (started !== null) cells.push({ key: 'elapsed', label: '', text: elapsedText(now - started) })

    // 한 줄에 안 들어가면 바를 빼고 숫자만
    const full = cells.map(c => cellText(c, true)).join(SEP)
    const withBar = cols(full) <= e.props.bodyColumns

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" justifyContent="flex-end" width={e.props.bodyColumns}>
        <Text wrap="truncate-start">
          {cells.map((c, i) => (
            <Text key={c.key}>
              {i > 0 ? <Text dimColor>{SEP}</Text> : null}
              {c.pct === undefined ? (
                <Text dimColor>{c.text}</Text>
              ) : (
                <Text>
                  <Text dimColor>{c.label} </Text>
                  <Text bold color={colorFor(c.pct)}>{Math.round(c.pct)}%</Text>
                  {withBar ? <Text color={colorFor(c.pct)} dimColor>{' ' + bar(c.pct)}</Text> : null}
                  <Text dimColor>{c.reset}</Text>
                </Text>
              )}
            </Text>
          ))}
        </Text>
      </Box>
    )
  })
}
