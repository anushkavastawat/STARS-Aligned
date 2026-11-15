export function canonicalCode(value){const code=String(value||'').trim().toUpperCase();const m=/^([A-Z]{2,6})[ -]*(\d{3})(?:LX|L)?$/.exec(code);return m?`${m[1]} ${m[2]}`:code.replace(/\s+/g,' ')}
export function termName(code){if(!Number.isInteger(Number(code))||![1,2,3].includes(Number(code)%10))return 'Term not stated';return `${({1:'Spring',2:'Summer',3:'Fall'})[Number(code)%10]} ${Math.floor(Number(code)/10)}`}
export function termsThroughGraduation(current,iso){const match=/^(\d{4})-(\d{2})-\d{2}$/.exec(iso||'');if(!match||!Number.isInteger(current)||![1,2,3].includes(current%10))return [];const year=Number(match[1]),month=Number(match[2]);if(month<1||month>12||year>Math.floor(current/10)+15)return [];const last=year*10+(month<=5?1:month<=8?2:3),out=[];for(let y=Math.floor(current/10);y<=year;y++)for(let t=1;t<=3;t++){const code=y*10+t;if(code>current&&code<=last)out.push(code)}return out}
// Best effort only: the editable review step is always required before sending text.
export function redactReport(raw){let t=String(raw||'').replace(/\u0000/g,'');
 t=t.replace(/STARS\s+Report\s+for[\s\S]{0,160}?(?=ID\s*#)/gi,'STARS Report for [name removed] ')
 .replace(/\b(?:USC\s*)?(?:ID\s*#|Student\s*ID)\s*:?\s*[\d -]{5,25}/gi,'ID: [removed]\n')
 .replace(/Name\s+as\s+it\s+will\s+appear\s+on\s+your\s+USC\s+Diploma\s*:[\s\S]*?(?=PRIMARY\s+POST|={5,}|$)/gi,'[Diploma name and address removed]\n')
 .replace(/Diploma\s+will\s+be\s+mailed\s+to\s*:[\s\S]*?(?=PRIMARY\s+POST|={5,}|$)/gi,'[Diploma address removed]\n')
 .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]')
 .replace(/\b\d{9,10}\b/g,'[identifier removed]');
 return t.trim();}
export function normalizeWhitespace(s){return String(s||'').replace(/\s+/g,' ').trim().toLowerCase()}
export function evidenceFound(quote,report){const q=normalizeWhitespace(quote);return q.length>=8&&normalizeWhitespace(report).includes(q)}
export function deriveRegistration(courses,term){return courses.filter(c=>c.term===Number(term)&&['registered','in_progress'].includes(c.status))}
export function sumUnits(courses){return {known:courses.reduce((sum,c)=>sum+(typeof c.units==='number'?c.units:0),0),unknown:courses.filter(c=>c.units===null||c.units===undefined).length}}
export function prereqCheck(code,report,term,references){const rules=references.prerequisites[canonicalCode(code)];if(!rules)return{kind:'unknown',label:'Pre-reqs not checked',details:'No verified prerequisite reference is included for this course.'};const found=[],pending=[],review=[],missing=[];for(const required of rules){const matches=report.courses.filter(c=>canonicalCode(c.code)===canonicalCode(required)&&c.term!==null&&c.term<Number(term));if(matches.some(c=>c.evidenceVerified&&c.status==='completed'&&!['F','NP','NC','IN','IX','MG','NS'].includes((c.grade||'').toUpperCase())))found.push(required);else if(matches.some(c=>c.evidenceVerified&&['in_progress','registered'].includes(c.status)))pending.push(required);else if(matches.some(c=>c.status==='transfer'||!c.evidenceVerified)||report.courses.some(c=>canonicalCode(c.code)===canonicalCode(required)&&c.term===null))review.push(required);else missing.push(required)}return{kind:missing.length?'missing':review.length||pending.length?'pending':'found',label:missing.length?'Pre-reqs missing':review.length?'Pre-reqs need review':pending.length?'Pre-reqs ongoing':'Pre-req courses complete',details:[`Reference courses: ${rules.join(' + ')}.`,found.length?`Completed: ${found.join(', ')}.`:'',pending.length?`Must pass first: ${pending.join(', ')}.`:'',review.length?`Check term, transfer equivalency or source evidence: ${review.join(', ')}.`:'',missing.length?`Not found as completed before this term: ${missing.join(', ')}.`:'','Minimum grades, co-requisites, waivers and clearance still require confirmation.'].filter(Boolean).join(' ')}}

// Only verified heading markers can override the model's interpretation.
export function requirementStatus(r){
 const marker=r.evidenceVerified?r.sourceQuote?.match(/^\s*(IP[+-]?|OK|NO|[+-])(?=\s)/)?.[1]:null;
 return marker?({'IP-':'needed','NO':'needed','-':'needed','IP':'ongoing','IP+':'ongoing','OK':'complete','+':'complete'}[marker]):r.status;
}
// Read explicitly labeled GPA blocks from the reviewed report, independently of AI excerpts.
export function gpaKind(text){
 const t=String(text||'');
 if(/upper\s+division/i.test(t))return 'upper';
 if(/computer\s+science|\bCSCI\b/i.test(t)&&/electrical\s+engineering|\bEE\b/i.test(t))return 'major';
 if(/baccalaureate|university\s+GPA/i.test(t))return 'university';
 return null;
}
export function extractGpaChecks(text){
 const source=String(text||'').replace(/\s+/g,' '),heads=[...source.matchAll(/\b(OK|IP[+-]?|NO)\s+(\d+(?:\.\d+)?)\s+CUMULATIVE\s+GPA\s+REQUIRED\b/gi)],checks=new Map(),conflicts=new Set();
 for(let i=0;i<heads.length;i++){
  const h=heads[i],block=source.slice(h.index,Math.min(heads[i+1]?.index??source.length,h.index+2500));
  const earned=block.match(/\bEARNED:\s*(\d+(?:\.\d+)?)\s*GPA\b/i);if(!earned)continue;
  const heading=block.slice(0,earned.index),kind=gpaKind(heading),value=Number(earned[1]),minimum=Number(h[2]);
  if(!kind||value>4||minimum>4||value<0||minimum<0)continue;
  const entry={kind,value:earned[1],minimum:h[2],status:({'OK':'complete','NO':'needed','IP':'ongoing','IP+':'ongoing','IP-':'needed'})[h[1].toUpperCase()],sourceQuote:block.slice(0,earned.index+earned[0].length)};
  const old=checks.get(kind);if(old&&(Number(old.value)!==value||Number(old.minimum)!==minimum||old.status!==entry.status)){conflicts.add(kind);continue}checks.set(kind,entry);
 }
 for(const kind of conflicts)checks.delete(kind);
 return checks;
}
export function buildAdvisorEmail({program,term,track,registered=[],additions=[],expectedGraduationDate=null,questions=[]}){
 const label=termName(term),lines=c=>`- ${c.code}${c.title?' — '+c.title:''} (${c.units===null||c.units===undefined?'units to confirm':c.units+' units'})`;
 const all=[...registered,...additions],units=sumUnits(all);
 const body=[
 'Hi [Advisor’s name],','',
 `I’m reviewing my course plan for ${label} and would appreciate your guidance.`,
 program?`My program is ${program}${track?', and I’m considering the '+track+' track':''}.`:track?`I’m considering the ${track} track.`:'',
 '',
 ...(registered.length?['My STARS report lists these courses as already registered or in progress for this term:',...registered.map(lines),'']:[]),
 ...(additions.length?['I’m considering adding:',...additions.map(lines),'']:['I haven’t selected additional courses yet and would appreciate your suggestions.','']),
 ...(all.length?[`Together, these courses total ${units.known}${units.unknown?' known':''} units${units.unknown?'; some course units still need confirmation':''}.`,'']:[]),
 'Could you please help me confirm:',
 ...[...new Set([
  'Whether this plan fits my remaining degree requirements'+(track?' for this track':'')+'.',
  'Any prerequisites, course offerings, registration restrictions or substitutions I should check.',
  ...(expectedGraduationDate?[`Whether this plan keeps me on track for my report’s expected graduation date of ${expectedGraduationDate}.`]:[]),
  ...questions
 ])].map(q=>'- '+q),
 '',
 'This is a tentative plan based on my STARS report. Please let me know if you would recommend any changes.',
 '', 'Thank you!', '[Your name]'
 ].filter(line=>line!==null).join('\n');
 return {subject:`Course planning for ${label}`,body};
}
