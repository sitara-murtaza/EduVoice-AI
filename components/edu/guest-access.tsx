'use client';

import { useEffect, useRef, useState } from 'react';

type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'error-callback': () => void }) => string;
  remove: (id: string) => void;
};

export default function GuestAccess({siteKey,onReady}:{siteKey?:string|null;onReady:()=>void}) {
  const container=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [checking,setChecking]=useState(true);

  useEffect(()=>{
    let alive=true;
    fetch('/api/guest/status').then(r=>r.json() as Promise<{active:boolean}>).then(data=>{
      if(!alive)return;
      if(data.active)onReady(); else setChecking(false);
    }).catch(()=>{if(alive){setError('Could not check guest access. Please reload.');setChecking(false)}});
    return()=>{alive=false};
  },[onReady]);

  useEffect(()=>{
    if(checking||!siteKey||!container.current)return;
    let removed=false;
    let widget:string|undefined;
    const render=()=>{
      if(removed||!container.current||widget)return;
      const turnstile=(window as unknown as {turnstile?:Turnstile}).turnstile;
      if(!turnstile)return;
      widget=turnstile.render(container.current,{
        sitekey:siteKey,
        callback:async token=>{
          try{
            const response=await fetch('/api/guest/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
            const data=await response.json() as {error?:string};
            if(!response.ok)throw new Error(data.error||'Verification failed.');
            if(!removed)onReady();
          }catch(e){if(!removed)setError((e as Error).message)}
        },
        'error-callback':()=>{if(!removed)setError('Human verification could not load. Please reload.')},
      });
    };
    let script=document.querySelector<HTMLScriptElement>('script[data-edu-turnstile]');
    if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.dataset.eduTurnstile='true';document.head.appendChild(script)}
    script.addEventListener('load',render);
    render();
    return()=>{removed=true;script?.removeEventListener('load',render);if(widget)(window as unknown as {turnstile?:Turnstile}).turnstile?.remove(widget)};
  },[checking,siteKey,onReady]);

  return <main className="entry"><section className="entry-card onboarding">
    <h1>One quick check</h1>
    <p>Complete this check to use the live AI features. You do not need an account.</p>
    {checking?<p>Checking access…</p>:siteKey?<div ref={container}/>:<p>Guest access is not configured yet. Please contact the site owner.</p>}
    {error&&<p role="alert" className="notice error">{error}</p>}
    {error&&<button className="button secondary" onClick={()=>location.reload()}>Try again</button>}
  </section></main>;
}
