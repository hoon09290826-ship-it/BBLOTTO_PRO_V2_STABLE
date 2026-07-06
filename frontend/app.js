/* BBLOTTO PRO V40 PHASE2 FRONTEND CORE
   목표: 버튼 안정화, 추천결과 상세표시, 회원 안내문구 자동 생성, 분석 표시 강화 */
const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem('bb_v34_token') || '';
const headers = () => ({'Content-Type':'application/json','Authorization':'Bearer '+token(),'X-Token': token()});

let currentCombos = [];
let currentDetails = [];
let currentSms = '';
let currentAnalysis = '';
let currentRound = '';
let currentRecId = null;
let membersCache = [];
let latestStatsCache = null;
let currentAdmin = null;
let sessionWatchTimer = null;
let sessionWarned = false;
const WORKSPACE_KEY = 'bb_v50_workspace_state';

function saveWorkspaceState(){
  try{
    const state = {
      currentCombos, currentDetails, currentSms, currentAnalysis, currentRound, currentRecId,
      selectedMemberId: $('genMember')?.value || '',
      template: $('template')?.value || '',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
  }catch(e){ console.warn('작업 상태 저장 실패', e); }
}
function restoreWorkspaceState(){
  try{
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if(!raw) return false;
    const st = JSON.parse(raw);
    if(!st || !Array.isArray(st.currentCombos) || st.currentCombos.length===0) return false;
    currentCombos = normalizeCombos(st.currentCombos);
    currentDetails = Array.isArray(st.currentDetails) ? st.currentDetails : [];
    currentSms = normalizeText(st.currentSms || '');
    currentAnalysis = normalizeText(st.currentAnalysis || '');
    currentRound = st.currentRound || '';
    currentRecId = st.currentRecId || null;
    if(st.selectedMemberId && $('genMember')) $('genMember').value = st.selectedMemberId;
    if(!($('template')?.value) && st.template) setValue('template', normalizeText(st.template));
    if(currentRound) setText('roundLabel', `${currentRound}회차 추천번호 · 저장된 작업 복원`);
    renderCombos(currentCombos, currentDetails);
    renderAnalysis(currentAnalysis);
    refreshSmsPreview();
    return true;
  }catch(e){ console.warn('작업 상태 복원 실패', e); return false; }
}
async function restoreLatestRecommendationFromServer(){
  try{
    const list = await api('/api/recommendations');
    if(!Array.isArray(list) || !list.length) return false;
    const latest = list[0];
    const d = await api('/api/recommendations/' + latest.id);
    currentRecId = d.id || latest.id || null;
    currentCombos = normalizeCombos(d.numbers || []);
    currentDetails = d.details || [];
    currentRound = d.round_no || latest.round_no || '';
    currentAnalysis = normalizeText(d.analysis || latest.analysis || '');
    currentSms = normalizeText(d.sms || latest.sms || '');
    if(d.member_id && $('genMember')) $('genMember').value = String(d.member_id);
    if(currentRound) setText('roundLabel', `${currentRound}회차 추천번호 · 마지막 이력 복원`);
    renderCombos(currentCombos, currentDetails);
    renderAnalysis(currentAnalysis);
    refreshSmsPreview();
    saveWorkspaceState();
    return true;
  }catch(e){ console.warn('마지막 추천이력 복원 실패', e); return false; }
}


function parseServerTime(s){
  if(!s) return null;
  const t = String(s).replace(' ', 'T');
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
function forceLogout(msg){
  localStorage.removeItem('bb_v34_token');
  alert(msg || '로그인이 만료되었습니다. 다시 로그인해주세요.');
  location.href='/';
}
function startSessionWatcher(admin){
  if(sessionWatchTimer) clearInterval(sessionWatchTimer);
  sessionWarned = false;
  let exp = null;
  // PHASE25: Render 서버 시간대(UTC)와 브라우저 시간대(KST) 차이로 즉시 로그아웃되는 문제 방지
  if(admin?.expires_in_seconds){
    exp = new Date(Date.now() + Number(admin.expires_in_seconds) * 1000);
  } else {
    exp = parseServerTime(admin?.expires_at);
  }
  if(!exp) return;
  sessionWatchTimer = setInterval(()=>{
    const leftMs = exp.getTime() - Date.now();
    if(leftMs <= 0){ clearInterval(sessionWatchTimer); forceLogout('자동 로그아웃 시간이 지나 로그아웃됩니다.'); return; }
    const leftMin = Math.ceil(leftMs / 60000);
    const userBox = document.querySelector('.user');
    if(userBox && leftMin <= 30) userBox.title = `자동 로그아웃까지 약 ${leftMin}분`;
    if(!sessionWarned && leftMin <= 5){ sessionWarned = true; toast(`자동 로그아웃까지 약 ${leftMin}분 남았습니다.`); }
  }, 30000);
}

async function api(path, opts={}){
  const method = opts.method || 'GET';
  const init = {method, headers: headers()};
  if(opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const r = await fetch(path, init);
  if(r.status === 401){
    localStorage.removeItem('bb_v34_token');
    location.href='/';
    throw new Error('로그인이 필요합니다.');
  }
  const text = await r.text();
  let data;
  try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = {raw:text}; }
  if(!r.ok){
    const err = data.error || data.detail || data.message || text || '요청 실패';
    const msg = (err && typeof err === 'object') ? (err.message || err.detail || JSON.stringify(err)) : String(err);
    throw new Error(msg);
  }
  return data;
}

function toast(msg){
  const el = $('toast');
  if(el){
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1800);
  }else{
    console.log(msg);
  }
}
function setText(id, v){ const el=$(id); if(el) el.textContent = v ?? ''; }
function setHTML(id, v){ const el=$(id); if(el) el.innerHTML = v ?? ''; }
function setValue(id, v){ const el=$(id); if(el) el.value = v ?? ''; }
function safe(fn){
  return async (...args)=>{
    try{return await fn(...args)}
    catch(e){ console.error(e); alert(e.message || e); }
  };
}
function setBusy(btnId, busy, text){
  const btn=$(btnId); if(!btn) return;
  if(busy){ btn.dataset.oldText = btn.textContent; btn.textContent = text || '처리 중...'; btn.disabled = true; }
  else{ btn.textContent = btn.dataset.oldText || btn.textContent; btn.disabled = false; }
}
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function memberGradeLabel(v){
  v=String(v||'일반').trim();
  const map={'VIP':'1등','다이아':'1등','다이아몬드':'1등','프리미엄':'2등','1등관리':'1등','2등관리':'2등','일반관리':'일반'};
  return map[v] || (['1등','2등','일반'].includes(v)?v:'일반');
}
function numberListText(arr){ return (arr||[]).map(x=>Array.isArray(x)?x.join(', '):String(x)).join('\n'); }
function ballClass(n){ n=Number(n); if(n<=10)return'b1'; if(n<=20)return'b2'; if(n<=30)return'b3'; if(n<=40)return'b4'; return'b5'; }
function gradeLabel(d){ const s=Number(d?.score ?? d?.vip_score ?? d?.ai_score ?? 0); return d?.grade || (s>=94?'VIP':(s>=89?'PREMIUM':'STANDARD')); }
function starLabel(d){ const s=Number(d?.score ?? d?.vip_score ?? d?.ai_score ?? 0); return d?.star || (s>=95?'★★★★★':(s>=90?'★★★★☆':(s>=85?'★★★★':'★★★☆'))); }
function top3FromDetails(sets, details=[]){ return (sets||[]).map((nums,i)=>({nums, detail:details[i]||{}, idx:i+1})).sort((a,b)=>Number(b.detail.score||0)-Number(a.detail.score||0)).slice(0,3); }
function parseNumsInput(v){ return String(v||'').match(/\d+/g)?.map(Number).filter(n=>n>=1&&n<=45) || []; }
function getSelectedMember(){ const id=String($('genMember')?.value||''); return membersCache.find(m=>String(m.id)===id) || null; }

function normalizeText(value){
  // V50 13차: textarea/미리보기에는 JSON 객체가 아니라 실제 문구만 표시한다.
  if(value === null || value === undefined) return '';
  if(typeof value === 'string') {
    let text = value;
    // DB에 {"value":"..."} 또는 {"body":"..."} 형태로 잘못 저장된 경우 자동 복구
    for(let i=0;i<3;i++){
      const t = String(text).trim();
      if(!((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')))) break;
      try{
        const parsed = JSON.parse(t);
        const extracted = extractTextField(parsed);
        if(!extracted || extracted === text) break;
        text = extracted;
      }catch(e){ break; }
    }
    return String(text).replace(/\\n/g,'\n').replace(/\\t/g,'\t');
  }
  if(Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join('\n');
  if(typeof value === 'object'){
    const direct = extractTextField(value);
    if(direct) return normalizeText(direct);
    const parts = [];
    const keys = ['summary','message','text','body','value','analysis','overview','comment','safe_message','member_message','copy_text'];
    keys.forEach(k=>{ if(value[k]) parts.push(normalizeText(value[k])); });
    ['reasons','reason','tags','points','items','warnings','notes','lines'].forEach(k=>{
      if(Array.isArray(value[k]) && value[k].length) parts.push(value[k].map(x=>'• '+normalizeText(x)).join('\n'));
    });
    if(value.score || value.ai_score || value.avg_score) parts.push(`AI SCORE ${value.score || value.ai_score || value.avg_score}`);
    return parts.filter(Boolean).join('\n');
  }
  return String(value);
}
function extractTextField(obj){
  if(!obj || typeof obj !== 'object') return '';
  const keys = ['body','value','text','message','sms_template','template','content'];
  for(const k of keys){
    if(obj[k] !== undefined && obj[k] !== null){
      // /api/settings 응답처럼 sms_template: {value: '...'} 형태도 처리
      if(typeof obj[k] === 'object') return extractTextField(obj[k]);
      return String(obj[k]);
    }
  }
  return '';
}
function normalizeCombo(combo){
  if(Array.isArray(combo)) return combo.map(Number).filter(n=>Number.isFinite(n));
  if(combo && typeof combo === 'object'){
    const arr = combo.numbers || combo.combo || combo.set || combo.nums;
    if(Array.isArray(arr)) return arr.map(Number).filter(n=>Number.isFinite(n));
  }
  return parseNumsInput(String(combo));
}
function normalizeCombos(combos){ return (combos || []).map(normalizeCombo).filter(c=>c.length); }
function getDefaultTemplate(){
  return '안녕하세요 {회원명}님, BBLOTTO입니다.\n\n{회차}회차 추천번호 안내드립니다.\n\n[추천번호]\n{추천번호}\n\n[AI 분석 요약]\n{분석}\n\nAI SCORE: {AI점수}\n최근 데이터와 조합 균형을 기준으로 선별했습니다.\n좋은 결과 있으시길 바랍니다.\n\n발송일: {발송일}';
}
function getBestAiScore(){
  const scores = (currentDetails || []).map(d=>Number(d.score ?? d.vip_score ?? d.ai_score ?? 0)).filter(Boolean);
  if(!scores.length) return '-';
  return Math.max(...scores).toFixed(1);
}
function formatComboLines(combos){
  return normalizeCombos(combos).map((c,i)=>`${i+1}. ${c.join(', ')}`).join('\n') || '추천번호 없음';
}
function buildTemplateMessage(member, round, combos, analysis){
  const tplRaw = $('template')?.value || '';
  const tpl = normalizeText(tplRaw).trim() || getDefaultTemplate();
  const name = member?.name || '회원';
  const today = new Date().toLocaleDateString('ko-KR');
  const analysisText = normalizeText(analysis || currentAnalysis).trim() || '분석 결과 없음';
  const numbers = formatComboLines(combos || currentCombos);
  return tpl
    .replaceAll('{회원명}', name)
    .replaceAll('{회차}', String(round || currentRound || '-'))
    .replaceAll('{추천번호}', numbers)
    .replaceAll('{분석}', analysisText)
    .replaceAll('{발송일}', today)
    .replaceAll('{AI점수}', String(getBestAiScore()));
}
function scrollToMessagePanel(){
  const target = $('memberMessagePanel') || $('smsPreview') || $('comboList');
  if(target) setTimeout(()=>target.scrollIntoView({behavior:'smooth', block:'center'}), 150);
}


function renderCombos(sets, details=[]){
  const box=$('comboList'); if(!box) return;
  if(!sets || !sets.length){
    box.classList.add('empty');
    box.innerHTML='추천번호를 생성하면 카드형 결과가 표시됩니다.';
    return;
  }
  box.classList.remove('empty');
  const top3 = top3FromDetails(sets, details);
  const topHtml = `<div class="top3-panel rc38-top3"><h4>TOP 3 우선 추천 <small>AI Engine V1.0</small></h4><div class="top3-grid">${top3.map(t=>{
    const d=t.detail||{}; const score=Number(d.score ?? d.vip_score ?? d.ai_score ?? 0);
    const nums=(t.nums||[]).map(n=>`<span class="mini-ball ${ballClass(n)}">${n}</span>`).join('');
    return `<div class="top3-card"><b>${t.idx}조합</b><div class="mini-nums">${nums}</div><span>${gradeLabel(d)}</span><strong>${score?score.toFixed(1):'-'}점</strong><em>${starLabel(d)}</em></div>`;
  }).join('')}</div></div>`;
  const cards = sets.map((arr,i)=>{
    const d = details[i] || {};
    const score = d.score ?? d.vip_score ?? d.ai_score ?? '';
    const sum = d.sum ?? arr.reduce((a,b)=>a+Number(b),0);
    const odd = d.odd ?? arr.filter(n=>Number(n)%2).length;
    const even = d.even ?? (6-odd);
    const zones = d.zones || [arr.filter(n=>n<=15).length, arr.filter(n=>n>=16&&n<=30).length, arr.filter(n=>n>=31).length];
    const tags = d.tags || d.reasons || [];
    const grade = gradeLabel(d);
    const star = starLabel(d);
    return `<div class="combo-card v40-card ${i<3?'top-combo':''}">
      <div class="idx"><span>${i+1}조합</span><em>${grade} · ${score!=='' ? `${Number(score).toFixed(1)}점` : '점수 대기'}</em></div>
      <div class="nums">${arr.map(n=>`<span class="ball ${ballClass(n)}">${n}</span>`).join('')}</div>
      <div class="combo-meta">
        <span>${star}</span><span>합계 ${sum}</span><span>홀짝 ${odd}:${even}</span><span>구간 ${zones.join('/')}</span>
      </div>
      <div class="chip-row">${tags.slice(0,4).map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>
    </div>`;
  }).join('');
  box.innerHTML = topHtml + `<div class="combo-card-grid">${cards}</div>`;
}

function buildFallbackAnalysis(combos, stats, mode){
  if(!combos || !combos.length) return '추천번호를 생성하면 실제 조합 기준 분석이 표시됩니다.';
  const flat = combos.flat().map(Number);
  const freq = new Map(); flat.forEach(n=>freq.set(n,(freq.get(n)||0)+1));
  const core = [...freq.entries()].sort((a,b)=>b[1]-a[1] || a[0]-b[0]).slice(0,6).map(x=>x[0]);
  const sums = combos.map(c=>c.reduce((a,b)=>a+Number(b),0));
  const avgSum = Math.round(sums.reduce((a,b)=>a+b,0)/sums.length);
  const odds = combos.map(c=>c.filter(n=>Number(n)%2).length);
  const avgOdd = (odds.reduce((a,b)=>a+b,0)/odds.length);
  const hot = stats?.hot?.slice?.(0,4) || [];
  const cold = stats?.cold?.slice?.(0,4) || [];
  const modeText = {balanced:'균형형',conservative:'안정형',aggressive:'공격형'}[mode] || mode || '균형형';
  const seed = Math.abs(flat.reduce((a,b,i)=>a + b*(i+3), 0) + Math.round(avgSum*7) + Math.round(avgOdd*11));
  const pick=(arr,salt=0)=>arr[(seed+salt)%arr.length];
  const openers = {
    balanced:[
      '이번 회차는 최근 흐름과 누적 데이터를 함께 비교해 안정적인 분포의 조합으로 구성했습니다.',
      '특정 번호대에 치우치지 않도록 전체 흐름을 기준으로 추천 조합을 선별했습니다.',
      '최근 당첨 흐름과 장기 통계를 함께 반영해 균형 중심으로 구성했습니다.'
    ],
    conservative:[
      '이번 회차는 과도한 변동보다 안정적인 번호 흐름을 우선해 조합을 선별했습니다.',
      '최근 흐름 안에서 무리한 편중을 줄이고 안정성을 높이는 방향으로 구성했습니다.',
      '누적 통계와 반복 패턴을 함께 살펴 안정적인 조합을 중심으로 선별했습니다.'
    ],
    aggressive:[
      '최근 흐름 변화가 큰 구간을 함께 반영해 적극적인 조합으로 구성했습니다.',
      '출현 가능성이 높아진 후보를 중심으로 변화를 준 조합을 선별했습니다.',
      '최근 강세 번호와 보강 후보를 함께 반영해 흐름 전환 가능성을 고려했습니다.'
    ]
  };
  const middles = [
    `주요 후보는 ${core.join(', ')}이며, 최근 흐름과 보강 후보를 함께 배분했습니다.`,
    hot.length ? `최근 흐름 번호(${hot.join(', ')})와 보강 후보(${cold.join(', ')})를 조합해 편중을 줄였습니다.` : `평균 합계 ${avgSum}와 홀짝 흐름을 함께 확인해 조합 균형을 맞췄습니다.`,
    `핵심 후보군은 ${core.join(', ')} 중심이며, 전체 조합 간 중복 가능성을 낮췄습니다.`,
    '최근 반복된 패턴은 일부만 반영하고, 새롭게 움직일 가능성이 있는 번호를 함께 보강했습니다.'
  ];
  const balances = [
    '홀짝 비율과 저·중·고 구간 분포를 함께 맞춰 전체적인 안정성을 높였습니다.',
    '끝수 흐름과 번호 간 간격을 확인해 비슷한 형태의 조합 반복을 줄였습니다.',
    '연속수와 반복 패턴은 필요한 범위 안에서만 반영해 조합 간 차이를 살렸습니다.',
    `${modeText} 기준에 맞춰 번호대, 끝수, 반복 흐름을 함께 점검했습니다.`
  ];
  const closers = [
    '전체적으로 최근 데이터와 누적 통계를 함께 고려한 심층 추천 결과입니다.',
    '이번 추천은 안정성과 변화 가능성을 함께 반영한 구성입니다.',
    '단순 빈도보다 번호 간 균형과 최근 흐름을 함께 본 추천입니다.',
    '최근 흐름을 유지하면서도 새로운 출현 가능성을 함께 고려했습니다.'
  ];
  const openerPool = openers[mode] || openers.balanced;
  const lines = [pick(openerPool,1), pick(middles,5), pick(balances,9)];
  if(seed % 3 !== 0) lines.push(pick(closers,13));
  return [...new Set(lines)].slice(0,4).join('\n');
}

function buildMemberMessage(member, round, combos, analysis){
  const name = member?.name || '회원';
  const numbers = formatComboLines(combos || currentCombos);
  const analysisText = normalizeText(analysis || currentAnalysis).trim() || '분석 결과 없음';
  const today = new Date().toLocaleDateString('ko-KR');
  return `안녕하세요 ${name}님, BBLOTTO입니다.\n\n${round || '-'}회차 추천번호 안내드립니다.\n\n[추천번호]\n${numbers}\n\n[AI 분석 요약]\n${analysisText}\n\nAI SCORE: ${getBestAiScore()}\n최근 데이터와 조합 균형을 기준으로 선별했습니다.\n좋은 결과 있으시길 바랍니다.\n\n발송일: ${today}`;
}

function renderAnalysis(text){
  const an=$('analysis'); if(!an) return;
  const lines = normalizeText(text).split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.length){ an.textContent='추천번호를 생성하면 3~5줄 분석이 표시됩니다.'; return; }
  an.innerHTML = `<ul class="analysis-list">${lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`;
}

function renderEngine(engine, details=[]){
  const eb=$('engineBox'); if(!eb) return;
  const scores = details.map(d=>Number(d.score ?? d.vip_score ?? d.ai_score ?? 0)).filter(Boolean);
  const avg = engine?.avg_score ?? (scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '');
  const candidate = engine?.candidate_count ?? engine?.combo_count ?? engine?.total_candidates ?? '';
  const filter = engine?.filter_count ?? engine?.passed_count ?? details.length;
  const top = scores.length ? Math.max(...scores).toFixed(1) : '';
  const min = scores.length ? Math.min(...scores).toFixed(1) : (engine?.min_score ?? '');
  const v2 = engine?.v2_pipeline_report || engine?.v10_pipeline_report || {};
  const pipeline = engine?.rc38_report?.quality_message || v2.pipeline || '후보 생성 → 필터 → 중복/분산 보정 → 최종선별';
  const stage1 = v2.stage1_candidates ?? candidate ?? '-';
  const stage2 = v2.stage2_top500 ?? v2.stage2_filters ?? '-';
  const stage3 = v2.stage3_top100 ?? v2.stage3_portfolio ?? '-';
  eb.innerHTML = `<div class="engine-grid">
    <span><b>${avg || '-'}</b><small>평균 AI점수</small></span>
    <span><b>${top || '-'}</b><small>최고 점수</small></span>
    <span><b>${min || '-'}</b><small>최저 점수</small></span>
    <span><b>${filter || '-'}</b><small>최종 선별</small></span>
  </div>`;
}

function renderMembers(list){
  const box=$('memberList'); if(!box) return;
  if(!list.length){ box.innerHTML='<p class="hint">등록된 회원이 없습니다.</p>'; return; }
  box.innerHTML=list.map(m=>{
    const st=m.status||'활성';
    const muted=['휴면','정지','종료','탈퇴'].includes(st);
    const registeredBy = m.registered_by_name || m.created_by_name || m.registered_by_username || '미지정';
    return `<div class="member-row member-card ${muted?'muted':''}">
      <div>
        <b>${esc(m.name||'')}</b>
        <p>${esc(m.phone||'')} · ${esc(memberGradeLabel(m.grade))} · ${esc(st)} · ${esc(m.priority||'보통')}</p>
        <small class="member-owner-line">등록 관리자: <strong>${esc(registeredBy)}</strong>${m.created_at ? ' · 등록일 ' + esc(m.created_at) : ''}</small>
        <small>${esc(m.memo||'')}</small>
      </div>
      <div class="member-actions"><button onclick="selectMember(${m.id})">선택</button><button onclick="detailMember(${m.id})">상세페이지</button><button onclick="quickMemberStatus(${m.id},'활성')">활성</button><button onclick="quickMemberStatus(${m.id},'정지')">정지</button><button onclick="quickMemberStatus(${m.id},'탈퇴')">탈퇴</button><button onclick="deleteMember(${m.id})">삭제</button></div>
    </div>`;
  }).join('');
}
function fillMemberSelect(list){
  const sel=$('genMember'); if(!sel) return;
  const prev=String(sel.value||'');
  sel.innerHTML='<option value="">회원 선택 없음</option>'+list.map(m=>`<option value="${m.id}">${esc(m.name)}${m.phone? ' ('+esc(m.phone)+')':''}</option>`).join('');
  if(prev && Array.from(sel.options).some(o=>String(o.value)===prev)) sel.value=prev;
}

async function loadMembers(){
  const q=$('memberSearch')?.value?.trim() || '';
  const params = new URLSearchParams();
  if(q) params.set('q', q);
  const status=$('memberStatusFilter')?.value||'';
  const grade=$('memberGradeFilter')?.value||'';
  const priority=$('memberPriorityFilter')?.value||'';
  if(status) params.set('status', status);
  if(grade) params.set('grade', grade);
  if(priority) params.set('priority', priority);
  const sort=$('memberSort')?.value||'priority';
  if(sort) params.set('sort', sort);
  membersCache = await api('/api/members' + (params.toString() ? '?'+params.toString() : ''));
  renderMembers(membersCache); fillMemberSelect(membersCache);
  setText('memberActive', membersCache.filter(m=>(m.status||'활성')==='활성').length);
  setText('memberVip', membersCache.filter(m=>['1등','2등','VIP','다이아','프리미엄'].includes(String(m.grade||''))).length);
  setText('memberPriority', membersCache.filter(m=>(m.priority||'').includes('높') || (m.priority||'').includes('최')).length);
}
function rc44Money(v){ return Number(v||0).toLocaleString() + '원'; }
function rc44Rows(items, empty){
  if(!Array.isArray(items) || !items.length) return `<div class="empty-detail">${esc(empty||'데이터가 없습니다.')}</div>`;
  return items.map(x=>`<div class="rc44-row"><div><b>${esc(x.title||x.name||x.member_name||x.username||'-')}</b><small>${esc(x.sub||x.detail||x.created_at||'')}</small></div><strong>${esc(x.value||x.action||x.rank||'')}</strong></div>`).join('');
}
async function loadRc44Dashboard(){
  const d = await api('/api/rc4-4/admin-dashboard');
  const k = d.kpi || {};
  setText('memberCount', k.total_members ?? 0);
  setText('latestRound', d.latest_draw?.round_no ?? '-');
  setText('recCount', k.recommendations_total ?? 0);
  setText('smsCount', k.sms_today ?? 0);
  setText('rc44TodayRec', k.recommendations_today ?? 0);
  setText('rc44TodayLogin', k.login_today ?? 0);
  const sub=$('rc44AdminSub'); if(sub) sub.textContent=`활성 ${k.active_members||0}명 · VIP/프리미엄 ${k.vip_members||0}명 · 우선관리 ${k.priority_members||0}명 · 총 당첨금 ${rc44Money(k.total_prize||0)}`;
  const alerts=$('rc44Alerts'); if(alerts) alerts.innerHTML=(d.alerts||[]).map(a=>`<div class="rc44-alert ${esc(a.type||'')}">${esc(a.message||'')}</div>`).join('');
  const ops=$('rc44Ops'); if(ops) ops.innerHTML=`<div class="rc44-mini-grid"><div class="rc44-mini"><b>${k.activity_today||0}</b><span>오늘 활동</span></div><div class="rc44-mini"><b>${k.wins_today||0}</b><span>오늘 적중</span></div><div class="rc44-mini"><b>${k.max_ai_score||0}</b><span>최고 AI점수</span></div></div>` + rc44Rows((d.recent_members||[]).map(m=>({title:m.name, sub:`${m.grade||'일반'} · ${m.status||'활성'} · ${m.priority||'보통'}`, value:m.created_at||''})), '최근 가입 회원이 없습니다.');
  const recent=$('recentRecs'); if(recent) recent.innerHTML=rc44Rows((d.recent_recommendations||[]).map(r=>({title:`${r.round_no||'-'}회 · ${r.member_name||'회원'}`, sub:`${r.mode||'balanced'} · ${r.count||0}조합 · ${r.created_at||''}`, value:`AI ${Number(r.avg_score||0).toFixed(1)}`})), '최근 생성 이력이 없습니다.');
  const logs=$('rc44Logs'); if(logs) logs.innerHTML=rc44Rows((d.recent_logs||[]).map(l=>({title:l.username||'admin', sub:l.detail||l.created_at||'', value:l.action||''})), '최근 관리자 활동이 없습니다.');
}
async function loadRc44AiStatus(){
  const d = await api('/api/rc4-4/ai-status');
  const engineMini=$('engineMini');
  const total=(d.today||[]).reduce((a,r)=>a+Number(r.count||0),0);
  if(engineMini) engineMini.textContent=`RC4-4 AI 추천 현황 · 오늘 ${d.today?.length||0}건 / ${total}조합`;
  const box=$('rc44AiStatus'); if(!box) return;
  const modeRows=(d.by_mode||[]).map(r=>({title:r.mode||'balanced', sub:`평균 AI ${Number(r.avg_score||0).toFixed(1)}점`, value:`${r.c||0}건`}));
  const todayRows=(d.today||[]).slice(0,6).map(r=>({title:`${r.round_no||'-'}회 · ${r.member_name||'회원'}`, sub:`${r.mode||'balanced'} · ${r.count||0}조합 · ${r.created_at||''}`, value:`${Number(r.avg_score||0).toFixed(1)}점`}));
  box.innerHTML=`<h4>모드별 추천</h4>${rc44Rows(modeRows,'모드별 데이터 없음')}<h4>오늘 생성 로그</h4>${rc44Rows(todayRows,'오늘 생성 이력 없음')}`;
}
async function loadDashboard(){
  try{ await loadRc44Dashboard(); }
  catch(e){
    console.warn('RC4-4 대시보드 실패, 기본 대시보드 사용', e);
    let d; try{ d=await api('/api/dashboard_v2'); }catch(_){ d=await api('/api/dashboard_summary'); }
    setText('memberCount', d.members ?? 0); setText('latestRound', d.latest_round ?? '-'); setText('recCount', d.recommendations ?? 0); setText('smsCount', d.sms ?? 0);
    const engineMini=$('engineMini'); if(engineMini) engineMini.textContent=`${d.engine_version||'AI'} · 평균 ${d.avg_ai_score||0}점 · 오늘 ${d.today_recommendations||0}건`;
    const recent=$('recentRecs'); if(recent) recent.innerHTML=(d.recent_recommendations||[]).map(r=>`<p>${r.round_no}회 · ${esc(r.member_name||'회원')} · ${esc(r.created_at||'')}</p>`).join('') || '최근 생성 이력이 없습니다.';
  }
}
async function rc44RunAutoUpdate(){
  if(!confirm('최신회차 조회, 통계 갱신, 회원 적중 계산을 실행할까요?')) return;
  const box=$('rc44AutoResult'); if(box){ box.style.display='block'; box.innerHTML='자동 업데이트 실행 중입니다...'; }
  try{
    const d=await api('/api/rc4-4/auto-update?backfill=12',{method:'POST'});
    if(box) box.innerHTML=`<h3>자동 업데이트 결과</h3>${(d.steps||[]).map(s=>`<div class="rc44-step"><b>${esc(s.name)}</b><span class="${s.ok?'ok':'fail'}">${s.ok?'완료':'실패'}</span></div>`).join('')}<p class="hint">성공 ${d.success_count||0}건 / 실패 ${d.failed_count||0}건</p>`;
    await Promise.allSettled([loadDashboard(), loadStats(100), loadDraws(), loadMembers()]);
    toast('RC4-4 자동 업데이트가 완료되었습니다.');
  }catch(e){ if(box) box.innerHTML=`<b>자동 업데이트 실패</b><p>${esc(e.message||e)}</p>`; }
}
async function loadTemplate(){
  let text = '';
  try{ const d=await api('/api/template'); text = normalizeText(d); }
  catch(e){ try{ const s=await api('/api/settings'); text = normalizeText(s); }catch(_){} }
  setValue('template', text);
  refreshSmsPreview();
}
function renderStats(d){
  latestStatsCache=d;
  const box=$('statsBox'); if(!box) return;
  if(!d || !d.count){ box.innerHTML='<div class="hint">저장된 당첨번호가 없어서 통계를 만들 수 없습니다. 당첨번호를 먼저 저장하세요.</div>'; return; }
  const hot=(d.hot||[]).map(n=>`<span class="ball ${ballClass(n)}">${n}</span>`).join('');
  const cold=(d.cold||[]).map(n=>`<span class="ball ${ballClass(n)}">${n}</span>`).join('');
  const miss=(d.missing20||d.overdue||[]).map(n=>`<span class="ball ${ballClass(n)}">${n}</span>`).join('');
  const pairs=(d.top_pairs||[]).map(p=>`<span class="mini-chip">${(p.pair||[]).join('-')} · ${p.count}회</span>`).join('');
  const recent=(d.recent_draws||[]).slice(0,100).map(r=>`<div class="draw-row"><b>${r.round_no}회</b><span>${(r.numbers||[]).join(', ')} + ${r.bonus||''}</span><small>${r.draw_date||''}</small></div>`).join('');
  const freq=d.freq || d.freq100 || {};
  const maxFreq=Math.max(1, ...Object.values(freq).map(Number));
  const bars=Object.entries(freq).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,15).map(([n,c])=>`<div class="stats-bar"><b>${n}</b><div><i style="width:${Math.round(Number(c)/maxFreq*100)}%"></i></div><span>${c}회</span></div>`).join('');
  box.innerHTML=`<div class="stats-dashboard">
    <div class="stats-kpi">
      <div class="stat-card"><b>${d.count}</b><span>분석 회차</span></div>
      <div class="stat-card"><b>${d.sum_avg}</b><span>평균 합계</span></div>
      <div class="stat-card"><b>${d.odd}:${d.even}</b><span>홀짝 누적</span></div>
      <div class="stat-card"><b>${(d.sections||[]).join(' / ')}</b><span>구간 1~15 / 16~30 / 31~45</span></div>
    </div>
    <div class="stats-panels">
      <div class="detail-section"><h4>HOT 번호</h4><div class="nums-line">${hot}</div><h4>COLD 번호</h4><div class="nums-line">${cold}</div><h4>미출현/공백 번호</h4><div class="nums-line">${miss}</div></div>
      <div class="detail-section"><h4>번호 발생 빈도 TOP 15</h4><div class="stats-bars">${bars||'데이터 없음'}</div></div>
    </div>
    <div class="detail-section"><h4>동반출현 TOP</h4><div class="pair-line">${pairs||'데이터 없음'}</div></div>
    <div class="detail-section"><h4>최근 회차 ${Math.min(100,(d.recent_draws||[]).length)}개</h4><div class="recent-draws-100">${recent||'최근 회차 데이터 없음'}</div></div>
  </div>`;
}
async function loadStats(limit=100){
  const d=await api('/api/stats?limit='+limit);
  renderStats(d);
  const live = buildRealtimeRoundAnalysis(d);
  if(live && (!currentAnalysis || currentAnalysis.includes('데이터 없음') || currentAnalysis.includes('분석 준비'))){
    currentAnalysis = live;
    renderAnalysis(currentAnalysis);
    refreshSmsPreview();
  }
  return d;
}
function buildRealtimeRoundAnalysis(stats){
  if(!stats || !stats.count) return '';
  const latest = stats.latest || (stats.recent_draws||[])[0] || {};
  const nextRound = Number(latest.round_no || 0) ? Number(latest.round_no) + 1 : (currentRound || '');
  const hot = (stats.hot||[]).slice(0,6).join(', ') || '데이터 없음';
  const cold = (stats.cold||[]).slice(0,6).join(', ') || '데이터 없음';
  const miss = (stats.missing20||[]).slice(0,6).join(', ') || '데이터 없음';
  const sections = (stats.sections||[]).join(' / ') || '-';
  const pair = (stats.top_pairs||[]).slice(0,3).map(p=>(p.pair||[]).join('-')).filter(Boolean).join(', ') || '데이터 없음';
  return `${nextRound?nextRound+'회차 ':''}실시간 분석입니다.\n최근 ${stats.count}회 기준 강세번호는 ${hot}, 보완번호는 ${cold}입니다.\n구간 흐름은 ${sections}, 공백수는 ${miss}, 동반출현 핵심은 ${pair}입니다.`;
}
async function loadDraws(){
  try{
    const rows=await api('/api/draws?limit=100');
    const box=$('drawList'); if(box) box.innerHTML=(rows||[]).slice(0,100).map(r=>`<p><b>${r.round_no}회</b> ${r.numbers.join(', ')} + ${r.bonus} <small>${r.draw_date||''}</small></p>`).join('') || '저장된 당첨번호가 없습니다.';
  }catch(e){ console.error(e); }
}
async function setNextDrawRound(){
  try{
    const d=await api('/api/draws/next');
    const latest=d.latest || {};
    const current=d.current || {};
    // PHASE19: 당첨확인은 오늘/현재 추첨 회차를 우선 표시하고, 추천생성은 다음 관리 회차를 사용합니다.
    if($('checkRound')) $('checkRound').value = d.check_round || d.expected_round || d.latest_round || d.next_round || '';
    const check=d.check || {};
    const drawObj=(check.numbers?.length ? check : (current.numbers?.length ? current : {}));
    if(drawObj.numbers?.length){
      if($('winningNums')) $('winningNums').value = drawObj.numbers.join(' ');
      if($('bonusNum')) $('bonusNum').value = drawObj.bonus || '';
    }else{
      // 추첨 전/번호 미공개 상태에서는 직전 회차 번호가 오늘 회차 당첨번호처럼 들어가지 않도록 비웁니다.
      if($('winningNums')) $('winningNums').value = '';
      if($('bonusNum')) $('bonusNum').value = '';
    }
    if($('autoRoundInfo')){
      const msg=d.message || '';
      const latestText=d.latest_round ? `최신 저장 ${d.latest_round}회` : '저장된 회차 없음';
      const checkText=d.check_round ? `당첨확인 ${d.check_round}회` : '';
      const genText=d.next_round ? `추천생성 ${d.next_round}회` : '';
      $('autoRoundInfo').textContent = `${latestText} · ${checkText} · ${genText}${msg ? ' / '+msg : ''}`;
    }
    if(d.next_round) currentRound = d.next_round;
    else if(d.expected_round) currentRound = d.expected_round;
    else if(d.latest_round) currentRound = d.latest_round;
    if(latestStatsCache){
      const live = buildRealtimeRoundAnalysis(latestStatsCache);
      if(live && (!currentAnalysis || currentAnalysis.includes('분석 준비'))) currentAnalysis = live;
    }
    refreshSmsPreview();
    return d;
  }catch(e){ console.error(e); return null; }
}
function rankBadgeClass(rank){
  const r=String(rank||'낙첨');
  if(r.includes('1')) return 'rank-1';
  if(r.includes('2')) return 'rank-2';
  if(r.includes('3')) return 'rank-3';
  if(r.includes('4')) return 'rank-4';
  if(r.includes('5')) return 'rank-5';
  return 'rank-lose';
}
function renderWinNumberChips(nums){
  const arr=Array.isArray(nums) ? nums : String(nums||'').split(/[^0-9]+/).filter(Boolean).map(Number);
  return arr.slice(0,6).map(n=>`<span class="num-chip">${esc(n)}</span>`).join('');
}
window.toggleWinMember=function(mid){
  const el=$('winMemberDetail_'+mid);
  const btn=$('winMemberArrow_'+mid);
  if(!el) return;
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  if(btn) btn.textContent=open?'›':'⌄';
};
function renderWinningResult(d){
  const box=$('winningResult'); if(!box) return;
  const members=Array.isArray(d.member_results) ? d.member_results : [];
  const fallbackGroup={};
  if(!members.length && Array.isArray(d.results)){
    d.results.forEach(r=>{
      if(!r.member_id) return;
      const key=r.member_id;
      if(!fallbackGroup[key]) fallbackGroup[key]={member_id:r.member_id,member_name:r.member_name||'회원명 미확인',total_combos:0,hit_count:0,lose_count:0,total_prize:0,best_rank:'낙첨',best_prize:0,combos:[]};
      const g=fallbackGroup[key];
      g.total_combos++; g.total_prize+=Number(r.prize||0); g.combos.push(r);
      if(r.rank && r.rank!=='낙첨') g.hit_count++; else g.lose_count++;
      const order={'1등':1,'2등':2,'3등':3,'4등':4,'5등':5,'낙첨':9};
      if((order[r.rank]||9) < (order[g.best_rank]||9)){ g.best_rank=r.rank; g.best_prize=Number(r.prize||0); }
    });
  }
  const list=members.length ? members : Object.values(fallbackGroup);
  const summary=d.summary||{};
  const rows=list.map((m,idx)=>{
    const best=m.best_rank||'낙첨';
    const combos=(m.combos||[]).map((c,i)=>`<tr>
      <td>${esc(c.combo_index||i+1)}번</td>
      <td>${renderWinNumberChips(c.combo||[])}</td>
      <td>${esc(c.match_count||0)}개${c.bonus_match?' + 보너스':''}</td>
      <td><span class="rank-badge ${rankBadgeClass(c.rank)}">${esc(c.rank||'낙첨')}</span></td>
      <td>${Number(c.prize||0).toLocaleString()}원</td>
    </tr>`).join('');
    return `<div class="win-member-card">
      <div class="win-member-row">
        <div class="win-member-name"><b>${esc(m.member_name||'회원명 미확인')}</b><small>${esc(m.total_combos||0)}조합 확인</small></div>
        <div><b>${esc(m.hit_count||0)}</b><small>당첨</small></div>
        <div><b>${esc(m.lose_count||0)}</b><small>낙첨</small></div>
        <div><span class="rank-badge ${rankBadgeClass(best)}">${esc(best)}</span><small>최고당첨</small></div>
        <div><b>${Number(m.total_prize||0).toLocaleString()}원</b><small>총 당첨금</small></div>
        <button class="icon-btn" id="winMemberArrow_${esc(m.member_id||idx)}" onclick="toggleWinMember('${esc(m.member_id||idx)}')">›</button>
      </div>
      <div class="win-member-detail" id="winMemberDetail_${esc(m.member_id||idx)}" style="display:none">
        <div class="win-detail-head"><b>${esc(d.round_no || d.round)}회 추천 조합 상세</b><span>당첨번호 ${renderWinNumberChips(d.wins||[])} ${d.bonus?`+ <span class="num-chip bonus">${esc(d.bonus)}</span>`:''}</span></div>
        <table class="simple-table win-combo-table"><thead><tr><th>조합</th><th>추천번호</th><th>일치</th><th>결과</th><th>당첨금</th></tr></thead><tbody>${combos||'<tr><td colspan="5">확인된 조합이 없습니다.</td></tr>'}</tbody></table>
      </div>
    </div>`;
  }).join('');
  box.innerHTML=`<div class="result-summary rc44-win-summary"><b>${esc(d.round_no || d.round)}회차 회원별 자동 확인 완료</b><br>
    회원 ${summary.members||list.length||0}명 / 추천 ${summary.recommendations||0}건 / 조합 ${summary.checked_combos||0}개 / 당첨조합 ${summary.hit_combos||0}개 / 낙첨조합 ${summary.lose_combos||0}개 / 총 당첨금 ${Number(summary.prize||0).toLocaleString()}원</div>
    <div class="win-member-list">${rows||'<div class="empty-detail">해당 회차 회원별 추천 이력이 없습니다.</div>'}</div>`;
}

function openPanel(tabId, title){
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabId));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const p=$(tabId); if(p) p.classList.add('active');
  if(title) setText('pageTitle', title);
  window.scrollTo({top:0, behavior:'smooth'});
}

function formatLongText(text, maxLen=900){
  const value = normalizeText(text || '');
  if(!value) return '<span class="hint">내용 없음</span>';
  const safeText = esc(value.length > maxLen ? value.slice(0, maxLen) + '…' : value);
  return `<pre class="detail-pre">${safeText}</pre>`;
}

function formatMoney(v){ return Number(v||0).toLocaleString() + '원'; }
function renderRecommendCards(items){
  if(!Array.isArray(items) || !items.length) return '<div class="empty-detail">추천 이력이 없습니다.</div>';
  return items.slice(0,20).map(r=>{
    const sets = normalizeCombos(r.numbers || []);
    const nums = sets.slice(0,5).map((c,i)=>`<div class="mini-rec-line"><b>${i+1}</b><span>${c.join(', ')}</span></div>`).join('') || '<span class="hint">번호 없음</span>';
    return `<details class="detail-history rec-history" open>
      <summary><b>${esc(r.round_no || '-')}회 추천</b><small>${esc(r.created_at || '')} · ${esc(r.mode||'balanced')} · 평균 ${esc(r.avg_score||'-')}</small></summary>
      <div class="mini-rec-list">${nums}</div>
      ${formatLongText(r.analysis || '', 500)}
    </details>`;
  }).join('');
}
function renderNoteCards(items){
  if(!Array.isArray(items) || !items.length) return '<div class="empty-detail">상담 이력이 없습니다.</div>';
  return items.slice(0,30).map(r=>`<div class="note-card"><div><b>${esc(r.note_type||'상담')}</b><small>${esc(r.created_at||'')} · ${esc(r.created_by_name||'관리자')}</small></div>${formatLongText(r.note||'', 700)}</div>`).join('');
}
function renderHistoryCards(items, type){
  if(!Array.isArray(items) || !items.length) return '<div class="empty-detail">이력이 없습니다.</div>';
  return items.slice(0, 30).map((r)=>{
    if(type==='sms'){
      return `<details class="detail-history" open>
        <summary><b>${esc(r.round_no || '-')}회 문구</b><small>${esc(r.created_at || '')}</small></summary>
        ${formatLongText(r.body || r.message || r.content || '', 900)}
      </details>`;
    }
    return renderWinningHistoryCard(r);
  }).join('');
}
function rankClass(rank){
  const txt=String(rank||'낙첨');
  if(txt.includes('1등')) return 'rank-1';
  if(txt.includes('2등')) return 'rank-2';
  if(txt.includes('3등')) return 'rank-3';
  if(txt.includes('4등')) return 'rank-4';
  if(txt.includes('5등')) return 'rank-5';
  return 'rank-miss';
}
function renderWinningHistorySummary(items){
  if(!Array.isArray(items) || !items.length) return '<div class="empty-detail">당첨 이력이 없습니다.</div>';
  const list=items.slice(0,20);
  const counts={'1등':0,'2등':0,'3등':0,'4등':0,'5등':0,'낙첨':0};
  let totalPrize=0;
  list.forEach(r=>{
    const rank=String(r.rank||'낙첨');
    const key=['1등','2등','3등','4등','5등'].find(x=>rank.includes(x)) || '낙첨';
    counts[key]+=1;
    totalPrize += Number(r.prize||0);
  });
  const hit=list.length-counts['낙첨'];
  const rate=list.length ? Math.round((hit/list.length)*100) : 0;
  const best=['1등','2등','3등','4등','5등'].find(k=>counts[k]>0) || '없음';
  return `<div class="win-summary-box">
    <div class="win-summary-top">
      <div><b>${list.length}</b><span>최근 확인</span></div>
      <div><b>${hit}</b><span>적중</span></div>
      <div><b>${rate}%</b><span>적중률</span></div>
      <div><b>${esc(best)}</b><span>최고기록</span></div>
      <div><b>${formatMoney(totalPrize)}</b><span>최근 당첨금</span></div>
    </div>
    <div class="win-rank-strip">
      ${['1등','2등','3등','4등','5등','낙첨'].map(k=>`<span class="${rankClass(k)}"><em>${k}</em><b>${counts[k]}</b></span>`).join('')}
    </div>
    <div class="win-card-list">${list.map(renderWinningHistoryCard).join('')}</div>
  </div>`;
}
function renderWinningHistoryCard(r){
  const rank=esc(r.rank || '낙첨');
  const numbersRaw = r.numbers || r.combo || r.recommend_numbers || '';
  const numbers = Array.isArray(numbersRaw) ? numbersRaw.join(', ') : String(numbersRaw||'');
  const matched = (r.matched_count ?? r.match_count ?? r.matches ?? '-');
  const bonusRaw = (r.bonus_match ?? r.bonus ?? false);
  const bonus = bonusRaw===true || bonusRaw==='true' || bonusRaw==='O' || bonusRaw===1 ? 'O' : '-';
  const prize = Number(r.prize||0);
  return `<div class="win-history-card ${rankClass(r.rank)}">
    <div class="win-card-head"><b>${esc(r.round_no || '-')}회</b><span>${rank}</span></div>
    <div class="win-card-nums">${numbers ? esc(numbers) : '<span class="hint">추천번호 없음</span>'}</div>
    <div class="win-card-meta"><small>일치 ${esc(matched)}개 · 보너스 ${esc(bonus)}</small><strong>${prize.toLocaleString()}원</strong></div>
  </div>`;
}

function applyAdminVisibility(isSuper){
  // PHASE28: 일반 관리자는 시스템/관리자 관리 메뉴를 숨기고, 내 계정만 허용
  ['adminSecurityBox','adminBackupBox','adminStatsBox','adminLogsBox','adminAddBox'].forEach(id=>{
    const el=$(id);
    if(el) el.style.display = isSuper ? '' : 'none';
  });
  document.querySelectorAll('.nav[data-tab="admin"]').forEach(btn=>{ btn.style.display = isSuper ? '' : 'none'; });
}


let activityLogCache=[]; let activityLogFilter='all';
function prettyAction(action=''){
  const a=String(action||'').toUpperCase();
  if(a.includes('LOGIN_FAILED')) return '로그인 실패';
  if(a.includes('LOGIN')) return '로그인';
  if(a.includes('LOGOUT')) return '로그아웃';
  if(a.includes('CREATE_MEMBER')) return '회원 등록';
  if(a.includes('UPDATE_MEMBER')) return '회원 수정';
  if(a.includes('DELETE_MEMBER')) return '회원 삭제';
  if(a.includes('GENERATE')) return '추천번호 생성';
  if(a.includes('WIN') || a.includes('DRAW')) return '당첨 확인';
  if(a.includes('BACKUP')) return '백업';
  if(a.includes('SMS')) return '문구 저장';
  return action || '활동';
}
function logGroup(action=''){
  const a=String(action||'').toUpperCase();
  if(a.includes('MEMBER')) return 'member';
  if(a.includes('GENERATE') || a.includes('RECOMMEND')) return 'recommend';
  if(a.includes('WIN') || a.includes('DRAW')) return 'winning';
  if(a.includes('LOGIN') || a.includes('LOGOUT')) return 'login';
  if(a.includes('BACKUP') || a.includes('RESTORE')) return 'backup';
  return 'etc';
}
function shortDetail(action='', detail=''){
  const d=String(detail||'').replace(/_/g,' ').trim();
  const a=String(action||'').toUpperCase();
  if(!d) return '';
  if(a.includes('GENERATE')){
    const round=(d.match(/(\d{3,4})회/)||[])[1];
    const combos=(d.match(/(\d+)조합/)||[])[1];
    return [round?round+'회':'', combos?combos+'조합':''].filter(Boolean).join(' · ') || d.slice(0,46);
  }
  if(a.includes('AUTO_WIN') || a.includes('DRAW')){
    const round=(d.match(/(\d{3,4})회/)||[])[1];
    return round ? round+'회 당첨 확인' : d.slice(0,46);
  }
  if(a.includes('CREATE_MEMBER')) return d.replace('회원 등록:','').trim().slice(0,46);
  if(a.includes('BACKUP')) return d.split(':').pop().trim().slice(0,46);
  return d.slice(0,46);
}
function renderActivityLogs(){
  const rows=(activityLogCache||[]).filter(l=>{ const a=String(l.action||'').toUpperCase(); return !a.includes('LOGIN_FAILED') && !a.includes('SAVE_SMS'); }).slice(0,10);
  const html=rows.map(l=>`<div class="simple-log-row"><div><time>${esc((l.created_at||'').slice(11,16) || (l.created_at||'').slice(5,16))}</time><b>${esc(l.username||'관리자')}</b><span>${esc(prettyAction(l.action))}</span>${shortDetail(l.action,l.detail)?`<small>${esc(shortDetail(l.action,l.detail))}</small>`:''}</div></div>`).join('');
  setHTML('activityLogs', html || '<p class="hint">표시할 활동이 없습니다.</p>');
}
window.filterActivityLog=function(kind){ activityLogFilter=kind||'all'; renderActivityLogs(); };
function renderBackupList(backups){
  const rows=(backups||[]).slice(0,5).map(b=>{
    const file=String(b.filename||''); const safe=esc(file); const isJson=file.toLowerCase().endsWith('.json');
    const created=esc((b.created_at||'').slice(0,16) || file.replace(/^BBLOTTO.*?_BACKUP_/,'').slice(0,15));
    const reason=esc((b.reason||'manual')==='auto_daily'?'자동백업':'수동백업');
    return `<div class="simple-backup-row"><div><b>${created}</b><small>${reason}</small></div><div><button type="button" onclick="downloadApi('/api/backups/download/${encodeURIComponent(file)}')">다운로드</button>${isJson?` <button type="button" class="danger" onclick="restoreBackup('${safe}')">복원</button>`:''}</div></div>`;
  }).join('');
  setHTML('backupList', rows || '<p class="hint">백업 없음</p>');
}

function switchAdminPanel(panel){
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.adminPanel===panel));
  document.querySelectorAll('[data-admin-panel-box]').forEach(box=>box.classList.toggle('active', box.dataset.adminPanelBox===panel));
}
function openAdminCreateModal(){
  const m=$('adminCreateModal');
  if(!m) return;
  // RC5.4 FIX: aria-hidden이 남아있는 상태에서 input에 포커스가 잡히면
  // Chrome이 클릭/포커스 처리를 막는 경우가 있어 열린 상태에서는 완전히 제거한다.
  m.style.display='flex';
  m.classList.add('is-open');
  m.removeAttribute('aria-hidden');
  m.removeAttribute('inert');
  m.inert=false;
  const card=m.querySelector('.modal-card');
  if(card){ card.removeAttribute('aria-hidden'); card.removeAttribute('inert'); card.inert=false; }
  setTimeout(()=>{ const first=$('newAdmin'); if(first) first.focus(); },30);
}
function closeAdminCreateModal(){
  const m=$('adminCreateModal');
  if(!m) return;
  // 닫기 전에 모달 내부 포커스를 먼저 빼야 aria-hidden 경고와 클릭 먹통을 방지한다.
  if(m.contains(document.activeElement)) document.activeElement.blur();
  m.classList.remove('is-open');
  m.style.display='none';
  m.setAttribute('aria-hidden','true');
}
window.openAdminCreateModal=openAdminCreateModal;
window.closeAdminCreateModal=closeAdminCreateModal;

