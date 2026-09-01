'use client';
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
import {saveSession} from "../lib/session";
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000/api";
export default function LoginForm(){
 const router=useRouter(); const [email,setEmail]=useState("admin@wholesale.local"); const [password,setPassword]=useState("Admin@12345"); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");try{const r=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Login failed");saveSession(d.accessToken,d.user);router.push("/dashboard");}catch(e){setError(e instanceof Error?e.message:"Login failed")}finally{setLoading(false)}}
 return <main className="auth"><section className="card"><div className="mark">W</div><p className="eyebrow">WHOLESALE MANAGEMENT SYSTEM</p><h1>Welcome back</h1><p className="muted">Phase 1 administration dashboard.</p><form onSubmit={submit}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></label>{error&&<div className="error">{error}</div>}<button disabled={loading}>{loading?"Signing in...":"Sign in"}</button></form><small>Demo: admin@wholesale.local / Admin@12345</small></section></main>
}