# doc-factory — AGENTS.md (SLIM)

목적: “대충 적어도” 잘 되는 범용 문서 디자이너를 **프롬프트가 아니라 코드/게이트로 강제**한다.

---

## 1) 절대 규칙 (Hard Constraints)

### 1.1 런타임 네트워크 금지

- 외부 이미지/구글폰트/원격 CSS fetch 금지
- 폰트는 `/fonts` 로컬만 사용

### 1.2 재현성(Determinism)

같은 입력이면 같은 결과여야 한다.

- 입력 = RequestSpec + 정렬된 /images 목록 + /references digest + pageSpec + variantIndex + seed
- 시간/난수/mtime 의존 금지
- 파일 순서는 반드시 **결정적 정렬**(path normalize + numeric-aware) 사용

### 1.3 페이지 사이즈 단일 소스

- DSL의 `widthMm/heightMm`이 유일한 진실
- Web/PPTX 모두 같은 DSL 소비 (차이는 단위 변환 함수만)

---

## 2) “새 작업처럼” 동작 (State Isolation)

- 모든 생성/캐시/산출물은 **requestHash(jobId)** 로 분리한다.
- 이전 실행 산출물(layout.json 등)이나 전역 캐시가 다음 작업에 영향을 주면 버그다.
- UI에는 “New Job(새 작업)”이 있어야 하며, New Job은 requestHash를 갱신한다.

---

## 3) 파이프라인 (프롬프트 의존 금지, 스펙 의존)

항상 아래 순서로 동작해야 한다.

### 3.1 RequestSpec (필수)

사용자 입력은 먼저 RequestSpec으로 정규화한다. (이후 모든 단계는 RequestSpec만 신뢰)
최소 필드:

- docKind: poster | brochure | onepager | report | cards
- pageCount: exact(N) 또는 range(min,max)
- pageSize: A4P/A4L/Letter/Custom(mm)
- title, language(ko), tone(concise/…) + constraints(숫자 창작 금지 등)
- variantIndex, seed

**금지:** 이미지 파일명 키워드로 특정 “도메인 문구/주제”를 자동 삽입하는 로직.

### 3.2 Planner(스토리보드) → Generator(레이아웃) → Validators → Export

- Planner는 “문서 전체(목차/리듬/분량)”를 먼저 만든다.
- “이미지 1장 = 1페이지” 같은 기본값에 의존하지 않는다.
- 템플릿은 **패턴 패밀리 12~20개** + 파라미터화로 다양성 확보.

---

## 4) References 정책 (있으면 강제 반영)

### 4.1 ReferenceIndex (필수, 캐시)

- `/references`에 이미지가 충분(>=8)하면:
  - **전체 파일을 인덱싱**해 `reference-index.json` 생성(변경 시에만 재빌드)
  - `referenceDigest` 산출(결정적)
- 생성 단계는 “전부 다시 보기” 금지. 인덱스만 사용.

### 4.2 스타일 + 레이아웃 둘 다 반영(강제)

- references는 “스타일 토큰 + 레이아웃 아키타입(그리드/hero비율/밀도/리듬)”에 반영해야 함
- **1:1 레이아웃 복제(좌표 베끼기) 금지**

### 4.3 레퍼런스 사용 증명 게이트(하드)

references>=8이면 Export는 아래 없으면 **무조건 차단**:

- referenceIndexStatus = fresh
- styleSource = references
- layoutSource = references
- usedLayoutClusters 커버리지 충족(멀티페이지는 최소 3, 1~2p는 최소 2)
- exportAudit에 referenceUsageReport 포함

---

## 5) 카피 정책 (도메인/주제별 하드코딩 금지)

- 금지: “자연 캠페인”, “B2B 건기식” 같은 **특정 주제 문구를 코드에 내장**
- 카피는 RequestSpec 기반으로만 생성(짧고 명확, 불릿 중심)
- 모르는 수치/성과는 지어내지 말고 `(추후 기입)` 처리
- 텍스트가 안 맞으면 **폰트 줄이기 전에 텍스트를 먼저 줄인다**

---

## 6) 검증 게이트 (Export 차단 필수)

### 6.1 정적 DSL 검증

- boundary / collision / reserved lanes / min-size / layering / determinism

### 6.2 런타임 실측 검증 (webapp-testing 우선)

- overflow / clip / overlap 검사
- 실패 시 자동 수정 루프:
  1. 텍스트 축약 2) 보조요소 제거 3) 템플릿 폴백 4) 재레이아웃 5) 재검증
- 통과 전 Export 금지

### 6.3 “조용한 잘림” 금지

- ellipsis(…/...) / line-clamp / overflow hidden으로 숨기기 금지
- 안 맞으면 텍스트를 줄이거나 템플릿 변경

### 6.4 debug/meta 누수 금지

- debugOnly는 debug=1에서만 표시, Export에는 절대 포함 금지

---

## 7) PPTX Export 규칙

- Web/PPTX 패리티 유지(같은 DSL)
- Export audit 필수(슬라이드 수/바운드/편집가능 오브젝트/게이트 결과/refs 사용 증명)
- 기본 파일명은 결정적:
  `{title}_{docKind}_{w}x{h}mm_{pageCount}p_v{variantIndex}_{hash8}.pptx`
  (hash8 = requestHash 일부)

---

## 8) 금지 패턴(바로 리젝)

- 특정 작업을 맞추기 위한 키워드 분기/특수 카피를 코드에 추가
- per-page 좌표 땜빵 / 예외 맵 누적
- 페이지 수 고정(항상 8p 등)
- references가 있는데도 “사용 증명 없이” export 통과