async function loadAdmin(){
  try{ currentAdmin = await api('/api/me'); setText('who', currentAdmin.name || currentAdmin.username || '관리자'); startSessionWatcher(currentAdmin); renderMyAccount(); }catch(e){ currentAdmin=null; }
  const isSuper = !!currentAdmin?.is_super_admin;
  applyAdminVisibility(isSuper);
  if(isSuper){
    try{
      const sec = await api('/api/security_status');
      const msg = `활성 세션 ${sec.active_sessions||0}개 / 오늘 로그인 실패 ${sec.failed_login_today||0}건 / 자동 로그아웃 ${sec.session_timeout_minutes||600}분`;
      const target = $('adminSecurityStatus') || $('activityLogs');
      if(target && target.id === 'adminSecurityStatus') target.textContent = msg;
    }catch(e){}
    try{
      const overview=await api('/api/admin-overview');
      setText('adminActiveCount', overview.active_admins ?? 0);
      setText('adminSessionCount', overview.active_sessions ?? 0);
      setText('adminTodayActions', overview.today_actions ?? 0);
      setText('adminBackupCount', overview.backup_count ?? 0);
    }catch(e){}
    try{ activityLogCache=await api('/api/admin-logs'); renderActivityLogs(); }catch(e){ setHTML('activityLogs','활동 로그를 불러오지 못했습니다.'); }
    try{
      const sessions = await api('/api/sessions');
      const el = $('activeSessions'); if(el) el.innerHTML = ''; // 간편 UI에서는 세션 상세 숨김
    }catch(e){}
  }else{
    setText('adminActiveCount', '-');
    setText('adminSessionCount', '-');
    setText('adminTodayActions', '-');
    setText('adminBackupCount', '-');
  }
  try{
    const admins=await api('/api/admins');
    const addBox = $('addAdmin');
    ['newAdmin','newAdminName','newAdminRole','newAdminPw','newAdminMemo'].forEach(id=>{ const el=$(id); if(el) el.disabled=!isSuper; });
    if(addBox) addBox.disabled=!isSuper;
    setHTML('adminList', admins.map(a=>{
      const self = currentAdmin && Number(a.id)===Number(currentAdmin.id);
      let actions = '';
      if(isSuper){
        actions += `<button type="button" onclick="editAdmin(${a.id})">수정</button>`;
        if(!self){
          actions += a.is_active ? `<button type="button" onclick="toggleAdmin(${a.id},0)">비활성</button>` : `<button type="button" onclick="activateAdmin(${a.id})">활성</button>`;
          actions += `<button type="button" class="danger" onclick="deleteAdmin(${a.id},'${esc(a.username)}')">삭제</button>`;
        }
      }else if(self){
        actions += `<button type="button" onclick="changeMyPassword(${a.id})">내 비밀번호 변경</button>`;
      }else{
        actions += `<span class="hint">수정 권한 없음</span>`;
      }
      return `<div class="admin-card">
        <div class="admin-info">
          <b>${esc(a.username)}</b>
          <span>${esc(a.name||'관리자')}</span>
          <small>${esc(a.role||'전체권한')} · ${a.is_active?'활성':'비활성'} · ${esc(a.last_login_at||'로그인 기록 없음')}</small>
        </div>
        <div class="admin-actions">${actions}</div>
      </div>`;
    }).join('') || '등록된 관리자가 없습니다.');
  }catch(e){ setHTML('adminList','관리자 목록을 불러오지 못했습니다.'); }
  if(isSuper){
    try{
      const backups=await api('/api/backups');
      renderBackupList(backups);
      if($('backupSummary')) $('backupSummary').textContent = `최근 백업 ${backups.length}개 · 매일 자동백업 유지`;
    }catch(e){}
  }
  try{
    const settings=await api('/api/settings');
    setValue('sessionTimeout', settings.session_timeout_minutes?.value || '600');
  }catch(e){}
}

