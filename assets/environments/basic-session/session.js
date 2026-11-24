'use strict';(()=>{const modules={"packages/basic-session/app.js":(exports,require)=>{
const { TerminalView } = require("packages/terminal/view.js");
const { receiveOutput } = require("packages/basic-session/output.js");
const { SourceEditor, moveBoundary } = require("packages/basic-session/editor.js");
const { Program, exportWorkspace, importWorkspace } = require("packages/basic/program.js");
const { limits } = require("packages/basic/profiles.js");
const { workerSource, sampleSource, examples } = require("packages/basic-session/generated.js");
const $=id=>document.getElementById(id), key='retrorealm-basic-workspace:1:default';
const terminal=new TerminalView({output:$('output'),viewport:$('screen'),input:$('decision'),prompt:$('prompt'),announce:$('announce'),width:()=>Number($('columns').value)});
let worker, state='ready', pending=false, pendingCount=0, lastMessage=Date.now(), historySize=0, source='', dialect='ms8k',seed='observatory-1';
let editing=null, priorInput='';
const editor=new SourceEditor({input:$('source'),gutter:$('source-rows'),status:$('source-status'),onChange:()=>updateControls()});
function notice(message){$('notice').textContent=message;}
function showError(message){$('error-text').textContent=message;$('error-panel').hidden=false;const line=/ in (\d+)$/.exec(message);$('error-edit').hidden=!line;$('error-edit').dataset.line=line?.[1]??'';}
function clearError(){$('error-panel').hidden=true;}
function updateControls(){
  $('source').readOnly=pending||editing!==null;
  for(const id of ['apply','run','sample','load','import','dialect','seed','new-program','load-example'])$(id).disabled=pending||editing!==null;
  for(const id of ['tape-record','tape-mount','tape-rewind','device-export','device-import'])$(id).disabled=pending||editing!==null||state==='running';
  $('cancel-source').disabled=pending||editing!==null||!editor.dirty;
  $('decision').readOnly=pending&&editing!==null;
  $('cancel-line').hidden=editing===null;$('cancel-line').disabled=pending;
  for(const button of $('output').querySelectorAll('.listing-line'))button.disabled=pending||editing!==null||editor.dirty||['running','input'].includes(state);
  $('prompt').textContent=editing!==null?`EDIT ${editing} / Enter commits / Escape cancels >`:state==='input'?'INPUT >':state==='running'?'RUNNING / STOP to interrupt >':'READY >';
  $('decision').setAttribute('aria-label',editing!==null?`Editing BASIC line ${editing}`:'BASIC command or program input');
}
function requireDraftDecision(allowSource=false){
  if(editing!==null)throw new Error('Commit or cancel the line edit first.');
  if(!allowSource&&editor.dirty)throw new Error('Apply or cancel the source editor changes first.');
  if(pending)throw new Error('Wait for the current request to finish.');
}
function decorateListing(){
  const index=terminal.records.findLastIndex(r=>r.kind==='listing');
  if(index<0)return;
  const record=terminal.records[index],block=$('output').children[index],rows=record.text.split('\n');
  if(rows.length>256||!/^\d+\s/.test(rows[0]))return;
  block.replaceChildren();
  for(const text of rows){const line=Number(text.match(/^\d+/)?.[0]);if(!line)continue;const button=document.createElement('button');button.type='button';button.className='listing-line';button.textContent=terminal.text({text});button.setAttribute('aria-label',`Edit BASIC line ${line}: ${text}`);button.onclick=()=>action(()=>{requireDraftDecision();priorInput=$('decision').value;send({type:'edit-begin',line});});block.append(button);}
  updateControls();
}
function output(text,kind='output'){
  if(historySize+text.length>limits.output){terminal.receive({type:'clear'});historySize=0;}
  if(kind==='listing')for(let i=0;i<terminal.records.length;i++)if(terminal.records[i].kind==='listing'){$('output').children[i].textContent=terminal.text(terminal.records[i]);terminal.records[i].kind='output';}
  historySize+=text.length;receiveOutput(terminal,text,kind);
  while(terminal.records.length>500){const record=terminal.records.shift();historySize-=record.text.length;$('output').firstChild.remove();}
  if(kind==='listing')decorateListing();
}
function send(data){if(!worker){notice('Worker unavailable. Reload the page to retry. Source can still be exported.');return;}pending=true;pendingCount++;document.body.dataset.pending='true';updateControls();lastMessage=Date.now();worker.postMessage(data);}
function loadProgram(text,selectedDialect=$('dialect').value,selectedSeed=$('seed').value){const p=new Program(text);clearError();send({type:'load',source:p.list(),dialect:selectedDialect,seed:selectedSeed});}
function action(fn){try{fn();}catch(error){showError(error.message);notice(error.message);output('? '+error.message+'\n','help');}}
function remember(text){terminal.remember(text);if(terminal.history.length>100){terminal.history.shift();terminal.cursor=terminal.history.length;}}
function cancelLine(){if(editing!==null&&!pending)send({type:'edit-cancel'});}
function cancelSource(){if(pending||editing!==null)return;editor.cancel();notice('Source draft canceled. Program and execution state unchanged.');}
function failWorker(message){worker?.terminate();worker=null;state='error';pending=false;pendingCount=0;document.body.dataset.pending='false';editing=null;updateControls();$('decision').disabled=true;$('status').textContent='Worker stopped';notice(message);}
function begin(){
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  try{worker=new Worker(url);}catch(error){URL.revokeObjectURL(url);notice('Isolated Worker unavailable: '+error.message);return;}
  worker.onerror=()=>{URL.revokeObjectURL(url);failWorker('Worker failed. Reload to restart; editor source remains available to export.');};
  worker.onmessage=event=>{
    lastMessage=Date.now();const data=event.data;
    if(data.type==='ack'){pendingCount=Math.max(0,pendingCount-1);pending=pendingCount>0;document.body.dataset.pending=String(pending);updateControls();return;}
    if(data.type==='ready'){URL.revokeObjectURL(url);$('decision').disabled=false;loadProgram(sampleSource);output('RETROREALM BASIC\nObservatory example loaded.\nType RUN to begin, LIST to inspect, or HELP.\n');}
    else if(data.type==='devices'){const select=$('tape-file'),old=select.value;select.replaceChildren();for(const f of data.files){const option=document.createElement('option');option.value=f.name;option.textContent=`${f.name} (${f.records} records)`;select.append(option);}if(data.files.some(f=>f.name===old))select.value=old;$('device-status').textContent=data.tapes.map(t=>`Cassette ${t.unit}: ${t.name}, ${t.mode==='O'?'recording':'reading'}, position ${t.position}`).join('; ')||'No cassette inserted.';$('device-channels').textContent=data.channels.map(c=>`Channel ${c.channel}: ${c.name}, ${c.mode==='O'?'writing':'reading'}, record ${c.position}`).join('; ')||'No open file channels.';}
    else if(data.type==='device-export')download('retrorealm-devices-v1.json',data.text,'application/json');
    else if(data.type==='source'){source=data.source;dialect=data.dialect;seed=data.seed;editor.accept(source);$('welcome-message').textContent=source===sampleSource.trimEnd()?'The Observatory example is ready. Type RUN below, or start your own.':source?'Your program is loaded. Type RUN to begin or LIST to inspect it.':'A blank program is ready. Enter numbered lines below or open the source editor.';$('dialect').value=dialect;$('seed').value=seed;describeDialect();}
    else if(data.type==='edit'){editing=data.line;$('decision').value=data.text;$('decision').focus();$('decision').setSelectionRange(data.text.length,data.text.length);notice(`Editing line ${editing}. Enter commits; Escape cancels. Keep the line number, or enter it alone to delete.`);}
    else if(data.type==='edit-end'){
      editing=null;
      if(data.committed){remember(data.text);output('> '+data.text+'\n','input');notice('Line committed. Continuation discarded; type RUN when ready.');}
      else {$('decision').value=priorInput;notice('Line edit canceled. Program and execution state unchanged.');}
      $('decision').focus();priorInput='';
    }
    else if(data.type==='output')output(data.text,data.kind);
    else if(data.type==='notice'){showError(data.text);notice(data.text);output('? '+data.text+'\n','help');}
    else if(data.type==='state'){
      const previous=state;state=data.status;$('status').textContent=`${state.toUpperCase()}${data.line?' / LINE '+data.line:''} / ${data.steps} steps`;
      if(state==='error'&&previous!=='error'){showError(data.error);notice(data.error);output('? '+data.error+'\n','help');}
      else if(state==='stopped'&&previous!=='stopped'){notice('Stopped. CONT resumes this execution.');output('\nSTOPPED — CONT to resume.\n');}
      else if(state==='ended'&&previous!=='ended'){notice('Program ended. RUN starts again with the same seed.');output('\nREADY\n');}
    }
    updateControls();
  };
}
$('action-form').addEventListener('submit',event=>{event.preventDefault();action(()=>{
  const text=$('decision').value;
  if(editing!==null){if(!pending){send({type:'edit-commit',text});}return;}
  requireDraftDecision();priorInput='';remember(text);output('> '+text+'\n','input');send({type:'command',text});
});});
// Capture precedes the unchanged shared terminal's Up/Down history listener.
$('decision').addEventListener('keydown',event=>{
  if(editing===null||event.isComposing)return;
  if(moveBoundary($('decision'),event)){event.stopImmediatePropagation();}
  else if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancelLine();}
  else if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();}
},true);
$('source').addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();cancelSource();}});
$('cancel-line').onclick=cancelLine;$('cancel-source').onclick=cancelSource;
$('stop').onclick=()=>send({type:'stop'});
$('console').addEventListener('keydown',event=>{if(event.ctrlKey&&event.key.toLowerCase()==='c'&&!window.getSelection()?.toString()){event.preventDefault();if(editing!==null)cancelLine();else send({type:'stop'});}});
$('clear').onclick=()=>{terminal.receive({type:'clear'});historySize=0;};$('latest').onclick=()=>terminal.bottom();
$('columns').onchange=()=>{document.body.dataset.columns=$('columns').value;terminal.reflow();decorateListing();};
$('phosphor').onchange=()=>{document.body.dataset.theme=$('phosphor').value;};
$('apply').onclick=()=>action(()=>{requireDraftDecision(true);loadProgram($('source').value);notice('Source applied. Continuation discarded.');});
$('sample').onclick=()=>action(()=>{requireDraftDecision();loadProgram(sampleSource,'ms8k','observatory-1');notice('Original Observatory sample loaded.');});
$('run').onclick=()=>action(()=>{requireDraftDecision(true);loadProgram($('source').value);send({type:'command',text:'RUN'});$('decision').focus();});
for(const id of ['dialect','seed'])$(id).onchange=()=>action(()=>{try{requireDraftDecision();loadProgram(source);notice('Settings applied. RUN starts fresh with this seed.');}catch(error){$('dialect').value=dialect;$('seed').value=seed;throw error;}});
function workspace(){if(editing!==null)throw new Error('Commit or cancel the line edit first.');return exportWorkspace(new Program($('source').value),$('dialect').value,$('seed').value);}
$('save').onclick=()=>action(()=>{localStorage.setItem(key,workspace());notice('Editor workspace saved locally; this does not apply or execute the draft.');});
$('load').onclick=()=>action(()=>{requireDraftDecision();const data=localStorage.getItem(key);if(!data)throw new Error('No BASIC workspace saved here');const w=importWorkspace(data);loadProgram(w.program.list(),w.dialect,w.seed);notice('Workspace restored; type RUN when ready.');});
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Editor export prepared: '+name);}
$('export').onclick=()=>action(()=>{if(editing!==null)throw new Error('Commit or cancel the line edit first.');download('retrorealm-program.bas',new Program($('source').value).list()+'\n','text/plain');});
$('export-workspace').onclick=()=>action(()=>download('retrorealm-workspace-v1.json',workspace(),'application/json'));
$('import').onchange=async()=>{try{requireDraftDecision();const file=$('import').files[0];if(!file)return;if(file.size>limits.source*2)throw new Error('Import file exceeds 256 KiB');const text=await file.text();requireDraftDecision();if(/\.json$/i.test(file.name)){const w=importWorkspace(text);loadProgram(w.program.list(),w.dialect,w.seed);}else{if(!/\.(bas|txt)$/i.test(file.name))throw new Error('Choose .bas, .txt or workspace .json');loadProgram(text);}notice('Imported source. Review it in the editor, then RUN.');}catch(error){showError(error.message);notice('Import rejected: '+error.message);}finally{$('import').value='';}};
for(const [id,operation]of [['tape-record','record'],['tape-mount','mount'],['tape-rewind','rewind'],['device-export','export']])$(id).onclick=()=>action(()=>{requireDraftDecision();send({type:'device',action:operation,data:operation==='record'?$('tape-name').value:operation==='mount'?$('tape-file').value:''});});
$('device-import').onchange=async()=>{try{requireDraftDecision();const file=$('device-import').files[0];if(!file)return;if(file.size>2097152)throw Error('Device image exceeds 2 MiB');const text=await file.text();requireDraftDecision();send({type:'device',action:'import',data:text});}catch(e){showError(e.message);notice('Device import rejected: '+e.message);}finally{$('device-import').value='';}};
setInterval(()=>{if(worker&&(state==='running'||pending)&&Date.now()-lastMessage>5000)failWorker('Worker did not respond for five seconds and was terminated. Export editor source and reload.');},500);
const dialectDescriptions={ms8k:'Microsoft 8K subset · a good starting point for classic numbered BASIC.',tiny:'Tiny BASIC subset · one-letter variables and integer arithmetic.',swbasic:'Simple Web Basic subset · full, case-sensitive variable names.',trs80:'TRS-80 Level II subset · typed variables and virtual cassette records.'};
function describeDialect(){$('dialect-help').textContent=dialectDescriptions[$('dialect').value]+' See the guide for compatibility limits.';}
for(const example of examples){const option=document.createElement('option');option.value=example.id;option.textContent=example.title;$('example-choice').append(option);}
function describeExample(){$('example-description').textContent=examples.find(e=>e.id===$('example-choice').value).description;}
$('example-choice').onchange=describeExample;describeExample();describeDialect();
$('show-examples').onclick=()=>{$('examples').open=true;$('example-choice').focus();};
$('show-files').onclick=()=>{$('files').open=true;$('import').focus();};
let shelfReplacement=null;
function commitShelf(text,dialect){loadProgram(text,dialect);notice(text?'Example loaded. Type RUN to begin.':'Enter numbered lines at the prompt or in the source editor.');$('editor-panel').open=true;$('source').focus();}
function cancelShelf(){shelfReplacement=null;$('replace-program').hidden=true;$('new-program').focus();}
function replaceFromShelf(text,dialect){requireDraftDecision();if(source&&source!==sampleSource.trimEnd()){shelfReplacement={text,dialect};$('replace-program').hidden=false;$('replace-cancel').focus();return;}commitShelf(text,dialect);}
$('replace-confirm').onclick=()=>action(()=>{requireDraftDecision();if(!shelfReplacement)return;const {text,dialect}=shelfReplacement;shelfReplacement=null;$('replace-program').hidden=true;commitShelf(text,dialect);});
$('replace-cancel').onclick=cancelShelf;
$('replace-program').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancelShelf();}};
$('new-program').onclick=()=>action(()=>{replaceFromShelf('',$('dialect').value);});
$('load-example').onclick=()=>action(()=>{const example=examples.find(e=>e.id===$('example-choice').value);replaceFromShelf(example.source,example.dialect);});
$('error-edit').onclick=()=>action(()=>{requireDraftDecision();send({type:'edit-begin',line:Number($('error-edit').dataset.line)});});
function updateFullscreen(){const active=!!document.fullscreenElement||document.body.dataset.focus==='true';$('fullscreen').textContent=active?'Exit fullscreen':'Fullscreen';$('fullscreen').setAttribute('aria-pressed',String(active));}
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.body.dataset.focus==='true')delete document.body.dataset.focus;else if(document.querySelector('main').requestFullscreen)await document.querySelector('main').requestFullscreen();else document.body.dataset.focus='true';}catch{document.body.dataset.focus='true';notice('Browser fullscreen unavailable. Focus view is active; Escape exits.');}updateFullscreen();};
document.addEventListener('fullscreenchange',updateFullscreen);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.dataset.focus==='true'){delete document.body.dataset.focus;updateFullscreen();$('fullscreen').focus();}});
if(innerWidth<600)$('columns').value='40';document.body.dataset.columns=$('columns').value;
begin();

