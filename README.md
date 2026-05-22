# 🏁 새알심 레이스 통합 시뮬레이터 & AI 분석 대시보드
> **100,000회 Monte Carlo Simulation 기반의 보드게임 데이터 분석 웹 애플리케이션**

본 프로젝트는 복잡한 중첩(업기) 시스템과 역주행 기믹을 가진 보드게임 '새알심 레이스'의 전술적 밸런스를 검증하기 위해 기획된 **빅데이터 시뮬레이터 및 AI 분석 대시보드**입니다. 대용량 반복 연산 시 발생하는 브라우저 병목 현상을 해결하고, 데이터 무결성을 보장하는 객체 지향형 스택(Stack) 아키텍처 및 비용 통제형 AI 보안 파이프라인으로 설계되었습니다.

---

## 🚀 라이브 데모 (Live Demo)
* **운영 서버 주소:** [https://saealsim-race-simulator.vercel.app](https://saealsim-race-simulator.vercel.app)
* *비인증 외부 사용자도 로그인이나 개인 API Key 입력 없이 '원클릭'으로 모든 AI 분석 기능을 즉시 안전하게 체험할 수 있습니다.*

---

## 🚀 핵심 기술 스택 및 아키텍처
- **Frontend:** React.js, Tailwind CSS (Responsive Dashboards)
- **Data Engine:** JavaScript Asynchronous Chunking Core (비동기 연산 엔진)
- **AI Integration:** Google Gemini 2.5 Flash API (실시간 전술 브리핑 및 중계 스크립트 생성)
- **Deployment & Infra:** Vercel Environment Variables (보안 환경 변수 인프라)

---

## 🛠️ 핵심 엔지니어링 포인트

### 1. 10만 회 Monte Carlo 시뮬레이션 및 병목 해결
10,000회~100,000회의 대용량 시뮬레이션을 동기식 루프로 실행할 경우 자바스크립트 싱글 스레드 특성상 메인 스레드가 차단되어 브라우저 멈춤(`Freezing`) 현상이 발생합니다. 이를 해결하기 위해 **Asynchronous Chunking(비동기 청크 분할) 기법**을 적용, 1,000회 단위로 연산 인터벌을 부여하여 렌더링 스레드를 확보하고 실시간 프로그레스 바(Progress Bar)를 매끄럽게 구현했습니다.

### 2. 물리적 스택(Stack) 제어를 통한 데이터 무결성 보장
보드게임 특성상 한 칸에 여러 개의 말이 쌓이고, 이동 시 상단 서브스택이 통째로 이동하며, 특정 타일(균열)에서 순서가 섞이는 복잡한 배열 조작이 필요합니다. 고수준 내장 함수에만 의존하는 대신 **2차원 배열 인덱스 매핑과 탑 포인터(Top Pointer) 제어 메커니즘**을 구현하여, 역주행하는 '아브 대왕'이 스택 최하단에 항상 강제 고정되는 예외 처리를 무결성 에러 없이 완벽히 수행했습니다.

### 3. 실시간 덤프 기반 Play-by-Play 시각화 뷰어
시뮬레이션 데이터 중 무작위 1게임의 전술 로그를 인메모리에 덤프(Dump)하여, `setInterval` 타이머 상태 제어를 통해 매 라운드 말들이 물리적으로 이동하고 쌓이는 과정을 가로 전개형 보드 레이아웃으로 시각화했습니다.

### 4. 서버 사이드 보안 변수(env) 연동을 통한 UX 혁신
초기 설계의 `window.prompt` 키 입력 방식을 제거하고, **Vercel Environment Variables** 인프라를 구축했습니다. 클라이언트 소스코드나 사용자 브라우저에 개발자의 API Key가 절대 유출 및 노출되지 않도록 서버 사이드 금고 시스템과 연동하여, **보안성 100%를 유지함과 동시에 사용자에게는 로그인 없는 '원클릭 AI 분석 환경'을 제공**합니다.

### 5. 사용자 맞춤형 가이드 팝업 및 트리플 엔진 동시 가동(Orchestration)
사용자가 단판 시각화와 AI 에이전트 분석을 수동으로 각각 조작해야 했던 기존 인터랙션 단점과 UI 배치 순서를 UX 흐름에 맞춰 대대적으로 리팩토링했습니다.
- **가이드 유도형 모달(Modal) 탑재:** 시뮬레이션 가동 버튼을 누르면 직관적인 안내 팝업이 활성화되어, 3종의 가상 AI 에이전트 중 사용자가 원하는 분석 스펙트럼을 직접 선택하도록 유도합니다. (Default: 마동선 족집게 예측)
- **원클릭 3대 엔진 동시 제어:** 에이전트 선택과 동시에 `[대량 통계 연산 루프]` ➔ `[무작위 1판 덤프 시각화 하이라이트 레이싱 재생]` ➔ `[백그라운드 LLM API 사전 패칭 및 가짜 실시간 홀더 메시지 연출]`이 오케스트라처럼 세트로 연동되어 유기적으로 동작합니다.
- **사용자 시선 중심 레이아웃 재배치:** `통계 차트` 아래로 `Play-by-Play 주행 디스플레이`를 승격시키고, 최종 요약 리포트 영역인 `AI 브리핑룸`을 최하단으로 내림으로써, 말들이 완주 과정을 감상한 뒤 AI 해설을 자연스럽게 읽어내려가는 이상적인 시각적 스토리텔링을 구현했습니다.

### 6. 클라우드 비용 통제를 위한 이중 방어막 (Rate Limiting) 설계
Vercel에 API Key를 심어 원클릭 오픈할 경우 발생할 수 있는 악의적인 무단 연타(DDoS) 매크로 및 사용자의 과도한 호출로 인한 구글 API Quota 고갈/비용 폭탄 위험을 통제하기 위해 **프론트엔드 이중 방어 로직**을 직접 설계했습니다.
- **1차 방어 (Debouncing 쿨타임):** AI 브리핑 요청 즉시 상태 변수를 제어하여 버튼을 `disabled` 처리하고 `🔒 분석 쿨타임 대기` UI를 반영, **10초간의 연속 클릭 요청을 웹 브라우저 단에서 원천 차단**합니다.
- **2차 방어 (세션 기반 사용 제한):** 단일 접속 세션 메모리에 누적 호출 카운터를 심어 **인당 최대 3회 초과 요청 시** 경고창 팝업과 함께 함수 실행을 영구 중지(`return`)시킵니다. 악의적인 봇의 무한 연타 공격을 완벽히 무력화하여 클라우드 계정의 자산을 철저히 방어합니다.

---

## 💻 핵심 동시 구동 및 보안 방어벽 소스코드 (React)

```javascript
// 팝업창에서 에이전트를 최종 클릭 시 3대 엔진(통계, 단판 애니메이션, AI)이 동시 결합 가동
const executeSimulationAndAiCombo = async (chosenMode) => {
  setSelectedAiMode(chosenMode);
  setIsAgentModalOpen(false); // 가이드 모달 닫기
  setIsSimulating(true);
  setAiLoading(true);

  // 1. [연출 엔진] 에이전트 모드별 실시간 가짜 홀더 메시지 선제 세팅
  if (chosenMode === "madongseon") {
    setAiStatusMessage("🎲 마동선이 담배를 물고 주행 시뮬레이션 데이터를 야수가 가득한 눈빛으로 파싱 중입니다...");
  } else if (chosenMode === "sports") {
    setAiStatusMessage("🎙️ 메인 캐스터가 마이크를 켜고 단판 하이라이트 로그 스크립트를 벼르는 중입니다...");
  } else {
    setAiStatusMessage("📐 총괄 밸런스 디자이너가 승률 편차 매트릭스를 취합해 패치 노트를 고안 중입니다...");
  }

  // ... [비동기 청크 몬테카를로 통계 연산 수행] ...

  // 2. [시각화 엔진] 통계 완료 직후 무작위 1판 덤프 로그 바인딩 및 주행 플레이어 자동 재생
  const singlePlaybackGame = runSingleGame(activeRoster, selectedTrack);
  setVisualGame(singlePlaybackGame);
  setIsPlaying(true); 

  // 3. [AI 분석 엔진] 백그라운드 LLM 프롬프트 파이프라인 전송 가동
  await processLiveAiReport(compiledResults, singlePlaybackGame, chosenMode);
};

// 비용 보호를 위한 실시간 레이트 리밋 제어부
const processLiveAiReport = async (stats, playback, mode) => {
  if (aiCallCount >= 3) return; // [방어벽 B] 세션 제한 차단

  try {
    setIsAiAnalyzing(true); // [방어벽 A] 🔒 10초 쿨타임 락 온
    const res = await callGeminiWithBackoff(prompt, systemPrompt);
    setAiReport(res);
    setAiCallCount(prev => prev + 1); // 사용 한도 카운트 업
  } catch (e) {
    setAiError("에러 발생: " + e.message);
  } finally {
    setAiLoading(false);
    setTimeout(() => { setIsAiAnalyzing(false); }, 10000); // [방어벽 C] 🔓 10초 후 안전 해제
  }
};
```

---
## 📊 시뮬레이션 메커니즘 & 프리셋 규칙
🏁 트랙 환경 모델
일반 경기 프리셋: 추진 장치(B) 4개, 억제 장치(R) 2개, 균열 장치(C) 2개 포진된 변수 중심 트랙

토너먼트 전용 프리셋: 기믹 타일을 3개씩 대칭 축소하여 새알심 고유의 스피드 스킬 기댓값을 강조한 전술 트랙
[출발] - N - N - B - N - C - N - N - N - B - N - N - N - C - N - R - N - N - N - B - N - N - C - N - N - R - N - N - N - R - N - [도착]

---
## 🥚 주요 출전 로스터 및 스킬 도메인
린네 (S-Tier / 스피드): 60% 확률로 주사위 2배 이동, 20% 확률로 침묵(이동 불가).

에이메스 (S-Tier / 전략): 경기당 1회, 중간 지점 통과 후 전방 최선두 머리 위로 전송.

금희 (S-Tier / 유틸): 머리 위에 다른 새알심이 쌓일 경우 40% 확률로 모든 새알심의 최상단 강탈.

그 외 파수인, 시그리카, 카르티시아, 히유키 등 총 18종의 독립적 객체 스킬 로직 완벽 구현.

---
## 🤖 Gemini API 기반 AI 브리핑 시스템
시뮬레이션 완료 후, 수집된 승률 통계 배열과 단판 주행 텍스트 로그를 LLM 프롬프트 파이프라인과 결합하여 안내 유도 모달 팝업창 선택지에 따라 세 가지 가상 에이전트 확장 피처를 동시성(Concurrency) 로직으로 연동 제공합니다.

AI 도박사 '마동선'의 족집게 분석: 몬테카를로 데이터를 해석하여 정배/역배 요인 분석 및 픽 추천 (거칠고 찰진 현장감 있는 한국어 도박사 페르소나 주입)

AI 스포츠 생중계 해설: 단판 로그 덤프를 가공해 하이라이트 순간의 열혈 중계 대본 창작 (E-sports 캐스터 페르소나)

AI 밸런스 패치 처방전: 승률 불균형 현상을 감지하여 신규 트랙 장치 및 카운터 버프 기획 제안 (보드게임 총괄 디자이너 페르소나)
