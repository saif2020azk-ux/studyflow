import {generatePlan,validateInput,checkPlan,parseModelOutput,exportCsv,localDate,addDays,dayDifference} from './planner.mjs';
import {templates,repairTemplate} from './prompt-templates.mjs';
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=[['#8a70ca','#f1ebfc'],['#549a89','#e9f5ef'],['#cb9264','#fff1e8'],['#678cbe','#eaf1fc'],['#bc789c','#faeaf2'],['#9a9b53','#f4f5e6']];
const storageKey='studyflow.workspace.v1',runsKey='studyflow.runs.v1';
let state,dirty=false,page=0,display='days',validated=null,runs=[],toastTimer,printing=false;
function example(){const start=localDate();return {isExample:true,input:{startDate:start,availability:[3,3,2,3,2,4,3],subjects:[{id:'math',name:'Mathematics',examDate:addDays(start,7),hours:8,priority:'high'},{id:'physics',name:'Physics',examDate:addDays(start,10),hours:7,priority:'medium'},{id:'cs',name:'Computer Science',examDate:addDays(start,13),hours:6,priority:'medium'}]},result:null};}
function fresh(){const start=localDate();return {isExample:false,input:{startDate:start,availability:[2,2,2,2,2,2,2],subjects:[{id:'s-'+crypto.randomUUID().slice(0,8),name:'',examDate:addDays(start,14),hours:5,priority:'medium'}]},result:null};}
function canRestore(input){return input&&typeof input.startDate==='string'&&Array.isArray(input.availability)&&input.availability.length===7&&input.availability.every(h=>Number.isFinite(h))&&Array.isArray(input.subjects)&&input.subjects.length>0&&input.subjects.length<=12&&input.subjects.every(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&typeof s.examDate==='string'&&Number.isFinite(s.hours)&&['low','medium','high'].includes(s.priority));}
function setTheme(theme,persist=false){
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  for(const name of ['light','dark'])$('theme-'+name).setAttribute('aria-pressed',String(theme===name));
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#10131e':'#6357db';
  if(persist)try{localStorage.setItem('studyflow.theme',theme);}catch{toast('Theme changed. Browser storage is unavailable, so it cannot be remembered.');}
}
function readSaved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{toast('Browser storage is unavailable. Export your plan to keep it.');}}
function saveRuns(){try{localStorage.setItem(runsKey,JSON.stringify(runs));}catch{toast('Run history could not be saved. Export it before leaving.');}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function dateLabel(date,options={day:'numeric',month:'short'}){return new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{...options,timeZone:'UTC'});}
function download(name,content,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard.');}catch{toast('Clipboard unavailable. Select the text and copy it manually.');}}
function colorFor(id){const i=state.input.subjects.findIndex(s=>s.id===id);return colors[Math.max(i,0)%colors.length];}
function renderForm(){
  $('start-date').value=state.input.startDate;
  $('subjects').innerHTML=state.input.subjects.map((s,i)=>`<div class="subject-row" data-id="${escapeHtml(s.id)}" style="--subject-color:${colors[i%colors.length][0]}"><div class="subject-top"><div><label for="subject-${i}">Subject name</label><input id="subject-${i}" data-field="name" aria-label="Subject ${i+1} name" value="${escapeHtml(s.name)}" maxlength="60" placeholder="e.g. Mathematics"></div><button type="button" class="remove-subject" data-remove="${escapeHtml(s.id)}" aria-label="Remove ${escapeHtml(s.name||'subject')}" ${state.input.subjects.length===1?'disabled':''}>×</button></div><div class="subject-fields"><div><label for="exam-${i}">Exam date</label><input id="exam-${i}" type="date" data-field="examDate" value="${escapeHtml(s.examDate)}"></div><div><label for="hours-${i}">Hours needed</label><input id="hours-${i}" aria-label="Total study hours needed for subject ${i+1}" type="number" data-field="hours" min="0.25" max="200" step="0.25" value="${s.hours}"></div><div><label for="priority-${i}">Priority</label><select id="priority-${i}" data-field="priority">${['low','medium','high'].map(p=>`<option value="${p}" ${s.priority===p?'selected':''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></div></div></div>`).join('');
  $('subject-count').textContent=`${state.input.subjects.length} subject${state.input.subjects.length===1?'':'s'}`;
  $('add-subject').disabled=state.input.subjects.length>=12;
  $('availability').innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=>`<label>${day}<input type="number" min="0" max="12" step="0.25" value="${state.input.availability[i]}" data-day="${i}" aria-label="${day} available study hours"></label>`).join('');
}
function renderPlan(){
  const result=state.result;
  const input=result?.input??state.input;
  const validation=result?.validation;
  $('example-hint').hidden=!state.isExample;
  const dayCount=result?.plan?.days.length??0;
  $('stat-subjects').textContent=input.subjects.length;
  $('stat-hours').innerHTML=`${validation?.scheduledHours??0}<span> hrs</span>`;
  $('stat-days').innerHTML=`${dayCount}<span> days</span>`;
  $('source-badge').textContent=result?.source==='ai'?'AI · checked':'Local planner';
  $('schedule-range').textContent=result ? `${dateLabel(input.startDate)} – ${dateLabel(addDays(input.startDate,dayCount-1))} · ${dayCount} days, at your pace` : 'Your personalised plan will appear here.';
  $('plan-message').innerHTML=dirty?'<div class="draft-note">Your details have changed. Generate a new plan to apply them. The timetable below shows your previous inputs.</div>':validation&&!validation.complete?`<div class="notice"><strong>Some work needs more time.</strong> ${validation.coverage.filter(s=>s.remaining>0).map(s=>`${escapeHtml(s.name)}: ${s.remaining}h left`).join(' · ')}. Add availability, reduce your targets, or review your dates.</div>`:'';
  $('export-menu').disabled=!result;$('print-plan').disabled=!result;
  if(!result){$('schedule-content').innerHTML='<div class="empty-state"><strong>Your plan starts here.</strong><p>Add your subjects and free hours, then select <strong>Create my study plan</strong>.</p></div>';$('pagination').innerHTML='';$('checks-count').textContent='Not checked yet';$('validation-description').textContent='We’ll check your dates and hours when you create your plan.';$('constraint-checks').innerHTML='';return;}
  if(display==='subjects'){
    $('schedule-content').innerHTML=validation.coverage.map((s,i)=>`<div class="coverage-row" style="--subject-color:${colors[i%colors.length][0]}"><div class="coverage-title"><strong>${escapeHtml(s.name)}</strong><span>${s.scheduled} / ${s.required} hrs</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,s.scheduled/s.required*100)}%"></div></div><div class="coverage-caption">Exam ${dateLabel(input.subjects.find(x=>x.id===s.subjectId).examDate)}${s.remaining?` · ${s.remaining}h still to allocate`:' · Target covered'}</div></div>`).join('');
    $('pagination').innerHTML='';
  }else{
    const days=printing?result.plan.days:result.plan.days.slice(page*7,page*7+7);
    const subjects=Object.fromEntries(input.subjects.map((s,i)=>[s.id,{...s,color:colors[i%colors.length]}]));
    $('schedule-content').innerHTML=`<table class="schedule-table"><thead><tr><th>Day / date</th><th>Your focus</th><th>Study approach</th></tr></thead><tbody>${days.map(day=>`<tr><td class="date-cell"><strong>${dateLabel(day.date,{weekday:'short'})}</strong><span>${dateLabel(day.date)}</span></td><td>${day.sessions.length?`<div class="session-list">${day.sessions.map(s=>`<div class="session" style="--subject-color:${subjects[s.subjectId].color[0]};--subject-bg:${subjects[s.subjectId].color[1]}"><span class="session-dot"></span><span class="subject-label">${escapeHtml(subjects[s.subjectId].name)}</span><span class="session-hours">${s.hours} hr${s.hours===1?'':'s'}</span></div>`).join('')}</div>`:'<span class="rest-text">Rest / free time</span>'}</td><td>${day.sessions.length?day.sessions.map(s=>`<div class="task-text">${escapeHtml(s.task)}</div>`).join(''):'<span class="task-text">Keep some space for yourself.</span>'}</td></tr>`).join('')}</tbody></table>`;
    const pages=Math.ceil(dayCount/7);
    $('pagination').innerHTML=pages>1?`<button id="prev-week" ${page===0?'disabled':''}>Previous</button><span>Days ${page*7+1}–${Math.min(page*7+7,dayCount)} of ${dayCount}</span><button id="next-week" ${page===pages-1?'disabled':''}>Next</button>`:'';
    $('prev-week')?.addEventListener('click',()=>{page--;renderPlan();});$('next-week')?.addEventListener('click',()=>{page++;renderPlan();});
  }
  $('checks-count').textContent=`${validation.checks.filter(c=>c.pass).length} / 6 passed`;
  $('validation-description').textContent=validation.complete?'Your study targets fit within your available time.':'The schedule respects your limits. Some study targets need more time.';
  $('constraint-checks').innerHTML=validation.checks.map(c=>`<span class="constraint-check ${c.pass?'':'failed'}"><b>${c.pass?'✓':'×'}</b> ${escapeHtml(c.name)}</span>`).join('');
}
function markDirty(){dirty=!!state.result;state.isExample=false;validated=null;$('use-ai-plan').disabled=true;$('ai-validation').textContent='';$('repair-prompt').value='';if(!$('form-errors').hidden){const errors=validateInput(state.input);$('form-errors').hidden=!errors.length;$('form-errors').textContent=errors.join(' ');}save();renderPlan();renderPrompt();}
function generate(){const result=generatePlan(state.input);$('form-errors').hidden=result.ok;if(!result.ok){$('form-errors').textContent=result.errors.join(' ');$('form-errors').scrollIntoView({block:'center',behavior:'smooth'});return false;}state.result={...result,input:structuredClone(state.input)};dirty=false;page=0;save();renderPlan();return true;}
const versionNotes={v1:'Baseline: a simple planning instruction. No enforced schema or explicit feasibility policy. Its response may need format repair; record this as a limitation.',v2:'Adds subject IDs, JSON output, date coverage, and hard limits. Targets are explicit, but the treatment of impossible requests is less detailed.',v3:'Adds a worked example, strict 15-minute increments, infeasibility handling, and self-check instructions. Improvements must be measured with actual model runs.'};
function renderPrompt(){const version=$('prompt-version').value;$('version-note').textContent=versionNotes[version];$('prompt-text').value=templates[version].replace('{student_input}',JSON.stringify(state.input,null,2));}
function renderRuns(){
  $('run-count').textContent=`${runs.length} actual run${runs.length===1?'':'s'}`;
  $('experiment-log').innerHTML=runs.length?[...runs].reverse().map(r=>`<div class="experiment-entry"><strong>${escapeHtml(r.version)} · ${escapeHtml(r.model)}</strong><br>${new Date(r.timestamp).toLocaleString()} · ${r.validation?`${r.validation.checks.filter(c=>c.pass).length}/6 checks passed · ${r.validation.complete?'targets covered':'targets not fully covered'}`:'JSON could not be parsed'}${r.error?`<br>${escapeHtml(r.error)}`:''}</div>`).join(''):'<div class="empty-state">No AI runs recorded yet. Start with the Prompt lab.</div>';
}
function route(){const view=['planner','lab','evaluation','guide'].includes(location.hash.slice(1))?location.hash.slice(1):'planner';for(const id of ['planner','lab','evaluation','guide'])$(`${id}-view`).hidden=id!==view;document.querySelectorAll('[data-view]').forEach(a=>a.classList.toggle('active',a.dataset.view===view));$('breadcrumb').textContent={planner:'Study planner',lab:'Prompt lab',evaluation:'Evaluation',guide:'Project guide'}[view];if(view==='lab')renderPrompt();if(view==='evaluation')renderRuns();}
state=readSaved(storageKey,null);
if(!state || !canRestore(state.input)){state=example();}
else if(state.result){const validation=checkPlan(state.result.input,state.result.plan);if(!validation.valid)state.result=null;else{state.result.validation=validation;dirty=JSON.stringify(state.input)!==JSON.stringify(state.result.input);}}
runs=readSaved(runsKey,[]);if(!Array.isArray(runs))runs=[];
$('today').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
renderForm();if(!state.result&&!validateInput(state.input).length)generate();else renderPlan();renderPrompt();renderRuns();route();
window.addEventListener('hashchange',route);
$('theme-light').addEventListener('click',()=>setTheme('light',true));
$('theme-dark').addEventListener('click',()=>setTheme('dark',true));
$('planner-form').addEventListener('submit',event=>{event.preventDefault();if(generate()){toast('Your study plan is ready.');$('schedule-heading').scrollIntoView({block:'start',behavior:'smooth'});}});
$('start-date').addEventListener('change',event=>{state.input.startDate=event.target.value;markDirty();});
$('subjects').addEventListener('input',event=>{const field=event.target.dataset.field;if(!field)return;const s=state.input.subjects.find(s=>s.id===event.target.closest('[data-id]').dataset.id);s[field]=field==='hours'?Number(event.target.value):event.target.value;markDirty();});
$('subjects').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button||state.input.subjects.length<=1)return;state.input.subjects=state.input.subjects.filter(s=>s.id!==button.dataset.remove);renderForm();markDirty();});
$('add-subject').addEventListener('click',()=>{if(state.input.subjects.length>=12)return;state.input.subjects.push({id:'s-'+crypto.randomUUID().slice(0,8),name:'',examDate:Number.isFinite(Date.parse(state.input.startDate))?addDays(state.input.startDate,14):'',hours:5,priority:'medium'});renderForm();markDirty();$('subjects').lastElementChild.querySelector('input').focus();});
$('availability').addEventListener('input',event=>{if(event.target.dataset.day===undefined)return;state.input.availability[Number(event.target.dataset.day)]=Number(event.target.value);markDirty();});
$('load-example').addEventListener('click',()=>{state=example();validated=null;$('use-ai-plan').disabled=true;$('ai-validation').textContent='';$('repair-prompt').value='';renderForm();generate();renderPrompt();toast('Example loaded. Make it your own.');});
$('start-fresh').addEventListener('click',()=>{state=fresh();dirty=false;page=0;validated=null;$('form-errors').hidden=true;$('use-ai-plan').disabled=true;$('ai-validation').textContent='';$('repair-prompt').value='';renderForm();save();renderPlan();renderPrompt();$('subjects').querySelector('input').focus();toast('Ready for your subjects.');});
$('apply-daily-hours').addEventListener('click',()=>{const raw=$('daily-hours').value,hours=Number(raw);if(!raw||!Number.isFinite(hours)||hours<0||hours>12||!Number.isInteger(hours*4)){toast('Choose 0–12 hours in 15-minute increments, such as 1.5.');$('daily-hours').focus();return;}state.input.availability=Array(7).fill(hours);renderForm();markDirty();toast(`${hours} study hours applied to every day.`);});
$('table-toggle').addEventListener('click',()=>{display='days';$('table-toggle').classList.add('selected');$('subjects-toggle').classList.remove('selected');$('table-toggle').setAttribute('aria-pressed','true');$('subjects-toggle').setAttribute('aria-pressed','false');renderPlan();});
$('subjects-toggle').addEventListener('click',()=>{display='subjects';$('subjects-toggle').classList.add('selected');$('table-toggle').classList.remove('selected');$('subjects-toggle').setAttribute('aria-pressed','true');$('table-toggle').setAttribute('aria-pressed','false');renderPlan();});
$('export-menu').addEventListener('click',()=>{if(state.result)download('studyflow-plan.csv',exportCsv(state.result.input,state.result.plan),'text/csv;charset=utf-8');});
$('print-plan').addEventListener('click',()=>{if(!state.result)return;const oldDisplay=display;display='days';printing=true;renderPlan();window.print();printing=false;display=oldDisplay;renderPlan();});
$('prompt-version').addEventListener('change',()=>{validated=null;$('use-ai-plan').disabled=true;renderPrompt();});
$('copy-prompt').addEventListener('click',()=>copy($('prompt-text').value));
$('download-prompt').addEventListener('click',()=>download(`P1-${$('prompt-version').value}.txt`,$('prompt-text').value));
$('copy-repair').addEventListener('click',()=>{if($('repair-prompt').value)copy($('repair-prompt').value);else toast('Validate a failed response first.');});
$('ai-response').addEventListener('input',()=>{validated=null;$('use-ai-plan').disabled=true;});
$('validate-ai').addEventListener('click',()=>{
  const model=$('model-name').value.trim();if(!model){toast('Enter the tool and model used for this run.');$('model-name').focus();return;}
  const errors=validateInput(state.input);if(errors.length){$('ai-validation').textContent='Fix the planner inputs first: '+errors.join(' ');return;}
  const raw=$('ai-response').value;let plan,validation,error;
  try{plan=parseModelOutput(raw);validation=checkPlan(state.input,plan);}catch(e){error=e.message;}
  const issues=error?[error]:[...validation.violations,...validation.coverage.filter(s=>s.remaining>0).map(s=>`${s.name}: ${s.remaining}h unallocated. If infeasible, keep the shortfall and explain why.`)];
  $('ai-validation').innerHTML=error?`<div class="error-box">${escapeHtml(error)}</div>`:`<div class="notice ${validation.valid?'success':''}"><strong>${validation.checks.filter(c=>c.pass).length}/6 checks passed.</strong> ${validation.complete?'All study targets are covered.':'Some study targets remain uncovered.'}</div>${validation.violations.length?`<ul>${validation.violations.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>`:''}`;
  $('repair-prompt').value=issues.length?repairTemplate.replace('{issues}',issues.map(x=>'- '+x).join('\n')):'';
  validated=validation?.valid?{plan:{days:[...plan.days].sort((a,b)=>a.date.localeCompare(b.date))},validation,input:structuredClone(state.input),source:'ai',generatedAt:new Date().toISOString()}:null;
  $('use-ai-plan').disabled=!validated;
  runs.push({timestamp:new Date().toISOString(),version:$('prompt-version').value,model,input:structuredClone(state.input),prompt:$('prompt-text').value,rawOutput:raw,validation:validation??null,error:error??null});
  if(runs.length>100)runs=runs.slice(-100);saveRuns();renderRuns();
});
$('use-ai-plan').addEventListener('click',()=>{if(!validated)return;state.result=structuredClone(validated);dirty=false;page=0;save();renderPlan();location.hash='planner';toast('Checked AI schedule applied.');});
$('export-evidence').addEventListener('click',()=>download('studyflow-ai-runs.json',JSON.stringify({exportedAt:new Date().toISOString(),runs},null,2),'application/json'));
$('clear-runs').addEventListener('click',()=>{if(!runs.length)return;if(!window.confirm('Clear the saved AI experiment log on this device? Export it first if you need the evidence.'))return;runs=[];saveRuns();renderRuns();});
try{const response=await fetch('./local-results.json');if(!response.ok)throw new Error('Unavailable');const data=await response.json();$('test-summary').textContent=`${data.results.filter(r=>r.pass).length} / ${data.results.length} passed`;$('evaluation-table').innerHTML=data.results.map(r=>`<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.expected)}</td><td>${escapeHtml(r.actual)}</td><td class="${r.pass?'result-pass':'result-fail'}">${r.pass?'Pass':'Fail'}</td></tr>`).join('');}catch{$('test-summary').textContent='Results unavailable';$('evaluation-table').innerHTML='<tr><td colspan="6">Run npm run evaluate and rebuild to load local results.</td></tr>';}
