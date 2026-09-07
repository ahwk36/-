// localStorage에 저장된 골드가 있으면 가져오고, 없으면 기본값 20000G 적용
function getSavedGold(pIdx, defaultGold = 20000) {
    const saved = localStorage.getItem(`player_gold_${pIdx}`);
    return saved !== null ? parseInt(saved, 10) : defaultGold;
}

let players = [
    { name: "나", values: [1,1,1,1,1], held: [false,false,false,false,false], rankInfo: null, gold: getSavedGold(0) },
    { name: "컴퓨터1", values: [1,1,1,1,1], held: [false,false,false,false,false], rankInfo: null, gold: getSavedGold(1) },
    { name: "컴퓨터2", values: [1,1,1,1,1], held: [false,false,false,false,false], rankInfo: null, gold: getSavedGold(2) }
];

let rollCount = 0; // 0: 시작전, 1: 1차완료, 2: 2차완료, 3: 3차완료
let currentBet = 100;
let totalPot = 0;
let isRolling = false;

function toggleGuide() {
    const guidePanel = document.getElementById('guide-panel');
    guidePanel.classList.toggle('hidden');
}

async function playTurn() {
    if (isRolling || rollCount >= 3) return;

    if (rollCount === 0) {
        const betInput = document.getElementById('bet-input');
        let bet = parseInt(betInput.value);

        if (isNaN(bet) || bet < 100) bet = 100;
        if (bet > 1000) bet = 1000;
        betInput.value = bet;
        currentBet = bet;

        if (players[0].gold < currentBet) {
            alert("소지금이 부족합니다! 판돈을 낮추거나 충전해주세요.");
            checkGoldAndToggleCharge();
            return;
        }

        players.forEach(p => {
            p.gold = Math.max(0, p.gold - currentBet);
        });
        
        totalPot = currentBet * 3;
        updateGoldUI();
        document.getElementById('total-pot').innerText = totalPot;
        document.getElementById('bet-input').disabled = true;
    }

    isRolling = true;
    document.getElementById('roll-btn').disabled = true;

    if (rollCount > 0) {
        aiHoldDecision(1);
        aiHoldDecision(2);
    }

    await animateDiceRoll();

    rollCount++;

    if (rollCount === 1) {
        document.getElementById('reroll-count').innerText = "주사위를 클릭하여 HOLD 설정 후 2차 굴리기를 누르세요.";
        document.getElementById('roll-btn').innerText = "2차 굴리기";
        document.getElementById('roll-btn').disabled = false;
    } else if (rollCount === 2) {
        document.getElementById('reroll-count').innerText = "HOLD 재설정 후 최종 굴리기를 누르세요.";
        document.getElementById('roll-btn').innerText = "최종 굴리기";
        document.getElementById('roll-btn').disabled = false;
    } else if (rollCount === 3) {
        document.getElementById('reroll-count').innerText = "모든 굴림 완료!";
        document.getElementById('roll-btn').style.display = "none";
        document.getElementById('next-btn').style.display = "inline-block";
        determineWinner();
    }

    isRolling = false;
}

function animateDiceRoll() {
    return new Promise(resolve => {
        const rollClasses = ['roll-type-A', 'roll-type-B'];

        for (let pIdx = 0; pIdx < 3; pIdx++) {
            for (let i = 0; i < 5; i++) {
                if (!players[pIdx].held[i]) {
                    const cubeEl = document.getElementById(`p${pIdx}-d${i}`);
                    const randomClass = rollClasses[Math.floor(Math.random() * rollClasses.length)];
                    
                    cubeEl.classList.remove('roll-type-A', 'roll-type-B');
                    void cubeEl.offsetWidth; 
                    cubeEl.classList.add(randomClass);
                }
            }
        }

        setTimeout(() => {
            finalizeRoll();
            resolve();
        }, 1000);
    });
}

