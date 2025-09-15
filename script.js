// ===== 환경 설정 =====
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzrQYWsGtcivWnD2ydP7PeNuWhEkeomZ7G1FpSnflUAjs00w6zT8bsjyPnugGmwyplS/exec';
const PRICE = { adult: 7000, youth: 5000 };
const STORAGE_KEY = 'jb-reserve-draft-v1';

// ===== 유틸 =====
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const vibrate = ms => { if (navigator.vibrate) navigator.vibrate(ms); };
const fmt = n => Number(n).toLocaleString();

function nearest20Slot(base = new Date(), addSteps = 0) {
  // 0,20,40 분 가장 가까운 slot(±3분 이내는 현재 slot로 간주)
  const slots = [0, 20, 40];
  const d = new Date(base);
  let h = d.getHours(), m = d.getMinutes();

  let chosen = slots.find(s => m <= s + 3);
  if (chosen === undefined) { h = (h + 1) % 24; chosen = 0; }

  // addSteps: 0=지금, 1=다음, 2=다다음
  let totalSteps = slots.indexOf(chosen) + addSteps;
  h = (h + Math.floor(totalSteps / slots.length)) % 24;
  chosen = slots[totalSteps % slots.length];

  return `${String(h).padStart(2, '0')}:${String(chosen).padStart(2, '0')}`;
}

// Draft 저장/복원
function saveDraft(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
}
function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearDraft() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

function showSnack(msg, type = 'info', ms = 1800) {
  const el = $('#snackbar');
  el.textContent = msg;
  el.className = `snackbar ${type} show`;
  $('#liveRegion').textContent = msg;
  setTimeout(() => el.classList.remove('show'), ms);
}