window.selectMember=function(id){
  const m=membersCache.find(x=>String(x.id)===String(id)); if(!m) return;
  setValue('mId',m.id); setValue('mName',m.name); setValue('mPhone',m.phone); setValue('mGrade',memberGradeLabel(m.grade)); setValue('mStatus',m.status||'활성'); setValue('mPriority',m.priority||'보통'); setValue('mSource',m.source||'직접등록'); setValue('mMemo',m.memo||'');
  if($('genMember')) $('genMember').value=id;
  refreshSmsPreview();
  toast(`${m.name} 회원을 선택했습니다.`);
};
window.detailMember=safe(async function(id){
  let d; try{ d=await api('/api/members/'+id+'/detail'); }catch(e){ d=await api('/api/members/'+id); }
  const m=d.member || d;
  const title=$('memberDetailTitle');
  const sub=$('memberDetailSub');
  const body=$('memberDetailPageBody');
  if(!body) return;
  if(title) title.textContent = `${m.name || '회원'} 상세`;
  if(sub) sub.textContent = `${m.phone || '-'} / ${memberGradeLabel(m.grade)} / ${m.status || '활성'} / ${m.priority || '보통'}`;
  const summary = d.summary || {};
  const ranks = summary.rank_counts || {};
  const rankText = ['1등','2등','3등','4등','5등','낙첨'].filter(k=>ranks[k]).map(k=>`${k} ${ranks[k]}건`).join(' · ') || '확인 이력 없음';
  body.innerHTML=`
    <div class="detail-profile-grid rc43-grid">
      <div class="detail-card main-profile">
        <h3>${esc(m.name||'')}</h3>
        <p>${esc(m.phone||'-')}</p>
        <div class="chip-row"><span class="chip">${esc(memberGradeLabel(m.grade))}</span><span class="chip">${esc(m.status||'활성')}</span><span class="chip">${esc(m.priority||'보통')}</span></div>
        <small>가입 ${esc(m.created_at||'-')} · 최근상담 ${esc(m.last_contact_at||'없음')}</small>
      </div>
      <div class="detail-card"><b>${summary.recommendations||0}</b><span>추천 이력</span></div>
      <div class="detail-card"><b>${summary.sms||0}</b><span>문구 이력</span></div>
      <div class="detail-card"><b>${summary.checks||0}</b><span>당첨 확인</span></div>
      <div class="detail-card"><b>${esc(summary.best_rank||'없음')}</b><span>최고 결과</span></div>
      <div class="detail-card"><b>${formatMoney(summary.total_profit||0)}</b><span>누적 손익</span></div>
    </div>
    <div class="detail-section rc43-summary"><h4>적중 요약</h4><p>${esc(rankText)}</p><p>누적 당첨금 ${formatMoney(summary.total_prize||0)} · 누적 구매금 ${formatMoney(summary.total_cost||0)} · ROI ${esc(summary.roi||0)}%</p></div>
    <div class="detail-section"><h4>회원 메모</h4><textarea id="memberMemoEdit" class="detail-edit-textarea">${esc(m.memo||'')}</textarea><div class="btnrow"><button onclick="saveMemberMemo(${m.id})" class="primary">메모 저장</button></div></div>
    <div class="detail-section"><h4>상담 이력 추가</h4><div class="note-write"><select id="memberNoteType"><option>상담</option><option>결제</option><option>추천안내</option><option>당첨확인</option><option>기타</option></select><textarea id="memberNoteText" placeholder="상담/안내 내용을 입력하세요."></textarea><button onclick="saveMemberNote(${m.id})" class="primary">이력 추가</button></div>${renderNoteCards(d.notes)}</div>
    <div class="detail-section"><h4>문구 이력</h4>${renderHistoryCards(d.sms_logs,'sms')}</div>
    <div class="detail-section rc43-winning"><h4>당첨 이력</h4>${renderWinningHistorySummary(d.winning_checks)}</div>
  `;
  const selectBtn=$('memberDetailSelect');
  if(selectBtn) selectBtn.onclick=()=>selectMember(m.id);
  openPanel('memberDetailPage','회원 상세');
});
window.saveMemberMemo=safe(async function(id){
  await api('/api/members/'+id+'/memo',{method:'PUT',body:{memo:$('memberMemoEdit')?.value||''}});
  toast('회원 메모를 저장했습니다.');
  await detailMember(id);
  await loadMembers();
});
window.saveMemberNote=safe(async function(id){
  await api('/api/members/'+id+'/notes',{method:'POST',body:{note:$('memberNoteText')?.value||'',note_type:$('memberNoteType')?.value||'상담'}});
  toast('상담 이력을 추가했습니다.');
  await detailMember(id);
  await loadMembers();
});
window.deleteMember=safe(async function(id){ if(!confirm('삭제할까요?')) return; await api('/api/members/'+id,{method:'DELETE'}); await loadMembers(); await loadDashboard(); });
window.downloadApi=function(path){ const t=token(); location.href=path+(path.includes('?')?'&':'?')+'token='+encodeURIComponent(t); };
window.revokeSession=async function(tail){ if(!confirm('이 세션을 강제 종료할까요?')) return; await api('/api/sessions/'+tail,{method:'DELETE'}); toast('세션을 종료했습니다.'); await loadAdmin(); };
window.cleanupSessions=function(){ alert('세션 정리는 관리자 설정에서 처리됩니다.'); };

