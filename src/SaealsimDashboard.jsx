import React, { useState, useEffect, useMemo, useRef } from 'react';

// ==========================================
// Gemini API Key 설정 및 호출 함수 (정식 모델 규격 최적화)
// ==========================================
const getInitialApiKey = () => {
  if (typeof window !== 'undefined') {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) return envKey;
    return window.prompt("Gemini API Key를 입력해 주세요:") || "";
  }
  return "";
};

const apiKey = getInitialApiKey();

const callGeminiWithBackoff = async (prompt, systemInstruction = "") => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ 
      parts: [{ text: prompt }] 
    }],
    systemInstruction: systemInstruction ? { 
      parts: [{ text: systemInstruction }] 
    } : undefined
  };

  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("구글 서버 상세 에러 반환:", errorData);
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      throw new Error("응답 데이터가 비어있습니다.");
    } catch (err) {
      if (i === 4) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; 
    }
  }
};

// ==========================================
// 새알심 캐릭터 스펙 데이터베이스 (총 18명)
// ==========================================
const SAEALSIMS = [
  { id: 'linne', name: '린네', color: '#10b981', desc: '60% 확률로 주사위 2배 이동, 20% 확률로 해당 라운드 이동 불가.', tier: 'S', type: '스피드' },
  { id: 'aimes', name: '에이메스', color: '#8b5cf6', desc: '경기당 1회, 중간 지점(16칸) 통과 후 전방 가장 가까운 새알심의 머리 위로 전송.', tier: 'S', type: '전략' },
  { id: 'geumhee', name: '금희', color: '#a855f7', desc: '머리 위에 다른 새알심이 쌓이면, 40% 확률로 모든 새알심의 제일 위로 이동.', tier: 'S', type: '유틸' },
  { id: 'pasuin', name: '파수인', color: '#3b82f6', desc: '주사위가 항상 2 또는 3만 등장 (기복 없는 이동).', tier: 'A', type: '안정' },
  { id: 'chisa', name: '치사', color: '#ec4899', desc: '주사위 1이 나올 경우, +2칸 보너스 전진 (총 3칸).', tier: 'B', type: '유틸' },
  { id: 'monier', name: '모니에', color: '#64748b', desc: '주사위 값 고정 시퀀스: 3 → 2 → 1 반복 발동.', tier: 'F', type: '고정' },
  { id: 'carlotta', name: '카를로타', color: '#f59e0b', desc: '28% 확률로 주사위 값 2배 이동.', tier: 'B', type: '스피드' },
  { id: 'jangri', name: '장리', color: '#ef4444', desc: '자신 아래에 다른 새알심이 있을 경우, 65% 확률로 다음 라운드 마지막으로 행동.', tier: 'S', type: '전략' },
  { id: 'yuno', name: '유노', color: '#14b8a6', desc: '경기당 1회, 중간 지점 통과 후 자신의 앞뒤 새알심을 자신의 칸으로 전송 (랭킹 순서 유지).', tier: 'A', type: '전략' },
  { id: 'floro', name: '플로로', color: '#fb923c', desc: '라운드 시작 시 스택 맨 아래에 있으면 이동 시 추가 +3칸 전진.', tier: 'A', type: '엔진' },
  { id: 'kakaru', name: '카카루', color: '#6366f1', desc: '이동 시작 시 꼴찌일 경우 추가 +3칸 전진.', tier: 'B', type: '추격' },
  { id: 'augusta', name: '아우구스타', color: '#94a3b8', desc: '맨 위에 있으면 이번 라운드 행동 불가 및 다음 라운드 마지막 행동.', tier: 'F', type: '페널티' },
  { id: 'denia', name: '데니아', color: '#06b6d4', desc: '주사위 굴릴 때 지난번과 동일한 수가 나오면 추가 +2칸 전진.', tier: 'B', type: '연속' },
  { id: 'luke', name: '루크', color: '#ea580c', desc: '추진 장치(B) 활성 시 추가 +3칸 전진, 억제 장치(R) 활성 시 추가 1칸 후퇴.', tier: 'A', type: '장치' },
  { id: 'sigrica', name: '시그리카', color: '#0284c7', desc: '매 라운드 주사위 투척 후, 앞 순위 새알심 최대 2개의 다음 라운드 이동 칸수 1 감소.', tier: 'A', type: '견제' },
  { id: 'cartisia', name: '카르티시아', color: '#0ea5e9', desc: '경기당 1회, 이동 종료 후 꼴찌일 경우 남은 라운드 전체 60% 확률로 +2칸 전진.', tier: 'S', type: '역전' },
  { id: 'hiyuki', name: '히유키', color: '#e11d48', desc: '아브 대왕과 만난 이후부터 이동 시 추가 +1칸 영구 전진.', tier: 'A', type: '성장' },
  { id: 'peby', name: '페비', color: '#84cc16', desc: '50% 확률로 추가 +1칸 전진.', tier: 'C', type: '안정' }
];

// ==========================================
// 트랙 프리셋 정의 (32칸)
// ==========================================
const TRACKS = {
  original: {
    name: "기본 경기 트랙",
    layout: ['N','N','B','N','N','C','N','N','N','R','B','N','N','N','N','B','N','N','N','C','N','N','B','N','N','N','N','R','N','N','N','N'],
    desc: "추진(B) 4개, 억제(R) 2개, 균열(C) 2개가 포진된 밸런스형 대난전 트랙"
  },
  tournament: {
    name: "토너먼트 전용 트랙",
    layout: ['N','N','N','B','N','C','N','N','N','B','N','N','N','C','N','R','N','N','N','B','N','N','C','N','N','R','N','N','N','R','N','N'],
    desc: "추진(B) 3개, 균열(C) 3개, 억제(R) 3개로 변형된 고난도 전략형 토너먼트 트랙"
  }
};

