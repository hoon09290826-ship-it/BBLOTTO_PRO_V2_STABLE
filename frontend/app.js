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
  const avgOdd = (odds.reduce((a,b)=>a+b,0)/odds.length).toFixed(1);
  const hot = stats?.hot?.slice?.(0,6) || [];
  const cold = stats?.cold?.slice?.(0,6) || [];
  const pair = stats?.top_pairs?.[0]?.pair?.join('-') || '';
  const modeText = {balanced:'균형형',conservative:'보수형',aggressive:'공격형'}[mode] || mode || '균형형';
  return [
    `이번 회차는 ${modeText} 기준으로 최근 통계와 생성 조합의 분산을 함께 반영했습니다.`,
    `생성 조합 내 핵심 흐름은 ${core.join(', ')}이며 평균 합계는 ${avgSum}, 평균 홀수 비중은 ${avgOdd}개입니다.`,
    hot.length ? `최근 데이터 HOT 번호 ${hot.join(', ')}와 저출현 보강 번호 ${cold.join(', ')}를 혼합했습니다.` : `저장된 당첨번호가 부족해 기본 분산 규칙을 우선 적용했습니다.`,
    pair ? `동반출현 흐름은 ${pair} 조합을 참고했고, 과도한 연속수와 한 구간 쏠림은 제한했습니다.` : `동반출현 데이터가 부족해 홀짝·구간·끝수 균형을 우선 적용했습니다.`,
    `최종 조합은 단순 랜덤이 아니라 후보 조합을 점수화한 뒤 중복과 편향을 줄인 결과입니다.`
  ].join('\n');
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
  </div>
  <div class="ai-pipeline-card">
    <b>BBLOTTO AI Engine V1.0</b>
    <p>${esc(pipeline)}</p>
    <div class="mini-stats"><span>1차 후보 ${esc(stage1)}</span><span>상위500 ${esc(stage2)}</span><span>상위100 ${esc(stage3)}</span></div>
    <small>${esc(v2.summary || '최근 100회 통계와 포트폴리오 분산을 함께 적용했습니다.')}</small>
  </div>`;
}

function renderMembers(list){
  const box=$('memberList'); if(!box) return;
  if(!list.length){ box.innerHTML='<p class="hint">등록된 회원이 없습니다.</p>'; return; }
  box.innerHTML=list.map(m=>{
    const st=m.status||'활성';
    const muted=['휴면','정지','종료','탈퇴'].includes(st);
    return `<div class="member-row member-card ${muted?'muted':''}">
      <div><b>${esc(m.name||'')}</b><p>${esc(m.phone||'')} · ${esc(m.grade||'일반')} · ${esc(st)} · ${esc(m.priority||'보통')}</p><small>${esc(m.memo||'')}</small></div>
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
  setText('memberVip', membersCache.filter(m=>['VIP','다이아','프리미엄'].includes(m.grade)).length);
  setText('memberPriority', membersCache.filter(m=>(m.priority||'').includes('높') || (m.priority||'').includes('최')).length);
}
async function loadDashboard(){
  let d; try{ d=await api('/api/dashboard_v2'); }catch(e){ d=await api('/api/dashboard_summary'); }
  setText('memberCount', d.members ?? 0); setText('latestRound', d.latest_round ?? '-'); setText('recCount', d.recommendations ?? 0); setText('smsCount', d.sms ?? 0); const engineMini=$('engineMini'); if(engineMini) engineMini.textContent=`${d.engine_version||'AI'} · 평균 ${d.avg_ai_score||0}점 · 오늘 ${d.today_recommendations||0}건`; 
  const recent=$('recentRecs'); if(recent) recent.innerHTML=(d.recent_recommendations||[]).map(r=>`<p>${r.round_no}회 · ${esc(r.member_name||'회원')} · ${esc(r.created_at||'')}</p>`).join('') || '최근 생성 이력이 없습니다.';
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
  const miss=(d.missing20||[]).map(n=>`<span class="ball ${ballClass(n)}">${n}</span>`).join('');
  const pairs=(d.top_pairs||[]).map(p=>`<span class="mini-chip">${p.pair.join('-')} · ${p.count}회</span>`).join('');
  const recent=(d.recent_draws||[]).slice(0,100).map(r=>`<div class="draw-row"><b>${r.round_no}회</b><span>${(r.numbers||[]).join(', ')} + ${r.bonus||''}</span><small>${r.draw_date||''}</small></div>`).join('');
  box.innerHTML=`<div class="stat-grid">
    <div class="stat-card"><b>${d.count}</b><span>분석 회차</span></div>
    <div class="stat-card"><b>${d.sum_avg}</b><span>평균 합계</span></div>
    <div class="stat-card"><b>${d.odd}:${d.even}</b><span>홀짝 누적</span></div>
    <div class="stat-card"><b>${(d.sections||[]).join(' / ')}</b><span>구간 1~15 / 16~30 / 31~45</span></div>
  </div>
  <h4>많이 나온 번호</h4><div class="nums-line">${hot}</div>
  <h4>적게 나온 번호</h4><div class="nums-line">${cold}</div>
  <h4>미출현/공백 번호</h4><div class="nums-line">${miss}</div>
  <h4>동반출현 TOP</h4><div class="pair-line">${pairs||'데이터 없음'}</div>
  <h4>최근 회차 ${Math.min(100,(d.recent_draws||[]).length)}개</h4><div class="recent-draws-100">${recent||'최근 회차 데이터 없음'}</div>`;
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
function renderWinningResult(d){
  const box=$('winningResult'); if(!box) return;
  const rows=(d.results||[]).slice(0,100).map(r=>`<tr><td>${esc(r.member_name||'공통 추천')}</td><td>${(r.combo||[]).join(', ')}</td><td>${r.match_count}</td><td>${r.bonus_match?'O':'-'}</td><td><b>${r.rank}</b></td><td>${Number(r.prize||0).toLocaleString()}</td></tr>`).join('');
  box.innerHTML=`<div class="result-summary"><b>${d.round_no || d.round}회차 자동 확인 완료</b><br>추천이력 ${d.summary?.recommendations||0}건 / 조합 ${d.summary?.checked_combos||0}개 / 당첨금 ${Number(d.summary?.prize||0).toLocaleString()}원</div>
  <table class="simple-table"><thead><tr><th>회원</th><th>추천번호</th><th>일치</th><th>보너스</th><th>등수</th><th>당첨금</th></tr></thead><tbody>${rows||'<tr><td colspan="6">해당 회차 추천 이력이 없습니다.</td></tr>'}</tbody></table>`;
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
    const numbers = r.numbers ? `<small class="win-numbers">${esc(r.numbers)}</small>` : '';
    const matched = (r.matched_count ?? r.match_count ?? r.matches ?? '-');
    const bonus = (r.bonus_match ?? r.bonus ?? '-') ? 'O' : '-';
    return `<div class="win-row">
      <div><b>${esc(r.round_no || '-')}회</b>${numbers}</div>
      <span>일치 ${esc(matched)} / 보너스 ${esc(bonus)}</span>
      <strong>${esc(r.rank || '낙첨')} · ${Number(r.prize||0).toLocaleString()}원</strong>
    </div>`;
  }).join('');
}

