'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,BarChart3,Bot,BrainCircuit,Camera,CameraOff,Check,CheckCircle2,Clock3,FileText,Mic,MicOff,RotateCcw,Send,ShieldCheck,Square,Volume2,VolumeX} from 'lucide-react';
import {Choice} from './workspace';
import {Switch} from '@/components/ui/switch';
import {Progress} from '@/components/ui/progress';
import {Wave} from './landing';
import type {Profile} from '@/lib/edu/content';
import {interviewTypes,interviewDifficulties,interviewLanguages,type InterviewType,type InterviewDifficulty,type InterviewLanguage} from '@/lib/edu/interview-context';

type Phase='setup'|'connecting'|'live'|'report';
type LiveStatus='Idle'|'Connecting'|'Listening'|'Processing'|'AI speaking'|'Connected'|'Complete'|'Error';
type Verdict='Correct'|'Partially Correct'|'Incorrect'|'Unclear';
type Message={role:'user'|'agent';text:string};
type Setup={type:InterviewType;topic:string;difficulty:InterviewDifficulty;questionCount:5|10|15;language:InterviewLanguage;camera:boolean};
type ToolCall={call_id:string;name:string;arguments:Record<string,unknown>};
type TokenPayload={token?:string;error?:string;firstQuestion?:string;session?:{system_prompt?:string;[key:string]:unknown}};

export type InterviewEvaluation={
  id:string;
  questionNumber:number;
  question:string;
  answer:string;
  answerSummary:string;
  verdict:Verdict;
  score:number;
  correctPoints:string[];
  missingPoints:string[];
  feedback:string;
  modelAnswer:string;
  topic:string;
  difficulty:InterviewDifficulty;
  weakTopics:string[];
  nextQuestion:string;
  nextDifficulty:InterviewDifficulty;
};

export type InterviewResult=Setup&{
  startedAt:string;
  finishedAt:string;
  minutes:number;
  messages:Message[];
  evaluations:InterviewEvaluation[];
};

type Connection={
  ws:WebSocket;
  audio:AudioContext;
  gain:GainNode;
  nodes:Set<AudioBufferSourceNode>;
  stream?:MediaStream;
  worklet?:AudioWorkletNode;
  ready:boolean;
  started:number;
  playback:number;
  basePrompt:string;
  pending:ToolCall[];
  timer?:ReturnType<typeof setTimeout>;
  finishTimer?:ReturnType<typeof setTimeout>;
};

const topicIdeas=['Python & Data Structures','Artificial Intelligence','Mathematics','Physics','World History','Business & Marketing'];
const verdicts:Verdict[]=['Correct','Partially Correct','Incorrect','Unclear'];
const difficulties:InterviewDifficulty[]=['Beginner','Intermediate','Advanced'];
const clean=(value:unknown,fallback:string,max=1200)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
const list=(value:unknown,max=8)=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string'&&!!x.trim()).map(x=>x.trim().slice(0,240)).slice(0,max):[];
const formatTime=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
const unique=(values:string[],max=6)=>[...new Set(values.filter(Boolean))].slice(0,max);

