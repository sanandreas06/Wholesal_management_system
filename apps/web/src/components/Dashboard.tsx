'use client';
import {useEffect,useMemo,useState} from "react";
import {Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {useRouter} from "next/navigation";
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000/api";
type Summary={kpis:{totalSales:number;inventoryValue:number;products:number;lowStock:number};salesTrend:{date:string;amount:number}[];branchPerformance:{branch:string;amount:number}[]};
const money=new Intl.NumberFormat("en-GH",{style:"currency",currency:"GHS"});
export default function Dashboard(){
 const router=useRouter(); const [s,setS]=useState<Summary|null>(null); const [error,setError]=useState("");
 useEffect(()=>{const token=localStorage.getItem("wms_access_token");if(!token){router.replace("/login");return;}fetch(`${API}/dashboard/summary`,{headers:{Authorization:`Bearer ${token}`}}).then(async r=>{if(!r.ok)throw new Error("Unable to load dashboard");return r.json()}).then(setS).catch(e=>setError(e.message))},[router]);
 const trend=useMemo(()=>s?.salesTrend.map(x=>({...x,label:x.date.slice(5)}))||[],[s]);
 if(error)return <main className="shell"><div className="error">{error}</div></main>;
 if(!s)return <main className="shell">Loading dashboard...</main>;
 return <main className="shell"><header><div><p className="eyebrow">WHOLESALE MANAGEMENT SYSTEM</p><h1>Executive Dashboard</h1></div><button className="secondary" onClick={()=>{localStorage.clear();router.replace("/login")}}>Sign out</button></header><section className="kpis"><K title="Total Sales" value={money.format(s.kpis.totalSales)}/><K title="Inventory Value" value={money.format(s.kpis.inventoryValue)}/><K title="Products" value={String(s.kpis.products)}/><K title="Low Stock Items" value={String(s.kpis.lowStock)}/></section><section className="charts"><article className="panel"><h2>Sales Trend</h2><p className="muted">Database-backed demonstration data</p><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" strokeWidth={3}/></LineChart></ResponsiveContainer></div></article><article className="panel"><h2>Branch Performance</h2><p className="muted">Sales by branch</p><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={s.branchPerformance}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="branch"/><YAxis/><Tooltip/><Bar dataKey="amount"/></BarChart></ResponsiveContainer></div></article></section></main>
}
function K({title,value}:{title:string;value:string}){return <article className="kpi"><p>{title}</p><strong>{value}</strong></article>}