Object.assign(exports,{});
},"packages/terminal/view.js":(exports,require)=>{
const { renderView, wrap } = require("packages/terminal/render.js");

// A line terminal: selectable DOM output plus one native input (IME and touch).
class TerminalView {
  constructor({ output, viewport, input, prompt, announce, width }) {
    Object.assign(this, { output, viewport, input, prompt, announce, width });
    this.records = []; this.history = []; this.cursor = 0; this.draft = '';
    input.addEventListener('keydown', event => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (this.cursor === this.history.length) this.draft = input.value;
      this.cursor = Math.max(0, Math.min(this.history.length, this.cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = this.cursor === this.history.length ? this.draft : this.history[this.cursor];
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
  text(record) { return record.view ? renderView(record.view, this.width()) : wrap(record.text, this.width()).join('\n'); }
  receive(event) {
    if (event.type === 'clear') { this.records = []; this.output.replaceChildren(); }
    if (['output', 'restore'].includes(event.type)) {
      const nearBottom = this.viewport.scrollHeight - this.viewport.scrollTop - this.viewport.clientHeight < 48;
      this.records.push(event); const block = document.createElement('pre');
      block.className = `terminal-block ${event.kind ?? event.type}`; block.textContent = this.text(event); this.output.append(block);
      if (nearBottom || document.activeElement === this.input) this.bottom();
      this.announce.textContent = (event.text ?? event.view?.lines?.slice(-3).join(' ') ?? '').slice(-600);
    }
    if (event.type === 'prompt') this.prompt.textContent = event.text;
    if (event.type === 'input-request') {
      this.input.inputMode = event.kind === 'number' ? 'numeric' : 'text';
      this.input.name = event.actions.find(a => ['text','number'].includes(a.kind))?.id ?? 'choice';
    }
  }
  reflow() {
    const atBottom = this.viewport.scrollHeight - this.viewport.scrollTop - this.viewport.clientHeight < 48;
    [...this.output.children].forEach((block, i) => { block.textContent = this.text(this.records[i]); });
    if (atBottom) this.bottom();
  }
  remember(text) {
    if (text && this.history.at(-1) !== text) this.history.push(text);
    this.cursor = this.history.length; this.draft = ''; this.input.value = '';
  }
  bottom() { this.viewport.scrollTop = this.viewport.scrollHeight; }
  copyText() { return this.records.map(record => this.text(record)).join('\n\n') + '\n\n' + this.prompt.textContent; }
}

Object.assign(exports,{TerminalView});
},"packages/terminal/render.js":(exports,require)=>{
function wrap(text, width) {
  if (![40, 80].includes(width) && width !== 39) throw new Error('Unsupported terminal width.');
  // A terminal cell is one printable ASCII character, including imported labels.
  const clean = String(text).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, '/').replace(/×/g, 'x').replace(/÷/g, '/').normalize('NFKD').replace(/[^\x20-\x7e\n]/g, '?');
  const lines = [];
  for (let line of clean.split('\n')) {
    while (line.length > width) {
      let cut = line.lastIndexOf(' ', width);
      if (cut < 1) cut = width;
      lines.push(line.slice(0, cut)); line = line.slice(cut).trimStart();
    }
    lines.push(line);
  }
  return lines;
}

function renderView(view, width) {
  const lines = ['='.repeat(width), ...wrap(view.title, width), '='.repeat(width)];
  for (const row of view.rows) {
    if (width === 80 && row.length === 2) {
      const left = wrap(row[0], 39), right = wrap(row[1], 39);
      for (let i = 0; i < Math.max(left.length, right.length); i++) lines.push((left[i] ?? '').padEnd(40) + (right[i] ?? ''));
    } else for (const cell of row) lines.push(...wrap(cell, width));
  }
  for (const line of view.lines) lines.push(...wrap(line, width));
  if (view.advice?.length) {
    lines.push('', view.adviceTitle || 'ADVISOR');
    for (const line of view.advice) lines.push(...wrap(`* ${line}`, width));
  }
  return lines.join('\n');
}

Object.assign(exports,{wrap,renderView});
},"packages/basic-session/output.js":(exports,require)=>{
// Worker scheduling is not a BASIC newline. Join an unfinished PRINT across slices.
// Scoped to BASIC Computer; shared native-game TerminalView remains unchanged.
function receiveOutput(terminal,text,kind='output') {
  const previous=terminal.records.at(-1);
  if(kind==='output'&&previous?.kind==='output'&&!previous.text.endsWith('\n')) {
    const follow=terminal.viewport.scrollHeight-terminal.viewport.scrollTop-terminal.viewport.clientHeight<48||terminal.input.ownerDocument.activeElement===terminal.input;
    previous.text+=text;
    terminal.output.lastElementChild.textContent=terminal.text(previous);
    terminal.announce.textContent=text.slice(-600);
    if(follow)terminal.bottom();
  } else terminal.receive({type:'output',text,kind});
}

Object.assign(exports,{receiveOutput});
},"packages/basic-session/editor.js":(exports,require)=>{
// Explicit Home/End behavior also works on macOS, where these keys may scroll.
function moveBoundary(input,event,multiline=false){
  if(!['Home','End'].includes(event.key)||event.isComposing||event.altKey)return false;
  event.preventDefault();
  const anchor=input.selectionDirection==='backward'?input.selectionEnd:input.selectionStart;
  const caret=input.selectionDirection==='backward'?input.selectionStart:input.selectionEnd;
  let target=event.key==='Home'?0:input.value.length;
  if(multiline&&!event.ctrlKey&&!event.metaKey){target=event.key==='Home'?(caret===0?0:input.value.lastIndexOf('\n',caret-1)+1):input.value.indexOf('\n',caret);if(target<0)target=input.value.length;}
  if(event.shiftKey)input.setSelectionRange(Math.min(anchor,target),Math.max(anchor,target),target<anchor?'backward':'forward');
  else input.setSelectionRange(target,target);
  return true;
}
// BASIC Computer only: native textarea navigation and transactional source drafts.
class SourceEditor {
  constructor({input,gutter,status,onChange}) {
    Object.assign(this,{input,gutter,status,onChange});this.applied='';
    input.addEventListener('keydown',event=>{if(moveBoundary(input,event,true))this.position();});
    input.addEventListener('input',()=>{this.refresh();onChange();});
    for(const event of ['click','keyup','select'])input.addEventListener(event,()=>this.position());
    input.addEventListener('scroll',()=>{gutter.style.transform=`translateY(${-input.scrollTop}px)`;});
    this.refresh();
  }
  get dirty(){return this.input.value!==this.applied;}
  accept(source){this.applied=source;this.input.value=source;this.refresh();}
  cancel(){this.input.value=this.applied;this.refresh();this.onChange();}
  refresh(){this.gutter.textContent=Array.from({length:this.input.value.split('\n').length},(_,i)=>i+1).join('\n');this.position();this.gutter.style.transform=`translateY(${-this.input.scrollTop}px)`;}
  position(){const before=this.input.value.slice(0,this.input.selectionStart),rows=before.split('\n'),row=rows.length,col=rows.at(-1).length+1;const line=this.input.value.split('\n')[row-1]?.match(/^\s*(\d+)/)?.[1];this.status.textContent=`${this.dirty?'Unapplied changes':'Source applied'} · Row ${row}, column ${col}${line?' · BASIC line '+line:''}`;}
}

Object.assign(exports,{moveBoundary,SourceEditor});
},"packages/basic/program.js":(exports,require)=>{
const { limits, profileFor } = require("packages/basic/profiles.js");
const { parseLine } = require("packages/basic/parser.js");
class Program {
  constructor(source=''){this.lines=new Map();this.load(source);}
  load(source){
    if(typeof source!=='string'||source.length>limits.source)throw new Error('Source limit (128 KiB characters)');
    const lines=new Map();for(const row of source.replaceAll('\r\n','\n').split('\n')){if(!row.trim())continue;const m=/^\s*(\d+)\s?(.*)$/.exec(row);if(!m)throw new Error('Expected numbered source line (multiline records unsupported)');const n=Number(m[1]);if(n<1||n>65529||m[2].length>limits.line)throw new Error('Line number/length limit');if(m[2].trim())lines.set(n,m[2]);else lines.delete(n);}
    if(lines.size>limits.lines)throw new Error('Program line limit');this.lines=lines;
  }
  edit(row){const candidate=new Program(this.list());candidate.load(candidate.list()+'\n'+row);this.lines=candidate.lines;}
  list(){return [...this.lines].sort((a,b)=>a[0]-b[0]).map(([n,s])=>`${n} ${s}`).join('\n');}
  compile(profile){
    const instructions=[],locations=new Map(),data=[];
    function emit(nodes,line){for(const node of nodes){if(node.op==='IF'){const test={op:'BRANCH',test:node.test,line};instructions.push(test);emit(node.yes,line);const skip={op:'JUMP',line};instructions.push(skip);test.target=instructions.length;emit(node.no,line);skip.target=instructions.length;}
      else {instructions.push({...node,line});if(node.op==='DATA')for(const value of node.values)data.push({value,line});}}
    }
    for(const [line,source] of [...this.lines].sort((a,b)=>a[0]-b[0])){locations.set(line,instructions.length);try{emit(parseLine(source,profile),line);}catch(error){throw new Error(`${error.message} in ${line}`);}}
    return {instructions,locations,data};
  }
}
function exportWorkspace(program,dialect,seed){profileFor(dialect);return JSON.stringify({format:'retrorealm-basic-workspace',version:1,dialect,seed:String(seed).slice(0,128),source:program.list()},null,2);}
function importWorkspace(text){if(typeof text!=='string'||text.length>limits.source*2)throw new Error('Workspace size limit');const data=JSON.parse(text);if(data.format!=='retrorealm-basic-workspace'||data.version!==1||typeof data.source!=='string'||typeof data.seed!=='string'||data.seed.length>128)throw new Error('Unsupported BASIC workspace');profileFor(data.dialect);return {program:new Program(data.source),dialect:data.dialect,seed:data.seed};}

Object.assign(exports,{Program,exportWorkspace,importWorkspace});
},"packages/basic/profiles.js":(exports,require)=>{
// Compatibility targets, not claims of full machine emulation.
const profiles = Object.freeze({
  'swbasic': Object.freeze({ id:'swbasic', title:'Simple Web Basic — compatibility subset', integer:false, names:Infinity, truth:1, zone:3, integerRandom:false, strings:true, wholeIdentifiers:true, swbasic:true, caseSensitive:true, plainNumbers:true }),
  'tiny': Object.freeze({ id:'tiny', title:'Tiny BASIC — integer prototype', integer:true, names:1, truth:1, zone:8, integerRandom:true, strings:false }),
  'ms8k': Object.freeze({ id:'ms8k', title:'Microsoft 8K — subset prototype', integer:false, names:2, truth:-1, zone:14, integerRandom:false, strings:true }),
  'trs80': Object.freeze({ id:'trs80', title:'TRS-80 Level II — compatibility subset', trs80:true, integer:false, names:2, truth:-1, zone:16, integerRandom:false, strings:true })
});
const limits = Object.freeze({ source:131072, lines:4096, line:8192, tokens:4096, depth:64, cells:16384, variables:1024, string:4096, stack:128, output:131072, expressions:1000000, instructions:1000000, milliseconds:2000, input:4096 });
function profileFor(id) { if (!Object.hasOwn(profiles,id)) throw new Error('Unknown dialect'); return profiles[id]; }
function seededRandom(seed) {
  let state=2166136261;
  for (const char of String(seed)) state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
  if (!state) state=1;
  return () => { state^=state<<13; state^=state>>>17; state^=state<<5; return (state>>>0)/4294967296; };
}

Object.assign(exports,{profiles,limits,profileFor,seededRandom});
},"packages/basic/parser.js":(exports,require)=>{
const { limits, profileFor } = require("packages/basic/profiles.js");

const words = 'RESTORE RETURN GOSUB PRINT INPUT IF GOTO THEN ELSE NEXT STEP STOP READ DATA FOR DIM LET END REM DEF FN ON TO AND OR NOT MOD ABS INT RND SQR SIN COS TAN ATN LOG EXP SGN LEN LEFT$ RIGHT$ MID$ STR$ VAL ASC CHR$ TAB SPC'.split(' ').sort((a,b)=>b.length-a.length);
// Vocabulary is dialect data; unsupported SWB features fail explicitly.
const trsWords=[...words,...'DEFINT DEFSNG DEFDBL DEFSTR CLEAR CLS OPEN CLOSE CINT CSNG CDBL FIX POS MEM EOF'.split(' ')].sort((a,b)=>b.length-a.length);
const webWords = 'IF THEN ELSE FOR TO STEP GOTO GOSUB RETURN NEXT INPUT LET CLS END PRINT DIM DATA READ REM OR AND MOD WHILE WEND RANDOMIZE SYSTEM KEY CLEAR VAL STR$ LEFT$ RIGHT$ MID$ LEN RND INT INSTR ABS ASC CHR$ SQR STRING$ SIN COS TAN TIMER'.split(' ');
const webUnsupported = new Set('CLS WHILE WEND RANDOMIZE SYSTEM KEY CLEAR INSTR STRING$ TIMER'.split(' '));
const functions = new Set('ABS INT RND SQR SIN COS TAN ATN LOG EXP SGN LEN LEFT$ RIGHT$ MID$ STR$ VAL ASC CHR$ TAB SPC'.split(' '));
function csv(text) {
  const fields=[]; let start=0,quoted=false;
  for(let i=0;i<text.length;i++) {
    if(text[i]==='"'){if(quoted&&text[i+1]==='"')i++;else quoted=!quoted;}
    else if(text[i]===','&&!quoted){fields.push(text.slice(start,i));start=i+1;}
  }
  if(quoted)throw new Error('Unterminated DATA/input string');fields.push(text.slice(start));
  return fields.map(raw=>{const field=raw.trim();return field.startsWith('"')&&field.endsWith('"')?field.slice(1,-1).replaceAll('""','"'):field;});
}
function tokenize(source,profile=profileFor('ms8k')) {
  const tokens=[]; let p=0;const vocabulary=profile.wholeIdentifiers?webWords:profile.trs80?trsWords:words;
  const add=(kind,value)=>{if(tokens.length>=limits.tokens)throw new Error('Token limit');tokens.push({kind,value});};
  while(p<source.length){
    const c=source[p]; if(/\s/.test(c)){p++;continue;}
    if(c==="'"){add('keyword','REM');break;}
    if(c==='"'){let v='';p++;while(p<source.length&&source[p]!=='"')v+=source[p++];if(source[p]!=='"')throw new Error('Unterminated string');p++;add('string',v);continue;}
    const tail=source.slice(p).toUpperCase();
    const num=/^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/.exec(tail);
    if(num){add('number',Number(num[0]));p+=num[0].length;if(profile.trs80&&['!','#'].includes(source[p]))p++;continue;}
    const whole=/^[A-Z][A-Z0-9]*\$?/.exec(tail)?.[0];
    const keyword=vocabulary.find(word=>profile.wholeIdentifiers?whole===word:tail.startsWith(word));
    if(keyword){if(profile.swbasic&&webUnsupported.has(keyword))throw new Error(`Simple Web Basic feature ${keyword} is not implemented in this compatibility subset`);add('keyword',keyword);p+=keyword.length;if(keyword==='REM')break;
      if(keyword==='DATA'){let start=p,q=false;while(p<source.length){if(source[p]==='"')q=!q;if(source[p]===':'&&!q)break;p++;}add('data',csv(source.slice(start,p)));}continue;}
    if(profile.wholeIdentifiers&&whole){add('name',profile.caseSensitive?source.slice(p,p+whole.length):whole);p+=whole.length;continue;}
    if(/[A-Z]/i.test(c)){let v=c.toUpperCase();p++;while(p<source.length&&/[A-Z0-9]/i.test(source[p])&&!vocabulary.some(w=>source.slice(p).toUpperCase().startsWith(w)))v+=source[p++].toUpperCase();if((profile.trs80?'$%!#':'$').includes(source[p])&&source[p])v+=source[p++];add('name',v);continue;}
    const op=(profile.trs80?/^(<>|<=|>=|[+\-*/^=<>(),:;?#@])/:/^(<>|<=|>=|[+\-*/^=<>(),:;?])/).exec(tail);if(!op)throw new Error(`Unsupported character ${c}`);add('symbol',op[0]==='?'?'PRINT':op[0]);p+=op[0].length;
  }
  add('end','');return tokens;
}
const precedence={OR:1,AND:2,'=':3,'<>':3,'<':3,'>':3,'<=':3,'>=':3,'+':4,'-':4,'*':5,'/':5,MOD:5,'^':7};
class Parser {
  constructor(source,profile){this.tokens=tokenize(source,profile);this.p=0;this.depth=0;this.profile=profile;}
  peek(){return this.tokens[this.p];}
  is(v){return ['keyword','symbol'].includes(this.peek().kind)&&this.peek().value===v;}
  take(v){if(this.is(v)){this.p++;return true;}return false;}
  expect(v){if(!this.take(v))throw new Error(`Expected ${v}; found ${this.peek().value||'end of line'}`);}
  name(){const t=this.peek();if(t.kind!=='name')throw new Error(`Expected variable; found ${t.value}`);this.p++;if(t.value.endsWith('$')&&!this.profile.strings)throw new Error('String variables unavailable in Tiny profile');return t.value;}
  args(){this.expect('(');const a=[this.expr()];while(this.take(','))a.push(this.expr());this.expect(')');return a;}
  target(){const name=this.name();return {name,args:this.is('(')?this.args():null};}
  expr(min=0){
    if(++this.depth>limits.depth)throw new Error('Expression nesting limit');
    let node,t=this.peek();
    if(this.take('-')||this.take('+')||this.take('NOT')){node={type:'unary',op:t.value,right:this.expr(t.value==='NOT'?3:this.profile.wholeIdentifiers?8:6)};}
    else if(this.take('(')){node=this.expr();this.expect(')');}
    else if(t.kind==='number'||t.kind==='string'){this.p++;node={type:'literal',value:t.value};}
    else if(this.take('FN')){const name=this.name();node={type:'fn',name,args:this.args()};}
    else if(this.profile.trs80&&this.take('MEM'))node={type:'call',name:'MEM',args:[]};
    else if(t.kind==='keyword'&&(functions.has(t.value)||this.profile.trs80&&['CINT','CSNG','CDBL','FIX','POS','EOF'].includes(t.value))){this.p++;node={type:'call',name:t.value,args:this.profile.wholeIdentifiers&&t.value==='RND'&&this.peek().value!=='('?[]:this.args()};}
    else if(t.kind==='name'){node={type:'variable',...this.target()};}
    else throw new Error(`Expected expression; found ${t.value||'end of line'}`);
    const order=this.profile.wholeIdentifiers?{...precedence,AND:1,'^':5}:precedence;
    while(['keyword','symbol'].includes(this.peek().kind)&&Object.hasOwn(order,this.peek().value)&&order[this.peek().value]>=min){const op=this.tokens[this.p++].value;node={type:'binary',op,left:node,right:this.expr(order[op]+(op==='^'&&!this.profile.wholeIdentifiers?0:1))};}
    this.depth--;return node;
  }
  end(){return this.peek().kind==='end'||(this.is(':')||this.is('ELSE'));}
  targets(){const a=[this.target()];while(this.take(','))a.push(this.target());return a;}
  statements(level=0){
    if(level>limits.depth)throw new Error('Statement nesting limit');const result=[];
    while(this.peek().kind!=='end'&&!this.is('ELSE')){
      if(this.take(':'))continue;
      const t=this.peek(), op=t.value;
      if(this.take('REM')){result.push({op:'REM'});break;}
      if(this.take('PRINT')){let channel=null,position=null;if(this.profile.trs80&&this.take('#')){channel=this.expr();this.expect(',');}else if(this.profile.trs80&&this.take('@')){position=this.expr();this.expect(',');}const parts=[];while(!this.end()){if(this.take(';')||this.take(','))parts.push({separator:this.tokens[this.p-1].value});else parts.push({expression:this.expr()});}result.push({op:'PRINT',parts,channel,position});}
      else if(this.take('INPUT')){let channel=null;if(this.profile.trs80&&this.take('#')){channel=this.expr();this.expect(',');}let prompt='';if(this.peek().kind==='string'){prompt=this.tokens[this.p++].value;if(!this.take(';')&&!this.take(','))throw new Error('Expected INPUT separator');}result.push({op:'INPUT',prompt,channel,targets:this.targets()});}
      else if(this.take('IF')){const test=this.expr();if(!this.take('THEN')&&!this.profile.trs80)throw new Error('Expected THEN');let yes;
        if(this.peek().kind==='number'){yes=[{op:'GOTO',destination:this.expr()}];if(this.take(':'))yes.push(...this.statements(level+1));}
        else yes=this.statements(level+1);
        let no=[];if(this.take('ELSE')){if(this.peek().kind==='number'){no=[{op:'GOTO',destination:this.expr()}];if(this.take(':'))no.push(...this.statements(level+1));}else no=this.statements(level+1);}
        result.push({op:'IF',test,yes,no});break;
      }
      else if(t.kind==='keyword'&&['GOTO','GOSUB'].includes(op)){this.p++;result.push({op,destination:this.expr()});}
      else if(this.take('ON')){const value=this.expr();const mode=this.peek().value;if(!['GOTO','GOSUB'].includes(mode))throw new Error('Expected ON GOTO/GOSUB');this.p++;const lines=[this.expr()];while(this.take(','))lines.push(this.expr());result.push({op:'ON',mode,value,lines});}
      else if(this.take('FOR')){const name=this.name();this.expect('=');const start=this.expr();this.expect('TO');const end=this.expr();const step=this.take('STEP')?this.expr():{type:'literal',value:1};result.push({op:'FOR',name,start,end,step});}
      else if(this.take('NEXT')){const names=[];if(!this.end()){names.push(this.name());while(this.take(','))names.push(this.name());}for(const name of names.length?names:[null])result.push({op:'NEXT',name});}
      else if(this.take('DIM'))result.push({op:'DIM',targets:this.targets()});
      else if(this.take('READ'))result.push({op:'READ',targets:this.targets()});
      else if(this.take('DATA'))result.push({op:'DATA',values:this.tokens[this.p++].value});
      else if(this.take('RESTORE'))result.push({op:'RESTORE',destination:this.end()?null:this.expr()});
      else if(this.profile.trs80&&['DEFINT','DEFSNG','DEFDBL','DEFSTR'].includes(op)){this.p++;const ranges=[];do{const start=this.name(),end=this.take('-')?this.name():start;if(!/^[A-Z]$/.test(start)||!/^[A-Z]$/.test(end)||end<start)throw Error('Invalid type letter range');ranges.push([start,end]);}while(this.take(','));result.push({op:'TYPE',kind:op,ranges});}
      else if(this.profile.trs80&&this.take('CLEAR'))result.push({op:'CLEAR',size:this.end()?null:this.expr()});
      else if(this.profile.trs80&&this.take('CLS'))result.push({op:'CLS'});
      else if(this.profile.trs80&&this.take('OPEN')){const mode=this.expr();this.expect(',');this.take('#');const channel=this.expr();this.expect(',');const name=this.expr();result.push({op:'OPEN',mode,channel,name});}
      else if(this.profile.trs80&&this.take('CLOSE')){const channels=[];if(!this.end())do{this.take('#');channels.push(this.expr());}while(this.take(','));result.push({op:'CLOSE',channels});}
      else if(this.take('DEF')){this.expect('FN');const name=this.name();this.expect('(');const arg=this.name();this.expect(')');this.expect('=');result.push({op:'DEF',name,arg,expression:this.expr()});}
      else if(t.kind==='keyword'&&['RETURN','STOP','END'].includes(op)){this.p++;result.push({op});}
      else {this.take('LET');const target=this.target();this.expect('=');result.push({op:'LET',target,expression:this.expr()});}
      if(!this.end())throw new Error(`Unexpected ${this.peek().value}`);if(this.is('ELSE'))break;this.take(':');
    }return result;
  }
}
function parseLine(source,profile){
  try{const parser=new Parser(source,profile);const result=parser.statements();if(parser.peek().kind!=='end')throw new Error(`Unexpected ${parser.peek().value}`);return result;}
  catch(error){
    if(!profile.wholeIdentifiers){
      const candidate=tokenize(source,{...profileFor('swbasic'),swbasic:false}).find(t=>t.kind==='name'&&words.some(w=>t.value.toUpperCase().includes(w)));
      if(candidate)throw new Error(`${error.message}. ${profile.title} recognizes keywords inside names such as ${candidate.value}; use Simple Web Basic for full identifiers (do not rename the reference source)`);
    }
    throw new Error(`${error.message} [${profile.title}]`);
  }
}

Object.assign(exports,{csv,tokenize,Parser,parseLine});
},"packages/basic-session/generated.js":(exports,require)=>{
const workerSource="'use strict';(()=>{const modules={\"packages/basic-session/worker.js\":(exports,require)=>{\nconst { BasicSession } = require(\"packages/basic/session.js\");\nlet buffer='',timer=null;\nconst session=new BasicSession(event=>{if(event.type==='output'&&!event.kind)buffer+=event.text;else {flush();self.postMessage(event);}});\nfunction flush(){if(buffer){self.postMessage({type:'output',text:buffer});buffer='';}}\nfunction pump(){timer=null;session.tick();flush();if(session.machine?.status==='running')timer=setTimeout(pump,0);}\nself.onmessage=event=>{\n  try{\n    const data=event.data;\n    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid Worker request');\n    if(data.type==='load'&&Object.keys(data).sort().join(',')==='dialect,seed,source,type')session.load(data.source,data.dialect,data.seed);\n    else if(data.type==='command'&&Object.keys(data).sort().join(',')==='text,type')session.command(data.text);\n    else if(data.type==='edit-begin'&&Object.keys(data).sort().join(',')==='line,type')session.beginEdit(data.line);\n    else if(data.type==='edit-commit'&&Object.keys(data).sort().join(',')==='text,type')session.commitEdit(data.text);\n    else if(data.type==='edit-cancel'&&Object.keys(data).join(',')==='type')session.cancelEdit();\n    else if(data.type==='device'&&Object.keys(data).sort().join(',')==='action,data,type'&&typeof data.action==='string'&&typeof data.data==='string')session.device(data.action,data.data);\n    else if(data.type==='stop'&&Object.keys(data).join(',')==='type')session.stop();\n    else throw new Error('Invalid Worker request');\n    flush();if(session.machine?.status==='running'&&timer===null)timer=setTimeout(pump,0);\n  }catch(error){flush();self.postMessage({type:'notice',text:error.message});session.state();}finally{self.postMessage({type:'ack'});}\n};\nself.postMessage({type:'ready'});\n\nObject.assign(exports,{});\n},\"packages/basic/session.js\":(exports,require)=>{\nconst { Program } = require(\"packages/basic/program.js\");\nconst { VirtualDevices } = require(\"packages/basic/devices.js\");\nconst { Machine } = require(\"packages/basic/machine.js\");\nconst { limits, profileFor } = require(\"packages/basic/profiles.js\");\nclass BasicSession {\n  constructor(emit=()=>{}){this.emit=emit;this.program=new Program();this.dialect='ms8k';this.seed='1';this.machine=null;this.editing=null;this.devices=new VirtualDevices();this.deviceState='';}\n  source(){this.emit({type:'source',source:this.program.list(),dialect:this.dialect,seed:this.seed});}\n  output(text){this.emit({type:'output',text});}\n  state(){const m=this.machine;this.emit({type:'state',status:m?.status??'ready',line:m?.line??null,steps:m?.steps??0,error:m?.error??null});const devices=this.devices.catalog(),encoded=JSON.stringify(devices);if(encoded!==this.deviceState){this.deviceState=encoded;this.emit({type:'devices',...devices});}}\n  load(source,dialect,seed){profileFor(dialect);if(typeof seed!=='string'||seed.length>128)throw new Error('Seed length limit');const candidate=new Program(source);if(this.editing!==null)throw new Error('Commit or cancel the line edit first');this.devices.close();this.program=candidate;this.dialect=dialect;this.seed=seed;this.machine=null;this.source();this.state();}\n  device(action,data){if(this.machine?.status==='running')throw Error('STOP or wait for INPUT before changing devices');if(this.editing!==null)throw Error('Cancel or commit the line edit first');\n    if(action==='record'){if(this.devices.files.has(data))throw Error('Choose a new tape name; existing tape preserved');this.devices.mount(data,'O');}\n    else if(action==='mount')this.devices.mount(data,'I');\n    else if(action==='rewind')this.devices.rewind();\n    else if(action==='import')this.devices.import(data);\n    else if(action==='export')this.emit({type:'device-export',text:this.devices.export()});\n    else throw Error('Unknown device operation');this.state();\n  }\n  stop(){this.machine?.stop();this.state();}\n  beginEdit(line){\n    if(this.editing!==null)throw new Error('Commit or cancel the current line edit first');\n    if(['running','input'].includes(this.machine?.status))throw new Error('STOP the program before editing a line');\n    if(!Number.isInteger(line)||!this.program.lines.has(line))throw new Error(`No program line ${line}`);\n    this.editing=line;\n    this.emit({type:'edit',line,text:`${line} ${this.program.lines.get(line)}`});\n  }\n  commitEdit(text){\n    if(this.editing===null)throw new Error('No active line edit');\n    if(typeof text!=='string'||text.length>limits.line+6||/[\\r\\n]/.test(text))throw new Error('Enter one numbered BASIC line');\n    const match=/^\\s*(\\d+)(?:\\s|$)/.exec(text);\n    if(!match||Number(match[1])!==this.editing)throw new Error(`Keep line number ${this.editing}; enter that number alone to delete it`);\n    this.program.edit(text);this.machine=null;this.editing=null;\n    this.emit({type:'edit-end',committed:true,text});this.source();this.state();\n  }\n  cancelEdit(){\n    if(this.editing===null)return;\n    this.editing=null;this.emit({type:'edit-end',committed:false});this.state();\n  }\n  command(text){\n    if(typeof text!=='string'||text.length>limits.line)throw new Error('Command length limit');\n    if(this.editing!==null)throw new Error('Commit or cancel the line edit first');\n    const upper=text.trim().toUpperCase();\n    if(upper==='/STOP'){this.stop();return;}\n    if(this.machine?.status==='input'){this.machine.input(text);this.state();return;}\n    if(this.machine?.status==='running'){if(upper==='STOP')this.stop();else throw new Error('Program running; STOP first');return;}\n    if(/^\\s*\\d+/.test(text)){this.program.edit(text);this.machine=null;this.source();}\n    else if(upper==='NEW'){this.program=new Program();this.machine=null;this.source();this.output('New program.');}\n    else if(/^EDIT(?:\\s|$)/.test(upper)){if(!/^EDIT\\s+\\d+$/.test(upper))throw new Error('Use EDIT followed by a line number');this.beginEdit(Number(upper.slice(4).trim()));}\n    else if(upper==='LIST')this.emit({type:'output',kind:'listing',text:this.program.list()||'(Empty program)'});\n    else if(upper==='RUN'){this.devices.close();this.machine=null;this.machine=new Machine(this.program,{dialect:this.dialect,seed:this.seed,devices:this.devices,write:s=>this.output(s)});}\n    else if(upper==='STOP')this.stop();\n    else if(upper==='CONT'){if(!this.machine)throw new Error('Cannot continue');this.machine.cont();}\n    else if(upper==='HELP')this.output('NEW / LIST / EDIT n / RUN / STOP / CONT\\nEDIT 10 retrieves line 10. Enter commits; Escape cancels.\\nLeft/Right and Home/End edit the input; Up/Down history resumes afterward.\\n10 PRINT \"HELLO\" inserts or replaces line 10.\\n10 deletes line 10. Edits discard CONT state.\\nUse the program editor and file controls for text/.bas files.\\nSTOP button or Ctrl-C interrupts even at INPUT.\\nCONT resumes STOP, including pending INPUT.\\nRUN resets variables, DATA and the deterministic seed.\\nThis is a bounded prototype; see the compatibility notes.');\n    else if(upper)throw new Error('Unknown session command. Type HELP. Immediate statements are not implemented.');\n    this.state();\n  }\n  tick(){if(this.machine?.status==='running'){this.machine.step();this.state();}return this.machine?.status;}\n}\n\nObject.assign(exports,{BasicSession});\n},\"packages/basic/program.js\":(exports,require)=>{\nconst { limits, profileFor } = require(\"packages/basic/profiles.js\");\nconst { parseLine } = require(\"packages/basic/parser.js\");\nclass Program {\n  constructor(source=''){this.lines=new Map();this.load(source);}\n  load(source){\n    if(typeof source!=='string'||source.length>limits.source)throw new Error('Source limit (128 KiB characters)');\n    const lines=new Map();for(const row of source.replaceAll('\\r\\n','\\n').split('\\n')){if(!row.trim())continue;const m=/^\\s*(\\d+)\\s?(.*)$/.exec(row);if(!m)throw new Error('Expected numbered source line (multiline records unsupported)');const n=Number(m[1]);if(n<1||n>65529||m[2].length>limits.line)throw new Error('Line number/length limit');if(m[2].trim())lines.set(n,m[2]);else lines.delete(n);}\n    if(lines.size>limits.lines)throw new Error('Program line limit');this.lines=lines;\n  }\n  edit(row){const candidate=new Program(this.list());candidate.load(candidate.list()+'\\n'+row);this.lines=candidate.lines;}\n  list(){return [...this.lines].sort((a,b)=>a[0]-b[0]).map(([n,s])=>`${n} ${s}`).join('\\n');}\n  compile(profile){\n    const instructions=[],locations=new Map(),data=[];\n    function emit(nodes,line){for(const node of nodes){if(node.op==='IF'){const test={op:'BRANCH',test:node.test,line};instructions.push(test);emit(node.yes,line);const skip={op:'JUMP',line};instructions.push(skip);test.target=instructions.length;emit(node.no,line);skip.target=instructions.length;}\n      else {instructions.push({...node,line});if(node.op==='DATA')for(const value of node.values)data.push({value,line});}}\n    }\n    for(const [line,source] of [...this.lines].sort((a,b)=>a[0]-b[0])){locations.set(line,instructions.length);try{emit(parseLine(source,profile),line);}catch(error){throw new Error(`${error.message} in ${line}`);}}\n    return {instructions,locations,data};\n  }\n}\nfunction exportWorkspace(program,dialect,seed){profileFor(dialect);return JSON.stringify({format:'retrorealm-basic-workspace',version:1,dialect,seed:String(seed).slice(0,128),source:program.list()},null,2);}\nfunction importWorkspace(text){if(typeof text!=='string'||text.length>limits.source*2)throw new Error('Workspace size limit');const data=JSON.parse(text);if(data.format!=='retrorealm-basic-workspace'||data.version!==1||typeof data.source!=='string'||typeof data.seed!=='string'||data.seed.length>128)throw new Error('Unsupported BASIC workspace');profileFor(data.dialect);return {program:new Program(data.source),dialect:data.dialect,seed:data.seed};}\n\nObject.assign(exports,{Program,exportWorkspace,importWorkspace});\n},\"packages/basic/profiles.js\":(exports,require)=>{\n// Compatibility targets, not claims of full machine emulation.\nconst profiles = Object.freeze({\n  'swbasic': Object.freeze({ id:'swbasic', title:'Simple Web Basic — compatibility subset', integer:false, names:Infinity, truth:1, zone:3, integerRandom:false, strings:true, wholeIdentifiers:true, swbasic:true, caseSensitive:true, plainNumbers:true }),\n  'tiny': Object.freeze({ id:'tiny', title:'Tiny BASIC — integer prototype', integer:true, names:1, truth:1, zone:8, integerRandom:true, strings:false }),\n  'ms8k': Object.freeze({ id:'ms8k', title:'Microsoft 8K — subset prototype', integer:false, names:2, truth:-1, zone:14, integerRandom:false, strings:true }),\n  'trs80': Object.freeze({ id:'trs80', title:'TRS-80 Level II — compatibility subset', trs80:true, integer:false, names:2, truth:-1, zone:16, integerRandom:false, strings:true })\n});\nconst limits = Object.freeze({ source:131072, lines:4096, line:8192, tokens:4096, depth:64, cells:16384, variables:1024, string:4096, stack:128, output:131072, expressions:1000000, instructions:1000000, milliseconds:2000, input:4096 });\nfunction profileFor(id) { if (!Object.hasOwn(profiles,id)) throw new Error('Unknown dialect'); return profiles[id]; }\nfunction seededRandom(seed) {\n  let state=2166136261;\n  for (const char of String(seed)) state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;\n  if (!state) state=1;\n  return () => { state^=state<<13; state^=state>>>17; state^=state<<5; return (state>>>0)/4294967296; };\n}\n\nObject.assign(exports,{profiles,limits,profileFor,seededRandom});\n},\"packages/basic/parser.js\":(exports,require)=>{\nconst { limits, profileFor } = require(\"packages/basic/profiles.js\");\n\nconst words = 'RESTORE RETURN GOSUB PRINT INPUT IF GOTO THEN ELSE NEXT STEP STOP READ DATA FOR DIM LET END REM DEF FN ON TO AND OR NOT MOD ABS INT RND SQR SIN COS TAN ATN LOG EXP SGN LEN LEFT$ RIGHT$ MID$ STR$ VAL ASC CHR$ TAB SPC'.split(' ').sort((a,b)=>b.length-a.length);\n// Vocabulary is dialect data; unsupported SWB features fail explicitly.\nconst trsWords=[...words,...'DEFINT DEFSNG DEFDBL DEFSTR CLEAR CLS OPEN CLOSE CINT CSNG CDBL FIX POS MEM EOF'.split(' ')].sort((a,b)=>b.length-a.length);\nconst webWords = 'IF THEN ELSE FOR TO STEP GOTO GOSUB RETURN NEXT INPUT LET CLS END PRINT DIM DATA READ REM OR AND MOD WHILE WEND RANDOMIZE SYSTEM KEY CLEAR VAL STR$ LEFT$ RIGHT$ MID$ LEN RND INT INSTR ABS ASC CHR$ SQR STRING$ SIN COS TAN TIMER'.split(' ');\nconst webUnsupported = new Set('CLS WHILE WEND RANDOMIZE SYSTEM KEY CLEAR INSTR STRING$ TIMER'.split(' '));\nconst functions = new Set('ABS INT RND SQR SIN COS TAN ATN LOG EXP SGN LEN LEFT$ RIGHT$ MID$ STR$ VAL ASC CHR$ TAB SPC'.split(' '));\nfunction csv(text) {\n  const fields=[]; let start=0,quoted=false;\n  for(let i=0;i<text.length;i++) {\n    if(text[i]==='\"'){if(quoted&&text[i+1]==='\"')i++;else quoted=!quoted;}\n    else if(text[i]===','&&!quoted){fields.push(text.slice(start,i));start=i+1;}\n  }\n  if(quoted)throw new Error('Unterminated DATA/input string');fields.push(text.slice(start));\n  return fields.map(raw=>{const field=raw.trim();return field.startsWith('\"')&&field.endsWith('\"')?field.slice(1,-1).replaceAll('\"\"','\"'):field;});\n}\nfunction tokenize(source,profile=profileFor('ms8k')) {\n  const tokens=[]; let p=0;const vocabulary=profile.wholeIdentifiers?webWords:profile.trs80?trsWords:words;\n  const add=(kind,value)=>{if(tokens.length>=limits.tokens)throw new Error('Token limit');tokens.push({kind,value});};\n  while(p<source.length){\n    const c=source[p]; if(/\\s/.test(c)){p++;continue;}\n    if(c===\"'\"){add('keyword','REM');break;}\n    if(c==='\"'){let v='';p++;while(p<source.length&&source[p]!=='\"')v+=source[p++];if(source[p]!=='\"')throw new Error('Unterminated string');p++;add('string',v);continue;}\n    const tail=source.slice(p).toUpperCase();\n    const num=/^(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:E[+-]?\\d+)?/.exec(tail);\n    if(num){add('number',Number(num[0]));p+=num[0].length;if(profile.trs80&&['!','#'].includes(source[p]))p++;continue;}\n    const whole=/^[A-Z][A-Z0-9]*\\$?/.exec(tail)?.[0];\n    const keyword=vocabulary.find(word=>profile.wholeIdentifiers?whole===word:tail.startsWith(word));\n    if(keyword){if(profile.swbasic&&webUnsupported.has(keyword))throw new Error(`Simple Web Basic feature ${keyword} is not implemented in this compatibility subset`);add('keyword',keyword);p+=keyword.length;if(keyword==='REM')break;\n      if(keyword==='DATA'){let start=p,q=false;while(p<source.length){if(source[p]==='\"')q=!q;if(source[p]===':'&&!q)break;p++;}add('data',csv(source.slice(start,p)));}continue;}\n    if(profile.wholeIdentifiers&&whole){add('name',profile.caseSensitive?source.slice(p,p+whole.length):whole);p+=whole.length;continue;}\n    if(/[A-Z]/i.test(c)){let v=c.toUpperCase();p++;while(p<source.length&&/[A-Z0-9]/i.test(source[p])&&!vocabulary.some(w=>source.slice(p).toUpperCase().startsWith(w)))v+=source[p++].toUpperCase();if((profile.trs80?'$%!#':'$').includes(source[p])&&source[p])v+=source[p++];add('name',v);continue;}\n    const op=(profile.trs80?/^(<>|<=|>=|[+\\-*/^=<>(),:;?#@])/:/^(<>|<=|>=|[+\\-*/^=<>(),:;?])/).exec(tail);if(!op)throw new Error(`Unsupported character ${c}`);add('symbol',op[0]==='?'?'PRINT':op[0]);p+=op[0].length;\n  }\n  add('end','');return tokens;\n}\nconst precedence={OR:1,AND:2,'=':3,'<>':3,'<':3,'>':3,'<=':3,'>=':3,'+':4,'-':4,'*':5,'/':5,MOD:5,'^':7};\nclass Parser {\n  constructor(source,profile){this.tokens=tokenize(source,profile);this.p=0;this.depth=0;this.profile=profile;}\n  peek(){return this.tokens[this.p];}\n  is(v){return ['keyword','symbol'].includes(this.peek().kind)&&this.peek().value===v;}\n  take(v){if(this.is(v)){this.p++;return true;}return false;}\n  expect(v){if(!this.take(v))throw new Error(`Expected ${v}; found ${this.peek().value||'end of line'}`);}\n  name(){const t=this.peek();if(t.kind!=='name')throw new Error(`Expected variable; found ${t.value}`);this.p++;if(t.value.endsWith('$')&&!this.profile.strings)throw new Error('String variables unavailable in Tiny profile');return t.value;}\n  args(){this.expect('(');const a=[this.expr()];while(this.take(','))a.push(this.expr());this.expect(')');return a;}\n  target(){const name=this.name();return {name,args:this.is('(')?this.args():null};}\n  expr(min=0){\n    if(++this.depth>limits.depth)throw new Error('Expression nesting limit');\n    let node,t=this.peek();\n    if(this.take('-')||this.take('+')||this.take('NOT')){node={type:'unary',op:t.value,right:this.expr(t.value==='NOT'?3:this.profile.wholeIdentifiers?8:6)};}\n    else if(this.take('(')){node=this.expr();this.expect(')');}\n    else if(t.kind==='number'||t.kind==='string'){this.p++;node={type:'literal',value:t.value};}\n    else if(this.take('FN')){const name=this.name();node={type:'fn',name,args:this.args()};}\n    else if(this.profile.trs80&&this.take('MEM'))node={type:'call',name:'MEM',args:[]};\n    else if(t.kind==='keyword'&&(functions.has(t.value)||this.profile.trs80&&['CINT','CSNG','CDBL','FIX','POS','EOF'].includes(t.value))){this.p++;node={type:'call',name:t.value,args:this.profile.wholeIdentifiers&&t.value==='RND'&&this.peek().value!=='('?[]:this.args()};}\n    else if(t.kind==='name'){node={type:'variable',...this.target()};}\n    else throw new Error(`Expected expression; found ${t.value||'end of line'}`);\n    const order=this.profile.wholeIdentifiers?{...precedence,AND:1,'^':5}:precedence;\n    while(['keyword','symbol'].includes(this.peek().kind)&&Object.hasOwn(order,this.peek().value)&&order[this.peek().value]>=min){const op=this.tokens[this.p++].value;node={type:'binary',op,left:node,right:this.expr(order[op]+(op==='^'&&!this.profile.wholeIdentifiers?0:1))};}\n    this.depth--;return node;\n  }\n  end(){return this.peek().kind==='end'||(this.is(':')||this.is('ELSE'));}\n  targets(){const a=[this.target()];while(this.take(','))a.push(this.target());return a;}\n  statements(level=0){\n    if(level>limits.depth)throw new Error('Statement nesting limit');const result=[];\n    while(this.peek().kind!=='end'&&!this.is('ELSE')){\n      if(this.take(':'))continue;\n      const t=this.peek(), op=t.value;\n      if(this.take('REM')){result.push({op:'REM'});break;}\n      if(this.take('PRINT')){let channel=null,position=null;if(this.profile.trs80&&this.take('#')){channel=this.expr();this.expect(',');}else if(this.profile.trs80&&this.take('@')){position=this.expr();this.expect(',');}const parts=[];while(!this.end()){if(this.take(';')||this.take(','))parts.push({separator:this.tokens[this.p-1].value});else parts.push({expression:this.expr()});}result.push({op:'PRINT',parts,channel,position});}\n      else if(this.take('INPUT')){let channel=null;if(this.profile.trs80&&this.take('#')){channel=this.expr();this.expect(',');}let prompt='';if(this.peek().kind==='string'){prompt=this.tokens[this.p++].value;if(!this.take(';')&&!this.take(','))throw new Error('Expected INPUT separator');}result.push({op:'INPUT',prompt,channel,targets:this.targets()});}\n      else if(this.take('IF')){const test=this.expr();if(!this.take('THEN')&&!this.profile.trs80)throw new Error('Expected THEN');let yes;\n        if(this.peek().kind==='number'){yes=[{op:'GOTO',destination:this.expr()}];if(this.take(':'))yes.push(...this.statements(level+1));}\n        else yes=this.statements(level+1);\n        let no=[];if(this.take('ELSE')){if(this.peek().kind==='number'){no=[{op:'GOTO',destination:this.expr()}];if(this.take(':'))no.push(...this.statements(level+1));}else no=this.statements(level+1);}\n        result.push({op:'IF',test,yes,no});break;\n      }\n      else if(t.kind==='keyword'&&['GOTO','GOSUB'].includes(op)){this.p++;result.push({op,destination:this.expr()});}\n      else if(this.take('ON')){const value=this.expr();const mode=this.peek().value;if(!['GOTO','GOSUB'].includes(mode))throw new Error('Expected ON GOTO/GOSUB');this.p++;const lines=[this.expr()];while(this.take(','))lines.push(this.expr());result.push({op:'ON',mode,value,lines});}\n      else if(this.take('FOR')){const name=this.name();this.expect('=');const start=this.expr();this.expect('TO');const end=this.expr();const step=this.take('STEP')?this.expr():{type:'literal',value:1};result.push({op:'FOR',name,start,end,step});}\n      else if(this.take('NEXT')){const names=[];if(!this.end()){names.push(this.name());while(this.take(','))names.push(this.name());}for(const name of names.length?names:[null])result.push({op:'NEXT',name});}\n      else if(this.take('DIM'))result.push({op:'DIM',targets:this.targets()});\n      else if(this.take('READ'))result.push({op:'READ',targets:this.targets()});\n      else if(this.take('DATA'))result.push({op:'DATA',values:this.tokens[this.p++].value});\n      else if(this.take('RESTORE'))result.push({op:'RESTORE',destination:this.end()?null:this.expr()});\n      else if(this.profile.trs80&&['DEFINT','DEFSNG','DEFDBL','DEFSTR'].includes(op)){this.p++;const ranges=[];do{const start=this.name(),end=this.take('-')?this.name():start;if(!/^[A-Z]$/.test(start)||!/^[A-Z]$/.test(end)||end<start)throw Error('Invalid type letter range');ranges.push([start,end]);}while(this.take(','));result.push({op:'TYPE',kind:op,ranges});}\n      else if(this.profile.trs80&&this.take('CLEAR'))result.push({op:'CLEAR',size:this.end()?null:this.expr()});\n      else if(this.profile.trs80&&this.take('CLS'))result.push({op:'CLS'});\n      else if(this.profile.trs80&&this.take('OPEN')){const mode=this.expr();this.expect(',');this.take('#');const channel=this.expr();this.expect(',');const name=this.expr();result.push({op:'OPEN',mode,channel,name});}\n      else if(this.profile.trs80&&this.take('CLOSE')){const channels=[];if(!this.end())do{this.take('#');channels.push(this.expr());}while(this.take(','));result.push({op:'CLOSE',channels});}\n      else if(this.take('DEF')){this.expect('FN');const name=this.name();this.expect('(');const arg=this.name();this.expect(')');this.expect('=');result.push({op:'DEF',name,arg,expression:this.expr()});}\n      else if(t.kind==='keyword'&&['RETURN','STOP','END'].includes(op)){this.p++;result.push({op});}\n      else {this.take('LET');const target=this.target();this.expect('=');result.push({op:'LET',target,expression:this.expr()});}\n      if(!this.end())throw new Error(`Unexpected ${this.peek().value}`);if(this.is('ELSE'))break;this.take(':');\n    }return result;\n  }\n}\nfunction parseLine(source,profile){\n  try{const parser=new Parser(source,profile);const result=parser.statements();if(parser.peek().kind!=='end')throw new Error(`Unexpected ${parser.peek().value}`);return result;}\n  catch(error){\n    if(!profile.wholeIdentifiers){\n      const candidate=tokenize(source,{...profileFor('swbasic'),swbasic:false}).find(t=>t.kind==='name'&&words.some(w=>t.value.toUpperCase().includes(w)));\n      if(candidate)throw new Error(`${error.message}. ${profile.title} recognizes keywords inside names such as ${candidate.value}; use Simple Web Basic for full identifiers (do not rename the reference source)`);\n    }\n    throw new Error(`${error.message} [${profile.title}]`);\n  }\n}\n\nObject.assign(exports,{csv,tokenize,Parser,parseLine});\n},\"packages/basic/devices.js\":(exports,require)=>{\n// Bounded virtual typed-record storage. No host I/O, paths, executable data or network.\nconst deviceLimits=Object.freeze({files:32,records:4096,fields:256,string:4096,bytes:1048576,channels:15});\nfunction nameOf(name){if(typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/.test(name)||name.includes('..'))throw Error('Invalid virtual file name');return name;}\nfunction modeOf(mode){if(!['I','O'].includes(mode))throw Error('Unsupported device mode (use I or O)');return mode;}\nfunction recordOf(values){if(!Array.isArray(values)||!values.length||values.length>deviceLimits.fields)throw Error('Device record field limit');for(const value of values)if(!(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=deviceLimits.string))throw Error('Invalid device field');return [...values];}\nclass VirtualDevices {\n constructor(){this.files=new Map();this.channels=new Map();this.tapes=new Map();}\n validateSize(files){if(files.size>deviceLimits.files||JSON.stringify([...files]).length>deviceLimits.bytes)throw Error('Virtual storage limit');}\n prepare(name,mode){nameOf(name);modeOf(mode);if(mode==='I'&&!this.files.has(name))throw Error('Virtual file not found');if(mode==='O'){const next=new Map(this.files);next.set(name,[]);this.validateSize(next);this.files=next;}return {name,mode,position:0};}\n mount(name,mode='I',unit=-1){if(![-1,-2].includes(unit))throw Error('Cassette unit must be -1 or -2');this.tapes.set(unit,this.prepare(name,mode));}\n rewind(unit=-1){const tape=this.tapes.get(unit);if(!tape)throw Error('No cassette mounted');tape.position=0;tape.mode='I';}\n open(channel,mode,name){this.channelNumber(channel);if(this.channels.has(channel))throw Error('File already open');this.channels.set(channel,this.prepare(name,mode));}\n channelNumber(channel){if(!Number.isInteger(channel)||channel<1||channel>deviceLimits.channels)throw Error('Bad file number');}\n close(channel){if(channel===undefined){this.channels.clear();return;}this.channelNumber(channel);if(!this.channels.delete(channel))throw Error('File not open');}\n handle(channel,mode){const h=channel<0?this.tapes.get(channel):this.channels.get(channel);if(!h)throw Error(channel<0?'No cassette mounted':'File not open');if(h.mode!==mode)throw Error('Wrong device mode');return h;}\n write(channel,values){const h=this.handle(channel,'O'),record=recordOf(values),records=this.files.get(h.name);if(records.length>=deviceLimits.records)throw Error('Device record limit');const next=new Map(this.files);next.set(h.name,[...records,record]);this.validateSize(next);this.files=next;h.position++;}\n peek(channel,types){const h=this.handle(channel,'I'),record=this.files.get(h.name)[h.position];if(!record)throw Error('Out of file data (EOF)');if(record.length!==types.length||record.some((v,i)=>typeof v!==types[i]))throw Error('Bad file data: record count/type mismatch');return [...record];}\n advance(channel){this.handle(channel,'I').position++;}\n eof(channel){const h=this.handle(channel,'I');return h.position>=this.files.get(h.name).length;}\n catalog(){return {files:[...this.files].map(([name,records])=>({name,records:records.length})),tapes:[...this.tapes].map(([unit,h])=>({unit,...h})),channels:[...this.channels].map(([channel,h])=>({channel,...h}))};}\n export(){return JSON.stringify({format:'retrorealm-basic-devices',version:1,files:[...this.files].map(([name,records])=>({name,records}))});}\n import(text){if(typeof text!=='string'||text.length>deviceLimits.bytes*2)throw Error('Device image size limit');const data=JSON.parse(text);if(!data||Object.keys(data).sort().join(',')!=='files,format,version'||data.format!=='retrorealm-basic-devices'||data.version!==1||!Array.isArray(data.files))throw Error('Invalid device image');const next=new Map();for(const file of data.files){if(!file||Object.keys(file).sort().join(',')!=='name,records'||!Array.isArray(file.records)||file.records.length>deviceLimits.records)throw Error('Invalid virtual file');nameOf(file.name);if(next.has(file.name))throw Error('Duplicate virtual file');next.set(file.name,file.records.map(recordOf));}this.validateSize(next);this.files=next;this.channels.clear();this.tapes.clear();}\n}\n\nObject.assign(exports,{deviceLimits,VirtualDevices});\n},\"packages/basic/machine.js\":(exports,require)=>{\nconst { limits, profileFor, seededRandom } = require(\"packages/basic/profiles.js\");\nconst { csv, Parser } = require(\"packages/basic/parser.js\");\nconst { VirtualDevices } = require(\"packages/basic/devices.js\");\n\n// AST interpreter. BASIC values never become JavaScript code or property paths.\nclass Machine {\n  constructor(program,{dialect='ms8k',seed='1',random,write=()=>{},clock=()=>performance.now(),budgets={},devices=new VirtualDevices()}={}){\n    this.profile=profileFor(dialect);this.code=program.compile(this.profile);this.random=random??seededRandom(seed);this.write=write;this.clock=clock;this.limits={...limits,...budgets};\n    this.devices=devices;this.types=new Map();this.stringSpace=50;this.row=0;\n    this.variables=new Map();this.arrays=new Map();this.functions=new Map();this.calls=[];this.loops=[];this.pc=0;this.status='running';this.steps=0;this.evaluations=0;this.elapsed=0;this.output=0;this.column=0;this.cells=0;this.dataIndex=0;this.lastRandom=0;this.coverage=new Set();this.line=null;this.pending=null;this.depth=0;\n  }\n  key(name){if(this.profile.trs80){const suffix=/[$%!#]$/.test(name)?name.at(-1):(this.types.get(name[0])??'!');return name.replace(/[$%!#]$/,'').slice(0,this.profile.names)+suffix;}return name.replace(/\\$$/,'').slice(0,this.profile.names)+(name.endsWith('$')?'$':'');}\n  number(value){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Numeric type/overflow error');return this.profile.integer?Math.trunc(value):value;}\n  string(value){if(typeof value!=='string')throw new Error('String type mismatch');if(value.length>this.limits.string)throw new Error('String limit');return value;}\n  integer16(value){const n=Math.floor(this.number(value));if(n< -32768||n>32767)throw Error('Integer overflow');return n;}\n  checked(name,value){return name.endsWith('$')?this.string(value):this.profile.trs80&&name.endsWith('%')?this.integer16(value):this.number(value);}\n  array(name,args,create=true){\n    const key=this.key(name);let a=this.arrays.get(key);\n    if(!a&&create){this.dim(name,args.map(()=>10));a=this.arrays.get(key);}\n    if(!a||args.length!==a.bounds.length)throw new Error('Array dimension mismatch');\n    let index=0;for(let i=0;i<args.length;i++){const n=Math.trunc(this.number(args[i]));if(n<0||n>a.bounds[i])throw new Error('Subscript out of range');index=index*(a.bounds[i]+1)+n;}\n    return {a,index};\n  }\n  dim(name,bounds){const key=this.key(name);if(this.arrays.has(key))throw new Error('Array already dimensioned');if(bounds.length<1||bounds.length>4)throw new Error('Dimension limit');bounds=bounds.map(n=>Math.trunc(this.number(n)));const size=bounds.reduce((n,v)=>n*(v+1),1);if(bounds.some(n=>n<0)||!Number.isSafeInteger(size)||size+this.cells>this.limits.cells)throw new Error('Array memory limit');this.cells+=size;this.arrays.set(key,{bounds,values:new Map()});}\n  read(target){const key=this.key(target.name);if(target.args){const {a,index}=this.array(key,target.args.map(x=>this.eval(x)));return a.values.get(index)??(key.endsWith('$')?'':0);}return this.variables.get(key)??(key.endsWith('$')?'':0);}\n  assign(target,value){const key=this.key(target.name);value=this.checked(key,value);if(target.args){const {a,index}=this.array(key,target.args.map(x=>this.eval(x)));a.values.set(index,value);}else {if(!this.variables.has(key)&&this.variables.size>=this.limits.variables)throw new Error('Variable limit');this.variables.set(key,value);}}\n  eval(node){\n    if(++this.evaluations>this.limits.expressions)throw new Error('Expression evaluation budget exhausted');\n    if(this.sliceStarted!==undefined && this.evaluations%128===0 && this.elapsed+this.clock()-this.sliceStarted>=this.limits.milliseconds)throw new Error('Execution budget exhausted');\n    if(++this.depth>this.limits.depth)throw new Error('Expression/function depth limit');let value;\n    try {switch(node.type){\n      case 'literal':value=node.value;break;\n      case 'variable':if(this.profile.swbasic&&node.args)for(const arg of node.args.slice(0,2))this.eval(arg);value=this.read(node);break;\n      case 'unary':{const v=this.number(this.eval(node.right));value=node.op==='-'?-v:node.op==='+'?v:~(this.profile.trs80?this.integer16(v):Math.trunc(v));break;}\n      case 'binary':{const a=this.eval(node.left),b=this.eval(node.right),op=node.op;\n        if(['=','<>','<','>','<=','>='].includes(op)){if(typeof a!==typeof b)throw new Error('Comparison type mismatch');value=({'=':a===b,'<>':a!==b,'<':a<b,'>':a>b,'<=':a<=b,'>=':a>=b}[op])?this.profile.truth:0;}\n        else if(op==='+'&&typeof a==='string'&&typeof b==='string')value=this.string(a+b);\n        else{this.number(a);this.number(b);if((op==='/'||op==='MOD')&&b===0)throw new Error('Division by zero');switch(op){case '+':value=a+b;break;case '-':value=a-b;break;case '*':value=a*b;break;case '/':value=a/b;break;case '^':value=a**b;break;case 'MOD':value=a%b;break;case 'AND':value=this.profile.trs80?this.integer16(a)&this.integer16(b):a&b;break;case 'OR':value=this.profile.trs80?this.integer16(a)|this.integer16(b):a|b;break;default:throw new Error('Unknown operator');}}break;}\n      // The inspected SWB evaluator visits the first two children before dispatch,\n      // then evaluates function arguments again. Keep that quirk profile-local.\n      case 'call':if(this.profile.swbasic)for(const arg of node.args.slice(0,2))this.eval(arg);value=this.builtin(node.name,node.args.map(x=>this.eval(x)));break;\n      case 'fn':{const f=this.functions.get(this.key(node.name));if(!f||node.args.length!==1)throw new Error('Undefined function/arity');const v=this.eval(node.args[0]),key=this.key(f.arg),had=this.variables.has(key),old=this.variables.get(key);this.assign({name:f.arg},v);try{value=this.eval(f.expression);}finally{if(had)this.variables.set(key,old);else this.variables.delete(key);}break;}\n      default:throw new Error('Invalid expression');\n    }return typeof value==='number'?this.number(value):this.string(value);}finally{this.depth--;}\n  }\n  builtin(name,args){\n    const count=name==='MEM'?[0]:name==='RND'&&this.profile.swbasic?[0,1]:name==='MID$'?[2,3]:['LEFT$','RIGHT$'].includes(name)?[2]:[1];if(!count.includes(args.length))throw new Error(`Wrong number of arguments for ${name}`);\n    const x=args[0],n=i=>this.number(args[i]);\n    switch(name){\n      case 'RND':{if(this.profile.trs80){const bound=n(0);if(bound<0||bound>32767)throw Error('RND bound range');return bound===0?this.draw():Math.floor(this.draw()*Math.floor(bound))+1;}if(!args.length)return this.draw();n(0);if(this.profile.integerRandom){if(x<1)throw new Error('RND bound must be positive');return Math.floor(this.draw()*Math.trunc(x))+1;}if(x<0&&!this.profile.swbasic)throw new Error('Negative RND reseeding is not implemented; use the session seed');return x===0?this.lastRandom:this.draw();}\n      case 'MEM':throw Error('MEM requires a ROM memory layout; use an explicitly documented compatibility listing');\n      case 'CINT':return this.integer16(n(0));case 'FIX':return Math.trunc(n(0));case 'CSNG':case 'CDBL':return n(0);\n      case 'POS':return this.column%64;case 'EOF':return this.devices.eof(n(0))?-1:0;\n      case 'INT':return Math.floor(n(0));case 'ABS':return Math.abs(n(0));case 'SGN':return Math.sign(n(0));\n      case 'SQR':return Math.sqrt(n(0));case 'SIN':return Math.sin(n(0));case 'COS':return Math.cos(n(0));case 'TAN':return Math.tan(n(0));case 'ATN':return Math.atan(n(0));case 'LOG':return Math.log(n(0));case 'EXP':return Math.exp(n(0));\n      case 'LEN':return this.string(x).length;\n      case 'LEFT$':case 'RIGHT$':{const s=this.string(x),length=Math.trunc(n(1));if(length<0)throw new Error('Illegal string length');return name==='LEFT$'?s.slice(0,length):length?s.slice(-length):'';}\n      case 'MID$':{const s=this.string(x),start=Math.trunc(n(1)),length=args.length===3?Math.trunc(n(2)):s.length;if(start<1||length<0)throw new Error('Illegal substring');return s.slice(start-1,start-1+length);}\n      case 'STR$':return (n(0)>=0&&!this.profile.plainNumbers?' ':'')+String(x);\n      case 'VAL':{const match=/^[ \\t]*[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:E[+-]?\\d+)?/i.exec(this.string(x));return match?Number(match[0]):0;}\n      case 'ASC':if(!this.string(x).length)throw new Error('Empty ASC');return x.charCodeAt(0);\n      case 'CHR$':if(n(0)<0||x>255)throw new Error('CHR$ range');return String.fromCharCode(Math.trunc(x));\n      case 'TAB':case 'SPC':{const amount=Math.trunc(n(0));if(amount<0||amount>this.limits.string)throw new Error('Spacing limit');return ' '.repeat(name==='TAB'?Math.max(0,(this.profile.trs80?amount%64:amount)-this.column):amount);}\n      default:throw new Error(`Unsupported function ${name}`);\n    }\n  }\n  draw(){const n=this.random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid RNG device');return this.lastRandom=n;}\n  out(text){if(this.output+text.length>this.limits.output)throw new Error('Output budget exhausted');this.output+=text.length;this.column=text.includes('\\n')?text.length-text.lastIndexOf('\\n')-1:this.column+text.length;if(this.profile.trs80)this.column%=64;this.write(text);}\n  goto(value,sub=false){const target=this.code.locations.get(this.number(value));if(target===undefined)throw new Error(`Undefined line ${value}`);if(sub){if(this.calls.length>=this.limits.stack)throw new Error('GOSUB stack limit');this.calls.push(this.profile.trs80?{pc:this.pc,loops:this.loops.length}:this.pc);}this.pc=target;}\n  execute(s){switch(s.op){\n    case 'REM':case 'DATA':break;\n    case 'TYPE':for(const [start,end]of s.ranges)for(let c=start.charCodeAt(0);c<=end.charCodeAt(0);c++)this.types.set(String.fromCharCode(c),{DEFINT:'%',DEFSNG:'!',DEFDBL:'#',DEFSTR:'$'}[s.kind]);break;\n    case 'CLEAR':{const size=s.size?this.number(this.eval(s.size)):this.stringSpace;if(size<0||size>this.limits.source)throw Error('CLEAR string-space range');this.stringSpace=Math.floor(size);this.variables.clear();this.arrays.clear();this.functions.clear();this.loops=[];this.calls=[];this.cells=0;this.dataIndex=0;break;}\n    case 'CLS':this.column=0;this.row=0;this.out('\\n[Screen cleared]\\n');break;\n    case 'OPEN':this.devices.open(this.number(this.eval(s.channel)),this.string(this.eval(s.mode)),this.string(this.eval(s.name)));break;\n    case 'CLOSE':if(!s.channels.length)this.devices.close();else for(const c of s.channels)this.devices.close(this.number(this.eval(c)));break;\n    case 'LET':this.assign(s.target,this.eval(s.expression));break;\n    case 'PRINT':if(s.channel){const values=s.parts.filter(p=>p.expression).map(p=>this.eval(p.expression));this.devices.write(this.number(this.eval(s.channel)),values);break;}if(s.position){const position=this.number(this.eval(s.position));if(!Number.isInteger(position)||position<0||position>1023)throw Error('PRINT @ position range');this.out('\\n'+' '.repeat(position%64));this.row=Math.floor(position/64);}\n      for(const part of s.parts){if(part.separator===',')this.out(' '.repeat(this.profile.plainNumbers?3:this.profile.zone-this.column%this.profile.zone));else if(part.expression){const v=this.eval(part.expression);this.out(typeof v==='number'&&!this.profile.integer&&!this.profile.plainNumbers?(v>=0?' ':'')+String(Number(v.toPrecision(7)))+' ':String(v));}}if(!s.parts.at(-1)?.separator)this.out('\\n');break;\n    case 'INPUT':if(s.channel){const channel=this.number(this.eval(s.channel)),types=s.targets.map(t=>this.key(t.name).endsWith('$')?'string':'number'),values=this.devices.peek(channel,types);s.targets.forEach((t,i)=>this.checked(this.key(t.name),values[i]));s.targets.forEach((t,i)=>this.assign(t,values[i]));this.devices.advance(channel);break;}this.pending={...s,received:[]};this.status='input';this.out(s.prompt+'? ');break;\n    case 'BRANCH':if(!this.number(this.eval(s.test)))this.pc=s.target;break;\n    case 'JUMP':this.pc=s.target;break;\n    case 'GOTO':case 'GOSUB':this.goto(this.eval(s.destination),s.op==='GOSUB');break;\n    case 'ON':{const i=Math.trunc(this.number(this.eval(s.value)));if(i>=1&&i<=s.lines.length)this.goto(this.eval(s.lines[i-1]),s.mode==='GOSUB');break;}\n    case 'RETURN':if(!this.calls.length)throw new Error('RETURN without GOSUB');{const frame=this.calls.pop();if(this.profile.trs80){this.pc=frame.pc;this.loops.splice(frame.loops);}else this.pc=frame;}break;\n    case 'FOR':{const key=this.key(s.name),start=this.number(this.eval(s.start)),end=this.number(this.eval(s.end)),step=this.number(this.eval(s.step));if(!step)throw new Error('Zero FOR step');this.assign({name:s.name},start);const floor=this.profile.trs80?(this.calls.at(-1)?.loops??0):0;const found=this.loops.findIndex((l,i)=>i>=floor&&l.name===key);if(found>=0)this.loops.splice(found);if(this.loops.length>=this.limits.stack)throw new Error('FOR stack limit');this.loops.push({name:key,end,step,pc:this.pc});break;}\n    case 'NEXT':{const index=s.name?this.loops.findLastIndex(l=>l.name===this.key(s.name)):this.loops.length-1;if(index<0||this.profile.trs80&&index<(this.calls.at(-1)?.loops??0))throw new Error('NEXT without FOR');this.loops.splice(index+1);const l=this.loops[index],v=this.checked(l.name,(this.variables.get(l.name)??0)+l.step);this.variables.set(l.name,v);if(l.step>0?v<=l.end:v>=l.end)this.pc=l.pc;else this.loops.pop();break;}\n    case 'DIM':for(const t of s.targets){if(!t.args)throw new Error('DIM needs bounds');this.dim(t.name,t.args.map(a=>this.eval(a)));}break;\n    case 'READ':for(const t of s.targets){const datum=this.code.data[this.dataIndex++];if(!datum)throw new Error('Out of DATA');const value=this.key(t.name).endsWith('$')?datum.value:Number(datum.value);this.assign(t,value);}break;\n    case 'RESTORE':if(!s.destination)this.dataIndex=0;else{const n=this.number(this.eval(s.destination));const at=this.code.data.findIndex(d=>d.line>=n);this.dataIndex=at<0?this.code.data.length:at;}break;\n    case 'DEF':this.functions.set(this.key(s.name),s);break;\n    case 'STOP':this.stop();break;case 'END':this.status='ended';break;\n    default:throw new Error(`Unsupported statement ${s.op}`);\n  }}\n  inputExpression(text){\n    const start=this.clock();this.sliceStarted=start;\n    try{const parser=new Parser(text,this.profile),node=parser.expr();if(parser.peek().kind!=='end')throw new Error('Expected one INPUT expression');return this.number(this.eval(node));}\n    catch(error){if(error.message.includes('budget')){this.status='error';this.error=`${error.message} in ${this.line}`;}throw error;}\n    finally{this.elapsed+=this.clock()-start;this.sliceStarted=undefined;}\n  }\n  input(text){if(this.profile.trs80)return this.trsInput(text);if(this.status!=='input')throw new Error('Not waiting for INPUT');if(typeof text!=='string'||text.length>this.limits.input)throw new Error('Input length limit');const values=this.profile.caseSensitive&&this.pending.targets.length===1&&this.pending.targets[0].name.endsWith('$')?[text]:csv(this.profile.caseSensitive?text:text.toUpperCase());if(values.length!==this.pending.targets.length)throw new Error('INPUT requires '+this.pending.targets.length+' value(s)');const converted=values.map((v,i)=>this.pending.targets[i].name.endsWith('$')?this.string(v):this.profile.integer?this.inputExpression(v):/^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:E[+-]?\\d+)?$/.test(v)?this.number(Number(v)):(()=>{throw new Error('Expected numeric input');})());this.pending.targets.forEach((t,i)=>this.assign(t,converted[i]));this.pending=null;this.column=0;this.status='running';}\n  trsInput(text){\n    if(this.status!=='input')throw Error('Not waiting for INPUT');if(typeof text!=='string'||text.length>this.limits.input)throw Error('Input length limit');\n    const pending=this.pending,offset=pending.received.length,targets=pending.targets.slice(offset);\n    if(text===''){for(const t of targets)pending.received.push(this.read(t));}\n    else {const fields=csv(text.toUpperCase()),values=fields.slice(0,targets.length).map((value,i)=>{const key=this.key(targets[i].name);if(key.endsWith('$'))return this.string(value);if(!/^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:E[+-]?\\d+)?$/.test(value))throw Error('Expected numeric input');return this.checked(key,Number(value));});pending.received.push(...values);if(fields.length>targets.length)this.out('?EXTRA IGNORED\\n');}\n    this.column=0;if(pending.received.length<pending.targets.length){this.out('?? ');return;}\n    pending.targets.forEach((t,i)=>this.assign(t,pending.received[i]));this.pending=null;this.status='running';\n  }\n  stop(){if(['running','input'].includes(this.status)){this.suspended=this.status;this.status='stopped';}}\n  cont(){if(this.status!=='stopped')throw new Error('Cannot continue');this.status=this.suspended??'running';}\n  step(quota=500){if(this.status!=='running')return this.status;const start=this.clock();this.sliceStarted=start;try{for(let i=0;i<Math.min(quota,500)&&this.status==='running';i++){\n    if(this.steps>=this.limits.instructions||this.elapsed+this.clock()-start>=this.limits.milliseconds)throw new Error('Execution budget exhausted; RUN starts a fresh run');\n    if(this.pc>=this.code.instructions.length){this.status='ended';break;}const s=this.code.instructions[this.pc++];this.line=s.line;this.coverage.add(s.line);this.steps++;this.execute(s);\n  }}catch(error){this.status='error';this.error=`${error.message} in ${this.line}`;}finally{this.elapsed+=this.clock()-start;this.sliceStarted=undefined;}return this.status;}\n}\n\nObject.assign(exports,{Machine});\n}};const cache=Object.create(null);function require(id){if(!cache[id]){const exports={};cache[id]=exports;modules[id](exports,require);}return cache[id];}require(\"packages/basic-session/worker.js\"); })();\n";
const sampleSource="10 REM RETROREALM ORIGINAL DEMO - NO HISTORICAL GAME SOURCE\n20 DIM A(3):DATA 3,5,8\n30 FOR I=1 TO 3:READ A(I):NEXT I\n40 DEF FNS(X)=X*X\n50 PRINT \"RETROREALM OBSERVATORY\"\n60 INPUT \"YOUR NAME\";N$\n70 PRINT \"WELCOME, \";LEFT$(N$,12)\n80 FOR I=1 TO 3:GOSUB 200:NEXT I\n90 RESTORE:READ X:PRINT \"FIRST READING AGAIN: \";X\n100 PRINT \"SEEDED SIGNAL: \";INT(RND(1)*100)\n110 STOP\n120 PRINT \"CONT RESUMED WITHOUT RESETTING\":END\n200 PRINT \"READING \";I;\" = \";A(I);\" SQUARED = \";FNS(A(I))\n210 RETURN\n";
const examples=[{"id":"hello","title":"Hello, BASIC","dialect":"ms8k","description":"Your first conversation with a program.","inputs":["EXPLORER"],"source":"10 REM ORIGINAL RETROREALM EXAMPLE: HELLO\n20 INPUT \"YOUR NAME\";N$\n30 PRINT \"HELLO, \";N$\n40 PRINT \"YOU ARE RUNNING BASIC.\"\n50 END\n"},{"id":"countdown","title":"Countdown & continue","dialect":"ms8k","description":"Loops, a subroutine, STOP and CONT.","inputs":[],"source":"10 REM ORIGINAL RETROREALM EXAMPLE: COUNTDOWN\n20 FOR I=3 TO 1 STEP -1\n30 PRINT I\n40 NEXT I\n50 GOSUB 100\n60 STOP\n70 PRINT \"CONT RESUMED THE PROGRAM\":END\n100 PRINT \"LIFT OFF!\":RETURN\n"},{"id":"arrays","title":"A pocket observatory","dialect":"ms8k","description":"Arrays, DATA, a mean and a user function.","inputs":[],"source":"10 REM ORIGINAL RETROREALM EXAMPLE: READINGS\n20 DIM A(4):DATA 12,18,15,23\n30 S=0\n40 FOR I=1 TO 4:READ A(I):S=S+A(I):NEXT I\n50 PRINT \"MEAN READING: \";S/4\n60 DEF FNS(X)=X*X\n70 PRINT \"SQUARE OF MEAN: \";FNS(S/4)\n80 RESTORE:READ F:PRINT \"FIRST READING: \";F\n90 END\n"},{"id":"tiny-squares","title":"Five tiny squares","dialect":"tiny","description":"One-letter variables and an integer loop.","inputs":[],"source":"10 REM ORIGINAL RETROREALM EXAMPLE: TINY SQUARES\n20 LET A=1\n30 PRINT A,A*A\n40 LET A=A+1\n50 IF A<=5 THEN GOTO 30\n60 END\n"},{"id":"web-names","title":"Names that matter","dialect":"swbasic","description":"Full identifiers and case-sensitive variables.","inputs":[],"source":"10 REM ORIGINAL RETROREALM EXAMPLE: FULL NAMES\n20 LET Reading=7\n30 LET reading=3\n40 PRINT \"Reading + reading = \";Reading+reading\n50 PRINT \"Case matters in this profile.\"\n60 END\n"},{"id":"virtual-notebook","title":"Virtual notebook","dialect":"trs80","description":"Write and read a named virtual file. Replaces notebook.","inputs":[],"source":"10 REM ORIGINAL RETROREALM EXAMPLE: VIRTUAL NOTEBOOK\n20 DEFINT A-Z\n30 OPEN \"O\",1,\"notebook\"\n40 PRINT#1,42,\"A NOTE FROM BASIC\"\n50 CLOSE 1\n60 OPEN \"I\",1,\"notebook\"\n70 INPUT#1,N,T$\n80 PRINT N;T$\n90 PRINT \"END OF FILE: \";EOF(1)\n100 CLOSE\n110 END\n"},{"id":"observatory","title":"Observatory tour","dialect":"ms8k","description":"The original guided demo; enter a name, then CONT.","inputs":["EXPLORER"],"source":"10 REM RETROREALM ORIGINAL DEMO - NO HISTORICAL GAME SOURCE\n20 DIM A(3):DATA 3,5,8\n30 FOR I=1 TO 3:READ A(I):NEXT I\n40 DEF FNS(X)=X*X\n50 PRINT \"RETROREALM OBSERVATORY\"\n60 INPUT \"YOUR NAME\";N$\n70 PRINT \"WELCOME, \";LEFT$(N$,12)\n80 FOR I=1 TO 3:GOSUB 200:NEXT I\n90 RESTORE:READ X:PRINT \"FIRST READING AGAIN: \";X\n100 PRINT \"SEEDED SIGNAL: \";INT(RND(1)*100)\n110 STOP\n120 PRINT \"CONT RESUMED WITHOUT RESETTING\":END\n200 PRINT \"READING \";I;\" = \";A(I);\" SQUARED = \";FNS(A(I))\n210 RETURN\n"}];

Object.assign(exports,{workerSource,sampleSource,examples});
},"packages/player/embed.js":(exports,require)=>{
// Optional same-origin layout bridge. No game state, storage, commands or
// parent DOM access. A standalone/file player never starts this protocol.
(() => {
  if (window.parent === window || !/^https?:$/.test(location.protocol)) return;
  const channel = 'retrorealm-basic-lab:layout', origin = location.origin;
  let token = null, lastHeight = 0, pending = false;
  const sendHeight = () => {
    if (!token || pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      // Measure intrinsic content, not document.scrollHeight (which is at
      // least the iframe viewport and would prevent shrinking).
      const height = Math.ceil(document.querySelector('main').getBoundingClientRect().height) + 2;
      if (height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ channel, version: 1, type: 'height', token, height }, origin);
      }
    });
  };
  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window.parent || event.origin !== origin || !data || typeof data !== 'object' || Array.isArray(data)) return;
    if (Object.keys(data).sort().join(',') !== 'channel,token,type,version' || data.channel !== channel || data.version !== 1 || data.type !== 'observe' || typeof data.token !== 'string' || !/^[a-f0-9]{32}$/.test(data.token)) return;
    token = data.token; lastHeight = 0; sendHeight();
  });
  new ResizeObserver(sendHeight).observe(document.querySelector('main'));
  window.addEventListener('pageshow', () => window.parent.postMessage({ channel, version: 1, type: 'ready' }, origin));
  window.parent.postMessage({ channel, version: 1, type: 'ready' }, origin);
})();

Object.assign(exports,{});
}};const cache=Object.create(null);function require(id){if(!cache[id]){const exports={};cache[id]=exports;modules[id](exports,require);}return cache[id];}require("packages/basic-session/app.js");require("packages/player/embed.js"); })();
