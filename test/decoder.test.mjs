import test from 'node:test';import assert from 'node:assert/strict';
import {redactReport,canonicalCode,termsThroughGraduation,deriveRegistration,prereqCheck,extractGpaChecks,buildAdvisorEmail} from '../public/report-core.mjs';
import {reportSchema,validateSchema,prepareReport} from '../report-schema.mjs';
import {createHandler,modelText,serverSettings,startServer} from '../server.mjs';
const text=`STARS DEGREE PROGRESS REPORT
PROGRAM: Synthetic Test Degree
PREPARED: 11/11/26
EARNED: 24.00 UNITS
IN-PROCESS: 4.00 UNITS
20243 CSCI201 4.0 A
20271 CSCI350 4.0 RG >IP
NO TRACK ALPHA REQUIREMENT: SELECT FROM EE451
NO OR TRACK BETA REQUIREMENT: SELECT FROM EE477
EXPECTED GRADUATION: 15 DECEMBER 2027
`.repeat(2);
const fixture=()=>({program:'Synthetic Test Degree',catalogueYear:'20253',classLevel:null,preparedDate:'2026-11-11',currentTerm:20263,expectedGraduationDate:'2027-12-15',units:{required:128,earned:24,pending:4,appliedEarned:null,appliedPending:null,sourceQuote:'EARNED: 24.00 UNITS'},tracks:[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}],courses:[{code:'CSCI201',title:null,units:4,term:20243,grade:'A',status:'completed',area:'CS',sourceQuote:'20243 CSCI201 4.0 A'},{code:'CSCI350',title:null,units:4,term:20271,grade:null,status:'registered',area:'CS',sourceQuote:'20271 CSCI350 4.0 RG >IP'}],requirements:[{id:'a1',title:'Alpha remaining course',category:'course',status:'needed',trackId:'a',summary:'One course remains.',remainingCount:1,options:[{code:'EE451',title:null,units:null}],sourceQuote:'NO TRACK ALPHA REQUIREMENT: SELECT FROM EE451'},{id:'b1',title:'Beta remaining course',category:'course',status:'needed',trackId:'b',summary:'One course remains.',remainingCount:1,options:[{code:'EE477',title:null,units:null}],sourceQuote:'NO OR TRACK BETA REQUIREMENT: SELECT FROM EE477'}],watchOuts:[]});
const request=(data,origin='http://localhost:3000',url='http://localhost:3000/api/decode')=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
const modelResponse=report=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]}));
test('term bounds include Spring/Summer/Fall through graduation and never invent a missing date',()=>{assert.deepEqual(termsThroughGraduation(20263,'2027-12-15'),[20271,20272,20273]);assert.deepEqual(termsThroughGraduation(20263,'2027-05-15'),[20271]);assert.deepEqual(termsThroughGraduation(20263,null),[])});
test('canonical codes match lab suffixes without combining A/B courses',()=>{assert.equal(canonicalCode('EE459Lx'),'EE 459');assert.equal(canonicalCode('CSCI 104L'),'CSCI 104');assert.notEqual(canonicalCode('CSCI 491A'),canonicalCode('CSCI 491B'))});
test('redaction handles PDF whitespace, repeated identifiers and diploma blocks',()=>{const input='STARS Report for Example Person ID#: 1234567890\nPROGRAM: TEST\nName  as\nit will appear on your USC Diploma: Secret Person\nDiploma will be mailed to: 123 Road\n=====\nPRIMARY POST: BS\nSTARS Report for Example Person ID#: 1234567890\ntest@example.edu';const result=redactReport(input);assert(!result.includes('Example Person'));assert(!result.includes('Secret Person'));assert(!result.includes('123 Road'));assert(!result.includes('1234567890'));assert(!result.includes('test@example.edu'));assert(result.includes('PRIMARY POST'))});
test('strict schema rejects missing fields and invalid statuses; null totals remain null',()=>{const f=fixture();assert.equal(validateSchema(f).units.appliedEarned,null);delete f.currentTerm;assert.throws(()=>validateSchema(f));const bad=fixture();bad.courses[0].status='done';assert.throws(()=>validateSchema(bad));assert.equal(reportSchema.additionalProperties,false)});
test('report validation retains alternative tracks, pending courses and distinct credit measures',()=>{const report=prepareReport(fixture(),text);assert.equal(report.program,'Synthetic Test Degree');assert.equal(report.units.earned,24);assert.equal(report.units.appliedEarned,null);assert.equal(report.requirements[1].trackId,'b');assert(report.courses.every(c=>c.evidenceVerified));assert.equal(deriveRegistration(report.courses,20271).length,1);assert.equal(report.courses.filter(c=>c.status==='completed').length,1)});
test('duplicate course listings are deduplicated and conflicting data flagged',()=>{const f=fixture();f.courses.push({...f.courses[0],units:3});const r=prepareReport(f,text);assert.equal(r.courses.length,2);assert(r.watchOuts.some(w=>w.includes('Conflicting')))});
test('invalid evidence is flagged instead of silently trusted; invalid tracks and dates rejected',()=>{const f=fixture();f.courses[0].sourceQuote='invented text with no source';const r=prepareReport(f,text);assert.equal(r.courses[0].evidenceVerified,false);assert(r.watchOuts.length>0);const bad=fixture();bad.requirements[0].trackId='invented';assert.throws(()=>prepareReport(bad,text));const date=fixture();date.expectedGraduationDate='2027-02-31';assert.throws(()=>prepareReport(date,text))});
test('prerequisites distinguish completed, registered, missing and transfer with evidence checks',()=>{const r=prepareReport(fixture(),text),refs={prerequisites:{'EE 451':['CSCI 201'],'EE 454':['CSCI 350'],'CSCI 401':['CSCI 201','CSCI 310']}};assert.equal(prereqCheck('EE 451',r,20273,refs).kind,'found');assert.equal(prereqCheck('EE 454',r,20273,refs).label,'Pre-reqs ongoing');assert.equal(prereqCheck('EE 454',r,20271,refs).kind,'missing');assert.equal(prereqCheck('CSCI 401',r,20273,refs).kind,'missing');r.courses[0].status='transfer';assert.equal(prereqCheck('EE 451',r,20273,refs).label,'Pre-reqs need review')});
test('unconfigured API returns explicit setup error, never sample report',async()=>{const h=createHandler({env:{},fetchImpl:()=>{throw Error('must not call')}});const res=await h(request({text,consent:true}));assert.equal(res.status,503);const data=await res.json();assert(data.error.includes('OPENAI_API_KEY'));assert(!data.report)});
test('origin and consent are checked before sending a report',async()=>{let calls=0;const h=createHandler({env:{OPENAI_API_KEY:'test-only'},fetchImpl:()=>{calls++;return modelResponse(fixture())}});assert.equal((await h(request({text,consent:true},'https://another-site.example'))).status,403);assert.equal((await h(request({text,consent:false}))).status,400);assert.equal(calls,0)});
test('configured API sends schema and store:false, returns only validated new report data',async()=>{let sent;const h=createHandler({env:{OPENAI_API_KEY:'test-only'},fetchImpl:async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(init.body);return modelResponse(fixture())}});const res=await h(request({text,consent:true}));assert.equal(res.status,200);const data=await res.json();assert.equal(data.mode,'ai');assert.equal(data.report.units.earned,24);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);assert.equal(sent.text.format.schema.additionalProperties,false);assert(!JSON.stringify(data).includes('test-only'))});
test('provider refusal, incomplete, malformed and invalid output never becomes a fake success',async()=>{for(const data of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'not json'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}]){const h=createHandler({env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>new Response(JSON.stringify(data))});const res=await h(request({text,consent:true}));assert.equal(res.status,422);assert(!(await res.json()).report)}});
test('password guard, oversized text and provider quota errors are explicit',async()=>{const h=createHandler({env:{OPENAI_API_KEY:'test-only',APP_PASSWORD:'private-demo'},fetchImpl:async()=>modelResponse(fixture())});assert.equal((await h(request({text,consent:true}))).status,401);const large=createHandler({env:{OPENAI_API_KEY:'test-only'}});assert.equal((await large(request({text:'x'.repeat(100001),consent:true}))).status,413);const quota=createHandler({env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>new Response('{}',{status:429})});assert.equal((await quota(request({text,consent:true}))).status,429)});
test('server never serves secrets or filesystem paths; health contains no key',async()=>{const h=createHandler({env:{OPENAI_API_KEY:'secret-value',APP_PASSWORD:'private-demo'}});assert.equal((await h(new Request('http://localhost:3000/.env'))).status,404);assert.equal((await h(new Request('http://localhost:3000/server.mjs'))).status,404);const status=await(await h(new Request('http://localhost:3000/api/health'))).json();assert.equal(status.configured,true);assert.equal(status.requiresAccessCode,true);assert(!JSON.stringify(status).includes('secret-value'));assert(!JSON.stringify(status).includes('private-demo'))});
test('provider billing errors are distinguished from temporary rate limits without raw provider text',async()=>{for(const [code,retryable,expected]of [['insufficient_quota',false,'quota'],['credit_balance_exhausted',false,'credits'],['project_spend_limit_exceeded',false,'spend limit'],['rate_limit_exceeded',true,'temporary'],['slow_down',true,'temporary']]){const h=createHandler({env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>new Response(JSON.stringify({error:{code,message:'Do not echo a raw provider message'}}),{status:429})});const response=await h(request({text,consent:true}));assert.equal(response.status,429);const body=await response.json();assert.equal(body.code,code);assert.equal(body.retryable,retryable);assert(body.error.includes(expected));assert(!body.error.includes('Do not echo'))}});
test('Gemini sends native structured JSON request with only the selected provider key',async()=>{let sent,urlUsed,headers;const h=createHandler({env:{AI_PROVIDER:'gemini',GEMINI_API_KEY:'gemini-test-key',OPENAI_API_KEY:'must-not-use'},fetchImpl:async(url,init)=>{urlUsed=url;sent=JSON.parse(init.body);headers=init.headers;return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(fixture())}]}}]}))}});const res=await h(request({text,consent:true}));assert.equal(res.status,200);const result=await res.json();assert.equal(result.provider,'gemini');assert.equal(result.report.units.earned,24);assert(urlUsed.startsWith('https://generativelanguage.googleapis.com/v1beta/models/'));assert.equal(headers['x-goog-api-key'],'gemini-test-key');assert(!headers.Authorization);assert.equal(sent.generationConfig.responseMimeType,'application/json');assert.equal(sent.generationConfig.responseJsonSchema.additionalProperties,false);assert(!JSON.stringify(result).includes('gemini-test-key'))});
test('Gemini limit/access errors never fall back to OpenAI or enable billing',async()=>{for(const status of [403,429]){const calls=[];const h=createHandler({env:{AI_PROVIDER:'gemini',GEMINI_API_KEY:'gemini-test',OPENAI_API_KEY:'openai-test'},fetchImpl:async url=>{calls.push(url);return new Response('{}',{status})}});const response=await h(request({text,consent:true}));assert.equal(calls.length,1);assert(calls[0].includes('googleapis.com'));assert(!(await response.json()).report)}});
test('Gemini blocked or truncated candidates fail validation without sample fallback',async()=>{for(const result of [{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]}]){const h=createHandler({env:{AI_PROVIDER:'gemini',GEMINI_API_KEY:'test'},fetchImpl:async()=>new Response(JSON.stringify(result))});const response=await h(request({text,consent:true}));assert.equal(response.status,422);assert(!(await response.json()).report)}});
test('Gemini health reports the selected provider and does not treat an OpenAI key as a Gemini credential',async()=>{const h=createHandler({env:{AI_PROVIDER:'gemini',OPENAI_API_KEY:'must-not-use'}});const result=await(await h(new Request('http://localhost:3000/api/health'))).json();assert.equal(result.provider,'gemini');assert.equal(result.configured,false);assert.equal(result.providerName,'Google Gemini')});
test('decode errors identify the failing stage without exposing model output',async()=>{
 for(const [body,expected] of [
  [{candidates:[{finishReason:'MAX_TOKENS'}]},'output limit'],
  [{candidates:[{finishReason:'STOP',content:{parts:[{text:'PRIVATE GENERATED TEXT'}]}}]},'JSON was incomplete or malformed'],
  [{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...fixture(),program:42})}]}}]},'report.program: wrong data type']
 ]){
 const h=createHandler({env:{AI_PROVIDER:'gemini',GEMINI_API_KEY:'secret-test'},fetchImpl:async()=>new Response(JSON.stringify(body))});
 const res=await h(request({text,consent:true}));const value=await res.json();
 assert.equal(res.status,422);assert(value.error.includes(expected));assert(!JSON.stringify(value).includes('PRIVATE GENERATED TEXT'));assert(!JSON.stringify(value).includes('secret-test'));assert(!value.report);
 }
});

