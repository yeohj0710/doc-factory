# doc-factory — AGENTS.md (Best)

목표: 사용자가 “대충” 프롬프트를 던져도, /images + (/references)만으로

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
- 내부 규칙/개발 용어가 문서에 노출되면 실패다.

---

## 1) Hard Constraints (절대 규칙)

### 1.1 런타임 네트워크 금지

- 외부 이미지/구글 폰트/원격 CSS fetch 금지
- 폰트는 `/fonts` 로컬만 사용

### 1.2 결정성(Determinism)

동일 입력이면 동일 결과여야 한다.

- 입력 = RequestSpec + ordered image ids + referenceDigest + pageSpec + variantIndex + seed
- 시간/난수/mtime 의존 금지
- 파일 정렬은 locale-independent + numeric-aware(결정적)

### 1.3 페이지 사이즈 단일 소스

- DSL `widthMm/heightMm`만 진실
- Web/PPTX 모두 동일 DSL 소비(단위 변환 함수만 다름)

### 1.4 PPTX는 “편집 가능한 오브젝트” 유지

- 텍스트/도형은 가능한 한 편집 가능해야 함(전 슬라이드 스크린샷 금지)

---

## 2) State Isolation (새 작업처럼 동작)

- requestHash(jobId) 기준으로 캐시/산출물/감사를 분리한다.
- “New Job”은 requestHash를 갱신해야 한다.
- 이전 작업 산출물이 다음 작업에 영향을 주면 버그다.

---

## 3) RequestSpec (단일 진실: Single Source of Truth)

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

## 4) Content Ladder (프롬프트가 짧아도 “내용 부실” 방지)

콘텐츠는 아래 우선순위로 채운다:

1. RequestSpec.contentBrief / 프롬프트 텍스트
2. 파일명/폴더명 힌트(사람 이름/역할/날짜 등) — 단, 확정적 사실로 단정하지 말 것
3. 이미지의 “무해한” 비전 태깅(장면/분위기 정도) — 신상 추론 금지
4. 부족하면 fillable placeholder로 완성 형태 유지:
   - [이름] [한 줄 소개] [특징 3가지] [연락/링크] 등

중요:

- 수치/성과/회사명/연락처 등은 **지어내지 말고** `(추후 기입)`으로 둔다.
- “내용이 없으면” 내부 규칙/형식 설명 문구로 채우는 것을 금지한다.

---

## 5) References (있으면 강제 반영)

### 5.1 ReferenceIndex (변경 시에만 전체 ingest)

- references>=8이면:
  - 모든 refs를 인덱싱(reference-index.json)
  - referenceDigest 산출(결정적)
- 생성 단계에서는 “전부 다시 보기” 금지(인덱스만 사용)

### 5.2 스타일 + 레이아웃 둘 다 반영(하드)

- 스타일 토큰: 타이포 스케일/여백 밀도/라운드/스트로크/악센트 규칙
- 레이아웃 아키타입: grid columns/hero 비율/card density/rhythm/header-footer 비율
- 1:1 좌표 복제 금지

### 5.3 Reference Usage Gate (증명 없으면 Export 차단)

references>=8이면 Export는 아래 없으면 무조건 차단:

- referenceIndexStatus=fresh
- styleSource=references
- layoutSource=references
- usedLayoutClusters >= required (1~2p는 ≥2, 멀티페이지는 ≥3)
- exportAudit에 referenceUsageReport 포함

---

## 6) Templates (패턴 패밀리 12~20 + 파라미터)

- 업종별 템플릿 금지. 패턴 패밀리 기반으로만 확장한다.
- poster 계열은 “큰 타이포 + 짧은 문장 + 강한 배경/컬러블록”을 기본으로 한다.
- “모든 페이지가 같은 템플릿 반복” 금지:
  - 동일 패밀리 연속 사용 제한
  - full-bleed 과다 사용 제한(예: 40% 이하)

---

## 7) 파이프라인 (항상 이 순서)

1. Parse → RequestSpec 확정 (UI에 표시)
2. Scan assets (deterministic ordering)
3. Build ReferenceIndex(필요 시)
4. Planner: storyboard (page roles + template families + copy budgets)
5. Generate DSL pages (template params from archetypes)
6. Static Validation (DSL)
7. Runtime Validation (webapp-testing 우선)
8. Export Audit (proof 포함)
9. Export (PPTX) — 모든 게이트 PASS 전까지 금지

---

## 8) Validation Gates (Export 차단 필수)

정적(DSL):

- boundary / collision / reserved lanes / min readable size / layering / determinism

런타임(Web):

- overflow / clip / overlap

추가 “품질 게이트”(필수):

- 내부 용어 누수 금지: RequestSpec/variantIndex/referenceDigest/layout/validation/theme-factory/webapp-testing 등
  - 발견 시: 치환 또는 재생성, 해결 불가면 Export 차단
- Content Completeness: docKind별 최소 내용량 충족(포스터는 title+subtitle+bullets 등)
- Silent truncation 금지: …/..., line-clamp, overflow hidden으로 숨기기 금지
- debugOnly는 debug=1에서만, Export에는 절대 포함 금지

실패 시 자동 수정 루프(순서 고정):

1. 텍스트 축약(예산 재적용)
2. 보조 요소 제거
3. 템플릿 폴백(안전 패턴)
4. 재레이아웃
5. 재검증
   → 그래도 실패면 Export 금지 + 리포트 출력

---

## 9) Skills (있으면 강제 사용 + 증명)

- theme-factory: refs 대표 샘플 기반 3후보 → 1개 결정(결정적)
- webapp-testing: runtime gates 실행(Export 전 강제)

UI/헤더/exportAudit에 항상 노출:

- requestHash / auditHash
- ReferenceIndex fresh/stale, used/required clusters
- ThemeFactory ran/skip
- RuntimeGates pass/fail

---

## 10) Export 규칙

- 파일명 결정적:
  `{title}_{docKind}_{w}x{h}mm_{pageCount}p_v{variantIndex}_{hash8}.pptx`
- exportAudit.json 필수:
  - gate 결과, proof, 참조 사용 증명, 오브젝트 bounds, 슬라이드 수, debug=false 등

---

## 11) 금지 패턴 (바로 리젝)

- 특정 작업 1건을 맞추기 위한 키워드 분기/주제 전용 카피 하드코딩
- per-page 좌표 땜빵 / 예외 맵 누적
- 페이지 수 고정(항상 8p 등)
- references가 있는데도 사용 증명 없이 Export 통과
- “규칙/형식 설명 문장”이 최종 문서에 출력되는 것
