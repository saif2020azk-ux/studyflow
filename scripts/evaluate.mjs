import {readFile,writeFile} from 'node:fs/promises';
import {generatePlan} from '../code/planner.mjs';
const cases=JSON.parse(await readFile('test-data/cases.json','utf8'));
const results=cases.map(test=>{
  const result=generatePlan(test.input);
  let pass,actual;
  if(test.expect==='invalid'){pass=!result.ok&&result.errors.length>0;actual=result.ok?'Input accepted':result.errors.join(' ');}
  else if(!result.ok){pass=false;actual=result.errors.join(' ');}
  else{pass=result.validation.valid&&result.validation.complete===(test.expect==='complete');actual=`${result.validation.scheduledHours}h scheduled; ${result.validation.checks.filter(c=>c.pass).length}/6 checks; ${result.validation.complete?'all targets covered':result.validation.coverage.filter(s=>s.remaining).map(s=>`${s.name}: ${s.remaining}h short`).join(', ')}`;}
  return {id:test.id,name:test.name,type:test.type,expected:test.expected,actual,pass,input:test.input,output:result};
});
await writeFile('test-data/local-results.json',JSON.stringify({suite:'Local deterministic scheduler; not AI evaluation',timestamp:new Date().toISOString(),results},null,2)+'\n');
console.log(`${results.filter(r=>r.pass).length}/${results.length} local scenarios passed. Actual outputs saved to test-data/local-results.json.`);
if(results.some(r=>!r.pass))process.exitCode=1;