function refreshSmsPreview(){
  if(!$('smsPreview')) return;
  const member=getSelectedMember();
  const txt = buildTemplateMessage(member, currentRound, currentCombos, currentAnalysis);
  currentSms = txt;
  $('smsPreview').value = txt;
}

async function generate(){
  const selectedMemberId=$('genMember')?.value||'';
  const next=await setNextDrawRound();
  try{ await loadStats(100); }catch(e){ console.warn('최신 통계 갱신 실패', e); }
  const defaultRound = Number(next?.next_round || next?.latest_round || 0) || undefined;
  const body={
    member_id:selectedMemberId ? Number(selectedMemberId) : null,
    round_no: defaultRound,
    count: Number($('genCount')?.value||10),
    mode:$('genMode')?.value||'balanced',
    fixed:$('fixed')?.value||'',
    excluded:$('exclude')?.value||'',
    exclude:$('exclude')?.value||''
  };
  if(!selectedMemberId){ alert('회원별 당첨확인을 위해 먼저 회원을 선택한 뒤 추천번호를 생성하세요.'); return; }
  setBusy('generate',true,'회원 맞춤 추천번호 분석 중...');
  try{
    const d=await api('/api/generate',{method:'POST',body});
    currentRecId=d.id||null;
    currentCombos=normalizeCombos(d.sets||d.combos||d.numbers||[]);
    currentDetails=d.details||[];
    currentRound=d.round||d.round_no||body.round_no||'';
    const fallback = buildFallbackAnalysis(currentCombos, latestStatsCache, body.mode);
    currentAnalysis=normalizeText(d.analysis||d.ai_analysis||d.engine?.summary||fallback);
    currentSms=normalizeText(d.sms||'') || buildTemplateMessage(getSelectedMember(), currentRound, currentCombos, currentAnalysis);
    setText('roundLabel', currentRound ? `${currentRound}회차 추천번호 · 심층분석 완료` : '생성 완료');
    renderCombos(currentCombos,currentDetails);
    renderAnalysis(currentAnalysis);
    renderEngine(d.engine,currentDetails);
    refreshSmsPreview();
    await Promise.all([loadDashboard(), loadMembers(), loadStats(100)]);
    if(selectedMemberId && $('genMember')) $('genMember').value=selectedMemberId;
    refreshSmsPreview();
    scrollToMessagePanel();
    saveWorkspaceState();
    toast('추천번호 생성 및 회원 안내 문구 갱신 완료');
  }catch(e){
    console.error('추천번호 생성 실패', e);
    alert('추천번호 생성 실패: '+(e.message||e));
    throw e;
  }finally{ setBusy('generate',false); }
}
async function saveMember(){
  // RC2 Hotfix2: 생성 화면의 '회원 저장' 버튼도 실제 회원 수정/등록 버튼처럼 동작하도록 복구합니다.
  const id=$('mId')?.value;
  const name=($('mName')?.value||'').trim();
  if(!id && !name){
    alert('회원관리에서 회원을 선택하거나 이름을 입력한 뒤 저장하세요.');
    return;
  }
  await addMember();
}
async function addMember(){
  const id=$('mId')?.value;
  const body={name:$('mName')?.value||'', phone:$('mPhone')?.value||'', grade:memberGradeLabel($('mGrade')?.value||'일반'), status:$('mStatus')?.value||'활성', priority:$('mPriority')?.value||'보통', source:$('mSource')?.value||'직접등록', memo:$('mMemo')?.value||''};
  if(!body.name.trim()){ alert('회원 이름을 입력하세요.'); return; }
  if(id) await api('/api/members/'+id,{method:'PUT',body}); else await api('/api/members',{method:'POST',body});
  ['mId','mName','mPhone','mMemo'].forEach(x=>setValue(x,''));
  setValue('mGrade','일반'); setValue('mStatus','활성'); setValue('mPriority','보통'); setValue('mSource','');
  await loadMembers(); await loadDashboard(); toast('회원 정보가 저장되었습니다.');
}
function autoTemplate(){
  setValue('template', getDefaultTemplate());
  refreshSmsPreview();
  toast('AI 기본 안내문을 적용했습니다.');
}
function resetTemplate(){
  setValue('template', getDefaultTemplate());
  refreshSmsPreview();
  toast('기본문구를 복원했습니다.');
}
function clearTemplate(){
  setValue('template','');
  refreshSmsPreview();
  toast('문구를 초기화했습니다.');
}
async function saveTemplate(){
  const body=normalizeText($('template')?.value||'');
  try{ await api('/api/template',{method:'POST',body:{body}}); }
  catch(e){ await api('/api/settings',{method:'POST',body:{key:'sms_template',value:body}}); }
  saveWorkspaceState();
  toast('문구 템플릿을 저장했습니다.');
}
async function saveSmsLog(){
  const mid=$('genMember')?.value; if(!mid){ alert('회원을 선택해야 문구 이력을 저장할 수 있습니다.'); return; }
  const member=getSelectedMember();
  const body={member_id:Number(mid), member_name:member?.name||'', phone:member?.phone||'', round_no:Number(currentRound||0), body:$('smsPreview')?.value||currentSms, combos:normalizeCombos(currentCombos)};
  try{ await api('/api/sms_log',{method:'POST',body}); }
  catch(e){ await api('/api/sms',{method:'POST',body}); }
  toast('회원 안내 문구 이력을 저장했습니다.'); await loadDashboard();
}
async function checkWinning(){
  // PHASE20: 회차/당첨번호 확인을 백엔드 자동화에 맡깁니다.
  // 번호가 비어 있으면 해당 회차 공식 번호를 자동 조회하고, 아직 공개 전이면 안내 메시지를 받습니다.
  if(!$('checkRound')?.value) await setNextDrawRound();
  const body={round_no:Number($('checkRound')?.value||0), winning:$('winningNums')?.value||'', bonus:Number($('bonusNum')?.value||0)};
  if(!body.round_no){ alert('회차를 자동으로 불러오지 못했습니다.'); return; }
  setBusy('checkWinning',true,'자동 확인 중...');
  try{
    const d=await api('/api/check_winning',{method:'POST',body});
    if(d.wins?.length){ if($('winningNums')) $('winningNums').value=d.wins.join(' '); if($('bonusNum')) $('bonusNum').value=d.bonus||''; }
    renderWinningResult(d);
    toast('당첨번호 자동확인이 완료되었습니다.');
    await Promise.all([loadStats(100),loadDraws(),loadDashboard(),setNextDrawRound()]);
  }catch(e){
    const msg = e?.message || '당첨번호 자동확인에 실패했습니다.';
    alert(msg + '\n\n공식 조회가 막힌 경우에는 당첨번호 6개와 보너스 번호를 직접 입력한 뒤 다시 누르면 저장/확인이 가능합니다.');
  }
  finally{ setBusy('checkWinning',false); }
}
async function saveDraw(){ await checkWinning(); }


