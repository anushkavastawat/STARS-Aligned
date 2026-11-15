// A DOM contract smoke test, not a visual browser test.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import * as core from '../public/report-core.mjs';
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.value='';this.hidden=false;this.disabled=false;this._text='';this._html=''}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes;this._text=''}setAttribute(key,v){this.attributes[key]=v}after(){}remove(){}click(){this.onclick?.({target:this,preventDefault(){},stopPropagation(){}})}closest(){return null}
 set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(n=>n.textContent||'').join(' ')}set innerHTML(v){this._html=v;this.children=[]}get innerHTML(){return this._html}
}
const fixture=(program,earned)=>({program,catalogueYear:'20253',classLevel:'Junior',preparedDate:'2026-11-11',currentTerm:20263,expectedGraduationDate:'2027-12-15',units:{required:128,earned,pending:4,appliedEarned:null,appliedPending:null,sourceQuote:'Unit source',evidenceVerified:true},tracks:[],requirements:[{id:'one',title:'A remaining course',category:'course',status:'needed',trackId:null,summary:'One remaining course',remainingCount:1,options:[{code:'EE 451',title:null,units:null}],sourceQuote:'Needed EE 451',evidenceVerified:true}],courses:[{code:'TEST 123',title:'Synthetic completed course',units:4,term:20243,grade:'B+',status:'completed',area:'My subject area',sourceQuote:'Synthetic source',evidenceVerified:true},{code:'TEST 456',title:'Synthetic registered course',units:4,term:20271,grade:null,status:'registered',area:'My subject area',sourceQuote:'Synthetic source',evidenceVerified:true}],watchOuts:[]});
test('live dashboard replaces sample content, renders a different degree and handles no tracks',async()=>{
 const ids=new Map(),selectors=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id)};
 get('open-demo').onclick=()=>{};get('back-welcome').onclick=()=>{};
 const document={getElementById:get,createElement:t=>new Element(t),createTextNode:t=>{const n=new Element('#text');n.textContent=t;return n},body:new Element('body'),querySelector:s=>{if(!selectors.has(s))selectors.set(s,new Element());return selectors.get(s)}};
 const refs=JSON.parse(await readFile(new URL('../public/course-reference.json',import.meta.url),'utf8'));
 const context=vm.createContext({...core,document,window:{navigate() {},location:{reload(){}}},fetch:async url=>({json:async()=>url==='/api/health'?{configured:false,requiresAccessCode:false,provider:'gemini',providerName:'Google Gemini'}:refs}),AbortSignal,URL,Blob,setTimeout,console});
 const source=(await readFile(new URL('../public/ai-app.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 vm.runInContext("showReview('Synthetic academic report text for consent rendering')",context);assert(get('review').textContent.includes('Google Gemini'));const preview=get('review').children[4].children[1];assert.equal(preview.readOnly,true);assert.equal(preview.attributes['aria-readonly'],'true');assert(get('review').textContent.includes('Automatic cleanup can miss details'));assert(!get('review').textContent.includes('Editable report text'));assert(get('review').textContent.includes('synthetic demo data'));assert(!get('review').textContent.includes('and OpenAI'));
 context.testReport=fixture('Synthetic Biology Degree',24);vm.runInContext("app.report=testReport;app.track=null;app.term=20271;activateReport('mock-test-model')",context);
 assert.equal(selectors.get('#dashboard-topline>.eyebrow').textContent,'Synthetic Biology Degree');
 assert(get('overview').textContent.includes('24'));assert(!get('overview').textContent.includes('112'));assert(get('overview').textContent.includes('B+'));assert(!get('overview').textContent.includes('ENGR 102'));assert(get('overview').textContent.includes('What’s next for your degree'));assert(!get('overview').textContent.includes('Two tracks.'));const content=get('overview').children;assert(content.findIndex(c=>c.className==='columns overview-pathways')<content.findIndex(c=>c.className==='card course-history'));
 assert(get('requirements').textContent.includes('EE 451'));assert(get('planner').textContent.includes('TEST 456'));assert(get('planner').textContent.includes('Already registered'));
 let copied='';context.navigator={clipboard:{writeText:async value=>{copied=value}}};let emailRequests=0;context.fetch=async()=>{emailRequests++;throw Error('Email must not call API')};
 vm.runInContext("draftAdvisorEmail([],app.report.courses.filter(c=>c.status==='registered'))",context);
 const email=get('planner').children.at(-1);assert.equal(email.className,'card advisor-email');assert(email.textContent.includes('Your email draft'));const emailBody=email.children[5];assert.equal(emailBody.readOnly,undefined);emailBody.value='My personalized advisor message';await email.children[6].children[0].onclick();assert.equal(copied,'My personalized advisor message');assert.equal(emailRequests,0);
 context.testReport=fixture('Synthetic History Degree',56);context.testReport.watchOuts=['Advisor not yet designated by your Department.','Check a missing course with your advisor.'];vm.runInContext("app.report=testReport;app.report.expectedGraduationDate=null;activateReport('mock-test-model')",context);assert(get('overview').textContent.includes('56'));assert(!get('overview').textContent.includes('not yet designated'));assert(get('overview').textContent.includes('Check a missing course with your advisor.'));assert.equal(get('overview').children[3].children[0].children[1].textContent,'56');assert(get('planner').textContent.includes('Planning term needs review'));
});
test('PDF upload reaches review with the v6 document API, which has no doc.destroy method',async()=>{
 const ids=new Map(),selectors=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id)};
 const views=[];let destroyed=0;const document={getElementById:get,createElement:t=>new Element(t),createTextNode:t=>{const n=new Element('#text');n.textContent=t;return n},body:new Element('body'),querySelector:s=>{if(!selectors.has(s))selectors.set(s,new Element());return selectors.get(s)}};
 const doc={numPages:1,loadingTask:{destroy:async()=>{destroyed++}},getPage:async()=>({getTextContent:async()=>({items:[{str:'STARS academic report text with units, courses, and remaining requirements. '.repeat(8),hasEOL:true}]})})};
 assert.equal(doc.destroy,undefined);
 const refs={courseCatalogue:{},unitSources:{},prerequisites:{}};
 const context=vm.createContext({...core,document,window:{navigate:v=>views.push(v),location:{reload(){}}},fetch:async url=>({json:async()=>url==='/api/health'?{configured:false,requiresAccessCode:false,provider:'gemini',providerName:'Google Gemini'}:refs}),AbortSignal,URL,Blob,setTimeout,console,mockPDF:{GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(doc)})}});
 const source=(await readFile(new URL('../public/ai-app.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'').replace("await import('/vendor/pdf.mjs')",'mockPDF');vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 get('report-file').files=[{name:'sample.pdf',size:2000,type:'application/pdf',arrayBuffer:async()=>new ArrayBuffer(8)}];await get('report-file').onchange();assert.equal(destroyed,1);assert.equal(views.at(-1),'review');assert.equal(get('review').children[2].textContent,'Check what will be sent.');assert(!get('file-feedback').textContent.includes('not a function'));
});
test('AI requirements retain the original sections and keep IP- courses out of completed work',async()=>{
 const ids=new Map(),selectors=new Map(),get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id)};
 const document={getElementById:get,createElement:t=>new Element(t),createTextNode:t=>{const n=new Element('#text');n.textContent=t;return n},body:new Element('body'),querySelector:s=>{if(!selectors.has(s))selectors.set(s,new Element());return selectors.get(s)}};
 const refs=JSON.parse(await readFile(new URL('../public/course-reference.json',import.meta.url),'utf8'));
 const context=vm.createContext({...core,document,window:{navigate(){},location:{reload(){}}},fetch:async url=>({json:async()=>url==='/api/health'?{configured:true,provider:'gemini'}:refs}),AbortSignal,URL,Blob,setTimeout,console});
 vm.runInContext((await readFile(new URL('../public/ai-app.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,''),context);await new Promise(resolve=>setImmediate(resolve));
 const report=fixture('Another engineering degree',80);report.tracks=[{id:'a',name:'COMPUTING SYSTEMS TRACK'},{id:'b',name:'EMBEDDED SYSTEMS TRACK'}];report.requirements[0].trackId='a';
 const req=(id,category,status,quote,extra={})=>({id,title:id,category,status,trackId:null,summary:quote,remainingCount:null,options:[],sourceQuote:quote,evidenceVerified:true,...extra});
 report.requirements.push(
 req('Embedded core','course','ongoing','IP- 1) COMPLETE THE FOLLOWING COURSES',{trackId:'b',remainingCount:3,options:['EE202','EE301','EE459'].map(code=>({code,title:null,units:null}))}),
 req('University GPA','gpa','complete','OK 2.0 CUMULATIVE GPA REQUIRED\nEARNED: 3.950 GPA'),
 req('64-Unit Residency Requirement','other','complete','IP 64-UNIT RESIDENCY REQUIREMENT HAS BEEN SATISFIED.'),
 req('Technical elective','course','complete','IP+ 3) TECHNICAL ELECTIVE REQUIREMENT MET.')
 );
 context.testReport=report;vm.runInContext("app.report=testReport;app.track='b';app.term=20271;activateReport('mock')",context);
 const list=get('requirements').children.at(-1),needed=list.children[0],underway=list.children[1],gpa=list.children[2],units=list.children[3],done=list.children[4],applies=list.children[5];
 assert(needed.textContent.includes('Complete these 3 required courses'));assert(needed.textContent.includes('EE 202'));assert(!needed.textContent.includes('EE 451'));
 assert(underway.textContent.includes('TEST 456'));assert(underway.textContent.includes('Registered'));
 assert(gpa.textContent.includes('3.950'));assert(gpa.textContent.includes('Minimum 2.0'));assert(units.textContent.includes('64-Unit Residency Requirement'));
 assert(!done.textContent.includes('Residency'));assert(!done.textContent.includes('Technical elective'));assert(applies.textContent.includes('Technical elective'));
 const columns=get('overview').children.find(c=>c.className==='columns overview-pathways');assert.equal(columns.children.length,2);assert(columns.textContent.includes('Two tracks. One choice.'));assert(columns.textContent.includes('Computing Systems'));assert(columns.textContent.includes('Already on your report'));
 const picker=get('requirements').children[3];picker.children[0].click();assert(get('requirements').children.at(-1).children[0].textContent.includes('EE 451'));assert(!get('requirements').children.at(-1).children[0].textContent.includes('EE 202'));
});
