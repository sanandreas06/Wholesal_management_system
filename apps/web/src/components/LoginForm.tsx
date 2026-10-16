'use client';
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {saveSession} from "../lib/session";
import {useTheme} from "../hooks/useTheme";
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000/api";
// Optional, for a public demo only: a dedicated read-only demo account whose sign-in is shown on purpose. Nothing is shown or filled in unless both are set when the site is built.
const DEMO_EMAIL=process.env.NEXT_PUBLIC_DEMO_EMAIL||"", DEMO_PASSWORD=process.env.NEXT_PUBLIC_DEMO_PASSWORD||"";
export default function LoginForm(){
 const router=useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [slow,setSlow]=useState(false); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 const {theme,toggle}=useTheme();
 // free hosting puts the server to sleep when idle: wake it as soon as this page opens, and explain a slow first sign-in
 useEffect(()=>{fetch(`${API}/health`).catch(()=>{})},[]);
 useEffect(()=>{if(!loading){setSlow(false);return}const t=setTimeout(()=>setSlow(true),4000);return()=>clearTimeout(t)},[loading]);
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");try{const r=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Login failed");saveSession(d.accessToken,d.user);router.push("/dashboard");}catch(e){setError(e instanceof Error?e.message:"Login failed")}finally{setLoading(false)}}
 return <main className="auth"><button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode" style={{position:"fixed",top:24,right:24}}>{theme==="light"?"🌙":"☀️"}</button><section className="card"><div className="mark">W</div><p className="eyebrow">WHOLESALE MANAGEMENT SYSTEM</p><h1>Welcome back</h1><p className="muted">Phase 1 administration dashboard.</p><form onSubmit={submit}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></label>{error&&<div className="error">{error}</div>}{slow&&<p className="muted" role="status">The server is waking up after being idle. This can take up to a minute the first time.</p>}<button disabled={loading}>{loading?"Signing in...":"Sign in"}</button></form>{DEMO_EMAIL&&DEMO_PASSWORD&&<small>Demo account (read-only): {DEMO_EMAIL} / {DEMO_PASSWORD} <button type="button" className="secondary" onClick={()=>{setEmail(DEMO_EMAIL);setPassword(DEMO_PASSWORD)}}>Fill in</button></small>}</section></main>
}