function renderMyAccount(){
  if(!currentAdmin) return;
  setValue('myUsername', currentAdmin.username || '');
  setValue('myName', currentAdmin.name || '관리자');
  setValue('myPhone', currentAdmin.phone || '');
  setValue('myMemo', currentAdmin.memo || '');
  const roleText = currentAdmin.is_super_admin ? '최고관리자' : '일반관리자';
  setText('myLoginInfo', `${roleText} · 마지막 로그인 ${currentAdmin.last_login_at || '기록 없음'} · 최근 활동 ${currentAdmin.last_seen_at || '-'} · 자동 로그아웃까지 ${Math.ceil((currentAdmin.expires_in_seconds||0)/60)}분`);
}
async function loadMyAccount(){
  currentAdmin = await api('/api/me');
  setText('who', currentAdmin.name || currentAdmin.username || '관리자');
  startSessionWatcher(currentAdmin);
  applyAdminVisibility(!!currentAdmin?.is_super_admin);
  renderMyAccount();
}
async function saveMyProfile(){
  const body={name:$('myName')?.value||'관리자', phone:$('myPhone')?.value||'', memo:$('myMemo')?.value||''};
  await api('/api/me',{method:'PUT',body});
  toast('내 계정 정보를 저장했습니다.');
  await loadMyAccount();
}
async function saveMyPassword(){
  const current_password=$('myCurrentPw')?.value||'';
  const new_password=$('myNewPw')?.value||'';
  const confirm=$('myNewPw2')?.value||'';
  if(!current_password) return alert('현재 비밀번호를 입력하세요.');
  if(new_password.length<4) return alert('새 비밀번호는 4자리 이상입니다.');
  if(new_password!==confirm) return alert('새 비밀번호 확인이 맞지 않습니다.');
  await api('/api/me',{method:'PUT',body:{current_password,new_password}});
  ['myCurrentPw','myNewPw','myNewPw2'].forEach(id=>setValue(id,''));
  toast('비밀번호를 변경했습니다.');
}
async function saveSmsSettings(){
  toast('문자 발송 설정은 관리자 페이지에서 제거되었습니다.');
}
async function saveSessionTimeout(){
  const v=String(Math.max(10, Math.min(1440, Number($('sessionTimeout')?.value||600))));
  await api('/api/settings',{method:'POST',body:{key:'session_timeout_minutes',value:v}});
  toast('자동 로그아웃 시간을 저장했습니다.');
}
async function createBackup(){
  const d=await api('/api/backups/create',{method:'POST',body:{}});
  toast('백업 생성 완료: '+(d.filename||''));
  await loadAdmin();
}