function applyAdminVisibility(isSuper){
  // PHASE28: 일반 관리자는 시스템/관리자 관리 메뉴를 숨기고, 내 계정만 허용
  ['adminSecurityBox','adminBackupBox','adminStatsBox','adminLogsBox','adminAddBox'].forEach(id=>{
    const el=$(id);
    if(el) el.style.display = isSuper ? '' : 'none';
  });
  document.querySelectorAll('.nav[data-tab="admin"]').forEach(btn=>{ btn.style.display = isSuper ? '' : 'none'; });
}

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
    try{ const logs=await api('/api/admin-logs'); setHTML('activityLogs', logs.map(l=>`<p><b>${esc(l.username||'')}</b> ${esc(l.action||'')} ${esc(l.detail||'')} <small>${esc(l.created_at||'')}</small></p>`).join('') || '로그 없음'); }catch(e){}
    try{ const stats=await api('/api/admin-stats'); setHTML('loginLogs', stats.map(a=>`<p>${esc(a.username)}: 로그인 ${a.login_count||0}회 / 활동 ${a.total_actions||0}건 / 추천 ${a.generated_count||0}건</p>`).join('') || '통계 없음'); }catch(e){}
    try{
      const sessions = await api('/api/sessions');
      const html = sessions.map(s=>`<p><b>${esc(s.username)}</b> ${esc(s.ip||'')} <small>최근 ${esc(s.last_seen_at||s.created_at||'')} / 만료 ${esc(s.expires_at||'')}</small> <button onclick="revokeSession('${esc(s.token_tail)}')">종료</button></p>`).join('') || '활성 세션 없음';
      const el = $('activeSessions'); if(el) el.innerHTML = html;
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
      setHTML('backupList', backups.slice(0,20).map(b=>{
        const file=esc(b.filename||'');
        const isJson=String(b.filename||'').toLowerCase().endsWith('.json');
        return `<p><b>${file}</b><br><small>${esc(b.reason||'manual')} · ${esc(b.created_at||'')} · ${Number(b.size_bytes||0).toLocaleString()} bytes</small><br><button type="button" onclick="downloadApi('/api/backups/download/${encodeURIComponent(b.filename||'')}')">다운로드</button>${isJson?` <button type="button" onclick="validateBackup('${file}')">검증</button> <button type="button" class="danger" onclick="restoreBackup('${file}')">복원</button>`:''}</p>`;
      }).join('') || '백업 없음');
    }catch(e){}
  }
  try{
    const settings=await api('/api/settings');
    setValue('sessionTimeout', settings.session_timeout_minutes?.value || '600');
  }catch(e){}
}

