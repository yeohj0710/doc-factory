# doc-factory — AGENTS.md (v2 / LLM Copywriter 포함)

목표:
사용자가 “대충” 프롬프트를 던져도, /images + (/references) + (/fonts)만으로

- 문서 타입/분량/사이즈를 스스로 판단하고
- 레퍼런스 기반 스타일+레이아웃을 반영하며
- Web 미리보기 ↔ PPTX Export가 깨지지 않고
- 검증 통과 전엔 Export가 절대 안 되는
  범용 문서 디자이너를 **프롬프트가 아니라 코드/게이트로 강제**한다.

---

## 0) 원칙 (이 프로젝트의 핵심)

- 프롬프트는 “힌트”일 뿐. 품질/안정성은 **RequestSpec + 템플릿 + 게이트**가 만든다.
- /references는 “베끼기”가 아니라 **스타일 토큰 + 레이아웃 아키타입**에만 사용한다.
- “내용이 부족한 요청”은 질문으로 막지 않고 **fillable placeholder로 ‘완성된 형태’를 보장**한다.
- 내부 규칙/개발 용어가 최종 문서에 노출되면 실패다.
- (옵션) LLM을 써도 결과는 **캐시로 고정**해서 **동일 입력=동일 결과(deterministic)** 를 지킨다.

---

## 1) Hard Constraints (절대 규칙)

### 1.1 런타임 네트워크 금지 (기본)

- 외부 이미지/구글 폰트/원격 CSS fetch 금지
- 폰트는 `/fonts` 로컬만 사용

### 1.2 예외: LLM Copywriter (텍스트 생성 전용)

- 원격 “자산(fetch)”은 여전히 금지.
- 단, `COPYWRITER_MODE=openai`일 때 **텍스트(카피) 생성 목적의 OpenAI API 호출만 예외로 허용**한다.
- 이 호출은 **서버에서만** 실행한다(클라이언트에 키 노출 금지). API 키는 환경변수로 안전하게 로드하고, 브라우저/앱 코드에 포함시키지 않는다. (키 안전수칙: 서버 보관/비공개) :contentReference[oaicite:1]{index=1}

### 1.3 결정성(Determinism)

동일 입력이면 동일 결과여야 한다.

- 입력 = RequestSpec + ordered image ids + referenceDigest + pageSpec + variantIndex + seed + (copyDeckCacheKey)
- 시간/난수/mtime 의존 금지
- 파일 정렬은 locale-independent + numeric-aware(결정적)
- LLM 사용 시에도 **결과를 파일 캐시로 고정**해 재생성 시 재사용한다(강제).

### 1.4 페이지 사이즈 단일 소스

- DSL `widthMm/heightMm`만 진실
- Web/PPTX 모두 동일 DSL 소비(단위 변환 함수만 다름)

### 1.5 PPTX는 “편집 가능한 오브젝트” 유지

- 텍스트/도형은 가능한 한 편집 가능해야 함(전 슬라이드 스크린샷 금지)

---

## 2) Operating Modes (작업 모드)

### 2.1 DESIGN 모드 (기본)

- 목표: 새 문서/포스터 생성 품질 개선(템플릿/카피/게이트 기반)

### 2.2 MAINTENANCE 모드

- 목표: 버그/검증/Export/결정성/성능/QA 복구
- “새 디자인 만들기”보다 파이프라인 품질/안정성에 집중

### 2.3 QA 모드

- 목표: 재현 가능한 테스트/스냅샷/게이트/리포트 추가 및 통과

---

## 3) State Isolation (새 작업처럼 동작)

- requestHash(jobId) 기준으로 캐시/산출물/감사를 분리한다.
- “New Job”은 requestHash를 갱신해야 한다.
- 이전 작업 산출물이 다음 작업에 영향을 주면 버그다.

권장 디렉토리:

- `exports/<requestHash>/` : 최종 산출물(pptx/png/json/audit)
- `.cache/copy/<cacheKey>.json` : CopyDeck 캐시(또는 exports 하위로 고정 저장)

---

## 4) RequestSpec (단일 진실: Single Source of Truth)

사용자 입력(프롬프트/쿼리/폼)은 먼저 RequestSpec으로 정규화한다.
이후 Planner/Copy/Templates/Export는 **RequestSpec만 신뢰**한다.

최소 필드:

- docKind: poster | poster_set | onepager | brochure | report | cards
- pageCount: exact(N) or range(min,max)
- pageSize: A4P/A4L/Letter/Custom(mm)
- title, language(ko), tone(concise/bold/minimal…), constraints
- variantIndex, seed
- contentBrief(optional): 사용자가 준 핵심 내용(없어도 동작해야 함)

기본값(권장):

- language=ko
- pageSize=A4P
- tone=concise
- pageCount는 docKind별 안전 범위로 기본 설정(예: brochure 6~12)

---

## 5) Content Ladder (프롬프트가 짧아도 “내용 부실” 방지)

콘텐츠는 아래 우선순위로 채운다:

