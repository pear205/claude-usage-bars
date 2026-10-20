# usage-bars

Claude Code mod — 5시간 / 주간 사용 한도를 프롬프트 위에 가로 바로 표시합니다.

```
5시간 ██████░░░░░░░░░░░░░░ 31% · 2시간 14분 후 초기화
주간  ███████████████░░░░░ 76% · 3일 5시간 후 초기화
```

- 70% 미만 초록 / 70~89% 노랑 / 90% 이상 빨강
- 턴이 끝날 때, 한도가 1%p 움직일 때 갱신 (`session.measure`)
- 세션 시작 직후 첫 응답 전에는 값이 없어 표시되지 않을 수 있음
- 구독 플랜에서만 한도 값이 옵니다

## 설치

터미널:

```
/plugin install usage-bars --marketplace pear205/claude-usage-bars
```

데스크탑 앱 Code 탭: 프롬프트 옆 **+ → Plugins → Add marketplace** 에 `pear205/claude-usage-bars` 입력 → **Add plugin**

## 개발

```
claude --plugin-dir .          # 이 폴더를 바로 로드, 저장 시 핫리로드
claude plugin validate .       # 엔진 기준 검사
```

수정 후 배포: `plugin.json` 의 `version` 올리고 push → 설치한 쪽에서 `claude plugin update usage-bars` 후 `/reload-plugins`.
