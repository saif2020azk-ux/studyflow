// Optional real-browser smoke check using installed Chrome; no npm dependency.
// The response-import test uses a local fixture, not a real model response.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {generatePlan} from '../code/planner.mjs';
const profile=await mkdtemp(path.join(os.tmpdir(),'studyflow-qa-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
let ws;
try{
  const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);chrome.stderr.on('data',chunk=>{text+=chunk;const found=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(found){clearTimeout(timer);resolve(found[1]);}});chrome.once('error',reject);chrome.once('exit',code=>reject(new Error(`Chrome exited ${code}`)));});
  const target=await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/new?about:blank`,{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let sequence=0;const pending=new Map();const errors=[];
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Browser condition timed out: '+expression);};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5173'});
  await wait('document.getElementById("stat-hours")?.textContent.includes("21")');
  assert.equal(await evaluate('document.getElementById("checks-count").textContent'),'6 / 6 passed');
  await wait('document.getElementById("evaluation-table").children.length===16');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile('docs/local-planner-desktop.png',Buffer.from(shot.data,'base64'));
  await evaluate('document.getElementById("add-subject").click()');
  assert.equal(await evaluate('document.querySelectorAll(".subject-row").length'),4);
  await evaluate('document.querySelector(".subject-row:last-child .remove-subject").click()');
  assert.equal(await evaluate('document.querySelectorAll(".subject-row").length'),3);
  await evaluate('for(const input of document.querySelectorAll("[data-day]")){input.value="0";input.dispatchEvent(new Event("input",{bubbles:true}));}document.getElementById("planner-form").requestSubmit()');
  assert.equal(await evaluate('document.getElementById("stat-hours").textContent'),'0 hrs');
  assert.ok(await evaluate('document.getElementById("plan-message").textContent.includes("left")'));
  await evaluate('document.getElementById("load-example").click();location.hash="lab"');
  await wait('!document.getElementById("lab-view").hidden');
  assert.ok(await evaluate('document.getElementById("prompt-text").value.includes("HARD CONSTRAINTS")'));
  await evaluate('document.getElementById("model-name").value="QA synthetic fixture; not a model run";document.getElementById("ai-response").value="invalid json";document.getElementById("validate-ai").click()');
  assert.ok(await evaluate('document.getElementById("ai-validation").textContent.includes("not valid JSON")'));
  const input=await evaluate('JSON.parse(localStorage.getItem("studyflow.workspace.v1")).input');
  const fixture=generatePlan(input).plan;
  await evaluate(`document.getElementById('ai-response').value=${JSON.stringify(JSON.stringify(fixture))};document.getElementById('validate-ai').click()`);
  assert.equal(await evaluate('document.getElementById("use-ai-plan").disabled'),false);
  await evaluate('document.getElementById("use-ai-plan").click()');
  await wait('!document.getElementById("planner-view").hidden');
  assert.equal(await evaluate('document.getElementById("source-badge").textContent'),'AI · checked');
  // Remove synthetic import log; screenshots show a real local scheduler run only.
  await evaluate('localStorage.removeItem("studyflow.runs.v1");document.getElementById("load-example").click();document.getElementById("toast").hidden=true');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile('docs/local-planner-mobile.png',Buffer.from(mobile.data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('Browser QA passed: initial plan, constraint checks, test display, add/remove subject, overload, prompt generation, JSON rejection, fixture import, and desktop/mobile overflow.');
  console.log('Screenshots saved in docs/. The import fixture is not AI evaluation evidence.');
}finally{ws?.close();chrome.kill('SIGTERM');}