export default function AIInterviewer({profile,assembly,weakTopics,onComplete}:{profile:Profile;assembly:boolean;weakTopics:string[];onComplete:(result:InterviewResult)=>void}){
  const [phase,setPhase]=useState<Phase>('setup');
  const [setup,setSetup]=useState<Setup>({type:'Technical Interview',topic:profile.subjects[0]||'',difficulty:(interviewDifficulties.includes(profile.level as InterviewDifficulty)?profile.level:'Beginner') as InterviewDifficulty,questionCount:5,language:(interviewLanguages.includes(profile.language as InterviewLanguage)?profile.language:'Auto detect') as InterviewLanguage,camera:false});
  const [status,setStatus]=useState<LiveStatus>('Idle');
  const [messages,setMessages]=useState<Message[]>([]);
  const [evaluations,setEvaluations]=useState<InterviewEvaluation[]>([]);
  const [currentQuestion,setCurrentQuestion]=useState('');
  const [partial,setPartial]=useState('');
  const [text,setText]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [micOn,setMicOn]=useState(false);
  const [cameraOn,setCameraOn]=useState(false);
  const [muted,setMuted]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [report,setReport]=useState<InterviewResult|null>(null);
  const connection=useRef<Connection|null>(null);
  const cameraStream=useRef<MediaStream|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const generation=useRef(0);
  const mounted=useRef(true);
  const muteRef=useRef(false);
  const setupRef=useRef(setup);
  const messagesRef=useRef<Message[]>([]);
  const evaluationsRef=useRef<InterviewEvaluation[]>([]);
  const questionRef=useRef('');
  const latestAnswer=useRef('');
  const finishing=useRef(false);
  const completed=useRef(false);
  const callback=useRef(onComplete);
  setupRef.current=setup;
  callback.current=onComplete;

  useEffect(()=>{if((phase==='live'||phase==='connecting')&&connection.current?.started){const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-connection.current!.started)/1000)),1000);return()=>clearInterval(timer)}},[phase]);
  useEffect(()=>{if(videoRef.current&&cameraStream.current)videoRef.current.srcObject=cameraStream.current},[phase,cameraOn]);
  useEffect(()=>()=>{mounted.current=false;generation.current++;endConnection();stopCamera()},[]);

  function pushMessage(message:Message){messagesRef.current=[...messagesRef.current,message];setMessages(messagesRef.current)}
  function endConnection(){const c=connection.current;connection.current=null;if(!c)return;clearTimeout(c.timer);clearTimeout(c.finishTimer);c.ready=false;c.ws.onclose=null;c.ws.onerror=null;c.ws.onmessage=null;try{if(c.ws.readyState===WebSocket.OPEN)c.ws.send(JSON.stringify({type:'session.end'}));c.ws.close()}catch{}c.stream?.getTracks().forEach(t=>t.stop());c.worklet?.disconnect();c.nodes.forEach(n=>{try{n.stop()}catch{}});void c.audio.close();setMicOn(false)}
  function stopCamera(){cameraStream.current?.getTracks().forEach(t=>t.stop());cameraStream.current=null;if(videoRef.current)videoRef.current.srcObject=null;if(mounted.current)setCameraOn(false)}
  async function startCamera(){try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});if(!mounted.current){stream.getTracks().forEach(t=>t.stop());return}cameraStream.current=stream;setCameraOn(true);setError('');if(videoRef.current)videoRef.current.srcObject=stream}catch(e){setCameraOn(false);setError((e as Error).message==='Camera is not supported in this browser.'?(e as Error).message:'Camera permission was denied or unavailable. You can continue—the camera never affects your evaluation.')}}

  async function attachMicrophone(c:Connection,run:number){try{setStatus('Connecting');const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false}});if(run!==generation.current||connection.current!==c){media.getTracks().forEach(t=>t.stop());return}c.stream=media;await c.audio.audioWorklet.addModule('/voice-capture.js');if(run!==generation.current||connection.current!==c)return;const worklet=new AudioWorkletNode(c.audio,'voice-capture');c.worklet=worklet;c.audio.createMediaStreamSource(media).connect(worklet);const silent=c.audio.createGain();silent.gain.value=0;worklet.connect(silent).connect(c.audio.destination);worklet.port.onmessage=ev=>{if(connection.current===c&&c.ready&&c.ws.readyState===WebSocket.OPEN){let binary='';for(const b of new Uint8Array(ev.data))binary+=String.fromCharCode(b);c.ws.send(JSON.stringify({type:'input.audio',audio:btoa(binary)}))}};setMicOn(true);setStatus('Listening');setError('')}catch{if(connection.current===c){setMicOn(false);setStatus('Connected');setError('Microphone permission was denied or unavailable. Enable it in browser permissions, or answer with the text box.')}}}

  function detachMicrophone(){const c=connection.current;if(!c)return;c.stream?.getTracks().forEach(t=>t.stop());c.stream=undefined;c.worklet?.disconnect();c.worklet=undefined;setMicOn(false);setStatus('Connected')}

  function normalizedEvaluation(raw:Record<string,unknown>):InterviewEvaluation{
    const number=Math.min(setupRef.current.questionCount,evaluationsRef.current.length+1);
    const verdict=verdicts.includes(raw.verdict as Verdict)?raw.verdict as Verdict:'Unclear';
    const score=Math.max(0,Math.min(100,Math.round(typeof raw.score==='number'?raw.score:Number(raw.score)||0)));
    const difficulty=difficulties.includes(raw.difficulty as InterviewDifficulty)?raw.difficulty as InterviewDifficulty:setupRef.current.difficulty;
    const nextDifficulty=difficulties.includes(raw.next_difficulty as InterviewDifficulty)?raw.next_difficulty as InterviewDifficulty:difficulty;
    return {id:crypto.randomUUID(),questionNumber:number,question:clean(raw.question,questionRef.current||`Question ${number}`,2000),answer:clean(latestAnswer.current,'No transcript captured.',2000),answerSummary:clean(raw.answer_summary,latestAnswer.current||'No summary provided.',1600),verdict,score,correctPoints:list(raw.correct_points),missingPoints:list(raw.missing_points),feedback:clean(raw.feedback,'Review the model answer and try the concept again.',2000),modelAnswer:clean(raw.model_answer,'A model answer was not provided.',2500),topic:clean(raw.topic,setupRef.current.topic,100),difficulty,weakTopics:list(raw.weak_topics),nextQuestion:number<setupRef.current.questionCount?clean(raw.next_question,'',2000):'',nextDifficulty};
  }

  function saveToolCall(call:ToolCall,c:Connection){
    if(call.name!=='record_interview_evaluation'){
      c.ws.send(JSON.stringify({type:'tool.result',call_id:call.call_id,result:JSON.stringify({saved:false,error:'Unknown tool'}),is_error:true}));return;
    }
    if(evaluationsRef.current.length>=setupRef.current.questionCount){c.ws.send(JSON.stringify({type:'tool.result',call_id:call.call_id,result:JSON.stringify({saved:false,interview_complete:true,error:'The configured question count is already complete.'}),is_error:false}));return}
    const evaluation=normalizedEvaluation(call.arguments||{});
    const next=[...evaluationsRef.current,evaluation];
    evaluationsRef.current=next;
    setEvaluations(next);
    if(evaluation.nextQuestion){questionRef.current=evaluation.nextQuestion;setCurrentQuestion(evaluation.nextQuestion)}
    if(next.length>=setupRef.current.questionCount)finishing.current=true;
    c.ws.send(JSON.stringify({type:'tool.result',call_id:call.call_id,result:JSON.stringify({saved:true,evaluations_completed:next.length,questions_remaining:Math.max(0,setupRef.current.questionCount-next.length),interview_complete:next.length>=setupRef.current.questionCount}),is_error:false}));
  }

  function finishInterview(){
    if(completed.current)return;
    completed.current=true;
    const c=connection.current;
    const started=c?.started||Date.now();
    const result:InterviewResult={...setupRef.current,startedAt:new Date(started).toISOString(),finishedAt:new Date().toISOString(),minutes:Math.max(.1,Math.round((Date.now()-started)/6000)/10),messages:[...messagesRef.current],evaluations:[...evaluationsRef.current]};
    endConnection();stopCamera();setReport(result);setPhase('report');setStatus('Complete');setPartial('');setBusy(false);setElapsed(Math.floor((Date.now()-started)/1000));
    if(result.evaluations.length)callback.current(result);
  }

  function fail(message:string,returnToSetup=false){endConnection();if(returnToSetup)stopCamera();if(!mounted.current)return;setError(message);setBusy(false);setStatus('Error');if(returnToSetup)setPhase('setup')}

  async function startInterview(){
    const topic=setup.topic.trim();
    if(topic.length<2){setError('Enter the topic, role, or subject you want to practice.');return}
    generation.current++;const run=generation.current;
    endConnection();stopCamera();
    setupRef.current={...setup,topic};setSetup(setupRef.current);messagesRef.current=[];evaluationsRef.current=[];questionRef.current='';latestAnswer.current='';finishing.current=false;completed.current=false;
    setMessages([]);setEvaluations([]);setCurrentQuestion('');setPartial('');setText('');setError('');setElapsed(0);setBusy(true);setPhase('connecting');setStatus('Connecting');setReport(null);
    if(setup.camera)void startCamera();
    let audio:AudioContext|undefined;
    try{
      audio=new AudioContext();await audio.resume();
      const response=await fetch('/api/interview/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...setupRef.current,weakTopics:weakTopics.slice(0,10)}),signal:AbortSignal.timeout(20000)});
      const data=await response.json() as TokenPayload;
      if(run!==generation.current){void audio.close();return}
      if(!response.ok)throw new Error(data.error||'The interviewer could not start.');
      if(!data.token||!data.session||typeof data.session.system_prompt!=='string'||typeof data.firstQuestion!=='string')throw new Error('The interviewer returned an incomplete session. Please retry.');
      const gain=audio.createGain();gain.gain.value=muteRef.current?0:1;gain.connect(audio.destination);
      const ws=new WebSocket('wss://agents.assemblyai.com/v1/ws?token='+encodeURIComponent(data.token));
      const c:Connection={ws,audio,gain,nodes:new Set(),ready:false,started:0,playback:0,basePrompt:data.session.system_prompt,pending:[]};
      connection.current=c;
      questionRef.current=data.firstQuestion;setCurrentQuestion(data.firstQuestion);
      const valid=()=>run===generation.current&&connection.current===c;
      c.timer=setTimeout(()=>{if(valid())fail('Connection timed out. Please retry with a fresh session.',true)},20000);
      ws.onopen=()=>{if(valid())ws.send(JSON.stringify({type:'session.update',session:data.session}))};
      ws.onerror=()=>{if(valid())fail('The interview connection failed. Check your network and retry.',true)};
      ws.onclose=()=>{if(valid()&&!completed.current)fail('The interview connection was lost. Your completed answers remain visible until you restart.')};
      ws.onmessage=async event=>{
        if(!valid())return;
        try{
          const m=JSON.parse(event.data);
          if(m.type==='session.ready'){
            clearTimeout(c.timer);c.ready=true;c.started=Date.now();c.playback=c.audio.currentTime;setBusy(false);setPhase('live');setStatus('Connected');void attachMicrophone(c,run);
          }else if(m.type==='input.speech.started'){
            c.nodes.forEach(n=>{try{n.stop()}catch{}});c.nodes.clear();c.playback=c.audio.currentTime;setStatus('Listening');
          }else if(m.type==='input.speech.stopped'){setStatus('Processing');setBusy(true)}
          else if(m.type==='transcript.user.delta'){setPartial(m.text||'')}
          else if(m.type==='transcript.user'){
            setPartial('');if(m.text){latestAnswer.current=m.text;pushMessage({role:'user',text:m.text})}setStatus('Processing');setBusy(true);
          }else if(m.type==='reply.started'){
            setStatus('Processing');setBusy(true);clearTimeout(c.timer);c.timer=setTimeout(()=>{if(valid())fail('The interviewer response timed out. End the session for your partial report or retry.')},60000);
          }else if(m.type==='reply.audio'){
            if(typeof m.data!=='string')throw new Error('Unexpected audio response.');const bytes=atob(m.data);if(bytes.length%2)throw new Error('Unexpected audio format.');const buffer=c.audio.createBuffer(1,bytes.length/2,24000);const floats=buffer.getChannelData(0);for(let i=0;i<floats.length;i++){let value=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);if(value>=32768)value-=65536;floats[i]=value/32768}const source=c.audio.createBufferSource();source.buffer=buffer;source.connect(c.gain);c.playback=Math.max(c.playback,c.audio.currentTime);source.start(c.playback);c.playback+=buffer.duration;c.nodes.add(source);setStatus('AI speaking');source.onended=()=>{c.nodes.delete(source);if(valid()&&!c.nodes.size&&!finishing.current)setStatus(c.stream?'Listening':'Connected')};
          }else if(m.type==='transcript.agent'){
            if(m.text&&!m.interrupted)pushMessage({role:'agent',text:m.text});
          }else if(m.type==='tool.call'){
            if(typeof m.call_id==='string')c.pending.push({call_id:m.call_id,name:String(m.name||''),arguments:m.arguments&&typeof m.arguments==='object'?m.arguments:{}});
          }else if(m.type==='reply.done'){
            clearTimeout(c.timer);setBusy(false);
            if(m.status==='interrupted'){c.pending=[];c.nodes.forEach(n=>{try{n.stop()}catch{}});c.nodes.clear();c.playback=c.audio.currentTime;setStatus(c.stream?'Listening':'Connected');return}
            if(c.pending.length){const calls=c.pending.splice(0);calls.forEach(call=>saveToolCall(call,c));setBusy(true);setStatus('Processing');c.timer=setTimeout(()=>{if(valid())fail('The interviewer could not finish its feedback. End the session for your partial report or retry.')},60000);return}
            if(finishing.current){const wait=Math.max(250,(c.playback-c.audio.currentTime)*1000+250);c.finishTimer=setTimeout(()=>{if(valid())finishInterview()},wait);return}
            if(!c.nodes.size)setStatus(c.stream?'Listening':'Connected');
          }else if(m.type==='session.ended'){if(!completed.current)finishInterview()}
          else if(m.type==='session.error'||m.type==='error')fail(m.code==='unauthorized'?'Your temporary interview token expired or was rejected. Start a fresh session.':m.message||'The AI interviewer could not continue this session.');
        }catch{if(valid())fail('An unexpected voice response was received. End the session for your partial report or restart.')}
      };
    }catch(e){if(audio&&!connection.current)void audio.close();if(run===generation.current)fail((e as Error).name==='TimeoutError'?'The interview service timed out. Please retry.':(e as Error).message||'The AI interviewer could not start.',true)}
  }

  async function toggleMic(){const c=connection.current;if(!c?.ready)return;if(c.stream)detachMicrophone();else await attachMicrophone(c,generation.current)}
  function toggleSpeaker(){muteRef.current=!muted;setMuted(!muted);if(connection.current)connection.current.gain.gain.value=muted?1:0}
  function changeLanguage(value:string){const language=value as InterviewLanguage;setSetup(s=>({...s,language}));setupRef.current={...setupRef.current,language};const c=connection.current;if(c?.ready&&c.ws.readyState===WebSocket.OPEN){const rule=language==='Auto detect'?'Detect and reply in the language of the candidate’s latest answer. Follow language switches without losing context.':`The candidate has selected ${language}. Use ${language} from the next reply unless they explicitly switch again.`;c.ws.send(JSON.stringify({type:'session.update',session:{system_prompt:`${c.basePrompt}\n\nCURRENT LANGUAGE OVERRIDE: ${rule}`}}))}}
  function sendText(){const value=text.trim(),c=connection.current;if(!value||busy||!c?.ready||c.ws.readyState!==WebSocket.OPEN)return;latestAnswer.current=value;pushMessage({role:'user',text:value});c.ws.send(JSON.stringify({type:'conversation.message',role:'user',content:value}));c.ws.send(JSON.stringify({type:'reply.create'}));setText('');setBusy(true);setStatus('Processing')}
  function reset(keepTopic=true){generation.current++;endConnection();stopCamera();messagesRef.current=[];evaluationsRef.current=[];questionRef.current='';latestAnswer.current='';finishing.current=false;completed.current=false;setMessages([]);setEvaluations([]);setCurrentQuestion('');setPartial('');setText('');setError('');setElapsed(0);setReport(null);setStatus('Idle');setPhase('setup');if(!keepTopic)setSetup(s=>({...s,topic:'',camera:false}))}

  if(phase==='setup')return <InterviewSetup setup={setup} setSetup={setSetup} error={error} assembly={assembly} busy={busy} onStart={()=>void startInterview()}/>;
  if(phase==='report'&&report)return <InterviewReport report={report} onPractice={()=>reset(true)} onNew={()=>reset(false)}/>;

  const avatarState=status==='AI speaking'?'speaking':status==='Listening'?'listening':status==='Processing'||status==='Connecting'?'thinking':'idle';
  const lastEvaluation=evaluations.at(-1);
  return <>
    <div className="page-heading"><div><span className="eyebrow">LIVE MOCK INTERVIEW</span><h1>{setup.type}</h1><p>{setup.topic} · {setup.difficulty} · Answer by voice or text.</p></div><span className="pill"><span className="live-dot"/>Live AI</span></div>
    <div className="interview-live-grid">
      <section className="panel interview-stage">
        <div className="interview-statusbar"><span>Question {Math.min(evaluations.length+1,setup.questionCount)} of {setup.questionCount}</span><Progress value={evaluations.length/setup.questionCount*100}/><span><Clock3 size={14}/>{formatTime(elapsed)}</span></div>
        <div className={`interviewer-avatar ${avatarState}`} aria-label={`AI interviewer is ${avatarState}`}>
          <div className="avatar-halo"/><div className="avatar-core"><Bot size={60}/><span className="avatar-eyes"><i/><i/></span></div><div className="avatar-state-label">{avatarState==='speaking'?'AI speaking':avatarState==='listening'?'Listening':avatarState==='thinking'?'Thinking':'Ready'}</div>
          <Wave active={avatarState==='speaking'||avatarState==='listening'}/>
        </div>
        {cameraOn&&<div className="candidate-camera"><video ref={videoRef} autoPlay playsInline muted/><span>Your camera · preview only</span></div>}
        <div className="current-question" aria-live="polite"><span>CURRENT QUESTION</span><h2>{currentQuestion||'Preparing your first question…'}</h2></div>
        <div className="interview-controls">
          <button className={micOn?'round-control active':'round-control'} onClick={()=>void toggleMic()} aria-label={micOn?'Turn microphone off':'Turn microphone on'}>{micOn?<Mic size={20}/>:<MicOff size={20}/>}</button>
          <button className={cameraOn?'round-control active':'round-control'} onClick={()=>cameraOn?stopCamera():void startCamera()} aria-label={cameraOn?'Turn camera off':'Turn camera on'}>{cameraOn?<Camera size={20}/>:<CameraOff size={20}/>}</button>
          <button className={muted?'round-control':'round-control active'} onClick={toggleSpeaker} aria-label={muted?'Unmute interviewer':'Mute interviewer'}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>
          <button className="button interview-end" onClick={finishInterview}><Square size={16}/>End interview</button>
        </div>
        {error&&<div className="notice error" role="alert">{error}</div>}
        <form className="message-form interview-answer" onSubmit={e=>{e.preventDefault();sendText()}}><textarea aria-label="Type your interview answer" value={text} onChange={e=>setText(e.target.value)} placeholder="Type your answer if you prefer not to speak…" maxLength={2000} rows={2}/><button className="send-button" aria-label="Send answer" disabled={busy||!text.trim()}><Send size={19}/></button></form>
        <p className="voice-privacy"><ShieldCheck size={13}/>Camera is optional and local preview only. Evaluation uses answer content—not appearance, accent, or identity. Voice is processed by AssemblyAI. <Link href="/privacy">Privacy details</Link></p>
      </section>
      <aside className="interview-side">
        <section className="panel"><div className="between"><h3>Session</h3><span className="pill">{status}</span></div><Choice label="Response language" value={setup.language} options={[...interviewLanguages]} onChange={changeLanguage}/><div className="session-facts"><span><BrainCircuit size={15}/>{setup.difficulty} start</span><span><FileText size={15}/>{evaluations.length} answers evaluated</span></div></section>
        {lastEvaluation&&<section className={`panel instant-feedback ${lastEvaluation.verdict.toLowerCase().replace(' ','-')}`}><span className="eyebrow">LAST ANSWER</span><div className="between"><h3>{lastEvaluation.verdict}</h3><strong>{lastEvaluation.score}%</strong></div><p>{lastEvaluation.feedback}</p></section>}
        <section className="panel transcript-panel"><div className="between"><h3>Live transcript</h3><span>{messages.length}</span></div><div className="interview-transcript" aria-live="polite">{messages.length?messages.map((m,i)=><div className={'transcript-line '+m.role} key={i}><span>{m.role==='user'?'YOU':'INTERVIEWER'}</span><p dir="auto">{m.text}</p></div>):<p className="small-copy">The transcript will appear here when the session begins.</p>}{partial&&<div className="transcript-line user partial"><span>LISTENING</span><p dir="auto">{partial}</p></div>}</div></section>
      </aside>
    </div>
  </>;
}