test('invalid numeric terms become unknown with a warning and cannot certify prerequisites',()=>{
 const f=fixture();f.currentTerm=20264;f.courses[0].term=20244;
 const r=prepareReport(f,text);assert.equal(r.currentTerm,null);assert.equal(r.courses[0].term,null);
 assert(r.watchOuts.some(x=>x.includes('Current term')));assert(r.watchOuts.some(x=>x.includes('Course entry 1')));
 assert.equal(termsThroughGraduation(r.currentTerm,r.expectedGraduationDate).length,0);
 assert.equal(prereqCheck('EE451',r,20271,{prerequisites:{'EE 451':['CSCI 201']}}).label,'Pre-reqs need review');
 assert.equal(r.units.earned,24);assert.equal(r.courses[1].term,20271);
});
test('verified audit heading markers correct misleading model statuses without trusting invented evidence',()=>{
 const f=fixture();const source='IP- COMPLETE THREE COURSES\nIP 64-UNIT RESIDENCY HAS BEEN SATISFIED\nIP+ TECHNICAL ELECTIVE REQUIREMENT MET';
 f.requirements[0].sourceQuote='IP- COMPLETE THREE COURSES';f.requirements[0].status='ongoing';
 f.requirements[1].sourceQuote='IP+ TECHNICAL ELECTIVE REQUIREMENT MET';f.requirements[1].status='complete';
 const r=prepareReport(f,text+source);assert.equal(r.requirements[0].status,'needed');assert.equal(r.requirements[1].status,'ongoing');
 const invented=fixture();invented.requirements[0].sourceQuote='OK INVENTED EVIDENCE';assert.equal(prepareReport(invented,text).requirements[0].status,'needed');
});
test('GPA comes from the reviewed source when AI omits or paraphrases university evidence',()=>{
 const f=fixture();f.requirements.push({id:'gpa',title:'University GPA',category:'gpa',status:'needed',trackId:null,summary:'University GPA',remainingCount:null,options:[],sourceQuote:'A paraphrase not in the source'});
 const source='OK 2.0 CUMULATIVE GPA REQUIRED OF ALL USC BACCALAUREATE UNITS\n** NOTE: Honors consider transferred and resident GPA.\nEARNED:     3.625 GPA\nIP 2.0 CUMULATIVE GPA REQUIRED IN ALL UPPER DIVISION COURSE WORK APPLIED TO YOUR MAJOR:\nEARNED: 3.750 GPA';
 const r=prepareReport(f,text+source),gpa=r.requirements.at(-1);assert.equal(gpa.status,'complete');assert.equal(gpa.evidenceVerified,true);assert(gpa.sourceQuote.includes('3.625 GPA'));assert(!gpa.sourceQuote.includes('3.750'));
});

