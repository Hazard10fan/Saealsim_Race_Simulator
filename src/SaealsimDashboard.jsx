import React, { useState, useEffect, useMemo, useRef } from 'react';

// ==========================================
// Gemini API Key 설정 및 호출 함수 (정식 모델 규격 최적화)
// ==========================================
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

const callGeminiWithBackoff = async (prompt, systemInstruction = "") => {
  // 💡 정식 출시된 gemini-2.5-flash 모델 엔드포인트 고정
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  // 💡 구글 서버가 400 에러 없이 단번에 알아먹는 정석 페이로드 구조 개편
  const payload = {
    contents: [{ 
      parts: [{ text: prompt }] 
    }],
    // 시스템 명령어(마동선, 캐스터 설정) 구조의 불필요한 레이어를 걷어내고 정석 매핑
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
  const [activeAiTab, setActiveAiTab] = useState("");

  const loadPreset = (preset) => {
    setActiveRoster(preset.roster);
    setSelectedTrack(preset.track);
    setIsTournamentCheck(preset.track === 'tournament');
    setSimResults(null);
    setVisualGame(null);
    setAiReport("");
    setActiveAiTab("");
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

  // 10,000 ~ 100,000회 대용량 루프 몬테카를로 엔진
  const runMonteCarlo = () => {
    setIsSimulating(true);
    setProgress(0);
    setAiReport("");
    
    const layout = TRACKS[selectedTrack].layout;
    const players = activeRoster.map(id => SAEALSIMS.find(s => s.id === id));
    let winCounts = Array(players.length).fill(0);
    let roundFinishedCounts = [];
    
    const totalSims = simCount;
    const chunkSize = Math.max(1000, Math.floor(totalSims / 10));
    let completed = 0;

    const executeChunk = () => {
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
      if (completed < totalSims) setTimeout(executeChunk, 10);
      else {
        setIsSimulating(false);
        setSimResults({ 
          winPercent: winCounts.map(count => ((count / totalSims) * 100).toFixed(1)), 
          avgRounds: (roundFinishedCounts.reduce((a, b) => a + b, 0) / totalSims).toFixed(1), 
          totalSims 
        });
        setVisualGame(runSingleGame(activeRoster, selectedTrack));
        setCurrentRoundIdx(0);
      }
    };
    setTimeout(executeChunk, 10);
  };

  const currentBoardState = useMemo(() => {
    if (!visualGame || !visualGame.rounds[currentRoundIdx]) return null;
    return visualGame.rounds[currentRoundIdx];
  }, [visualGame, currentRoundIdx]);

  // 단판 트랙 주행 자동 플레이 타이머 제어
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

  const triggerAiAnalysis = async (type) => {
    if (!simResults) return;
    setAiLoading(true); setAiError(""); setActiveAiTab(type);
    const rosNames = activeRoster.map(id => SAEALSIMS.find(p => p.id === id).name).join(", ");
    const winData = activeRoster.map((id, idx) => `${SAEALSIMS.find(p => p.id === id).name}: ${simResults.winPercent[idx]}%`).join(", ");

    let systemPrompt = "", prompt = "";
    if (type === 'commentary') {
      systemPrompt = "너는 불법 사설 배팅판에서 수십 년간 활약한 베테랑 도박사 캐릭터 '마동선'이다. 한국어 경마 배팅 전문가다운 거칠고 찰진 현장 용어('정배', '역배', '올인 행님들')를 구사하여 위트 있게 작성하라.";
      prompt = `트랙: ${TRACKS[selectedTrack].name}, 라인업: [${rosNames}], 승률: [${winData}]. 마동선의 족집게 사설 배팅 예측 리포트를 브리핑해줘.`;
    } else if (type === 'live') {
      systemPrompt = "너는 열정적인 대한민국 E-sports 메인 캐스터다. 주사위 연산 및 장치 타일로 인해 뒤집히는 전개 상황을 육성 소리 지르듯 극적이고 긴장감 넘치게 해설하라.";
      prompt = `단판 하이라이트 로그: ${visualGame?.rounds.flatMap(r => r.log).slice(0,15).join("\n")}. 최종 우승자: ${visualGame?.winner?.name}. 이 경기의 손에 땀을 쥐는 생중계 스크립트를 짜줘.`;
    } else {
      systemPrompt = "너는 세계 최고 권위의 보드게임 밸런스 총괄 디자이너다. 데이터 기반 패치 아이디어를 이성적이고 설득력 있게 제시하라.";
      prompt = `현재 트랙: ${TRACKS[selectedTrack].name}, 승률 편차 데이터: [${winData}]. 우승 독점을 방해하거나 하위권을 구제할 참신한 밸런스 패치 아이디어를 제안해줘.`;
    }

    try {
      const res = await callGeminiWithBackoff(prompt, systemPrompt);
      setAiReport(res);
    } catch (e) { setAiError("API 분석 중 에러 발생: " + e.message); }
    finally { setAiLoading(false); }
  };

  useEffect(() => {
    runMonteCarlo();
  }, [activeRoster, selectedTrack, simCount]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. 상단 글로벌 대시보드 헤더 */}
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
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${isTournamentCheck ? 'bg-amber-500/10 border-amber-500/30 text-amber-400':'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'}`}>
            {isTournamentCheck ? '🏆 토너먼트 모드 적용' : '🎲 일반 경기 모드 적용'}
          </span>
        </div>
      </header>

      {/* 2. 대시보드 메인 양면 구조 그리드 레이아웃 */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* [좌측 컨트롤 보드 패널] */}
        <section className="xl:col-span-5 flex flex-col space-y-6">
          
          {/* 하이테크 환경 설정 카드 */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
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
              <label className="block text-xs text-slate-400 mb-2">빠른 다이렉트 매치업 프리셋 조 편성</label>
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
                className="bg-slate-950 border border-slate-800 rounded-lg text-xs py-1.5 px-3 text-slate-300 outline-none focus:border-amber-500 transition"
              >
                <option value={10000}>10,000회 연산 (Fast)</option>
                <option value={50000}>50,000회 연산 (Normal)</option>
                <option value={100000}>100,000회 연산 (Precise)</option>
              </select>
              <button 
                onClick={runMonteCarlo} 
                disabled={isSimulating} 
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black rounded-lg transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {isSimulating ? `연산 가동 중 (${progress}%)` : '🔄 시뮬레이션 엔진 가동'}
              </button>
            </div>
          </div>

          {/* 18명 새알심 전용 대규모 인벤토리 프로필 선택 풀 */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 flex-1 flex flex-col shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex justify-between items-center">
              <span>🥚 출전 새알심 커스텀 풀 로스터 스펙</span>
              <span className="text-cyan-400 font-mono text-xs font-bold bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded-full">{activeRoster.length} / 6 선택됨</span>
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">최소 3명에서 최대 6명까지 출전 리스트를 선택해 시뮬레이션을 재구성할 수 있습니다.</p>
            
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[420px] pr-1 border border-slate-800/40 p-2 bg-slate-950/30 rounded-xl">
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
                    <div className="flex gap-2 text-[9px] text-slate-400 font-medium mt-0.5">
                      <span>형태: <strong className="text-slate-300">{s.type}</strong></span>
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
          
          {/* 10만 회 몬테카를로 통계 판독 미터 차트 카드 */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span>📊</span> 10,000회 이상 무작위 알고리즘 Monte Carlo 통계 판독 차트
            </h2>
            
            {isSimulating ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-xs text-slate-400 border border-slate-800/50 rounded-xl bg-slate-950/20">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                <span>대용량 시뮬레이션 루프 트랙 난수 수집 장치 연산 데이터 추출 중...</span>
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
                        <div className="flex-1 bg-slate-950 h-6 rounded-lg relative border border-slate-800/60 overflow-hidden shadow-inner flex items-center">
                          <div 
                            className="h-full rounded-r transition-all duration-1000 ease-out shadow-lg" 
                            style={{ width: `${pct}%`, backgroundColor: s?.color }} 
                          />
                          <span className="absolute right-3 font-mono font-black text-xs text-cyan-400">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* ✨ LLM AI 분석 및 전략 브리핑룸 스위처 카드 */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span>✨</span> LLM AI 분석 가상 에이전트 브리핑룸
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['commentary', '🔮 마동선 족집게 예측'], 
                ['live', '🎙️ 스포츠 하이라이트 중계'], 
                ['patch', '🛠️ 밸런스 디자이너 리포트']
              ].map(([type, label]) => (
                <button 
                  key={type} 
                  onClick={() => triggerAiAnalysis(type)} 
                  disabled={!simResults || aiLoading} 
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${activeAiTab === type ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-md':'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[160px] text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto scrollbar-thin font-mono shadow-inner">
              {aiLoading ? (
                <div className="flex items-center gap-2 text-slate-400 animate-pulse">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                  <span>Gemini LLM이 시뮬레이션 데이터를 인공지능 기반으로 전술적 해석 및 기획 중입니다...</span>
                </div>
              ) : aiError ? (
                <span className="text-red-400">{aiError}</span>
              ) : aiReport ? (
                aiReport
              ) : (
                <span className="text-slate-500">📊 상단의 분석 스위치 버튼을 선택하면 Gemini API가 활성화되어 몬테카를로 통계 분석 맞춤형 브리핑 리포트를 즉시 생성합니다.</span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 3. 하단 단판 재생 컨트롤 플레이어 시각화 화면 */}
{/* 3. 하단 단판 재생 컨트롤 플레이어 시각화 화면 */}
      <footer className="border-t border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm">
        <div className="max-w-[1700px] mx-auto space-y-4">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🎮</span>
              <h3 className="font-bold text-slate-200 uppercase tracking-wider">Play-by-Play 단판 하이라이트 주행 디스플레이</h3>
            </div>
            
            {/* 📁 [여기서부터 교체 적용된 영역입니다] */}
            {visualGame && (
              <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-xl">
                
                {/* 🔄 새로 추가된 처음으로 (초기화) 버튼 */}
                <button 
                  onClick={() => {
                    setIsPlaying(false);        // 1. 자동 주행 재생을 멈춘다
                    setCurrentRoundIdx(0);      // 2. 라운드 번호표를 0(출발점)으로 되돌린다
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold transition border border-slate-700 active:scale-95"
                >
                  🔄 처음으로
                </button>

                {/* 기존 경기 재생 버튼 */}
                <button 
                  onClick={() => setIsPlaying(!isPlaying)} 
                  className={`px-3 py-1 rounded text-[11px] font-bold transition text-slate-950 active:scale-95 ${isPlaying ? 'bg-red-400 hover:bg-red-500 text-white' : 'bg-amber-400 hover:bg-amber-300'}`}
                >
                  {isPlaying ? '⏸️ 일시정지' : '▶️ 경기 재생'}
                </button>
                
                {/* 기존 라운드 카운터 표기 */}
                <span className="text-slate-400 p-1 font-mono text-[11px] tracking-widest font-black">ROUND: {currentRoundIdx} / {visualGame.totalRounds} R</span>
              </div>
            )}
          </div>
          
          {/* ??이 올려주신 32칸 트랙 보드 및 로그창 레이아웃 (그대로 보존됨) */}
          {visualGame && currentBoardState && (
            <div className="space-y-4 animate-fadeIn">
              {/* 32칸 트랙 그래픽 보드 패널 */}
              <div className="overflow-x-auto pb-3 flex space-x-1.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 shadow-inner scrollbar-thin">
                {Array.from({ length: 32 }).map((_, i) => {
                  const stack = currentBoardState.stacks[i] || [];
                  const type = TRACKS[selectedTrack].layout[i];
                  return (
                    <div 
                      key={i} 
                      className={`w-14 h-24 border flex flex-col justify-between p-1.5 text-[9px] rounded-xl transition-all shrink-0 ${i === 0 ? 'bg-blue-950/40 border-blue-800/60': i === 31 ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-slate-900/80 border-slate-800/80'}`}
                    >
                      <div className="flex justify-between font-black text-[9px]">
                        <span className="text-slate-500 font-mono">{i}</span>
                        <span className={`px-1 rounded text-[8px] font-black ${type==='B'?'text-amber-400 bg-amber-950/60':type==='R'?'text-red-400 bg-red-950/60':type==='C'?'text-purple-400 bg-purple-950/60':'text-transparent'}`}>
                          {type !== 'N' && type}
                        </span>
                      </div>
                      
                      <div className="flex flex-col-reverse space-y-reverse space-y-1 overflow-y-auto max-h-[55px] pr-0.5">
                        {stack.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="h-3.5 rounded-md text-center text-[9px] font-black text-slate-950 truncate flex items-center justify-center shadow-sm transition-all" 
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
              
              {/* 라이브 자막 텍스트 중계 스크립트 로그 */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-medium text-slate-400 max-h-[85px] overflow-y-auto font-mono leading-relaxed shadow-inner">
                {currentBoardState.log.map((logLine, idx) => (
                  <div key={idx} className="flex gap-2 items-center text-slate-300 py-0.5 border-b border-slate-900/50 last:border-0">
                    <span className="text-amber-500 text-[9px]">⚡</span>
                    <span>{logLine}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}