window.validateBackup=async function(filename){
  const d=await api('/api/backups/validate/'+encodeURIComponent(filename));
  const counts=d.table_counts||{};
  alert('백업 검증 완료\n파일: '+filename+'\n생성: '+(d.created_at||'')+'\n테이블: '+Object.entries(counts).map(([k,v])=>k+': '+v).join(', '));
};
window.restoreBackup=async function(filename){
  if(!confirm('정말 이 백업으로 복원할까요? 현재 DB 내용이 백업 기준으로 교체됩니다.')) return;
  const d=await api('/api/backups/restore/'+encodeURIComponent(filename),{method:'POST',body:{}});
  toast('복원 완료: '+filename);
  await loadAdmin();
};
window.cleanupBackups=async function(){
  const keep=prompt('최근 몇 개 백업을 남길까요?', '20');
  if(!keep) return;
  const d=await api('/api/backups/cleanup?keep='+encodeURIComponent(keep),{method:'POST',body:{}});
  toast('백업 정리 완료: '+(d.removed||[]).length+'개 삭제');
  await loadAdmin();
};
window.cleanupSessions=async function(){
  await api('/api/sessions/cleanup',{method:'POST',body:{}});
  toast('만료 세션을 정리했습니다.');
  await loadAdmin();
};

async function addAdmin(){
  if(!currentAdmin?.is_super_admin){ alert('최고 관리자만 관리자 계정을 생성할 수 있습니다.'); return; }
  const body={username:$('newAdmin')?.value||'', name:$('newAdminName')?.value||'관리자', password:$('newAdminPw')?.value||'', role:$('newAdminRole')?.value||'전체권한', memo:$('newAdminMemo')?.value||''};
  if(!body.username || body.password.length<4){ alert('관리자 아이디와 4자리 이상 비밀번호를 입력하세요.'); return; }
  await api('/api/admins',{method:'POST',body});
  ['newAdmin','newAdminName','newAdminPw','newAdminMemo'].forEach(x=>setValue(x,''));
  setValue('newAdminRole','전체권한');
  toast('관리자를 생성했습니다.'); closeAdminCreateModal(); await loadAdmin();
}
window.addAdmin=safe(addAdmin);
window.deleteAdmin=safe(async function(id, username){
  if(!confirm(`관리자 ${username || id} 계정을 완전히 삭제할까요?\n삭제하면 해당 관리자는 로그인할 수 없습니다.`)) return;
  await api('/api/admins/'+id,{method:'DELETE'});
  toast('관리자를 삭제했습니다.');
  await loadAdmin();
});
window.activateAdmin=safe(async function(id){
  await api('/api/admins/'+id+'/activate',{method:'POST',body:{}});
  toast('관리자를 활성화했습니다.');
  await loadAdmin();
});
window.toggleAdmin=safe(async function(id, active){
  if(active===0 && !confirm('이 관리자를 비활성화할까요?')) return;
  await api('/api/admins/'+id,{method:'PUT',body:{is_active:active}});
  toast(active ? '관리자를 활성화했습니다.' : '관리자를 비활성화했습니다.');
  await loadAdmin();
});
window.changeMyPassword=safe(async function(id){
  if(!currentAdmin || Number(id)!==Number(currentAdmin.id)) return alert('본인 비밀번호만 변경할 수 있습니다.');
  const password=prompt('새 비밀번호를 입력하세요 (4자리 이상)', '');
  if(password===null) return;
  if(password.length<4) return alert('비밀번호는 4자리 이상입니다.');
  await api('/api/admins/'+id,{method:'PUT',body:{password}});
  toast('비밀번호를 변경했습니다.');
});
function openAdminEditModal(admin){
  return new Promise(resolve=>{
    const old=$('adminEditModal'); if(old) old.remove();
    const wrap=document.createElement('div');
    wrap.id='adminEditModal';
    wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    wrap.innerHTML=`<div style="width:min(520px,96vw);background:#080808;border:1px solid rgba(212,175,55,.45);border-radius:18px;padding:24px;box-shadow:0 20px 80px rgba(0,0,0,.75);color:#f7e7b0;">
      <h3 style="margin:0 0 16px;color:#f5c542;">관리자 수정</h3>
      <p style="margin:0 0 16px;color:#bdb095;font-size:14px;">최고 관리자는 관리자명, 권한명, 메모, 비밀번호를 수정할 수 있습니다. 비밀번호를 비우면 기존 비밀번호가 유지됩니다.</p>
      <label style="display:block;margin:10px 0 6px;font-weight:700;">아이디</label>
      <input id="editUsername" value="${esc(admin.username||'')}" disabled style="width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1px solid rgba(212,175,55,.35);background:#111;color:#aaa;">
      <label style="display:block;margin:10px 0 6px;font-weight:700;">관리자명</label>
      <input id="editName" value="${esc(admin.name||'관리자')}" style="width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1px solid rgba(212,175,55,.5);background:#050505;color:white;">
      <label style="display:block;margin:10px 0 6px;font-weight:700;">권한명</label>
      <input id="editRole" value="${esc(admin.role||'전체권한')}" style="width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1px solid rgba(212,175,55,.5);background:#050505;color:white;">
      <label style="display:block;margin:10px 0 6px;font-weight:700;">새 비밀번호</label>
      <input id="editPassword" type="password" placeholder="변경하려면 4자리 이상 입력" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1px solid rgba(212,175,55,.5);background:#050505;color:white;">
      <label style="display:block;margin:10px 0 6px;font-weight:700;">메모</label>
      <input id="editMemo" value="${esc(admin.memo||'')}" style="width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1px solid rgba(212,175,55,.5);background:#050505;color:white;">
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
        <button id="cancelAdminEdit" type="button">취소</button>
        <button id="saveAdminEdit" type="button" class="primary">수정 저장</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const close=(value)=>{ wrap.remove(); resolve(value); };
    $('cancelAdminEdit').onclick=()=>close(null);
    wrap.addEventListener('click', e=>{ if(e.target===wrap) close(null); });
    $('saveAdminEdit').onclick=()=>{
      const password=$('editPassword').value.trim();
      if(password && password.length<4){ alert('비밀번호는 4자리 이상입니다.'); return; }
      const body={
        name:$('editName').value.trim() || '관리자',
        role:$('editRole').value.trim() || '전체권한',
        memo:$('editMemo').value.trim()
      };
      if(password) body.password=password;
      close(body);
    };
    setTimeout(()=>$('editName')?.focus(),50);
  });
}
window.editAdmin=safe(async function(id){
  const admins=await api('/api/admins');
  const a=admins.find(x=>Number(x.id)===Number(id));
  if(!a) return alert('관리자를 찾을 수 없습니다.');
  const self = currentAdmin && Number(id)===Number(currentAdmin.id);
  if(!currentAdmin?.is_super_admin){
    if(self) return changeMyPassword(id);
    return alert('일반 관리자는 다른 관리자를 수정할 수 없습니다.');
  }
  const body=await openAdminEditModal(a);
  if(!body) return;
  await api('/api/admins/'+id,{method:'PUT',body});
  toast('관리자 정보를 수정했습니다.');
  await loadAdmin();
});

function bind(){
  document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{
    openPanel(btn.dataset.tab, btn.textContent.trim());
    if(btn.dataset.tab==='stats') loadStats(100).catch(console.error);
    if(btn.dataset.tab==='account') loadMyAccount().catch(console.error);
    if(btn.dataset.tab==='admin') loadAdmin().catch(console.error);
  }));
  $('logout')?.addEventListener('click',safe(async()=>{ try{await api('/api/logout',{method:'POST'});}catch(e){} localStorage.removeItem('bb_v34_token'); location.href='/'; }));
  $('saveMyProfile')?.addEventListener('click',safe(saveMyProfile));
  $('saveMyPassword')?.addEventListener('click',safe(saveMyPassword));
  $('generate')?.addEventListener('click',safe(generate));
  $('addMember')?.addEventListener('click',safe(addMember));
  $('saveMemberBtn')?.addEventListener('click',safe(saveMember));
  $('clearMember')?.addEventListener('click',()=>['mId','mName','mPhone','mMemo'].forEach(x=>setValue(x,'')));
  $('memberDetailBack')?.addEventListener('click',()=>openPanel('members','회원 관리'));
  $('memberSearch')?.addEventListener('input',()=>loadMembers().catch(console.error));
  $('memberStatusFilter')?.addEventListener('change',()=>loadMembers().catch(console.error));
  $('memberGradeFilter')?.addEventListener('change',()=>loadMembers().catch(console.error));
  $('memberPriorityFilter')?.addEventListener('change',()=>loadMembers().catch(console.error));
  $('memberSort')?.addEventListener('change',()=>loadMembers().catch(console.error));
  $('genMember')?.addEventListener('change',refreshSmsPreview);
  $('saveTemplate')?.addEventListener('click',safe(saveTemplate));
  $('autoTemplate')?.addEventListener('click',autoTemplate);
  $('resetTemplate')?.addEventListener('click',resetTemplate);
  $('clearTemplate')?.addEventListener('click',clearTemplate);
  $('template')?.addEventListener('input',()=>{ refreshSmsPreview(); saveWorkspaceState(); });
  $('genMember')?.addEventListener('change',saveWorkspaceState);
  $('genCount')?.addEventListener('change',saveWorkspaceState);
  $('genMode')?.addEventListener('change',saveWorkspaceState);
  $('copyNums')?.addEventListener('click',()=>{navigator.clipboard?.writeText(currentCombos.map((a,i)=>`${i+1}. ${a.join(', ')}`).join('\n')); toast('번호를 복사했습니다.');});
  $('copySms')?.addEventListener('click',()=>{navigator.clipboard?.writeText($('smsPreview')?.value||currentSms); toast('회원 안내 문구를 복사했습니다.');});
  $('sendSmsBtn')?.addEventListener('click',()=>{refreshSmsPreview(); scrollToMessagePanel(); $('smsPreview')?.focus();});
  $('saveSmsLog')?.addEventListener('click',safe(saveSmsLog));
  $('checkWinning')?.addEventListener('click',safe(checkWinning));
  $('saveDraw')?.addEventListener('click',safe(saveDraw));
  $('addAdmin')?.addEventListener('click',safe(addAdmin));
  $('openAdminModal')?.addEventListener('click',openAdminCreateModal);
  $('closeAdminModal')?.addEventListener('click',closeAdminCreateModal);
  $('cancelAdminModal')?.addEventListener('click',closeAdminCreateModal);
  $('adminCreateModal')?.addEventListener('click',e=>{ if(e.target && e.target.id==='adminCreateModal') closeAdminCreateModal(); });
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.addEventListener('click',()=>switchAdminPanel(b.dataset.adminPanel)));

  // RC5.4 FIX: 관리자 모달 버튼은 onclick/직접 바인딩에 의존하지 않고
  // 버블 단계 이벤트 위임으로 처리한다. pointerdown preventDefault는 제거했다.
  if(!window.__bbAdminDelegatedClickBound){
    window.__bbAdminDelegatedClickBound=true;
    document.addEventListener('click', function(e){
      const btn=e.target && e.target.closest ? e.target.closest('button') : null;
      if(!btn) return;
      const id=btn.id || '';
      if(id==='openAdminModal'){
        e.preventDefault(); openAdminCreateModal(); return;
      }
      if(id==='closeAdminModal' || id==='cancelAdminModal'){
        e.preventDefault(); closeAdminCreateModal(); return;
      }
      if(id==='addAdmin'){
        e.preventDefault(); window.addAdmin ? window.addAdmin() : safe(addAdmin)(); return;
      }
      if(btn.classList && btn.classList.contains('admin-tab-btn')){
        e.preventDefault(); switchAdminPanel(btn.dataset.adminPanel || 'admins'); return;
      }
    });
    document.addEventListener('click', function(e){
      const modal=$('adminCreateModal');
      if(modal && modal.style.display!=='none' && e.target===modal) closeAdminCreateModal();
    });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeAdminCreateModal(); });
  }
  $('saveSessionTimeout')?.addEventListener('click',safe(saveSessionTimeout));
  $('createBackup')?.addEventListener('click',safe(createBackup));
  $('rc44AutoUpdate')?.addEventListener('click',safe(rc44RunAutoUpdate));
  $('rc44Refresh')?.addEventListener('click',safe(async()=>{ await loadDashboard(); await loadStats(100); await loadMembers(); toast('RC4-4 화면을 새로고침했습니다.'); }));
  document.querySelectorAll('.statBtn').forEach(b=>b.addEventListener('click',()=>loadStats(b.dataset.limit).catch(e=>alert(e.message))));
  $('pdfBtn')?.addEventListener('click',()=>window.print());
}

async function init(){
  if(!token()){ location.href='/'; return; }
  bind();
  try{
    // RC5.3 FIX: 관리자 권한을 먼저 확정한 뒤 화면을 불러온다.
    // 이전 버전은 /api/me 응답 전에 loadAdmin()이 실행되어 최고관리자도
    // 생성/수정 버튼이 disabled 상태로 남는 문제가 있었다.
    currentAdmin = await api('/api/me');
    setText('who', currentAdmin.name || currentAdmin.username || '관리자');
    startSessionWatcher(currentAdmin);
    applyAdminVisibility(!!currentAdmin?.is_super_admin);
  }catch(e){
    console.error(e);
    setText('who','관리자');
  }
  try{
    await Promise.all([loadDashboard(), loadMembers(), loadTemplate(), loadStats(100), loadDraws(), setNextDrawRound()]);
    const restored = restoreWorkspaceState() || await restoreLatestRecommendationFromServer();
    if(!restored){ renderCombos([]); refreshSmsPreview(); }
  }catch(e){ console.error(e); alert(e.message || e); }
}
init();

// ===== RC2 Sprint 4: operations helper =====
async function loadOpsHealth(){
  try{
    const d = await api('/api/ops/health');
    console.log('[BBLOTTO OPS]', d);
    const el = document.getElementById('engineStatus');
    if(el){
      const free = d.disk && d.disk.free_mb ? d.disk.free_mb : '-';
      el.textContent = `운영상태 ${d.ok?'정상':'점검필요'} · DB ${d.db?.size_bytes||0} bytes · 여유 ${free}MB`;
    }
    return d;
  }catch(e){ console.warn('ops health failed', e); return null; }
}
setTimeout(()=>{ if(typeof token==='function' && token()) loadOpsHealth(); }, 1200);
