export const MAX_DAYS = 120;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(value) {
  if (typeof value !== 'string' || !ISO.test(value)) return NaN;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
}
export function addDays(value, offset) {
  return new Date(parseDate(value) + offset * 86400000).toISOString().slice(0, 10);
}
export function dayDifference(start, end) { return Math.round((parseDate(end) - parseDate(start)) / 86400000); }
export function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validateInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['Enter your study details.'];
  if (!Number.isFinite(parseDate(input.startDate))) errors.push('Choose a valid start date.');
  if (!Array.isArray(input.availability) || input.availability.length !== 7 || input.availability.some(h => !Number.isFinite(h) || h < 0 || h > 12 || !Number.isInteger(h * 4))) errors.push('Daily availability must be 0–12 hours in 15-minute increments, Monday through Sunday.');
  if (!Array.isArray(input.subjects) || input.subjects.length < 1 || input.subjects.length > 12) errors.push('Add between 1 and 12 subjects.');
  const ids = new Set();
  const names = new Set();
  for (const s of Array.isArray(input.subjects) ? input.subjects : []) {
    if (!s || typeof s !== 'object') { errors.push('Each subject needs valid details.'); continue; }
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id)) errors.push('Each subject needs a unique identifier.');
    ids.add(s.id);
    const name = typeof s.name === 'string' ? s.name.trim() : '';
    if (!name || name.length > 60 || names.has(name.toLowerCase())) errors.push('Subject names must be unique and between 1 and 60 characters.');
    names.add(name.toLowerCase());
    if (!Number.isFinite(parseDate(s.examDate))) errors.push(`Choose a valid exam date for ${name || 'each subject'}.`);
    else if (Number.isFinite(parseDate(input.startDate))) {
      const days = dayDifference(input.startDate, s.examDate);
      if (days < 1) errors.push(`${name}: the exam must be after the start date.`);
      if (days > MAX_DAYS) errors.push(`${name}: choose an exam within ${MAX_DAYS} days of the start date.`);
    }
    if (!Number.isFinite(s.hours) || s.hours < 0.25 || s.hours > 200 || !Number.isInteger(s.hours * 4)) errors.push(`${name || 'Subject'}: study hours must be 0.25–200 in 15-minute increments.`);
    if (!['low','medium','high'].includes(s.priority)) errors.push(`${name || 'Subject'}: select a valid priority.`);
  }
  return [...new Set(errors)];
}
export function availableHours(input, date) {
  const mondayIndex = (new Date(parseDate(date)).getUTCDay() + 6) % 7;
  return input.availability[mondayIndex];
}
export function planDates(input) {
  const last = input.subjects.map(s => s.examDate).sort().at(-1);
  return Array.from({length: dayDifference(input.startDate, last)}, (_, i) => addDays(input.startDate,i));
}
export function generatePlan(input) {
  const errors = validateInput(input);
  if (errors.length) return {ok:false, errors};
  const remaining = Object.fromEntries(input.subjects.map(s => [s.id, Math.round(s.hours*4)]));
  const byId = Object.fromEntries(input.subjects.map(s => [s.id,s]));
  const weights = {high:3,medium:2,low:1};
  const days = planDates(input).map(date => {
    const allocations = new Map();
    const capacity = Math.round(availableHours(input,date)*4);
    for (let quarter=0; quarter<capacity; quarter++) {
      // Earliest deadline first preserves feasible allocation. Equal deadlines
      // use priority, remaining work and per-day balance to rotate subjects.
      const candidates = input.subjects.filter(s => s.examDate > date && remaining[s.id] > 0).sort((a,b) =>
        a.examDate.localeCompare(b.examDate) ||
        ((allocations.get(a.id)||0)/weights[a.priority] - (allocations.get(b.id)||0)/weights[b.priority]) ||
        remaining[b.id]-remaining[a.id] || a.id.localeCompare(b.id));
      if (!candidates.length) break;
      const s = candidates[0];
      allocations.set(s.id,(allocations.get(s.id)||0)+1);
      remaining[s.id]--;
    }
    return {date, sessions:[...allocations].map(([subjectId,quarters]) => ({subjectId,hours:quarters/4,task:dayDifference(date,byId[subjectId].examDate)<=2 ? 'Revise key ideas and practise exam questions' : 'Study concepts and practise recall'}))};
  });
  const plan = {days};
  const validation = checkPlan(input,plan);
  return {ok:true, plan, validation, source:'local', generatedAt:new Date().toISOString()};
}
export function checkPlan(input, plan) {
  const inputErrors = validateInput(input);
  if (inputErrors.length) return {valid:false,violations:inputErrors,complete:false,scheduledHours:0,coverage:[],checks:[]};
  const violations = [];
  const expectedDates = new Set(planDates(input));
  const subjects = Object.fromEntries(input.subjects.map(s=>[s.id,s]));
  const totals = Object.fromEntries(input.subjects.map(s=>[s.id,0]));
  const seen = new Set();
  const flags = {format:true,dates:true,capacity:true,deadlines:true,subjects:true,targets:true};
  const fail = (key,message) => { flags[key]=false; violations.push(message); };
  if (!plan || !Array.isArray(plan.days)) fail('format','The response must contain a days array.');
  else {
    if (plan.days.length > MAX_DAYS) fail('dates',`The schedule cannot exceed ${MAX_DAYS} days.`);
    for (const day of plan.days.slice(0, MAX_DAYS+1)) {
      if (!day || !Number.isFinite(parseDate(day.date)) || !expectedDates.has(day.date) || seen.has(day.date)) { fail('dates','The schedule contains a duplicate, invalid, or out-of-range date.'); continue; }
      seen.add(day.date);
      if (!Array.isArray(day.sessions) || day.sessions.length > 48) { fail('format',`${day.date}: use a sessions array with at most 48 sessions.`); continue; }
      let dayHours=0;
      for (const session of day.sessions) {
        if (!session || typeof session.subjectId !== 'string' || !Object.hasOwn(subjects,session.subjectId)) { fail('subjects',`${day.date}: a session references an unknown subject.`); continue; }
        if (!Number.isFinite(session.hours) || session.hours<=0 || !Number.isInteger(session.hours*4) || session.hours>12 || typeof session.task!=='string' || !session.task.trim() || session.task.length>300) { fail('format',`${day.date}: sessions need positive 15-minute hours and a task of 1–300 characters.`); continue; }
        dayHours += session.hours;
        totals[session.subjectId] += session.hours;
        if (day.date >= subjects[session.subjectId].examDate) fail('deadlines',`${day.date}: ${subjects[session.subjectId].name} is scheduled on or after its exam.`);
      }
      if (dayHours > availableHours(input,day.date)) fail('capacity',`${day.date}: scheduled ${dayHours}h with only ${availableHours(input,day.date)}h available.`);
    }
    if (seen.size !== expectedDates.size) fail('dates','Include every date in the planning period, using empty sessions for rest days.');
  }
  const coverage = input.subjects.map(s => ({subjectId:s.id,name:s.name,required:s.hours,scheduled:totals[s.id],remaining:Math.max(0,s.hours-totals[s.id])}));
  for (const s of coverage) if (s.scheduled>s.required) fail('targets',`${s.name}: the schedule exceeds the requested study hours.`);
  const checks = [
    {name:'Valid session format',pass:flags.format}, {name:'Complete, unique dates',pass:flags.dates},
    {name:'Within daily availability',pass:flags.capacity}, {name:'Study before exam dates',pass:flags.deadlines},
    {name:'Known subjects only',pass:flags.subjects}, {name:'Within study-hour targets',pass:flags.targets}
  ];
  return {valid:violations.length===0,violations:[...new Set(violations)],complete:coverage.every(s=>s.remaining===0),scheduledHours:Object.values(totals).reduce((a,b)=>a+b,0),coverage,checks};
}
export function parseModelOutput(text) {
  if (typeof text !== 'string' || text.length>200000) throw new Error('Paste a JSON response smaller than 200 KB.');
  const clean = text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try { return JSON.parse(clean); } catch { throw new Error('The response is not valid JSON. Copy the complete JSON object from your AI tool.'); }
}
export function safeCsv(value) {
  let text=String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function exportCsv(input,plan) {
  const names=Object.fromEntries(input.subjects.map(s=>[s.id,s.name]));
  const rows=[['Date','Subject','Hours','Task']];
  for (const day of plan.days) {
    if (!day.sessions.length) rows.push([day.date,'Rest / free time',0,'']);
    for(const s of day.sessions) rows.push([day.date,names[s.subjectId],s.hours,s.task]);
  }
  return rows.map(row=>row.map(safeCsv).join(',')).join('\r\n');
}