function finalizeRoll() {
    // 주사위 6개 면에 대한 정방향 3D 절대 회전 좌표 (X, Y 조합 정밀 수정)
    const rotMap = {
        1: 'rotateX(0deg) rotateY(0deg)',
        2: 'rotateX(0deg) rotateY(-90deg)',
        3: 'rotateX(-90deg) rotateY(0deg)',
        4: 'rotateX(90deg) rotateY(0deg)',
        5: 'rotateX(0deg) rotateY(90deg)',
        6: 'rotateX(180deg) rotateY(0deg)'
    };

    for (let pIdx = 0; pIdx < 3; pIdx++) {
        const p = players[pIdx];

        for (let i = 0; i < 5; i++) {
            const cubeEl = document.getElementById(`p${pIdx}-d${i}`);
            cubeEl.classList.remove('roll-type-A', 'roll-type-B');

            if (!p.held[i]) {
                p.values[i] = Math.floor(Math.random() * 6) + 1;
            }

            // 정확한 주사위 눈금 정렬 매핑
            cubeEl.style.transform = rotMap[p.values[i]];
        }

        p.rankInfo = evaluateHand(p.values);
        const sum = p.values.reduce((a, b) => a + b, 0);
        document.getElementById(`p${pIdx}-rank`).innerText = p.rankInfo.name;
        document.getElementById(`p${pIdx}-sum`).innerText = sum;
    }
}

function aiHoldDecision(pIdx) {
    const p = players[pIdx];
    const counts = {};
    p.values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    
    const diceWrappers = document.querySelectorAll(`#p${pIdx}-dice .dice-wrapper`);

    for (let i = 0; i < 5; i++) {
        if (counts[p.values[i]] >= 2) {
            p.held[i] = true;
            diceWrappers[i].classList.add('held');
        }
    }
}

function toggleHold(index) {
    if (rollCount === 0 || rollCount === 3 || isRolling) return;

    players[0].held[index] = !players[0].held[index];
    const diceWrappers = document.querySelectorAll('#p0-dice .dice-wrapper');
    
    if (players[0].held[index]) {
        diceWrappers[index].classList.add('held');
    } else {
        diceWrappers[index].classList.remove('held');
    }
}

function evaluateHand(dice) {
    const counts = {};
    dice.forEach(num => { counts[num] = (counts[num] || 0) + 1; });

    const entries = Object.entries(counts).map(([num, count]) => ({ num: Number(num), count }));
    entries.sort((a, b) => b.count - a.count || b.num - a.num);

    const sum = dice.reduce((a, b) => a + b, 0);

    if (entries[0].count === 5) {
        return { name: "파이브 다이스", score: 70000 + entries[0].num };
    }
    if (entries[0].count === 4) {
        const kicker = entries[1].num;
        return { name: "포 다이스", score: 60000 + (entries[0].num * 10) + kicker };
    }
    if (entries[0].count === 3 && entries[1].count === 2) {
        return { name: "풀 하우스", score: 50000 + (entries[0].num * 10) + entries[1].num };
    }
    if (entries[0].count === 3) {
        const kickersSum = entries.slice(1).reduce((acc, cur) => acc + (cur.num * cur.count), 0);
        return { name: "쓰리 다이스", score: 40000 + (entries[0].num * 100) + kickersSum };
    }
    if (entries[0].count === 2 && entries[1].count === 2) {
        const highPair = Math.max(entries[0].num, entries[1].num);
        const lowPair = Math.min(entries[0].num, entries[1].num);
        const kicker = entries[2].num;
        return { name: "투 페어", score: 30000 + (highPair * 100) + (lowPair * 10) + kicker };
    }
    if (entries[0].count === 2) {
        const kickersSum = entries.slice(1).reduce((acc, cur) => acc + (cur.num * cur.count), 0);
        return { name: "원 페어", score: 20000 + (entries[0].num * 100) + kickersSum };
    }
    return { name: "노 페어", score: 10000 + sum };
}