function InterviewSetup({setup,setSetup,error,assembly,busy,onStart}:{setup:Setup;setSetup:React.Dispatch<React.SetStateAction<Setup>>;error:string;assembly:boolean;busy:boolean;onStart:()=>void}){
  return <>
    <div className="page-heading"><div><span className="eyebrow">PRACTICE BEFORE IT COUNTS</span><h1>AI Interviewer</h1><p>Run a realistic voice-first mock interview on any subject, role, or academic topic.</p></div><span className="pill"><BrainCircuit size={14}/>Adaptive questions</span></div>
    <div className="interview-setup-grid">
      <section className="panel interview-setup-card">
        <h2>Set up your interview</h2><p>Choose the format and tell the interviewer what you want to practise.</p>
        <div className="form-grid"><Choice label="Interview type" value={setup.type} options={[...interviewTypes]} onChange={v=>setSetup(s=>({...s,type:v as InterviewType}))}/><Choice label="Language" value={setup.language} options={[...interviewLanguages]} onChange={v=>setSetup(s=>({...s,language:v as InterviewLanguage}))}/></div>
        <label className="field"><span>Topic, subject, course, or job role</span><input value={setup.topic} onChange={e=>setSetup(s=>({...s,topic:e.target.value.slice(0,100)}))} placeholder="For example: Python, Biology, HR, IELTS, Data Analyst" maxLength={100} required/><small>Use any custom topic. Questions will be generated from this, not a fixed list.</small></label>
        <div className="topic-suggestions" aria-label="Suggested topics">{topicIdeas.map(topic=><button type="button" key={topic} onClick={()=>setSetup(s=>({...s,topic}))}>{topic}</button>)}</div>
        <fieldset className="interview-options"><legend>Difficulty</legend><div>{interviewDifficulties.map(level=><button type="button" className={setup.difficulty===level?'selected':''} aria-pressed={setup.difficulty===level} key={level} onClick={()=>setSetup(s=>({...s,difficulty:level}))}>{level}</button>)}</div></fieldset>
        <fieldset className="interview-options"><legend>Number of questions</legend><div>{([5,10,15] as const).map(count=><button type="button" className={setup.questionCount===count?'selected':''} aria-pressed={setup.questionCount===count} key={count} onClick={()=>setSetup(s=>({...s,questionCount:count}))}>{count} questions</button>)}</div></fieldset>
        <div className="camera-choice"><div><strong>Camera preview</strong><p>Optional and never used for scoring.</p></div><Switch checked={setup.camera} onCheckedChange={camera=>setSetup(s=>({...s,camera}))} aria-label="Enable optional camera preview"/></div>
        {error&&<div className="notice error" role="alert">{error}</div>}
        {!assembly&&<div className="notice">AI Interviewer needs a valid AssemblyAI API key and Voice Agent access.</div>}
        <button className="button full interview-start" disabled={busy||setup.topic.trim().length<2} onClick={onStart}>{busy?'Preparing interview…':'Start AI interview'}<ArrowRight size={17}/></button>
      </section>
      <aside className="panel interview-preview"><div className="mini-interviewer"><Bot size={48}/><span>EDUVOICE INTERVIEWER</span></div><h2>Dynamic, not scripted.</h2><p>Each new question responds to what you just said. Strong answers raise the challenge; gaps lead to a focused follow-up.</p><div className="interview-benefits"><span><Check/>Semantic answer evaluation</span><span><Check/>English, Urdu, and Urdu-English</span><span><Check/>Voice with typing fallback</span><span><Check/>Detailed report after the session</span><span><Check/>Weak answers saved for revision</span></div><div className="notice"><ShieldCheck size={16}/>Only your answer content is evaluated. Camera appearance and accent are never scored.</div></aside>
    </div>
  </>;
}

