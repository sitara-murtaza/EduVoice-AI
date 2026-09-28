'use client';

import {useEffect,useRef} from 'react';

const STAR_COLORS=['#f5f3ff','#ede9fe','#c4b5fd','#a78bfa'];

export default function TwinklingStarsCursor(){
  const layer=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const root=layer.current;
    const finePointer=window.matchMedia('(pointer: fine)');
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    if(!root||!finePointer.matches||reducedMotion.matches)return;

    let frame=0;
    let queued:PointerEvent|null=null;
    let lastX=-100;
    let lastY=-100;

    const makeStar=(x:number,y:number,burst=false)=>{
      if(root.childElementCount>=24)return;
      const star=document.createElement('span');
      const size=burst?10+Math.random()*8:7+Math.random()*7;
      star.className='cursor-star';
      star.textContent=Math.random()>.28?'✦':'✧';
      star.style.left=`${x+(Math.random()-.5)*(burst?18:7)}px`;
      star.style.top=`${y+(Math.random()-.5)*(burst?18:7)}px`;
      star.style.fontSize=`${size}px`;
      star.style.color=STAR_COLORS[Math.floor(Math.random()*STAR_COLORS.length)];
      star.style.setProperty('--star-x',`${(Math.random()-.5)*(burst?46:30)}px`);
      star.style.setProperty('--star-y',`${-12-Math.random()*(burst?38:25)}px`);
      star.style.setProperty('--star-rotate',`${Math.round((Math.random()-.5)*160)}deg`);
      star.style.setProperty('--star-life',`${620+Math.round(Math.random()*380)}ms`);
      root.appendChild(star);
      star.addEventListener('animationend',()=>star.remove(),{once:true});
    };

    const draw=()=>{
      frame=0;
      const event=queued;
      queued=null;
      if(!event||document.documentElement.classList.contains('reduce-motion'))return;
      const distance=Math.hypot(event.clientX-lastX,event.clientY-lastY);
      if(distance<11)return;
      lastX=event.clientX;
      lastY=event.clientY;
      makeStar(event.clientX,event.clientY);
      if(Math.random()>.76)makeStar(event.clientX,event.clientY);
    };

    const onMove=(event:PointerEvent)=>{
      queued=event;
      if(!frame)frame=requestAnimationFrame(draw);
    };
    const onDown=(event:PointerEvent)=>{
      if(document.documentElement.classList.contains('reduce-motion'))return;
      for(let i=0;i<4;i++)makeStar(event.clientX,event.clientY,true);
    };

    window.addEventListener('pointermove',onMove,{passive:true});
    window.addEventListener('pointerdown',onDown,{passive:true});
    return()=>{
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerdown',onDown);
      if(frame)cancelAnimationFrame(frame);
      root.replaceChildren();
    };
  },[]);

  return <div ref={layer} className="star-cursor-layer" aria-hidden="true"/>;
}