function determineWinner() {
    const sorted = [...players].sort((a, b) => b.rankInfo.score - a.rankInfo.score);

    const highestScore = sorted[0].rankInfo.score;
    const winners = sorted.filter(p => p.rankInfo.score === highestScore);

    document.querySelectorAll('.player-card').forEach(card => card.classList.remove('winner'));

    if (winners.length > 1) {
        const splitPot = Math.floor(totalPot / winners.length);
        winners.forEach(w => {
            w.gold += splitPot;
            const wIdx = players.indexOf(w);
            const cardEl = document.getElementById(`player-card-${wIdx}`);
            if (cardEl) cardEl.classList.add('winner');
        });
        document.getElementById('winner-text').innerText = `무승부! 판돈을 나누어 가집니다 (+${splitPot}G)`;
    } else {
        const winner = winners[0];
        winner.gold += totalPot;
        const winnerIdx = players.indexOf(winner);
        const cardEl = document.getElementById(`player-card-${winnerIdx}`);
        if (cardEl) cardEl.classList.add('winner');
        document.getElementById('winner-text').innerText = `🏆 승자: ${winner.name}! (+${totalPot}G 획득)`;
    }

    updateGoldUI();
    checkGoldAndToggleCharge();
}

function updateGoldUI() {
    for (let i = 0; i < 3; i++) {
        // 화면 표기 업데이트
        document.getElementById(`p${i}-gold`).innerText = players[i].gold;
        // 브라우저에 소지금 데이터 저장
        localStorage.setItem(`player_gold_${i}`, players[i].gold);
    }
}

function checkGoldAndToggleCharge() {
    const chargeBtn = document.getElementById('charge-btn');
    if (players[0].gold < 100) {
        chargeBtn.style.display = 'inline-block';
        document.getElementById('roll-btn').disabled = true;
    } else {
        chargeBtn.style.display = 'none';
    }
}

function chargeGold() {
    players[0].gold += 5000;
    if (players[1].gold < 100) players[1].gold += 5000;
    if (players[2].gold < 100) players[2].gold += 5000;

    updateGoldUI();
    checkGoldAndToggleCharge();
    if (rollCount < 3) {
        document.getElementById('roll-btn').disabled = false;
    }
    document.getElementById('winner-text').innerText = "5000G가 충전되었습니다!";
}

function nextRound() {
    if (isRolling) return;

    rollCount = 0;
    totalPot = 0;

    players.forEach(p => {
        p.values = [1,1,1,1,1];
        p.held = [false,false,false,false,false];
        p.rankInfo = null;
    });

    document.getElementById('reroll-count').innerText = "주사위를 굴려 시작하세요!";
    document.getElementById('total-pot').innerText = "0";
    
    document.getElementById('bet-input').disabled = false;
    
    document.getElementById('roll-btn').innerText = "1차 굴리기";
    document.getElementById('roll-btn').style.display = "inline-block";
    document.getElementById('roll-btn').disabled = false;
    
    document.getElementById('next-btn').style.display = "none";
    document.getElementById('winner-text').innerText = "배팅액을 정하고 주사위를 굴리세요!";

    document.querySelectorAll('.player-card').forEach(card => card.classList.remove('winner'));

    for (let pIdx = 0; pIdx < 3; pIdx++) {
        const diceWrappers = document.querySelectorAll(`#p${pIdx}-dice .dice-wrapper`);
        diceWrappers.forEach((el, i) => {
            el.classList.remove('held');
            const cubeEl = document.getElementById(`p${pIdx}-d${i}`);
            cubeEl.classList.remove('roll-type-A', 'roll-type-B');
            cubeEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
        });
        document.getElementById(`p${pIdx}-rank`).innerText = "-";
        document.getElementById(`p${pIdx}-sum`).innerText = "0";
    }

    checkGoldAndToggleCharge();
}