const MATCH_PRESETS = [
  { name: '토너먼트 A조', roster: ['floro', 'sigrica', 'yuno', 'kakaru', 'linne', 'cartisia'], track: 'tournament' },
  { name: '토너먼트 B조', roster: ['peby', 'aimes', 'geumhee', 'pasuin', 'hiyuki', 'monier'], track: 'tournament' },
  { name: '토너먼트 승자조', roster: ['sigrica', 'floro', 'linne', 'pasuin', 'aimes', 'hiyuki'], track: 'tournament' },
  { name: '토너먼트 패자조', roster: ['yuno', 'kakaru', 'cartisia', 'geumhee', 'peby', 'monier'], track: 'tournament' },
  { name: '토너먼트 최종 결승조', roster: ['peby', 'kakaru', 'monier', 'floro', 'linne', 'hiyuki'], track: 'tournament' },
  { name: '1차 일반전 기본 로스터', roster: ['linne', 'aimes', 'pasuin', 'chisa', 'monier', 'carlotta'], track: 'original' }
];

export default function SaealsimDashboard() {
  const [selectedTrack, setSelectedTrack] = useState('tournament');
  const [activeRoster, setActiveRoster] = useState(MATCH_PRESETS[0].roster);
  const [isTournamentCheck, setIsTournamentCheck] = useState(true);
  const [simCount, setSimCount] = useState(10000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [simResults, setSimResults] = useState(null);
  
  const [visualGame, setVisualGame] = useState(null);
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimer = useRef(null);

  const [aiReport, setAiReport] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  
  const [selectedAiMode, setSelectedAiMode] = useState("madongseon"); 
  const [aiStatusMessage, setAiStatusMessage] = useState("");          
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);     

  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false); 
  const [aiCallCount, setAiCallCount] = useState(0);         

  const loadPreset = (preset) => {
    setActiveRoster(preset.roster);
    setSelectedTrack(preset.track);
    setIsTournamentCheck(preset.track === 'tournament');
    setSimResults(null);
    setVisualGame(null);
    setAiReport("");
  };

  const toggleSaealsim = (id) => {
    if (activeRoster.includes(id)) {
      if (activeRoster.length > 3) {
        setActiveRoster(activeRoster.filter(rid => rid !== id));
        setSimResults(null);
        setAiReport("");
      }
    } else {
      if (activeRoster.length < 6) {
        setActiveRoster([...activeRoster, id]);
        setSimResults(null);
        setAiReport("");
      }
    }
  };

  // 단판 시각화 시뮬레이션 기동 코어 엔진
  const runSingleGame = (roster, trackKey) => {
    const layout = TRACKS[trackKey].layout;
    const players = roster.map(id => SAEALSIMS.find(s => s.id === id));
    let cellStacks = Array.from({ length: 32 }, () => []);
    cellStacks[0] = [...players.map((_, i) => i)].sort(() => Math.random() - 0.5);

    let yunoUsed = Array(6).fill(false);
    let cartisiaBuff = Array(6).fill(false);
    let hiyukiActive = Array(6).fill(false);
    let lastRoll = Array(6).fill(0);
    let monierIndex = Array(6).fill(0);
    
    let abeActive = false;
    let abePos = 31;
    let roundsLog = [];
    
    roundsLog.push({
      round: 0,
      stacks: JSON.parse(JSON.stringify(cellStacks)),
      abePos: null,
      log: ["경기가 곧 시작됩니다! 모든 새알심이 출발선에 배정되었습니다."]
    });

    let currentRound = 1;
    let winner = null;
    let jangriStun = Array(6).fill(false);
    let augustaStun = Array(6).fill(false);
    let sigricaDebuff = Array(6).fill(false);

    while (currentRound < 60 && !winner) {
      let roundLogs = [];
      if (currentRound === 4) {
        abeActive = true;
        abePos = 31;
        cellStacks[31].unshift('ABE');
        roundLogs.push("⚠️ [아브대왕 등장] 결승점에서 아브대왕의 역주행 시동!");
      }

      let turnOrder = [...players.map((_, i) => i)];
      if (abeActive) turnOrder.push('ABE');
      
      let jangriIdx = players.findIndex(p => p.id === 'jangri');
      if (jangriIdx !== -1 && jangriStun[jangriIdx]) {
        turnOrder = turnOrder.filter(idx => idx !== jangriIdx);
        turnOrder.push(jangriIdx);
        jangriStun[jangriIdx] = false;
      }

      let augustaIdx = players.findIndex(p => p.id === 'augusta');
      if (augustaIdx !== -1 && augustaStun[augustaIdx]) {
        turnOrder = turnOrder.filter(idx => idx !== augustaIdx);
        turnOrder.push(augustaIdx);
        augustaStun[augustaIdx] = false;
      }

      const specialBack = [];
      if (jangriIdx !== -1 && turnOrder[turnOrder.length-1] === jangriIdx) specialBack.push(turnOrder.pop());
      if (augustaIdx !== -1 && turnOrder[turnOrder.length-1] === augustaIdx) specialBack.push(turnOrder.pop());
      
      for (let i = turnOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
      }
      turnOrder = [...turnOrder, ...specialBack];

      const getRanks = () => {
        let ranks = [];
        for (let c = 31; c >= 0; c--) {
          const stack = cellStacks[c];
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i] !== 'ABE') ranks.push(stack[i]);
          }
        }
        return ranks;
      };

      for (let mover of turnOrder) {
        if (mover === 'ABE') {
          const abeRoll = Math.floor(Math.random() * 6) + 1;
          const currCell = abePos;
          const abeStackIdx = cellStacks[currCell].indexOf('ABE');
          if (abeStackIdx !== -1) {
            const carried = cellStacks[currCell].slice(abeStackIdx);
            cellStacks[currCell] = cellStacks[currCell].slice(0, abeStackIdx);
            const nextCell = Math.max(0, currCell - abeRoll);
            abePos = nextCell;
            cellStacks[nextCell] = [...carried, ...cellStacks[nextCell]];
            roundLogs.push(`👑 [아브대왕] ${currCell}칸 → ${nextCell}칸 역주행 (새알심 견인 완료)`);
          }
          continue;
        }

        let currCell = -1;
        for (let c = 0; c < 32; c++) {
          if (cellStacks[c].includes(mover)) {
            currCell = c;
            break;
          }
        }

        if (currCell === -1 || currCell === 31) continue;

        const myId = players[mover].id;
        const myName = players[mover].name;
        const myStackIdx = cellStacks[currCell].indexOf(mover);
        
        if (myId === 'augusta' && myStackIdx === cellStacks[currCell].length - 1) {
          roundLogs.push(`❄️ [아우구스타] 상단에 구속되어 라운드 동결.`);
          augustaStun[mover] = true;
          continue;
        }

        let carried = cellStacks[currCell].slice(myStackIdx);
        cellStacks[currCell] = cellStacks[currCell].slice(0, myStackIdx);

        let dice = Math.floor(Math.random() * 3) + 1;
        let bonus = 0;

        if (myId === 'pasuin') dice = Math.random() < 0.5 ? 2 : 3;
        if (myId === 'chisa' && dice === 1) bonus += 2;
        if (myId === 'monier') {
          dice = [3, 2, 1][monierIndex[mover]];
          monierIndex[mover] = (monierIndex[mover] + 1) % 3;
        }
        let linneStun = false;
        if (myId === 'linne') {
          const rand = Math.random();
          if (rand < 0.6) dice *= 2;
          else if (rand < 0.8) linneStun = true;
        }
        if (myId === 'carlotta' && Math.random() < 0.28) dice *= 2;
        if (myId === 'floro' && myStackIdx === 0) bonus += 3;
        
        const currentRanks = getRanks();
        if (myId === 'kakaru' && currentRanks[currentRanks.length - 1] === mover) bonus += 3;
        if (myId === 'denia') {
          if (dice === lastRoll[mover]) bonus += 2;
          lastRoll[mover] = dice;
        }
        if (myId === 'peby' && Math.random() < 0.5) bonus += 1;
        if (myId === 'hiyuki' && hiyukiActive[mover]) bonus += 1;
        if (sigricaDebuff[mover]) {
          bonus -= 1;
          sigricaDebuff[mover] = false;
        }

        let totalMove = linneStun ? 0 : (dice + bonus);
        if (totalMove < 0) totalMove = 0;

        let targetCell = Math.min(31, currCell + totalMove);
        let loopCount = 0;
        while (targetCell > 0 && targetCell < 31 && loopCount < 5) {
          const tile = layout[targetCell];
          if (tile === 'B') {
            targetCell = Math.min(31, targetCell + (myId === 'luke' ? 4 : 1));
          } else if (tile === 'R') {
            targetCell = Math.max(0, targetCell - (myId === 'luke' ? 2 : 1));
          } else if (tile === 'C') {
            const hasAbe = carried.includes('ABE');
            let saealsims = carried.filter(x => x !== 'ABE').sort(() => Math.random() - 0.5);
            carried = hasAbe ? ['ABE', ...saealsims] : saealsims;
            break;
          } else break;
          loopCount++;
        }

        if (carried.includes('ABE')) {
          cellStacks[targetCell] = ['ABE', ...cellStacks[targetCell].filter(x => x !== 'ABE'), ...carried.filter(x => x !== 'ABE')];
          abePos = targetCell;
        } else {
          cellStacks[targetCell] = [...cellStacks[targetCell], ...carried];
        }

        roundLogs.push(linneStun ? `💤 [린네] 행동 차단` : `🏃 [${myName}] ${currCell} → ${targetCell}칸 이동 (주사위: ${dice}, 보너스: ${bonus})`);

        if (myId === 'jangri' && cellStacks[targetCell].indexOf(mover) > 0) jangriStun[mover] = true;
        if (myId === 'aimes' && !yunoUsed[mover] && targetCell >= 16) {
          let targetAimesCell = -1;
          for (let c = targetCell + 1; c < 31; c++) {
            if (cellStacks[c].filter(x => x !== 'ABE').length > 0) { targetAimesCell = c; break; }
          }
          if (targetAimesCell !== -1) {
            yunoUsed[mover] = true;
            cellStacks[targetCell] = cellStacks[targetCell].filter(x => x !== mover);
            cellStacks[targetAimesCell].push(mover);
          }
        }
        if (myId === 'yuno' && !yunoUsed[mover] && targetCell >= 16) {
          const activeRanks = getRanks();
          const idx = activeRanks.indexOf(mover);
          let targets = [];
          if (idx > 0) targets.push(activeRanks[idx - 1]);
          if (idx < activeRanks.length - 1) targets.push(activeRanks[idx + 1]);
          if (targets.length > 0) {
            yunoUsed[mover] = true;
            targets.sort((a, b) => activeRanks.indexOf(b) - activeRanks.indexOf(a));
            for (let t of targets) {
              for (let c = 0; c < 32; c++) cellStacks[c] = cellStacks[c].filter(x => x !== t);
              cellStacks[targetCell].push(t);
            }
          }
        }
        if (myId === 'sigrica') {
          const activeRanks = getRanks();
          const rIdx = activeRanks.indexOf(mover);
          if (rIdx > 0) {
            sigricaDebuff[activeRanks[rIdx - 1]] = true;
            if (rIdx > 1) sigricaDebuff[activeRanks[rIdx - 2]] = true;
          }
        }
        if (myId === 'cartisia' && !cartisiaBuff[mover] && getRanks().slice(-1)[0] === mover) cartisiaBuff[mover] = true;
        if (myId === 'hiyuki' && !hiyukiActive[mover] && (targetCell === abePos || cellStacks[targetCell].includes('ABE'))) hiyukiActive[mover] = true;

        if (cellStacks[31].filter(x => x !== 'ABE').length > 0) break;
      }

      let geumheeIdx = players.findIndex(p => p.id === 'geumhee');
      if (geumheeIdx !== -1) {
        let geumheeCell = -1;
        for (let c = 0; c < 32; c++) { if (cellStacks[c].includes(geumheeIdx)) { geumheeCell = c; break; } }
        if (geumheeCell !== -1 && cellStacks[geumheeCell].indexOf(geumheeIdx) < cellStacks[geumheeCell].length - 1 && Math.random() < 0.4) {
          cellStacks[geumheeCell] = cellStacks[geumheeCell].filter(x => x !== geumheeIdx);
          cellStacks[geumheeCell].push(geumheeIdx);
        }
      }

      if (cellStacks[31].filter(x => x !== 'ABE').length > 0) {
        const finishStack = cellStacks[31].filter(x => x !== 'ABE');
        winner = finishStack[finishStack.length - 1];
      }

      roundsLog.push({ round: currentRound, stacks: JSON.parse(JSON.stringify(cellStacks)), abePos: abeActive ? abePos : null, log: roundLogs });
      if (winner !== null) break;
      currentRound++;
    }

    return { winner: winner !== null ? players[winner] : null, rounds: roundsLog, totalRounds: currentRound };
  };

  const handleStartClick = () => {
    if (activeRoster.length < 3) {
      alert("최소 3명 이상의 새알심을 선택해야 매치 가동이 가능합니다!");
      return;
    }
    if (aiCallCount >= 3) {
      alert("⚠️ 과도한 AI 트래픽이 감지되었습니다. 원활한 공용 서버 운영을 위해 잠시 후 다시 시도해 주세요!");
      return;
    }
    setIsAgentModalOpen(true);
  };

  const executeSimulationAndAiCombo = async (chosenMode) => {
    setSelectedAiMode(chosenMode);
    setIsAgentModalOpen(false);

    setIsSimulating(true);
    setProgress(0);
    setAiReport("");
    setAiLoading(true);

    if (chosenMode === "madongseon") {
      setAiStatusMessage("🎲 마동선이 담배를 물고 주행 시뮬레이션 데이터를 야수가 가득한 눈빛으로 파싱 중입니다...");
    } else if (chosenMode === "sports") {
      setAiStatusMessage("🎙️ 메인 캐스터가 마이크를 켜고 단판 하이라이트 로그 스크립트를 벼르는 중입니다...");
    } else {
      setAiStatusMessage("📐 총괄 밸런스 디자이너가 승률 편차 매트릭스를 취합해 패치 노트를 고안 중입니다...");
    }

    const layout = TRACKS[selectedTrack].layout;
    const players = activeRoster.map(id => SAEALSIMS.find(s => s.id === id));
    let winCounts = Array(players.length).fill(0);
    let roundFinishedCounts = [];
    
    const totalSims = simCount;
    const chunkSize = Math.max(1000, Math.floor(totalSims / 10));
    let completed = 0;

    const executeChunk = async () => {
      const target = Math.min(completed + chunkSize, totalSims);
      for (let sim = completed; sim < target; sim++) {
        let cellStacks = Array.from({ length: 32 }, () => []);
        cellStacks[0] = [...players.map((_, i) => i)].sort(() => Math.random() - 0.5);

        let yunoUsed = Array(6).fill(false);
        let cartisiaBuff = Array(6).fill(false);
        let hiyukiActive = Array(6).fill(false);
        let lastRoll = Array(6).fill(0);
        let monierIndex = Array(6).fill(0);

        let abeActive = false;
        let abePos = 31;
        let currentRound = 1;
        let winner = null;
        let jangriStun = Array(6).fill(false);
        let augustaStun = Array(6).fill(false);
        let sigricaDebuff = Array(6).fill(false);

        const getRanks = () => {
          let ranks = [];
          for (let c = 31; c >= 0; c--) {
            const stack = cellStacks[c];
            for (let i = stack.length - 1; i >= 0; i--) { if (stack[i] !== 'ABE') ranks.push(stack[i]); }
          }
          return ranks;
        };

        while (currentRound < 60 && winner === null) {
          if (currentRound === 4) { abeActive = true; abePos = 31; cellStacks[31].unshift('ABE'); }
          let turnOrder = [...players.map((_, i) => i)];
          if (abeActive) turnOrder.push('ABE');

          let jangriIdx = players.findIndex(p => p.id === 'jangri');
          if (jangriIdx !== -1 && jangriStun[jangriIdx]) { turnOrder = turnOrder.filter(idx => idx !== jangriIdx).concat(jangriIdx); jangriStun[jangriIdx] = false; }
          let augustaIdx = players.findIndex(p => p.id === 'augusta');
          if (augustaIdx !== -1 && augustaStun[augustaIdx]) { turnOrder = turnOrder.filter(idx => idx !== augustaIdx).concat(augustaIdx); augustaStun[augustaIdx] = false; }

          for (let i = turnOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
          }

          for (let mover of turnOrder) {
            if (mover === 'ABE') {
              const abeRoll = Math.floor(Math.random() * 6) + 1;
              const currCell = abePos;
              const abeStackIdx = cellStacks[currCell].indexOf('ABE');
              if (abeStackIdx !== -1) {
                const carried = cellStacks[currCell].slice(abeStackIdx);
                cellStacks[currCell] = cellStacks[currCell].slice(0, abeStackIdx);
                const nextCell = Math.max(0, currCell - abeRoll);
                abePos = nextCell;
                cellStacks[nextCell] = [...carried, ...cellStacks[nextCell]];
              }
              continue;
            }

            let currCell = -1;
            for (let c = 0; c < 32; c++) { if (cellStacks[c].includes(mover)) { currCell = c; break; } }
            if (currCell === -1 || currCell === 31) continue;

            const myId = players[mover].id;
            const myStackIdx = cellStacks[currCell].indexOf(mover);
            if (myId === 'augusta' && myStackIdx === cellStacks[currCell].length - 1) { augustaStun[mover] = true; continue; }

            let carried = cellStacks[currCell].slice(myStackIdx);
            cellStacks[currCell] = cellStacks[currCell].slice(0, myStackIdx);

            let dice = Math.floor(Math.random() * 3) + 1;
            let bonus = 0;

            if (myId === 'pasuin') dice = Math.random() < 0.5 ? 2 : 3;
            if (myId === 'chisa' && dice === 1) bonus += 2;
            if (myId === 'monier') { dice = [3, 2, 1][monierIndex[mover]]; monierIndex[mover] = (monierIndex[mover] + 1) % 3; }
            let linneStun = false;
            if (myId === 'linne') {
              const rand = Math.random();
              if (rand < 0.6) dice *= 2; else if (rand < 0.8) linneStun = true;
            }
            if (myId === 'carlotta' && Math.random() < 0.28) dice *= 2;
            if (myId === 'floro' && myStackIdx === 0) bonus += 3;
            if (myId === 'kakaru' && getRanks().slice(-1)[0] === mover) bonus += 3;
            if (myId === 'denia') { if (dice === lastRoll[mover]) bonus += 2; lastRoll[mover] = dice; }
            if (myId === 'peby' && Math.random() < 0.5) bonus += 1;
            if (myId === 'hiyuki' && hiyukiActive[mover]) bonus += 1;
            if (sigricaDebuff[mover]) { bonus -= 1; sigricaDebuff[mover] = false; }

            let totalMove = linneStun ? 0 : (dice + bonus);
            let targetCell = Math.min(31, currCell + totalMove);
            let loopCount = 0;
            while (targetCell > 0 && targetCell < 31 && loopCount < 5) {
              const tile = layout[targetCell];
              if (tile === 'B') targetCell = Math.min(31, targetCell + (myId === 'luke' ? 4 : 1));
              else if (tile === 'R') targetCell = Math.max(0, targetCell - (myId === 'luke' ? 2 : 1));
              else if (tile === 'C') {
                const hasAbe = carried.includes('ABE');
                let sims = carried.filter(x => x !== 'ABE').sort(() => Math.random() - 0.5);
                carried = hasAbe ? ['ABE', ...sims] : sims;
                break;
              } else break;
              loopCount++;
            }

            if (carried.includes('ABE')) {
              cellStacks[targetCell] = ['ABE', ...cellStacks[targetCell].filter(x => x !== 'ABE'), ...carried.filter(x => x !== 'ABE')];
              abePos = targetCell;
            } else cellStacks[targetCell] = [...cellStacks[targetCell], ...carried];

            if (myId === 'jangri' && cellStacks[targetCell].indexOf(mover) > 0) jangriStun[mover] = true;
            if (myId === 'aimes' && !yunoUsed[mover] && targetCell >= 16) {
              let targetAimesCell = -1;
              for (let c = targetCell + 1; c < 31; c++) { if (cellStacks[c].filter(x => x !== 'ABE').length > 0) { targetAimesCell = c; break; } }
              if (targetAimesCell !== -1) { yunoUsed[mover] = true; cellStacks[targetCell] = cellStacks[targetCell].filter(x => x !== mover); cellStacks[targetAimesCell].push(mover); }
            }
            if (myId === 'yuno' && !yunoUsed[mover] && targetCell >= 16) {
              const ranks = getRanks(); const idx = ranks.indexOf(mover); let tgs = [];
              if (idx > 0) tgs.push(ranks[idx - 1]); if (idx < ranks.length - 1) tgs.push(ranks[idx + 1]);
              if (tgs.length > 0) {
                yunoUsed[mover] = true; tgs.sort((a, b) => ranks.indexOf(b) - ranks.indexOf(a));
                for (let t of tgs) {
                  for (let c = 0; c < 32; c++) cellStacks[c] = cellStacks[c].filter(x => x !== t);
                  cellStacks[targetCell].push(t);
                }
              }
            }
            if (myId === 'sigrica') {
              const ranks = getRanks(); const rIdx = ranks.indexOf(mover);
              if (rIdx > 0) { sigricaDebuff[ranks[rIdx - 1]] = true; if (rIdx > 1) sigricaDebuff[ranks[rIdx - 2]] = true; }
            }
            if (myId === 'cartisia' && !cartisiaBuff[mover] && getRanks().slice(-1)[0] === mover) cartisiaBuff[mover] = true;
            if (myId === 'hiyuki' && !hiyukiActive[mover] && (targetCell === abePos || cellStacks[targetCell].includes('ABE'))) hiyukiActive[mover] = true;

            if (cellStacks[31].filter(x => x !== 'ABE').length > 0) break;
          }

          let geumheeIdx = players.findIndex(p => p.id === 'geumhee');
          if (geumheeIdx !== -1) {
            let geumheeCell = -1;
            for (let c = 0; c < 32; c++) { if (cellStacks[c].includes(geumheeIdx)) { geumheeCell = c; break; } }
            if (geumheeCell !== -1 && cellStacks[geumheeCell].indexOf(geumheeIdx) < cellStacks[geumheeCell].length - 1 && Math.random() < 0.4) {
              cellStacks[geumheeCell] = cellStacks[geumheeCell].filter(x => x !== geumheeIdx); cellStacks[geumheeCell].push(geumheeIdx);
            }
          }

          if (cellStacks[31].filter(x => x !== 'ABE').length > 0) {
            winner = cellStacks[31].filter(x => x !== 'ABE').slice(-1)[0];
          }

          if (winner !== null) break;
          currentRound++;
        }

        if (winner !== null) winCounts[winner]++;
        roundFinishedCounts.push(currentRound);
      }

      completed = target;
      setProgress(Math.floor((completed / totalSims) * 100));
      if (completed < totalSims) {
        setTimeout(executeChunk, 10);
      } else {
        setIsSimulating(false);
        const compiledResults = { 
          winPercent: winCounts.map(count => ((count / totalSims) * 100).toFixed(1)), 
          avgRounds: (roundFinishedCounts.reduce((a, b) => a + b, 0) / totalSims).toFixed(1), 
          totalSims 
        };
        setSimResults(compiledResults);

        const singlePlaybackGame = runSingleGame(activeRoster, selectedTrack);
        setVisualGame(singlePlaybackGame);
        setCurrentRoundIdx(0);
        setIsPlaying(true); 

        await processLiveAiReport(compiledResults, singlePlaybackGame, chosenMode);
      }
    };
    setTimeout(executeChunk, 10);
  };

  const processLiveAiReport = async (stats, playback, mode) => {
    setAiLoading(true);
    setAiError("");
    
    const rosNames = activeRoster.map(id => SAEALSIMS.find(p => p.id === id).name).join(", ");
    const winData = activeRoster.map((id, idx) => `${SAEALSIMS.find(p => p.id === id).name}: ${stats.winPercent[idx]}%`).join(", ");

    let systemPrompt = "", prompt = "";
    if (mode === 'madongseon') {
      systemPrompt = "너는 불법 사설 배팅판에서 수십 년간 활약한 베테랑 도박사 캐릭터 '마동선'이다. 한국어 배팅 전문가다운 거칠고 찰진 현장 용어('정배', '역배', '형님들 배팅 주먹 꽉쥐고')를 구사하여 위트 있게 작성하라.";
      prompt = `트랙: ${TRACKS[selectedTrack].name}, 라인업: [${rosNames}], 승률 데이터: [${winData}]. 마동선의 족집게 사설 배팅 예측 리포트를 브리핑해줘.`;
    } else if (mode === 'sports') {
      systemPrompt = "너는 열정적인 대한민국 E-sports 메인 캐스터다. 주사위 연산 및 장치 타일로 인해 뒤집히는 전개 상황을 육성 소리 지르듯 극적이고 긴장감 넘치게 해설하라.";
      prompt = `단판 하이라이트 로그: ${playback?.rounds.flatMap(r => r.log).slice(0,15).join("\n")}. 최종 우승자: ${playback?.winner?.name}. 이 경기의 손에 땀을 쥐는 생중계 스크립트를 짜줘.`;
    } else {
      systemPrompt = "너는 세계 최고 권위의 보드게임 밸런스 총괄 디자이너다. 데이터 기반 패치 아이디어를 이성적이고 설득력 있게 제시하라.";
      prompt = `현재 트랙: ${TRACKS[selectedTrack].name}, 승률 편차 데이터: [${winData}]. 우승 독점을 방해하거나 하위권을 구제할 참신한 밸런스 패치 아이디어를 제안해줘.`;
    }

    try {
      setIsAiAnalyzing(true); 
      const res = await callGeminiWithBackoff(prompt, systemPrompt);
      setAiReport(res);
      setAiCallCount(prev => prev + 1);
    } catch (e) {
      setAiError("API 분석 중 에러 발생: " + e.message);
    } finally {
      setAiLoading(false);
      setTimeout(() => {
        setIsAiAnalyzing(false); 
      }, 10000);
    }
  };

  const currentBoardState = useMemo(() => {
    if (!visualGame || !visualGame.rounds[currentRoundIdx]) return null;
    return visualGame.rounds[currentRoundIdx];
  }, [visualGame, currentRoundIdx]);

  useEffect(() => {
    if (isPlaying && visualGame) {
      playbackTimer.current = setInterval(() => {
        setCurrentRoundIdx(prev => {
          if (prev >= visualGame.rounds.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    } else {
      clearInterval(playbackTimer.current);
    }
    return () => clearInterval(playbackTimer.current);
  }, [isPlaying, visualGame]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-purple-500/40 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center border-t-4 border-t-purple-500">
            <h3 className="text-lg font-black text-white mb-1 flex items-center justify-center gap-1.5">
              <span>🤖</span> AI 가상 에이전트 브리핑 소집
            </h3>
            <p className="text-xs text-slate-400 mb-6">브리핑룸 에이전트로 어떤걸 선택하시겠습니까?</p>
            
            <div className="flex flex-col gap-2.5">
              <button
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 font-bold rounded-xl transition text-slate-100 text-xs shadow-md shadow-purple-500/10"
                onClick={() => executeSimulationAndAiCombo("madongseon")}
              >
                1. 도박사 (마동선 족집게 예측) 🎲
              </button>
              <button
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition text-slate-100 text-xs shadow-md shadow-blue-500/10"
                onClick={() => executeSimulationAndAiCombo("sports")}
              >
                2. 중계 (스포츠 하이라이트 중계) 🎙️
              </button>
              <button
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl transition text-slate-100 text-xs shadow-md shadow-emerald-500/10"
                onClick={() => executeSimulationAndAiCombo("designer")}
              >
                3. 밸런스 (밸런스 디자이너 리포트) 📐
              </button>
            </div>
            <button 
              className="mt-4 text-[10px] text-slate-500 hover:text-slate-400 underline"
              onClick={() => setIsAgentModalOpen(false)}
            >
              세팅 취소하고 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <span className="text-3xl animate-pulse">🏁</span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              새알심 레이스 정밀 시뮬레이터
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Monte Carlo Statistics Engine & AI Strategy Suite</p>
          </div>
        </div>
        <div>
          <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${isTournamentCheck ? 'bg-amber-500/10 border-amber-500/30 text-amber-400':'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'}`}>
            {isTournamentCheck ? '🏆 토너먼트 모드 적용' : '🎲 일반 경기 모드 적용'}
          </span>
        </div>
      </header>

      {/* 대시보드 그리드 본체 */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* [좌측 컨트롤 보드 패널] */}
        <section className="xl:col-span-5 flex flex-col space-y-6">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span>⚙️</span> 제어 매개변수 커스텀 설정
            </h2>
            
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2">활성 경기 트랙 모델 코스</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(TRACKS).map(k => (
                  <button 
                    key={k} 
                    onClick={() => { setSelectedTrack(k); setIsTournamentCheck(k==='tournament'); setSimResults(null); }} 
                    className={`p-3 rounded-xl border text-left transition-all ${selectedTrack === k ? 'border-amber-500 bg-amber-500/5 text-amber-300 shadow-md shadow-amber-500/5':'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="font-bold text-xs">{TRACKS[k].name}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{TRACKS[k].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-2">빠른 프리셋 조 편성</label>
              <div className="flex flex-wrap gap-2">
                {MATCH_PRESETS.map((p, i) => (
                  <button 
                    key={i} 
                    onClick={() => loadPreset(p)} 
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 rounded-lg text-xs font-medium text-slate-300 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800/60">
              <select 
                value={simCount} 
                onChange={e => setSimCount(Number(e.target.value))} 
                className="bg-slate-950 border border-slate-800 rounded-lg text-xs py-1.5 px-3 text-slate-300 outline-none"
              >
                <option value={10000}>10,000회 연산 (Fast)</option>
                <option value={50000}>50,000회 연산 (Normal)</option>
                <option value={100000}>100,000회 연산 (Precise)</option>
              </select>
              
              <button 
                onClick={handleStartClick} 
                disabled={isSimulating} 
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black rounded-lg transition shadow-lg disabled:opacity-50"
              >
                {isSimulating ? `연산 매칭 중 (${progress}%)` : '🔄 시뮬레이션 엔진 가동'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex-1 flex flex-col shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex justify-between items-center">
              <span>🥚 출전 새알심 커스텀 풀 로스터 스펙</span>
              <span className="text-cyan-400 font-mono text-xs font-bold bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded-full">{activeRoster.length} / 6 선택됨</span>
            </h2>
            
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[460px] pr-1 p-2 bg-slate-950/30 rounded-xl">
              {SAEALSIMS.map(s => {
                const isSelected = activeRoster.includes(s.id);
                return (
                  <button 
                    key={s.id} 
                    onClick={() => toggleSaealsim(s.id)} 
                    className={`p-2.5 rounded-xl border text-left transition-all ${isSelected ? 'border-amber-500 bg-amber-500/10 shadow-md':'border-slate-800/60 bg-slate-950/40 hover:border-slate-700'}`}
                  >
                    <div className="flex justify-between items-center font-bold text-xs">
                      <span style={{ color: s.color }}>● {s.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${s.tier==='S'?'bg-red-500/10 text-red-400':s.tier==='A'?'bg-orange-500/10 text-orange-400':'bg-slate-800 text-slate-400'}`}>{s.tier}티어</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight mt-1 line-clamp-2 h-7">{s.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* [우측 통계 분석 및 디스플레이 패널] */}
        <section className="xl:col-span-7 flex flex-col space-y-6">
          
          {/* 위치 3: 몬테카를로 통계 판독 차트 */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span>📊</span> 10,000회 이상 무작위 알고리즘 Monte Carlo 통계 판독 차트
            </h2>
            
            {isSimulating ? (
              <div className="h-[230px] flex flex-col items-center justify-center text-xs text-slate-400 border border-slate-800/50 rounded-xl bg-slate-950/20">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span>대용량 시뮬레이션 루프 난수 데이터 연산 추출 중...</span>
              </div>
            ) : simResults ? (
              <div className="space-y-4">
                <div className="flex space-x-4 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs font-semibold">
                  <div className="flex-1 text-center border-r border-slate-800">총 루프 시행수: <span className="text-amber-400 font-black">{simResults.totalSims.toLocaleString()}회</span></div>
                  <div className="flex-1 text-center">평균 완주 소요 라운드: <span className="text-indigo-400 font-black">{simResults.avgRounds} R</span></div>
                </div>
                <div className="space-y-3.5 border border-slate-800/40 p-4 bg-slate-950/20 rounded-xl">
                  {activeRoster.map((id, i) => {
                    const s = SAEALSIMS.find(p => p.id === id); 
                    const pct = simResults.winPercent[i] || "0.0";
                    return (
                      <div key={id} className="flex items-center space-x-4 text-xs">
                        <div className="w-16 font-bold text-slate-300 truncate">{s?.name}</div>
                        <div className="flex-1 bg-slate-950 h-6 rounded-lg relative border border-slate-800/60 overflow-hidden flex items-center">
                          <div className="h-full rounded-r transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: s?.color }} />
                          <span className="absolute right-3 font-mono font-black text-cyan-400">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[230px] flex items-center justify-center text-xs text-slate-500 border border-slate-800/40 rounded-xl bg-slate-950/10">
                좌측에서 엔진 가동 버튼을 선택하면 몬테카를로 난수 연산 집계가 활성화됩니다.
              </div>
            )}
          </div>

          {/* ⭐ [위치 대이동 4] Play-by-Play 단판 하이라이트 주행 디스플레이 (트랙 시각화 완전 커스텀 개편) */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="flex justify-between items-center text-xs mb-4">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎮</span> Play-by-Play 단판 하이라이트 주행 디스플레이
              </h2>
              {visualGame && (
                <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1 border border-slate-800 rounded-lg">
                  <button 
                    onClick={() => { setIsPlaying(false); setCurrentRoundIdx(0); }}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold"
                  >
                    🔄 처음으로
                  </button>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)} 
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPlaying ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}
                  >
                    {isPlaying ? '⏸️ 정지' : '▶️ 재생'}
                  </button>
                  <span className="text-slate-500 font-mono text-[10px]">R: {currentRoundIdx}/{visualGame.totalRounds}</span>
                </div>
              )}
            </div>
            
            {visualGame && currentBoardState ? (
              <div className="space-y-3">
                {/* ── 🔮 [리팩토링] 하이테크 스타일 이모지 및 그라데이션 트랙 매핑 가동 ── */}
                <div className="overflow-x-auto pb-2 flex space-x-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 scrollbar-thin">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const stack = currentBoardState.stacks[i] || [];
                    const type = TRACKS[selectedTrack].layout[i];
                    
                    // 조건부 스타일/아이콘 주입 자동화
                    let tileStyle = "bg-slate-900/50 border-slate-800/60";
                    let tileIcon = "";
                    let tileName = "";

                    if (i === 0) {
                      tileStyle = "bg-blue-950/40 border-blue-600/50 shadow-inner text-blue-400";
                      tileName = "START";
                    } else if (i === 31) {
                      tileStyle = "bg-emerald-950/40 border-emerald-600/50 shadow-inner text-emerald-400";
                      tileName = "GOAL";
                    } else if (type === 'B') {
                      tileStyle = "bg-emerald-900/20 border-emerald-500/30 text-emerald-400 font-black";
                      tileIcon = "▶▶";
                      tileName = "BOOST";
                    } else if (type === 'R') {
                      tileStyle = "bg-rose-900/20 border-rose-500/30 text-rose-400 font-black";
                      tileIcon = "◀◀";
                      tileName = "REVERSE";
                    } else if (type === 'C') {
                      tileStyle = "bg-purple-900/20 border-purple-500/30 text-purple-400 font-black";
                      tileIcon = "🌀";
                      tileName = "CRACK";
                    }

                    return (
                      <div 
                        key={i} 
                        className={`w-12 h-20 border flex flex-col justify-between p-1 text-[8px] rounded-lg shrink-0 transition-all ${tileStyle}`}
                      >
                        {/* 상단 인덱스 및 상태 아이콘 스트림 */}
                        <div className="flex justify-between font-mono text-slate-500 font-bold">
                          <span>{String(i).padStart(2, '0')}</span>
                          <span className="text-[8px] tracking-tighter">{tileIcon}</span>
                        </div>

                        {/* 중간 장치 가이드 명칭 */}
                        {tileName && (
                          <div className="text-[7px] font-black text-center opacity-60 tracking-tighter -mt-1 font-sans">
                            {tileName}
                          </div>
                        )}

                        {/* 하단 새알심 물리적 스택 기믹 조작부 */}
                        <div className="flex flex-col-reverse space-y-reverse space-y-0.5 overflow-y-auto max-h-[38px] pr-0.5">
                          {stack.map((item, idx) => (
                            <div 
                              key={idx} 
                              className="h-3 rounded text-center text-[7.5px] font-black text-slate-950 truncate flex items-center justify-center shadow-sm" 
                              style={{ backgroundColor: item === 'ABE' ? '#f43f5e' : SAEALSIMS.find(p => p.id === activeRoster[item])?.color }}
                            >
                              {item === 'ABE' ? '👑Abe' : SAEALSIMS.find(p => p.id === activeRoster[item])?.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-2.5 text-[10px] font-mono text-slate-400 max-h-[70px] overflow-y-auto shadow-inner">
                  {currentBoardState.log.map((logLine, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center text-slate-300 py-0.5">
                      <span className="text-amber-500 text-[8px]">⚡</span>
                      <span>{logLine}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[120px] flex items-center justify-center text-xs text-slate-500 border border-slate-800/40 rounded-xl bg-slate-950/10">
                시뮬레이션이 발동되면 임의로 추출된 1게임의 박진감 넘치는 라운드별 변동 이력이 연동됩니다.
              </div>
            )}
          </div>

          {/* ⭐ [위치 대이동 5] LLM AI 분석 가상 에이전트 브리핑룸 (최하단 정렬 배치) */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span>✨</span> LLM AI 분석 가상 에이전트 브리핑룸
            </h2>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[140px] text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto font-mono shadow-inner">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-4 text-center animate-pulse text-slate-400">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-yellow-400 font-semibold text-[11px]">{aiStatusMessage}</span>
                </div>
              ) : aiError ? (
                <span className="text-red-400">{aiError}</span>
              ) : aiReport ? (
                <div>
                  <div className="text-[9px] text-amber-500/60 font-sans mb-1 text-right">
                    🔒 악성 디도스 방어 활성화 (잔여 사용 한도: {3 - aiCallCount}회)
                  </div>
                  {aiReport}
                </div>
              ) : (
                <span className="text-slate-500">
                  📊 시뮬레이션 매칭 시 고른 에이전트 모드가 실시간 기동 로직에 결합되어 차트 분석과 동시에 출력됩니다. (현재 기본 대기: 마동선 족집게 예측)
                </span>
              )}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}