window.selectMember=function(id){
  const m=membersCache.find(x=>String(x.id)===String(id)); if(!m) return;
  setValue('mId',m.id); setValue('mName',m.name); setValue('mPhone',m.phone); setValue('mGrade',m.grade||'일반'); setValue('mStatus',m.status||'활성'); setValue('mPriority',m.priority||'보통'); setValue('mSource',m.source||'직접등록'); setValue('mMemo',m.memo||'');
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
  if(sub) sub.textContent = `${m.phone || '-'} / ${m.grade || '일반'} / ${m.status || '활성'} / ${m.priority || '보통'}`;
  const summary = d.summary || {};
  const ranks = summary.rank_counts || {};
  const rankText = ['1등','2등','3등','4등','5등','낙첨'].filter(k=>ranks[k]).map(k=>`${k} ${ranks[k]}건`).join(' · ') || '확인 이력 없음';
  body.innerHTML=`
    <div class="detail-profile-grid rc43-grid">
      <div class="detail-card main-profile">
        <h3>${esc(m.name||'')}</h3>
        <p>${esc(m.phone||'-')}</p>
        <div class="chip-row"><span class="chip">${esc(m.grade||'일반')}</span><span class="chip">${esc(m.status||'활성')}</span><span class="chip">${esc(m.priority||'보통')}</span></div>
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
    <div class="detail-section"><h4>당첨 이력</h4>${renderHistoryCards(d.winning_checks,'winning')}</div>
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
  setBusy('generate',true,'RC3-14 회원 연동 AI 엔진 분석 중...');
  try{
    const d=await api('/api/generate',{method:'POST',body});
    currentRecId=d.id||null;
    currentCombos=normalizeCombos(d.sets||d.combos||d.numbers||[]);
    currentDetails=d.details||[];
    currentRound=d.round||d.round_no||body.round_no||'';
    const fallback = buildFallbackAnalysis(currentCombos, latestStatsCache, body.mode);
    currentAnalysis=normalizeText(d.analysis||d.ai_analysis||d.engine?.summary||fallback);
    currentSms=normalizeText(d.sms||'') || buildTemplateMessage(getSelectedMember(), currentRound, currentCombos, currentAnalysis);
    setText('roundLabel', currentRound ? `${currentRound}회차 추천번호 · RC3-13 회원 연동 엔진` : '생성 완료');
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
  const body={name:$('mName')?.value||'', phone:$('mPhone')?.value||'', grade:$('mGrade')?.value||'일반', status:$('mStatus')?.value||'활성', priority:$('mPriority')?.value||'보통', source:$('mSource')?.value||'직접등록', memo:$('mMemo')?.value||''};
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
  toast('관리자를 생성했습니다.'); await loadAdmin();
}
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
  $('saveSessionTimeout')?.addEventListener('click',safe(saveSessionTimeout));
  $('createBackup')?.addEventListener('click',safe(createBackup));
  document.querySelectorAll('.statBtn').forEach(b=>b.addEventListener('click',()=>loadStats(b.dataset.limit).catch(e=>alert(e.message))));
  $('pdfBtn')?.addEventListener('click',()=>window.print());
}

async function init(){
  if(!token()){ location.href='/'; return; }
  bind(); api('/api/me').then(me=>{currentAdmin=me; setText('who', me.name || me.username || '관리자'); startSessionWatcher(me);}).catch(()=>setText('who','관리자'));
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
