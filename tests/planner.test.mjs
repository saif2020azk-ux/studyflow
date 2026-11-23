import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generatePlan,checkPlan,parseDate,addDays,availableHours,parseModelOutput,exportCsv} from '../code/planner.mjs';
const cases=JSON.parse(await readFile(new URL('../test-data/cases.json',import.meta.url),'utf8'));
const base=cases[0].input;
for(const c of cases)test(`${c.id} ${c.type}: ${c.name}`,()=>{
  const result=generatePlan(c.input);
  if(c.expect==='invalid'){assert.equal(result.ok,false);assert.ok(result.errors.length);return;}
  assert.equal(result.ok,true);assert.equal(result.validation.valid,true);assert.equal(result.validation.complete,c.expect==='complete');
  // Check independently of the exported validator.
  const totals={};const seen=new Set();
  for(const day of result.plan.days){assert.ok(!seen.has(day.date));seen.add(day.date);let sum=0;for(const session of day.sessions){const subject=c.input.subjects.find(s=>s.id===session.subjectId);assert.ok(subject);assert.ok(day.date<subject.examDate);assert.ok(session.hours>0);assert.equal(session.hours*4,Math.trunc(session.hours*4));sum+=session.hours;totals[subject.id]=(totals[subject.id]??0)+session.hours;}assert.ok(sum<=availableHours(c.input,day.date));}
  for(const s of c.input.subjects)assert.ok((totals[s.id]??0)<=s.hours);
});
test('rejects non-existent dates and handles month/year rollover',()=>{assert.ok(Number.isNaN(parseDate('2026-02-30')));assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(addDays('2028-02-28',1),'2028-02-29');});
test('maps Monday through Sunday correctly',()=>{const input={...base,availability:[1,2,3,4,5,6,7]};for(let i=0;i<7;i++)assert.equal(availableHours(input,addDays('2026-11-23',i)),i+1);});
test('generation is deterministic and does not mutate inputs',()=>{const before=structuredClone(base);assert.deepEqual(generatePlan(base).plan,generatePlan(base).plan);assert.deepEqual(base,before);});
test('rejects sessions on the subject exam day',()=>{const p=generatePlan(base).plan;p.days.find(d=>d.date===base.subjects[0].examDate).sessions=[{subjectId:'math',hours:.25,task:'Study'}];assert.equal(checkPlan(base,p).checks.find(c=>c.name==='Study before exam dates').pass,false);});
test('rejects daily overbooking and target overflow',()=>{const p=generatePlan(base).plan;p.days[0].sessions=[{subjectId:'math',hours:12,task:'Study'}];const result=checkPlan(base,p);assert.equal(result.checks.find(c=>c.name==='Within daily availability').pass,false);assert.equal(result.checks.find(c=>c.name==='Within study-hour targets').pass,false);});
test('rejects unknown subjects including prototype property names',()=>{for(const id of ['unknown','toString','__proto__']){const p=generatePlan(base).plan;p.days[0].sessions=[{subjectId:id,hours:1,task:'Study'}];assert.equal(checkPlan(base,p).valid,false);}});
test('rejects duplicate days, missing dates and malformed session fields',()=>{const valid=generatePlan(base).plan;const duplicate=structuredClone(valid);duplicate.days.push(duplicate.days[0]);assert.equal(checkPlan(base,duplicate).valid,false);const missing=structuredClone(valid);missing.days.pop();assert.equal(checkPlan(base,missing).valid,false);for(const hours of [-1,0,.1,'1',null]){const p=structuredClone(valid);p.days[0].sessions[0].hours=hours;assert.equal(checkPlan(base,p).valid,false);}});
test('handles malformed model structures without throwing',()=>{for(const p of [null,{},[],{days:null},{days:[null]},{days:[{date:base.startDate,sessions:[null]}]}])assert.equal(checkPlan(base,p).valid,false);});
test('accepts fenced JSON and rejects prose or excessive output',()=>{assert.deepEqual(parseModelOutput('```json\n{"days":[]}\n```'),{days:[]});assert.throws(()=>parseModelOutput('Here is your plan'));assert.throws(()=>parseModelOutput('x'.repeat(200001)));});
test('CSV quotes text and prevents spreadsheet formula execution',()=>{const input=structuredClone(base);input.subjects[0].name='=HYPERLINK("example")';const csv=exportCsv(input,generatePlan(input).plan);assert.ok(csv.includes('"\'=HYPERLINK(""example"")"'));assert.ok(csv.startsWith('"Date","Subject","Hours","Task"'));});