1. RequestSpec.contentBrief / 프롬프트 텍스트
2. 파일명/폴더명 힌트(사람 이름/역할/날짜 등) — 단, 확정적 사실로 단정하지 말 것
3. 이미지의 “무해한” 비전 태깅(장면/분위기 정도) — 신상 추론 금지
4. 부족하면 fillable placeholder로 완성 형태 유지:
   - (예) [이름] [한 줄 소개] [특징 3가지] [연락/링크(추후 기입)] 등

중요:

- 수치/성과/회사명/연락처 등은 **지어내지 말고** `(추후 기입)`으로 둔다.
- “내용이 없으면” 내부 규칙/형식 설명 문구로 채우는 것을 금지한다.

---

## 6) LLM Copywriter (옵션이지만 강력 추천)

### 6.1 목적

- poster/poster_set/onepager에서 “카피가 너무 짧아 빈약해 보이는 문제”를 구조적으로 해결한다.
- LLM은 **문구 생성(카피)** 과 (선택) **계획 제안**만 하고, 레이아웃/배치는 기존 DSL 엔진이 수행한다.

### 6.2 보안/키 관리

- 키는 서버 환경변수로만 로드한다(클라이언트 노출 금지). :contentReference[oaicite:2]{index=2}
- OpenAI 공식 TS 라이브러리 사용 시도 가능(서버): `process.env['OPENAI_API_KEY']` 패턴 권장. :contentReference[oaicite:3]{index=3}
- 로그/에러에 키가 출력되면 즉시 실패(차단).

### 6.3 Structured Outputs (JSON Schema 강제)

- LLM 출력은 “자유 텍스트”가 아니라 **JSON Schema에 맞춘 CopyDeck**으로 고정한다.
- Structured Outputs를 사용하면 JSON Schema에 맞는 구조 출력을 강제할 수 있다. :contentReference[oaicite:4]{index=4}

### 6.4 Determinism을 위한 CopyDeck 캐시 (필수)

- cacheKey = sha256(
  requestHash +
  promptVersion +
  schemaVersion +
  model +
  (optional) referencesDigest +
  (optional) imageDigest
  )
- 캐시 파일이 존재하면 **무조건 재사용**(LLM 호출 금지)
- `forceRegenerate=true`일 때만 새로 호출
- exportAudit에 아래를 기록:
  - copywriterMode(local/openai)
  - copyCacheKey, model, promptVersion, schemaVersion
  - copyDeckHash(내용 해시), store 여부

### 6.5 CopyDeck 예시 스키마(개념)

- 공통:
  - docKind, language, tone
  - pages: [ { pageIndex, role, blocks: [...] } ]
- blocks:
  - kind: headline | subhead | paragraph | bullets | callout | chips | metrics | footer
  - text / items
  - constraints: maxChars, targetChars, intent (informative/funny/cta)

**문구 생성 규칙(강제):**

- 사실(facts)에서 벗어난 정보는 생성 금지(모르면 `(추후 기입)`).
- “비하/조롱” 금지, 유쾌/사랑스러운 놀림 톤만.
- poster_set은 페이지당 최소 정보 밀도 기준을 만족하도록 작성(아래 게이트 연동).

---

## 7) References (있으면 강제 반영)

### 7.1 ReferenceIndex (변경 시에만 전체 ingest)

- references>=8이면:
  - 모든 refs를 인덱싱(reference-index.json)
  - referenceDigest 산출(결정적)
- 생성 단계에서는 “전부 다시 보기” 금지(인덱스만 사용)

### 7.2 스타일 + 레이아웃 둘 다 반영(하드)

- 스타일 토큰: 타이포 스케일/여백 밀도/라운드/스트로크/악센트 규칙
- 레이아웃 아키타입: grid columns/hero 비율/card density/rhythm/header-footer 비율
- 1:1 좌표 복제 금지

### 7.3 Reference Usage Gate (증명 없으면 Export 차단)

references>=8이면 Export는 아래 없으면 무조건 차단:

- referenceIndexStatus=fresh
- styleSource=references
- layoutSource=references
- usedLayoutClusters >= required (1~2p는 ≥2, 멀티페이지는 ≥3)
- exportAudit에 referenceUsageReport 포함

---

## 8) Templates (패턴 패밀리 12~20 + 파라미터)

- 업종별 템플릿 금지. 패턴 패밀리 기반으로만 확장한다.
- poster 계열은 “큰 타이포 + 짧은 문장 + 강한 배경/컬러블록”을 기본으로 한다.
- “모든 페이지가 같은 템플릿 반복” 금지:
  - 동일 패밀리 연속 사용 제한
  - full-bleed 과다 사용 제한(예: 40% 이하)

poster_set/onepager에서 “텍스트 부족”이 반복되면:

- 템플릿 풀을 “텍스트 밀도 높은 패턴”으로 편향시키고,
- 단일 대형 이미지 중심 패턴의 우선순위를 낮춘다.

---

## 9) 파이프라인 (항상 이 순서)

