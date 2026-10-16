'use client';
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface Notice { id: string; severity: "high" | "medium" | "low"; title: string; detail: string; href: string; count: number }
export interface NoticeData { total: number; badgeCount: number; notices: Notice[] }

/** Things needing attention, refreshed every minute and whenever the tab regains focus. */
export function useNotifications(): NoticeData {
  const [data, setData] = useState<NoticeData>({ total: 0, badgeCount: 0, notices: [] });
  useEffect(() => {
    let alive = true;
    const load = () => { api.get<NoticeData>("/notifications").then(d => { if (alive) setData(d); }).catch(() => {}); };
    load();
    const t = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);
  return data;
}