// ===== 메인 =====
document.addEventListener('DOMContentLoaded', () => {
  const form = $('#reservationForm');
  const result = $('#result');
  const submitBtn = $('#submitBtn');
  const priceText = $('#priceText');
  const priceDetail = $('#priceDetail');

  // 방/난이도 라디오형 토글
  const roomButtons = $$('.room-buttons .seg');
  const roomInput = $('#roomSize');
  roomButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roomButtons.forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      roomInput.value = btn.dataset.value;
      vibrate(10);
      updateDraft();
    });
  });

  const diffButtons = $$('.difficulty-buttons .diff');
  const diffInput = $('#difficulty');
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      diffButtons.forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      diffInput.value = btn.dataset.value;
      vibrate(10);
      updateDraft();
    });
  });

  // 카운터 +/-
  function adjustCount(id, delta) {
    const inp = document.getElementById(id);
    const v = Math.max(0, (Number(inp.value) || 0) + delta);
    inp.value = v;
    vibrate(8);
    syncPrice();
    updateDraft();
  }
  $$('.btn-ghost.minus').forEach(b => b.addEventListener('click', () => adjustCount(b.dataset.target, -1)));
  $$('.btn-ghost.plus').forEach(b => b.addEventListener('click', () => adjustCount(b.dataset.target, 1)));

  // 프리셋(1+1 등)
  $$('.chip.preset').forEach(chip => {
    chip.addEventListener('click', () => {
      $('#adultCount').value = Number(chip.dataset.adult);
      $('#youthCount').value = Number(chip.dataset.youth);
      vibrate(10);
      syncPrice();
      updateDraft();
    });
  });

  // 팀명 자동 생성
  const teamNameList = [
    '순대', '떡볶이', '대박', '제로콜라', '불고기와퍼', '보노보노', '요리왕비룡', '검정고무신', '도라에몽',
    '런닝맨', '호빵맨', '괴짜가족', '우르사', '쿠쿠다스', '갈비탕', '돼지국밥', '순대국', '파리지옥',
    '은하철도999', '아이언맨', '호나우딩요', '독수리슛', '번개슛', '피구왕통키', '도깨비슛'
  ];
  $('#generateTeamNameBtn').addEventListener('click', () => {
    const rand = teamNameList[Math.floor(Math.random() * teamNameList.length)];
    $('#teamName').value = rand;
    vibrate(10);
    updateDraft();
  });

  // 입장 시간(지금/다음/다다음)
  const timeOpts = $$('.time-opt');
  let timeOffset = 0;
  function updateTimeHint() {
    const t = nearest20Slot(new Date(), timeOffset);
    $('#walkInTime').value = t;
    $('#timeHint').textContent = `선택된 입장 시간: ${t}`;
  }
  timeOpts.forEach((btn) => {
    btn.addEventListener('click', () => {
      timeOpts.forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      timeOffset = Number(btn.dataset.offset || 0);
      updateTimeHint();
      vibrate(8);
      updateDraft();
    });
  });
  updateTimeHint();

  // 차량번호: 숫자 4자리만
  $('#vehicle').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    updateDraft();
  });

  // 가격 실시간 반영
  function syncPrice() {
    const adult = Number($('#adultCount').value || 0);
    const youth = Number($('#youthCount').value || 0);
    const adultAmt = adult * PRICE.adult;
    const youthAmt = youth * PRICE.youth;
    const total = adultAmt + youthAmt;

    priceText.textContent = fmt(total);
    priceDetail.textContent = `성인 ${adult} × ${fmt(PRICE.adult)} + 청소년 ${youth} × ${fmt(PRICE.youth)}`;
  }
  $('#adultCount').addEventListener('input', () => { syncPrice(); updateDraft(); });
  $('#youthCount').addEventListener('input', () => { syncPrice(); updateDraft(); });
  syncPrice();

  // Draft 복원
  (function restore() {
    const d = loadDraft();
    if (!d) return;
    if (d.roomSize) {
      const btn = Array.from(roomButtons).find(b => b.dataset.value === d.roomSize);
      if (btn) btn.click();
    }
    if (d.difficulty) {
      const btn = Array.from(diffButtons).find(b => b.dataset.value === d.difficulty);
      if (btn) btn.click();
    }
    if (Number.isFinite(d.adultCount)) $('#adultCount').value = d.adultCount;
    if (Number.isFinite(d.youthCount)) $('#youthCount').value = d.youthCount;
    if (d.teamName) $('#teamName').value = d.teamName;
    if (d.vehicle) $('#vehicle').value = d.vehicle;
    if (Number.isFinite(d.timeOffset)) {
      const btn = Array.from(timeOpts).find(b => Number(b.dataset.offset) === d.timeOffset);
      if (btn) btn.click(); else updateTimeHint();
    } else {
      updateTimeHint();
    }
    syncPrice();
  })();

  function updateDraft() {
    saveDraft({
      roomSize: roomInput.value || '',
      difficulty: diffInput.value || '',
      adultCount: Number($('#adultCount').value || 0),
      youthCount: Number($('#youthCount').value || 0),
      teamName: ($('#teamName').value || '').trim(),
      vehicle: ($('#vehicle').value || '').trim(),
      timeOffset
    });
  }

  // 제출 공통 검증
  function validate() {
    const room = roomInput.value;
    const adult = Number($('#adultCount').value || 0);
    const youth = Number($('#youthCount').value || 0);
    const team = ($('#teamName').value || '').trim();
    const diff = diffInput.value;

    if (!room) return '방을 선택해주세요.';
    if (adult + youth <= 0) return '인원 수를 입력해주세요.';
    if (!team) return '팀명을 입력해주세요.';
    if (!diff) return '난이도를 선택해주세요.';
    return '';
  }

  // 네트워크 전송 (타임아웃 + 재시도 + sendBeacon)
  async function sendPayload(payload) {
    // 1) fetch with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Apps Script에서 CORS 응답 헤더 설정 시 cors로 바꾸면 응답 확인 가능
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      return true; // no-cors 라도 보냈다고 가정
    } catch (e) {
      clearTimeout(timer);
      // 2) retry once quickly
      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return true;
      } catch (e2) {
        // 3) background send
        try {
          const ok = navigator.sendBeacon?.(SCRIPT_URL, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
          return !!ok;
        } catch (_) {
          return false;
        }
      }
    }
  }

  // 제출 핸들러(하단 스티키 버튼)
  submitBtn.addEventListener('click', async () => {
    const msg = validate();
    if (msg) { showSnack(msg, 'warn'); vibrate(20); return; }

    // 시간 확정
    const slotStr = nearest20Slot(new Date(), timeOffset);
    $('#walkInTime').value = slotStr;

    const adult = Number($('#adultCount').value || 0);
    const youth = Number($('#youthCount').value || 0);

    const payload = {
      walkInTime: slotStr,
      roomSize: roomInput.value,
      teamName: ($('#teamName').value || '').trim(),
      difficulty: diffInput.value,
      totalCount: adult + youth,
      youthCount: youth,
      vehicle: ($('#vehicle').value || '').trim()
    };

    // UI: 로딩
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const ok = await sendPayload(payload);

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;

    const adultAmt = adult * PRICE.adult;
    const youthAmt = youth * PRICE.youth;
    const totalAmt = adultAmt + youthAmt;

    if (ok) {
      vibrate(15);
      result.hidden = false;
      result.innerHTML =
        `✅ <strong>전송 완료!</strong><br>` +
        `입장 시간 <strong>${slotStr}</strong><br>` +
        `<strong>총 금액: ${fmt(totalAmt)}원</strong><br>` +
        `성인 ${adult}명 × ${fmt(PRICE.adult)}원 = ${fmt(adultAmt)}원<br>` +
        `청소년 ${youth}명 × ${fmt(PRICE.youth)}원 = ${fmt(youthAmt)}원`;
      showSnack('예약 정보가 전송되었습니다.', 'ok');

      // 폼 초기화(최근값은 편의를 위해 유지)
      // 완전 초기화를 원하면 clearDraft() 호출
      // form.reset(); // 입력은 유지, 선택 토글만 유지도 가능
    } else {
      showSnack('전송에 실패했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.', 'error', 2500);
    }
  });
});
