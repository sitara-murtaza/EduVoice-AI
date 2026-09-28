'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="entry-card"><h1>Let’s try that again.</h1><p>Your learning space could not load. Please retry, or return to the home page.</p><div className="hero-actions"><button className="button" onClick={reset}>Retry</button><a className="button secondary" href="/">Home</a></div></main>}