1. Parse → RequestSpec 확정 (UI에 표시)
2. Scan assets (deterministic ordering)
3. Build ReferenceIndex(필요 시)
4. Build Facts + CopySlots (docKind/role별 슬롯 생성)
5. Copywriter:
   - local: 룰/placeholder 기반
   - openai: CopyDeck JSON 생성 + 캐시 저장 (Structured Outputs)
6. Planner: storyboard (page roles + template families + copy budgets)
7. Generate DSL pages (template params from archetypes + CopyDeck 채움)
8. Static Validation (DSL)
9. Runtime Validation (webapp-testing 우선)
10. Export Audit (proof 포함)
11. Export (PPTX) — 모든 게이트 PASS 전까지 금지

---

## 10) Validation Gates (Export 차단 필수)

정적(DSL):

- boundary / collision / reserved lanes / min readable size / layering / determinism

런타임(Web):

- overflow / clip / overlap

추가 “품질 게이트”(필수):

- 내부 용어 누수 금지:
  - RequestSpec/variantIndex/referenceDigest/layout/validation/theme-factory/webapp-testing 등
  - 발견 시: 치환 또는 재생성, 해결 불가면 Export 차단
- Content Completeness: docKind별 최소 내용량 충족
- Silent truncation 금지: …/..., line-clamp, overflow hidden으로 숨기기 금지
- debugOnly는 debug=1에서만, Export에는 절대 포함 금지

### 10.1 Copy Density Gate (특히 poster_set)

- page별 최소 기준(초기값, 이후 role/docKind별 세분화):
  - text_chars >= 220
  - text_blocks >= 4
  - body_font_min_pt >= 16
- 미달이면 fail → 기존 autofix/fallback 루프가 “더 밀도 높은 템플릿/레이아웃”으로 유도

실패 시 자동 수정 루프(순서 고정):

1. 여백/이미지 비율 조정(텍스트 공간 확보)
2. 보조 요소 제거(텍스트는 유지)
3. 템플릿 폴백(텍스트 밀도 높은 패턴)
4. 재레이아웃
5. 재검증
   → 그래도 실패면 Export 금지 + 리포트 출력

---

## 11) Skills (있으면 강제 사용 + 증명)

- theme-factory: refs 대표 샘플 기반 3후보 → 1개 결정(결정적)
- webapp-testing: runtime gates 실행(Export 전 강제)
- copywriter(openai/local): CopyDeck 생성 + 캐시 + audit

UI/헤더/exportAudit에 항상 노출:

- requestHash / auditHash
- ReferenceIndex fresh/stale, used/required clusters
- ThemeFactory ran/skip
- Copywriter mode, cacheKey, model, schemaVersion
- RuntimeGates pass/fail

---

## 12) Export 규칙

- 파일명 결정적:
  `{title}_{docKind}_{w}x{h}mm_{pageCount}p_v{variantIndex}_{hash8}.pptx`

- exportAudit.json 필수:
  - gate 결과, proof, 참조 사용 증명
  - CopyDeck 해시/캐시키/모델/버전
  - 오브젝트 bounds, 슬라이드 수, debug=false 등

---

## 13) QA / Commands (권장)

- `npm run qa:layout-density`
- `npm run qa:copy-density` (추가)
- `npm run qa:content-completeness`
- `npm run qa:determinism`

---

## 14) 금지 패턴 (바로 리젝)

- 특정 1건 맞추기용 하드코딩(주제/키워드 분기 폭증)
- per-page 좌표 땜빵 / 예외 맵 누적
- references가 있는데도 사용 증명 없이 Export 통과
- “규칙/형식 설명 문장”이 최종 문서에 출력되는 것
- LLM 호출 결과를 캐시 없이 매번 새로 생성(결정성 파괴)
- 클라이언트에서 OpenAI API 호출 / 키 노출 / 로그에 키 출력

---

## 15) 2026-02 Copywriter Integration Rules (ASCII Appendix)

- `COPYWRITER_MODE` must support `off | local | openai`.
- `openai` mode is server-only. Never expose API keys in client bundles, browser logs, or public env vars.
- OpenAI calls are allowed only for text generation. Remote asset fetch remains forbidden.
- Copy output must be a `CopyDeck` JSON object validated against JSON Schema (structured output).
- Determinism key must include:
  - `requestHash + promptVersion + schemaVersion + model (+referenceDigest, +imageDigest optional)`.
- If cache file exists for `cacheKey`, always reuse it unless `forceRegenerate=true`.
- Persist copy cache and mirror artifacts under `exports/<requestHash>/...` for auditability.
- `export-audit.json` must include:
  - `copywriterMode/effectiveMode`, `model`, `promptVersion`, `schemaVersion`,
  - `cacheKey`, `cacheHit`, `copyDeckHash`.
- Copy Density Gate is required for `poster_set` and `onepager`.
- Poster-set baseline per page: `text_chars >= 220`, `text_blocks >= 4`, `body_font_min_pt >= 16`.
- Export remains blocked until static + runtime + copy density + content gates all pass.
