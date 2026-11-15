import {canonicalCode,redactReport,termsThroughGraduation,termName,deriveRegistration,sumUnits,prereqCheck,requirementStatus,buildAdvisorEmail} from './report-core.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const append=(parent,...children)=>{parent.append(...children);return parent};
const navigate=view=>window.navigate(view);
const originalReview={html:$('review').innerHTML,text:$('sample-preview').value,open:$('open-demo').onclick,back:$('back-welcome').onclick};
const app={report:null,track:null,term:null,plans:new Map(),refs:{courseCatalogue:{},unitSources:{},prerequisites:{}},generation:0,decodeBusy:false,requiresAccess:false,provider:'unknown',providerName:'the configured AI provider'};
const missing='Not stated';const val=n=>n===null||n===undefined?missing:String(n);
const health=node('p','small muted','Checking AI connection…');health.id='ai-connection';document.querySelector('.upload-panel').append(health);
// This public status never exposes the API key.
fetch('/api/health').then(r=>r.json()).then(data=>{app.requiresAccess=data.requiresAccessCode;app.provider=data.provider||'openai';app.providerName=data.providerName||(app.provider==='gemini'?'Google Gemini':'OpenAI');document.querySelector('.upload-panel .upload-explainer').textContent='Reading the PDF stays in your browser. Only text you approve is sent to this server and '+app.providerName+' when you click Decode.';health.textContent=data.configured?app.providerName+' configured · review your text before sending.':'AI not configured yet · sample demo available. See README to add a server API key.'}).catch(()=>{health.textContent='Start this version with npm start, then open http://localhost:3000. Opening the HTML file directly only supports the sample demo.'});
fetch('/course-reference.json').then(r=>r.json()).then(refs=>{app.refs=refs}).catch(()=>{});
const intro=document.querySelector('.upload-panel>p');intro.textContent='Select your PDF to read it in this browser, then review the text before sending it to AI.';
document.querySelector('.upload-panel .upload-explainer').textContent='Reading the PDF stays in your browser. Only text you approve is sent to the server and its configured AI provider when you click Decode.';
document.querySelector('.entry-footnote').textContent='An independent student project. AI interpretations can be wrong; confirm your final plan with your advisor.';
const paste=append(node('details','source'),node('summary','','PDF not reading? Paste report text'));
const pasted=node('textarea','ai-paste');pasted.setAttribute('aria-label','Paste your STARS report text');pasted.placeholder='Copy the academic report text from your PDF and paste it here.';
const usePaste=node('button','alt','Review pasted text');usePaste.type='button';paste.append(pasted,usePaste);$('file-feedback').after(paste);
function errorText(e){return e instanceof Error?e.message:'Something went wrong. Please retry.'}
function checkLength(text){if(text.length<200)throw Error('This text is too short to interpret reliably. Paste the full academic report.');if(text.length>100000)throw Error('This report exceeds the 100,000-character limit. Remove unrelated content first.')}
usePaste.onclick=()=>{if(app.decodeBusy)return;try{const text=redactReport(pasted.value);checkLength(text);showReview(text)}catch(e){$('file-feedback').textContent=errorText(e)}};
$('report-file').onchange=async()=>{
 if(app.decodeBusy)return;const file=$('report-file').files[0];if(!file)return;const generation=++app.generation;
 try{if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('Please select a PDF or use the paste option.');if(file.size>15*1024*1024)throw Error('This file is larger than 15 MB. Use a smaller PDF or paste the report text.');$('file-feedback').textContent='Reading your PDF locally…';
 const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 let raw='';try{if(doc.numPages>75)throw Error('This PDF has more than 75 pages. Paste only the academic report text.');for(let i=1;i<=doc.numPages;i++){const content=await(await doc.getPage(i)).getTextContent();raw+=content.items.map(it=>it.str+(it.hasEOL?'\n':' ')).join('')+'\n';if(raw.length>100000)throw Error('Too much text. Paste only the academic report sections.')}}finally{await doc.loadingTask.destroy()}
 const text=redactReport(raw);checkLength(text);if(generation!==app.generation)return;$('file-feedback').textContent='PDF text read. Check the review before sending.';showReview(text);
 }catch(e){if(generation===app.generation){$('file-feedback').textContent=errorText(e)+' You can use the paste option below.';paste.open=true}}
};
$('start-demo').onclick=()=>{if(app.decodeBusy)return;app.generation++;$('review').innerHTML=originalReview.html;$('sample-preview').value=originalReview.text;$('open-demo').onclick=originalReview.open;$('back-welcome').onclick=originalReview.back;navigate('review')};
function showReview(text){
 const section=$('review');section.replaceChildren();
 const back=node('button','back-link','← Back to start');back.onclick=()=>{if(!app.decodeBusy)navigate('welcome')};
 section.append(back,node('div','eyebrow','Review before AI processing'),node('h1','','Check what will be sent.'),node('p','welcome-intro muted','We removed personal details detected by our cleanup. Check the read-only preview below. Automatic cleanup can miss details; if any remain, go back and use an anonymized report before continuing.'));
 const card=node('div','card');const input=node('textarea','review-input');input.value=text;input.setAttribute('aria-label','Read-only report preview to send to AI');input.readOnly=true;input.setAttribute('aria-readonly','true');input.spellcheck=false;
 const agree=node('input');agree.type='checkbox';agree.id='ai-consent';const label=node('label','consent-label');label.htmlFor=agree.id;label.append(agree,document.createTextNode(' I reviewed the text and agree to send it to this app’s server and '+app.providerName+' for interpretation.'));
 const password=node('input','demo-access');password.type='password';password.autocomplete='off';password.placeholder='Demo access code';password.setAttribute('aria-label','Demo access code');password.hidden=!app.requiresAccess;
 const go=node('button','primary','Decode my report →');go.disabled=true;agree.onchange=()=>{go.disabled=!agree.checked||app.decodeBusy};
 const status=node('p','small muted');status.setAttribute('role','status');
 card.append(node('h2','','Report preview · read only'),input,label,password,go,status,node('p','small muted ai-privacy',app.provider==='gemini'?'Google’s free tier may use submitted content for product improvement. Use synthetic demo data, not identifiable or confidential student records. This is not an official audit.':'The app does not write reports to disk. The configured provider processes the submitted text under its API data policies. This is not an official degree audit.'));section.append(card);navigate('review');
 go.onclick=async()=>{
  if(!agree.checked||app.decodeBusy)return;
  try{checkLength(text);app.decodeBusy=true;go.disabled=true;back.disabled=true;input.disabled=true;agree.disabled=true;$('report-file').disabled=true;usePaste.disabled=true;$('start-demo').disabled=true;status.textContent='Interpreting your report. This may take a minute or two…';
   const response=await fetch('/api/decode',{method:'POST',headers:{'Content-Type':'application/json',...(password.value?{Authorization:'Bearer '+password.value}:{})},body:JSON.stringify({text,consent:true}),signal:AbortSignal.timeout(135000)});
   let result;try{result=await response.json()}catch{throw Error('The server returned an unreadable response. Make sure the Node server is running.')}
   if(!response.ok)throw Error(result.error||'Decoding failed. No sample data has been substituted.');if(!result.report||!Array.isArray(result.report.requirements))throw Error('The returned report has no usable requirements.');
   app.report=result.report;app.track=app.report.tracks[0]?.id??null;app.plans.clear();app.term=termsThroughGraduation(app.report.currentTerm,app.report.expectedGraduationDate)[0]??null;
   activateReport(result.model);navigate('overview');
  }catch(e){status.textContent=e.name==='TimeoutError'?'Decoding timed out. Please try again.':errorText(e)}finally{app.decodeBusy=false;go.disabled=!agree.checked;back.disabled=false;input.disabled=false;agree.disabled=false;$('report-file').disabled=false;usePaste.disabled=false;$('start-demo').disabled=false}
 };
}
function excerpt(item){const d=node('details','source');d.append(node('summary','',item.evidenceVerified?'View report evidence':'Review source evidence'),node('pre','',item.sourceQuote||'No source excerpt returned.'));if(!item.evidenceVerified)d.append(node('p','small muted','This excerpt could not be matched to the reviewed report text. Verify the entry.'));return d}
function activateReport(model){
 $('overview').setAttribute('data-report-mode','ai');
 document.querySelector('#dashboard-topline>.eyebrow').textContent=app.report.program||'Program not stated';document.querySelector('#dashboard-topline .pill').textContent='AI report · '+(app.report.preparedDate||'date not stated');
 $('dashboard-banner').replaceChildren(node('strong','','Your report, made readable. '),document.createTextNode('Review your requirements, then build a semester to discuss with your advisor.'));
 app.report.requirements=app.report.requirements.map(r=>({...r,status:requirementStatus(r),category:r.category!=='gpa'&&!r.options.length&&/\b(?:\d+[ -]*units?|residency)\b/i.test(r.title)?'units':r.category}));
 $('dashboard-footer').textContent=`Based on the reviewed STARS text${app.report.preparedDate?' dated '+app.report.preparedDate:''}. Interpreted with ${model}. Confirm your final plan with your advisor.`;
 $('restart-demo').onclick=()=>window.location.reload();renderOverview();renderRequirements();renderPlanner();
}
function action(text,view,primary=true){const b=node('button',primary?'primary':'',text);b.onclick=()=>navigate(view);return b}
function metric(label,number,sub){const value=node('div','number',number);if(label==='Expected graduation')value.setAttribute('style','font-size:27px;margin-top:8px');return append(node('div','card'),node('div','eyebrow',label),value,node('p','small muted',sub))}
function displayDate(date){return date?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):missing}
function courseCountLabel(area,count){return area==='Transfer & AP credit'?(count===1?'entry':'entries'):(count===1?'course':'courses')}
function courseArea(course){
 if(course.status==='transfer')return 'Transfer & AP credit';
 const prefix=canonicalCode(course.code).match(/^[A-Z]+/)?.[0]||'';
 if(['CSCI','EE','ENGR','AME','ASTE','BME','CE','CHE','ISE','ITP','MASC','PTE','SAE','DENE','ENE'].includes(prefix))return 'Computer science & engineering';
 if(['MATH','PHYS'].includes(prefix))return 'Mathematics & physics';
 if(['CLAS','PSYC','SSCI','LING','WRIT','ENGL','HIST','PHIL','AMST','SOCI','ANTH','POSC','IR','SPAN','FREN','GERM','ITAL','JAPN','EALC','GEOG','REL'].includes(prefix))return 'Humanities & social sciences';
 if(['BISC','CHEM','ASTR','GEOL','HBIO','NEUR','ENST'].includes(prefix))return 'Natural sciences';
 if(['BUAD','ACCT','FBE','MOR','ECON','BAEP','DSO','MKT'].includes(prefix))return 'Business & economics';
 return 'Other coursework';
}
function renderOverview(){
 const r=app.report,u=r.units,root=$('overview');root.replaceChildren(node('div','eyebrow','Your degree at a glance'),node('h1','','Fight On, Trojan! ✌️'),node('p','intro muted','Here’s where you stand, what you’ve earned, and what’s next for your degree.'));
 const gap=u.required!==null&&u.earned!==null?Math.max(0,u.required-u.earned):null;
 root.append(append(node('div','metrics overview-metrics'),metric('Credits earned',val(u.earned),`Minimum: ${val(u.required)} units.`),metric('Taking / registered',val(u.pending),'Reported pending units; not earned yet.'),metric('Gap to unit minimum',val(gap),'Specific course requirements can remain after reaching the unit minimum.'),metric('Expected graduation',displayDate(r.expectedGraduationDate),'The date stated on your report.')));
 const explain=node('details','credit-explanation');explain.append(node('summary','','Why are total credits and requirement credits different?'),node('p','small muted',`Total earned: ${val(u.earned)}. Applied to subject requirements: ${val(u.appliedEarned)} earned + ${val(u.appliedPending)} pending. These are different measures.`),excerpt(u));root.append(explain);
 const history=append(node('section','card course-history'),node('h2','','Courses you’ve completed'),node('p','small muted','Open a subject area for courses, terms, units and grades. Transfer credit is marked separately.'));
 const groups=new Map();for(const c of r.courses.filter(c=>['completed','transfer'].includes(c.status))){const area=courseArea(c);if(!groups.has(area))groups.set(area,[]);groups.get(area).push(c)}
 for(const [area,courses] of groups){const d=node('details','history-group');d.append(node('summary','',`${area} · ${courses.length} ${courseCountLabel(area,courses.length)}`));const wrap=node('div','history-table-wrap'),table=node('table','history-table');table.append(node('caption','sr-only',area));const tr=node('tr');for(const head of ['Course','Term','Units','Grade']){const th=node('th','',head);th.scope='col';tr.append(th)}table.append(append(node('thead'),tr));const body=node('tbody');for(const c of courses){const row=node('tr');const description=node('td');description.append(node('strong','',c.code),node('span','course-label',c.title||'Title not stated'));if(!c.evidenceVerified)description.append(node('span','small legacy-note','Source needs review'));row.append(description,node('td','',c.term?termName(c.term):missing),node('td','',val(c.units)),append(node('td'),node('span','grade'+(c.status==='transfer'?' transfer-grade':''),c.status==='transfer'?'TR':c.grade||missing)));body.append(row)}table.append(body);wrap.append(table);d.append(wrap);history.append(d)}
 if(!groups.size)history.append(node('p','small muted','No completed course list was extracted. Check the reviewed text.'));
 const columns=node('div','columns overview-pathways');
 const next=append(node('section','card degree-pathways'),node('h2','',r.tracks.length===2?'Two tracks. One choice.':r.tracks.length?'Your degree pathway':'What’s next for your degree'),node('p','small muted',r.tracks.length>1?'These are alternative paths. Review one track’s requirements before building your semester.':r.tracks.length===1?'Review your pathway’s requirements before building your semester.':'Start with your remaining requirements, then explore a semester.'));
 if(r.tracks.length)next.append(trackPicker('overview'));
 next.append(append(node('div','actions'),action('See requirements →','requirements'),action('Explore my semester','planner',false)));columns.append(next);
 const underway=append(node('section','card registered-overview'),node('h2','','Already on your report'));appendCourseTerms(underway);
 underway.append(node('p','small muted','These courses are not earned yet. Requirements depend on successful completion.'));columns.append(underway);root.append(columns,history);
 const warnings=r.watchOuts.map(w=>w.replace(/\bAdvisor\s+(?:is\s+)?not\s+yet\s+designated\s+by\s+(?:your|the)\s+Department\.?/gi,'').replace(/^[\s•-]+|[\s•-]+$/g,'')).filter(Boolean);
 if(warnings.length){const attention=append(node('section','attention-note'),node('h2','','Needs attention'));for(const warning of warnings)attention.append(node('p','small',warning));root.append(attention)}
}
function readableName(text){return text===text.toUpperCase()?text.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):text}
function trackPicker(place='requirements'){
 const div=node('div',place==='overview'?'overview-track-list':'track-grid');
 if(!app.report.tracks.length){div.hidden=true;return div}
 for(const t of app.report.tracks){
  const remaining=app.report.requirements.filter(r=>r.trackId===t.id&&r.category==='course'&&['needed','unclear'].includes(r.status));
  const total=remaining.reduce((n,r)=>n+(r.remainingCount??0),0),unknown=remaining.some(r=>r.remainingCount===null);
  const common=app.report.requirements.filter(r=>r.trackId===null&&r.category==='course'&&['needed','unclear'].includes(r.status));
  const note=`${total}${unknown?' + uncounted':''} track courses still needed${common.length?' · common requirements also apply':''}`;
  const b=append(node('button','track'+(t.id===app.track?' selected':'')),node('strong','',readableName(t.name).replace(/ Track$/,'')),node('span','',note));
  b.setAttribute('aria-pressed',String(t.id===app.track));b.onclick=()=>{app.track=t.id;renderOverview();renderRequirements();renderPlanner()};div.append(b);
 }
 return div;
}
function appendCourseTerms(host){
 const groups=new Map();
 for(const c of app.report.courses.filter(c=>['in_progress','registered'].includes(c.status))){const key=`${c.term}|${c.status}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c)}
 for(const courses of groups.values()){
  const first=courses[0],units=sumUnits(courses),box=append(node('div','term'),node('strong','',first.term?termName(first.term):'Term needs review'));
  box.append(node('span','pill amber',`${first.status==='registered'?'Registered':'Taking now'} · ${units.known} units${units.unknown?' + unknown units':''}`));
  for(const c of courses)box.append(append(node('div','course-fact'),node('strong','',c.code),node('span','small muted',c.title||'')));
  host.append(box);
 }
 if(!groups.size)host.append(node('p','small muted','No current or registered courses were identified.'));
}
const visibleRequirements=()=>app.report.requirements.filter(r=>r.trackId===null||r.trackId===app.track);
function referenceFor(option){const key=canonicalCode(option.code);const ref=app.refs.courseCatalogue[key];return {units:ref?.units??option.units??null,title:ref?.title??option.title??null,ref:ref?app.refs.unitSources[ref.source]:null,note:ref?.note??null}}
function safeLink(text,url){const a=node('a','',text);if(/^https:\/\/(?:[a-z0-9-]+\.)*usc\.edu(?:\/|$)/i.test(url||'')){a.href=url;a.target='_blank';a.rel='noopener noreferrer'}return a}
function requirementLabel(r){
 if(r.category!=='course'||!r.options.length)return readableName(r.title).replace(/^[+\-]\s*\d*\)?\s*/,'');
 if(r.options.length===1)return canonicalCode(r.options[0].code);
 if(r.remainingCount===r.options.length)return `Complete these ${r.remainingCount} required courses`;
 const subjects=[...new Set(r.options.map(c=>canonicalCode(c.code).split(' ')[0]))];
 return `${subjects.length===1?subjects[0]+' course':'Course'} options${r.remainingCount!==null?' · '+r.remainingCount+' required':''}`;
}
function requirementRow(r,compact=false){
 const row=node('div',compact?'units-fact':'need-row');row.append(node('h3','',requirementLabel(r)));
 if(r.options.length&&!compact){
  const options=node('div','requirement-course-links');for(const c of r.options){const info=referenceFor(c);const item=append(node('div','requirement-option'),node('span','option-name',`${canonicalCode(c.code)} · ${info.units===null?'units not verified':info.units+' units'}`));if(info.ref)item.append(safeLink('View USC listing ↗',info.ref.url));options.append(item)}row.append(options);
 }else row.append(node('p','small muted',r.status==='complete'?'Satisfied on your report.':r.status==='ongoing'?'Depends on coursework currently underway or registered.':'Review this item with your advisor.'));
 row.append(excerpt(r));return row;
}
function disclosure(root,title,subtitle,tone=''){
 const d=node('details','card req-disclosure '+tone),summary=node('summary'),label=node('span','',title),body=node('div','disclosure-body');label.append(node('span','disclosure-copy',subtitle));summary.append(label);d.append(summary,body);root.append(d);return body;
}
function gpaFacts(r){
 const quote=r.evidenceVerified?r.sourceQuote:'';
 const value=quote.match(/EARNED:\s*([0-9]+(?:\.[0-9]+)?)\s*GPA/i)?.[1];
 const minimum=(quote+' '+r.title).match(/([0-9]+(?:\.[0-9]+)?)\s+(?:CUMULATIVE\s+)?GPA/i)?.[1];
 const label=/upper division/i.test(r.title)?'Upper division major GPA':/computer science|CSCI/i.test(r.title)?'CSCI & EE major GPA':/baccalaureate|university/i.test(r.title)?'University GPA':readableName(r.title);
 return {value,minimum,label};
}
function renderRequirements(){
 const root=$('requirements');root.replaceChildren(node('div','eyebrow','What needs your attention'),node('h1','','Your requirements'),node('p','intro muted','Start with the courses you still need. Courses already underway, GPA checks and unit totals are listed separately below.'),trackPicker());
 const list=node('div','requirements');root.append(list);const reqs=visibleRequirements();
 const needs=append(node('section','card req-section requirements-needed'),node('h2','','Courses you still need'),node('p','small muted','These are your course options. Review the USC listings, then use “Choose courses for a semester” to build your plan.'));
 const outstanding=reqs.filter(r=>r.category==='course'&&['needed','unclear'].includes(r.status));
 for(const r of outstanding)needs.append(requirementRow(r));
 if(!outstanding.length)needs.append(node('p','small muted','No outstanding course choices were extracted. Verify against your report.'));
 needs.append(append(node('div','actions'),action('Choose courses for a semester →','planner')));list.append(needs);
 const underway=disclosure(list,'Courses already underway','Taking now and registered courses, grouped by term','heading-blue');appendCourseTerms(underway);
 const gpa=reqs.filter(r=>r.category==='gpa');
 if(gpa.length){const card=append(node('section','card req-section gpa-summary'),node('h2','','GPA checks'),node('p','small muted','Your reported GPA and minimum are shown when they appear in the source evidence.'));const grid=node('div','gpa-checks');
  for(const r of gpa){const f=gpaFacts(r),c=append(node('div','gpa-check'),node('h3','',f.label),node('div','gpa-value',f.value||'Not extracted'),node('p','small muted',f.minimum?'Minimum '+f.minimum:'Minimum not extracted'));if(r.status==='ongoing')c.append(node('p','small muted','Includes unfinished coursework.'));c.append(excerpt(r));grid.append(c)}card.append(grid);list.append(card);
 }
 const units=disclosure(list,'Unit totals',`${val(app.report.units.earned)} earned · ${val(app.report.units.pending)} underway or registered · ${val(app.report.units.required)} minimum`,'heading-gold');
 units.append(node('p','small muted','Reaching the unit minimum does not replace the course requirements above.'));for(const r of reqs.filter(r=>r.category==='units'))units.append(requirementRow(r,true));
 const completed=disclosure(list,'Course requirements already satisfied','Completed course and general education requirements','heading-green');for(const r of reqs.filter(r=>!['gpa','units'].includes(r.category)&&r.status==='complete'))completed.append(requirementRow(r,true));
 const applying=disclosure(list,'How your current courses apply','Requirements that depend on passing coursework underway or registered','heading-blue');for(const r of reqs.filter(r=>!['gpa','units'].includes(r.category)&&r.status==='ongoing'))applying.append(requirementRow(r,true));
 const other=reqs.filter(r=>r.category==='other'&&['needed','unclear'].includes(r.status));if(other.length){const body=disclosure(list,'Other items to resolve','Review these remaining audit items with your advisor');for(const r of other)body.append(requirementRow(r,true))}
}
function currentSelections(){const key=`${app.term}|${app.track??'common'}`;if(!app.plans.has(key))app.plans.set(key,new Set());return app.plans.get(key)}
function optionGroups(){return visibleRequirements().filter(r=>r.category==='course'&&['needed','unclear'].includes(r.status)&&r.options.length)}
function selectedOptions(){const all=new Map(optionGroups().flatMap(r=>r.options.map(c=>[canonicalCode(c.code),c])));return [...currentSelections()].map(code=>all.get(code)).filter(Boolean)}
function renderPlanner(){const root=$('planner');root.replaceChildren(node('div','eyebrow','Make a plan you can discuss'),node('h1','','Build your semester.'),node('p','intro muted','A course shortlist, not a verified schedule. Unit references and prerequisite checks are limited to the linked USC sources.'),trackPicker());
 const termChoices=termsThroughGraduation(app.report.currentTerm,app.report.expectedGraduationDate);if(!termChoices.length){root.append(append(node('div','card'),node('h2','','Planning term needs review'),node('p','muted','The current term or expected graduation date was not found, or no future term falls within that range. Check the report with your advisor before building a semester.')));return}if(!termChoices.includes(app.term))app.term=termChoices[0];
 const columns=node('div','columns'),left=node('div','card'),right=node('div','card sticky');const termRow=append(node('div','plan-top'),node('h2','','Planning term'));const select=node('select');select.setAttribute('aria-label','Planning term');for(const code of termChoices){const o=node('option','',termName(code)+(deriveRegistration(app.report.courses,code).length?' · already registered':'')+(code===termChoices.at(-1)?' · expected graduation':''));o.value=String(code);select.append(o)}select.value=String(app.term);select.onchange=()=>{app.term=Number(select.value);renderPlanner()};termRow.append(select);left.append(termRow,node('p','term-context small muted','Tentative plan · offerings and registration eligibility are not verified. Each term keeps a separate shortlist.'));
 const registered=deriveRegistration(app.report.courses,app.term);if(registered.length){const units=sumUnits(registered);const box=append(node('section','registered-courses'),node('h2','',`Already registered · ${units.known} known units${units.unknown?' + unknown units':''}`));for(const c of registered)box.append(append(node('div','registered-course-row'),append(node('div'),node('strong','',c.code),node('div','small muted',c.title||missing)),node('span','small muted',`${val(c.units)} units`)));left.append(box)}
 left.append(node('h2','','Courses to add'));const used=new Set();for(const group of optionGroups()){left.append(node('h3','',requirementLabel(group)),node('p','small muted',group.remainingCount===null?group.summary:`${group.remainingCount} courses still required from these options.`));for(const c of group.options){const code=canonicalCode(c.code);if(used.has(code))continue;used.add(code);const info=referenceFor(c),row=node('div','course'),cb=node('input');cb.type='checkbox';const already=registered.some(x=>canonicalCode(x.code)===code);cb.checked=currentSelections().has(code)||already;cb.disabled=already;cb.setAttribute('aria-label','Add '+c.code);cb.onchange=()=>{if(cb.checked)currentSelections().add(code);else currentSelections().delete(code);renderPlanner()};const copy=append(node('div','live-course-copy'),node('strong','',c.code),node('div','small muted',info.title||'Title not stated'));copy.onclick=e=>{if(!e.target.closest('a,details')&&!already)cb.click()};const check=prereqCheck(code,app.report,app.term,app.refs);copy.append(node('span','prereq-status '+check.kind,already?'Already registered':check.label));const details=append(node('details','prereq-detail'),node('summary','','Course details'),node('p','small muted',check.details));details.onclick=e=>e.stopPropagation();if(info.ref)details.append(safeLink('USC unit source ↗',info.ref.url),node('p','small muted',info.ref.label));if(info.note)details.append(node('p','small legacy-note',info.note));if(app.refs.prereqSource&&app.refs.prerequisites[code])details.append(safeLink('USC prerequisite reference ↗',app.refs.prereqSource.url));copy.append(details);row.append(cb,copy,node('span','unit-badge',info.units===null?'Units unverified':`${info.units} units`));left.append(row)}}if(!used.size)left.append(node('p','small muted','No remaining course options were extracted. Review the report’s unresolved requirements.'));
 right.append(node('h2','','Your draft shortlist'));const chosen=selectedOptions();for(const c of chosen){const info=referenceFor(c);right.append(append(node('div','row between'),node('span','',c.code),node('span','small muted',`${val(info.units)} units`)));const check=prereqCheck(c.code,app.report,app.term,app.refs);if(check.kind!=='found')right.append(node('p','small prereq-summary '+check.kind,`${c.code}: ${check.label}. ${check.details}`))}if(!chosen.length)right.append(node('p','empty','No additions selected for this term.'));const totals=sumUnits(chosen.map(c=>({units:referenceFor(c).units}))),base=sumUnits(registered);right.append(node('div','plan-total',`${totals.known} shortlist units + ${base.known} registered = ${totals.known+base.known} known planned units${totals.unknown+base.unknown?' · some units unverified':''}`),node('p','small muted','Selecting courses does not certify requirement coverage, prerequisites, availability, workload or permission to register.'));
 const exp=node('button','primary','Draft email to advisor');exp.onclick=()=>draftAdvisorEmail(chosen,registered);const clear=node('button','','Clear additions');clear.onclick=()=>{currentSelections().clear();renderPlanner()};right.append(append(node('div','actions'),exp,clear));columns.append(left,append(node('div'),right));root.append(columns);
}
function draftAdvisorEmail(chosen,registered){
 const additions=chosen.filter(c=>!registered.some(r=>canonicalCode(r.code)===canonicalCode(c.code))).map(c=>{const info=referenceFor(c);return {...c,units:info.units,title:info.title}});
 const track=app.report.tracks.find(t=>t.id===app.track);
 const questions=visibleRequirements().some(r=>['needed','unclear'].includes(r.status)&&r.options.some(c=>canonicalCode(c.code)==='ENGR 102'))?['My report lists ENGR 102 as outstanding. Do I need to take it, or should an approved exception appear?']:[];
 showAdvisorEmail(buildAdvisorEmail({program:app.report.program,term:app.term,track:track?readableName(track.name).replace(/ Track$/,''):null,registered,additions,expectedGraduationDate:app.report.expectedGraduationDate?displayDate(app.report.expectedGraduationDate):null,questions}),$('planner'));
}
let advisorPanel=null;
function showAdvisorEmail(draft,host){
 advisorPanel?.remove();const panel=node('section','card advisor-email');advisorPanel=panel;panel.setAttribute('aria-label','Draft email to your advisor');
 panel.append(node('h2','','Your email draft'),node('p','small muted','Personalize this message, then copy the subject and message into your email. Nothing is sent from this app.'));
 const subjectLabel=node('label','small','Subject'),subject=node('input','email-subject');subject.id='advisor-email-subject';subject.type='text';subject.value=draft.subject;subjectLabel.htmlFor=subject.id;
 const bodyLabel=node('label','small','Message'),body=node('textarea','review-input');body.id='advisor-email-body';body.value=draft.body;bodyLabel.htmlFor=body.id;body.setAttribute('aria-label','Editable email draft for your advisor');
 const status=node('p','small muted');status.setAttribute('role','status');
 const copy=async(field,kind)=>{try{if(!globalThis.navigator?.clipboard?.writeText)throw Error('Clipboard unavailable');await globalThis.navigator.clipboard.writeText(field.value);status.textContent=kind+' copied. Paste it into your email.'}catch{field.focus?.();field.select?.();status.textContent='Select and copy this '+kind.toLowerCase()+' with Command+C or Ctrl+C.'}};
 const copySubject=node('button','','Copy subject');copySubject.onclick=()=>copy(subject,'Subject');const copyBody=node('button','primary','Copy message');copyBody.onclick=()=>copy(body,'Message');
 panel.append(subjectLabel,subject,bodyLabel,body,append(node('div','actions'),copyBody,copySubject),status);host.append(panel);panel.scrollIntoView?.({behavior:'smooth',block:'start'});
}
window.showAdvisorEmail=showAdvisorEmail;
window.buildAdvisorEmail=buildAdvisorEmail;
