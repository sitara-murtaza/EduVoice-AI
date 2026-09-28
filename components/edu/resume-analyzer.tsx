'use client';
import {useState} from 'react';
import {BriefcaseBusiness,Check,FileSearch,Lightbulb,LoaderCircle,Target,Upload} from 'lucide-react';
import type {Profile} from '@/lib/edu/content';

type Analysis={score:number;summary:string;suggestedHeadline:string;strengths:string[];improvements:string[];missingSkills:string[];actionPlan:string[]};

export default function ResumeAnalyzer({profile}:{profile:Profile}){
  const[targetRole,setTargetRole]=useState('');
  const[resume,setResume]=useState('');
  const[result,setResult]=useState<Analysis|null>(null);
  const[busy,setBusy]=useState(false);
  const[readingFile,setReadingFile]=useState(false);
  const[error,setError]=useState('');

  async function analyze(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');setResult(null);
    try{
      const response=await fetch('/api/resume/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetRole,resume,language:profile.language})});
      const data=await response.json() as Analysis&{error?:string};
      if(!response.ok)throw new Error(data.error||'Your resume could not be analyzed.');
      setResult(data);
    }catch(e){setError(e instanceof Error?e.message:'Your resume could not be analyzed.');}
    finally{setBusy(false)}
  }

  async function loadFile(file?:File){
    if(!file)return;
    if(file.size>5_000_000){setError('Please choose a resume file smaller than 5 MB.');return}
    setReadingFile(true);setError('');
    try{
      let text='';
      if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
        const[pdfjs,worker]=await Promise.all([import('pdfjs-dist/build/pdf.mjs'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
        pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
        const document=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        const pages:string[]=[];
        for(let pageNumber=1;pageNumber<=Math.min(document.numPages,50);pageNumber++){
          const page=await document.getPage(pageNumber);const content=await page.getTextContent();
          pages.push(content.items.map((item:{str?:string})=>'str' in item?item.str:'').join(' '));
        }
        text=pages.join('\n');
        if(text.trim().length<120)throw new Error('This PDF has little or no selectable text. Please paste the resume text instead.');
      }else if(/\.(txt|md)$/i.test(file.name)||file.type.startsWith('text/'))text=await file.text();
      else throw new Error('Please upload a PDF, TXT, or MD resume.');
      setResume(text.slice(0,15000));
      if(text.length>15000)setError('The resume was loaded, but only the first 15,000 characters will be analyzed.');
    }catch(e){setError(e instanceof Error?e.message:'The resume file could not be read. Please paste its text instead.');}
    finally{setReadingFile(false)}
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">CAREER CLARITY, ONE STEP AT A TIME</span><h1>Resume Analyzer</h1><p>Compare your resume with the role you want and get practical, beginner-friendly improvements.</p></div><span className="feature-icon"><FileSearch/></span></div>
    <div className="dashboard-grid resume-layout">
      <form className="panel" onSubmit={analyze}>
        <div className="between"><h3>Analyze your resume</h3><span className="pill">Private review</span></div>
        <label className="field">Target role<input required maxLength={100} value={targetRole} onChange={e=>setTargetRole(e.target.value)} placeholder="For example: AI Automation Specialist"/></label>
        <label className="field">Resume text<textarea required minLength={120} maxLength={15000} rows={14} value={resume} onChange={e=>setResume(e.target.value)} placeholder="Paste your resume here. Include your summary, education, skills, projects, and experience."/></label>
        <label className="button secondary resume-upload"><Upload size={17}/>{readingFile?'Reading resume…':'Upload PDF, TXT, or MD'}<input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" disabled={readingFile||busy} onChange={e=>void loadFile(e.target.files?.[0])}/></label>
        <p className="small-copy">PDF, TXT, and MD files up to 5 MB are supported. Scanned PDFs without selectable text must be pasted manually. Remove private details you do not want analyzed.</p>
        {error&&<div className="notice error" role="alert">{error}</div>}
        <button className="button full" disabled={busy||readingFile||resume.trim().length<120||!targetRole.trim()}>{busy?<><LoaderCircle className="spin" size={18}/>Analyzing your resume…</>:<><FileSearch size={18}/>Analyze resume</>}</button>
      </form>
      <aside>
        {!result?<section className="panel resume-empty"><BriefcaseBusiness size={34}/><h2>Make every line count.</h2><p>Your review will include a role-match score, strengths, missing skills, specific improvements, and a short action plan.</p><div className="resume-preview-list"><span><Check size={16}/> Clear, actionable feedback</span><span><Target size={16}/> Matched to your target role</span><span><Lightbulb size={16}/> No invented experience or skills</span></div></section>:<section className="panel resume-result" aria-live="polite">
          <div className="between"><div><span className="eyebrow">ROLE MATCH</span><h2>{targetRole}</h2></div><div className="resume-score"><strong>{result.score}</strong><span>/100</span></div></div>
          <p className="resume-summary">{result.summary}</p>
          <div className="resume-headline"><small>SUGGESTED HEADLINE</small><strong>{result.suggestedHeadline}</strong></div>
          <ResultList title="What is working" items={result.strengths}/>
          <ResultList title="Improve next" items={result.improvements}/>
          <ResultList title="Skills to strengthen" items={result.missingSkills}/>
          <ResultList title="Your action plan" items={result.actionPlan} numbered/>
          <button className="button secondary full" onClick={()=>setResult(null)}>Analyze another resume</button>
        </section>}
      </aside>
    </div>
  </>
}

function ResultList({title,items,numbered=false}:{title:string;items:string[];numbered?:boolean}){return <div className="resume-list"><h3>{title}</h3>{items.map((item,i)=><div className="list-row" key={item}><span className="resume-list-icon">{numbered?i+1:<Check size={15}/>}</span><p>{item}</p></div>)}</div>}
