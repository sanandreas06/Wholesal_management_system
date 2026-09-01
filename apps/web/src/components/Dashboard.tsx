'use client';
import {useEffect,useMemo,useState} from "react";
import {Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {useRouter} from "next/navigation";
import AppShell from "./AppShell";
import {api} from "../lib/api";
type Summary={kpis:{totalSales:number;inventoryValue:number;products:number;lowStock:number};salesTrend:{date:string;amount:number}[];branchPerformance:{branch:string;amount:number}[]};
const money=new Intl.NumberFormat("en-GH",{style:"currency",currency:"GHS"});
export default function Dashboard(){
 const router=useRouter(); const [s,setS]=useState<Summary|null>(null); const [error,setError]=useState("");
 useEffect(()=>{api.get<Summary>("/dashboard/summary").then(setS).catch(e=>setError(e.message))},[router]);
 const trend=useMemo(()=>s?.salesTrend.map(x=>({...x,label:x.date.slice(5)}))||[],[s]);
 return <AppShell title="Executive Dashboard">
  {error&&<div className="error">{error}</div>}
  {!s&&!error&&<p className="muted">Loading dashboard...</p>}
  {s&&<>
   <section className="kpis"><K title="Total Sales" value={money.format(s.kpis.totalSales)}/><K title="Inventory Value" value={money.format(s.kpis.inventoryValue)}/><K title="Products" value={String(s.kpis.products)}/><K title="Low Stock Items" value={String(s.kpis.lowStock)}/></section>
   <section className="charts"><article className="panel"><h2>Sales Trend</h2><p className="muted">Database-backed demonstration data</p><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" strokeWidth={3}/></LineChart></ResponsiveContainer></div></article><article className="panel"><h2>Branch Performance</h2><p className="muted">Sales by branch</p><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={s.branchPerformance}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="branch"/><YAxis/><Tooltip/><Bar dataKey="amount"/></BarChart></ResponsiveContainer></div></article></section>
  </>}
 </AppShell>;
}
function K({title,value}:{title:string;value:string}){return <article className="kpi"><p>{title}</p><strong>{value}</strong></article>}
