'use client';
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {saveSession} from "../lib/session";
import {useTheme} from "../hooks/useTheme";
import Link from "next/link";
import SiteHeader from "./landing/SiteHeader";
import FloatField, {type FloatItem} from "./landing/FloatField";
import {WarehouseScene} from "./landing/InventoryArt";
import "./landing/landing.css";
import "./landing/auth.css";
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000/api";
// Optional, for a public demo only: a dedicated read-only demo account whose sign-in is shown on purpose. Nothing is shown or filled in unless both are set when the site is built.
const DEMO_EMAIL=process.env.NEXT_PUBLIC_DEMO_EMAIL||"", DEMO_PASSWORD=process.env.NEXT_PUBLIC_DEMO_PASSWORD||"";
const ART_ITEMS:FloatItem[]=[{art:"box",x:"82%",y:"8%",w:70,depth:26,dur:7},{art:"tag",x:"87%",y:"27%",w:48,depth:34,dur:6,delay:.5},{chip:{text:"Low stock alert · Roofing nails",tone:"bad"},x:"50%",y:"42%",depth:40,dur:6.8,delay:.9},{chip:{text:"Transfer received",tone:"ok"},x:"6%",y:"58%",depth:36,dur:7.2,delay:.3},{art:"scanner",x:"88%",y:"72%",w:58,depth:24,dur:8,delay:1.1}];
export default function LoginForm(){
 const router=useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [slow,setSlow]=useState(false); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 const {theme,toggle}=useTheme();
 // free hosting puts the server to sleep when idle: wake it as soon as this page opens, and explain a slow first sign-in
 useEffect(()=>{fetch(`${API}/health`).catch(()=>{})},[]);
 useEffect(()=>{if(!loading){setSlow(false);return}const t=setTimeout(()=>setSlow(true),4000);return()=>clearTimeout(t)},[loading]);
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");try{const r=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Login failed");saveSession(d.accessToken,d.user);router.push("/dashboard");}catch(e){setError(e instanceof Error?e.message:"Login failed")}finally{setLoading(false)}}
 return <div className="au">
  <SiteHeader/>
  <div className="au-grid">
   <aside className="au-art" aria-label="About WHOLESTRA">
    <FloatField items={ART_ITEMS}/>
    <div className="au-art-in">
     <p className="au-eyebrow">Wholesale management for every branch</p>
     <h2>Know what you have, in every branch.</h2>
     <p>Stock, sales and money in one clear picture, with a record nobody can quietly rewrite.</p>
     <WarehouseScene className="au-scene"/>
    </div>
   </aside>
   <main className="au-pane">
    <button className="theme-toggle au-theme" onClick={toggle} aria-label="Toggle dark mode">{theme==="light"?"🌙":"☀️"}</button>
    <section className="card au-card"><h1>Welcome back</h1><p className="muted">Sign in to your WHOLESTRA workspace.</p><form onSubmit={submit}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="username" required/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>{error&&<div className="error" role="alert">{error}</div>}{slow&&<p className="muted" role="status">The server is waking up after being idle. This can take up to a minute the first time.</p>}<button disabled={loading}>{loading?"Signing in...":"Sign in"}</button></form>{DEMO_EMAIL&&DEMO_PASSWORD&&<small>Demo account (read-only): {DEMO_EMAIL} / {DEMO_PASSWORD} <button type="button" className="secondary" onClick={()=>{setEmail(DEMO_EMAIL);setPassword(DEMO_PASSWORD)}}>Fill in</button></small>}<p className="au-help">Not signed up yet? Ask your owner or administrator to add you. Or <Link href="/">look around the home page</Link> first.</p></section>
   </main>
  </div>
 </div>
}