test('GPA extraction keeps blocks separate and does not pick a conflicting repeated value',()=>{
 const source='OK 2.0 CUMULATIVE GPA REQUIRED OF ALL USC BACCALAUREATE UNITS No earned GPA here. IP 2.0 CUMULATIVE GPA REQUIRED IN ALL UPPER DIVISION COURSE WORK APPLIED TO YOUR MAJOR: EARNED: 3.700 GPA';
 assert.equal(extractGpaChecks(source).has('university'),false);assert.equal(extractGpaChecks(source).get('upper').value,'3.700');
 const conflict='OK 2.0 CUMULATIVE GPA REQUIRED OF ALL USC BACCALAUREATE UNITS EARNED: 3.100 GPA OK 2.0 CUMULATIVE GPA REQUIRED OF ALL USC BACCALAUREATE UNITS EARNED: 3.200 GPA';
 assert.equal(extractGpaChecks(conflict).has('university'),false);
});

test('advisor email distinguishes registered courses from additions and preserves unknown units',()=>{
 const result=buildAdvisorEmail({program:'Synthetic History Degree',term:20271,track:null,registered:[{code:'TEST 123',title:'Registered course',units:4}],additions:[{code:'TEST 456',title:'Proposed course',units:null}]});
 assert.equal(result.subject,'Course planning for Spring 2027');assert(result.body.includes('already registered or in progress'));assert(result.body.includes('I’m considering adding:'));assert(result.body.includes('TEST 456'));assert(result.body.includes('4 known units'));assert(result.body.includes('units to confirm'));assert(!result.body.includes('track.'));assert(!result.body.includes('ENGR 102'));
 const empty=buildAdvisorEmail({program:null,term:20273});assert(empty.body.includes('haven’t selected additional courses'));assert(!empty.body.includes('undefined'));
});
test('Render uses its public HTTPS URL and requires an access code for public binding',()=>{
 assert.deepEqual(serverSettings({}),{host:'127.0.0.1',port:3000,publicOrigin:null});
 assert.deepEqual(serverSettings({RENDER:'true',RENDER_EXTERNAL_URL:'https://example.onrender.com',PORT:'10000'}),{host:'0.0.0.0',port:10000,publicOrigin:'https://example.onrender.com'});
 assert.throws(()=>startServer({RENDER:'true'}),/APP_PASSWORD/);
});