function InterviewReport({report,onPractice,onNew}:{report:InterviewResult;onPractice:()=>void;onNew:()=>void}){
  const answered=report.evaluations.length;
  const average=answered?Math.round(report.evaluations.reduce((sum,item)=>sum+item.score,0)/answered):0;
  const correct=report.evaluations.filter(x=>x.verdict==='Correct').length;
  const partiallyCorrect=report.evaluations.filter(x=>x.verdict==='Partially Correct').length;
  const incorrect=report.evaluations.filter(x=>x.verdict==='Incorrect').length;
  const unclear=report.evaluations.filter(x=>x.verdict==='Unclear').length;
  const strengths=unique(report.evaluations.flatMap(x=>x.correctPoints));
  const weak=unique(report.evaluations.flatMap(x=>[...x.weakTopics,...x.missingPoints]));
  const label=!answered?'Interview ended before an answer was evaluated':average>=85?'Interview ready':average>=70?'Strong foundation':average>=50?'Developing well':'More practice recommended';
  return <>
    <div className="page-heading"><div><span className="eyebrow">INTERVIEW REPORT</span><h1>{label}</h1><p>{report.type} · {report.topic} · {report.difficulty} · {answered} of {report.questionCount} answers · {formatTime(Math.round(report.minutes*60))}</p></div><span className="pill">Completed {new Date(report.finishedAt).toLocaleDateString()}</span></div>
    <div className="report-hero panel"><div className="report-score"><strong>{average}%</strong><span>average score</span></div><div><h2>{answered?`You completed ${answered} evaluated answer${answered===1?'':'s'}.`:'Your setup is ready for another attempt.'}</h2><p>{answered?average>=70?'Your answers show useful understanding. Review the targeted gaps below, then repeat the interview to practise clearer, more complete responses.':'Use the model answers and improvement notes below as a focused practice plan, then try again.':'No answer was scored, so nothing was added to progress or the Mistake Notebook.'}</p></div><div className="report-summary-grid"><span><strong>{correct}</strong>Correct</span><span><strong>{partiallyCorrect}</strong>Partially correct</span><span><strong>{incorrect}</strong>Incorrect</span><span><strong>{unclear}</strong>Unclear</span></div></div>
    <div className="dashboard-grid">
      <section className="panel"><h3>What went well</h3>{strengths.length?strengths.map((item,i)=><div className="report-list-row" key={i}><CheckCircle2/><span>{item}</span></div>):<p className="small-copy">Complete more answers to identify consistent strengths.</p>}</section>
      <section className="panel"><h3>Recommended practice</h3>{weak.length?weak.map((item,i)=><div className="report-list-row weak" key={i}><AlertTriangle/><span>{item}</span></div>):<p className="small-copy">No major gaps were recorded. Practise at the next difficulty level.</p>}<p className="small-copy">Incorrect and significantly incomplete answers are added to your Mistake Notebook. This interview also contributes to your progress score.</p></section>
    </div>
    <section className="panel interview-breakdown"><div className="between"><div><span className="eyebrow">QUESTION BREAKDOWN</span><h2>Answer-by-answer feedback</h2></div><BarChart3/></div>{report.evaluations.length?report.evaluations.map(item=><article className="evaluation-card" key={item.id}><div className="between"><span className="pill">Question {item.questionNumber} · {item.difficulty}</span><span className={`verdict ${item.verdict.toLowerCase().replace(' ','-')}`}>{item.verdict} · {item.score}%</span></div><h3>{item.question}</h3><div className="evaluation-answer"><span>YOUR ANSWER</span><p>{item.answer}</p></div><div className="evaluation-grid"><div><strong>Feedback</strong><p>{item.feedback}</p>{item.correctPoints.length>0&&<ul>{item.correctPoints.map((point,i)=><li key={i}>{point}</li>)}</ul>}</div><div><strong>Stronger answer</strong><p>{item.modelAnswer}</p>{item.missingPoints.length>0&&<small>Review: {item.missingPoints.join(' · ')}</small>}</div></div></article>):<div className="empty-note"><FileText/><p>No evaluated answers in this session.</p></div>}</section>
    {report.messages.length>0&&<details className="panel report-transcript"><summary>View full interview transcript</summary>{report.messages.map((message,i)=><div className={'transcript-line '+message.role} key={i}><span>{message.role==='user'?'YOU':'INTERVIEWER'}</span><p>{message.text}</p></div>)}</details>}
    <div className="report-actions"><button className="button" onClick={onPractice}><RotateCcw size={17}/>Practise this interview again</button><button className="button secondary" onClick={onNew}>Set up a new interview <ArrowRight size={17}/></button>{weak.length>0&&<Link className="quiet-button" href="/mistakes">Open Mistake Notebook</Link>}</div>
  </>;
}
