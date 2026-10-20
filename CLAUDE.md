# usage-bars (Claude Code mod)

- 구조: `.claude-plugin/plugin.json`(매니페스트), `.claude-plugin/marketplace.json`(이 저장소 자체가 마켓플레이스), `hooks/hooks.json` → `hooks/register.tsx`(훅 모듈), `types/index.d.ts`(`$.state` 계약)
- 데이터: `$.session.usage().rateLimits` / `session.measure` 이벤트의 `rateLimits` — `kind` 는 `five_hour`, `seven_day`, `percentUsed` 0~100, `resetsAt` ISO
- 그리기: `ui.render` 의 `AbovePrompt` (terminal, desktop 에서만 그려짐). 요소는 `$.ui.resolve(e)` 로 받음
- API 타입: 엔진이 로드하면 `.claude-plugin/types/` 에 생성됨 (gitignore). 거기서 grep
- 수정 후 `claude plugin validate .` 통과 확인
- 배포: 변경할 때마다 묻지 말고 `bash scripts/release.sh "커밋 메시지"` 실행 (version patch 올림 → validate → commit → push → `claude plugin update`). 기능 추가면 두 번째 인자 `minor`. Claude 앱 재시작은 하지 않음 (현재 세션이 끊김) — 새 세션부터 반영된다고 안내
