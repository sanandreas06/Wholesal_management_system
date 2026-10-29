'use client';
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export interface WorkBranch { id: string; name: string }

/** The branch this person is working at: their own branch, or the one they picked last time (remembered on this device). */
export function useWorkBranch() {
  const [branches, setBranches] = useState<WorkBranch[]>([]);
  const [branchId, setBranchIdState] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api.get<WorkBranch[]>("/branches?own=1").then(bs => {
      setBranches(bs);
      let saved = ""; try { saved = localStorage.getItem("wms_scan_branch") ?? localStorage.getItem("wms_counter_branch") ?? ""; } catch { /* ignore */ }
      setBranchIdState(bs.find(b => b.id === saved)?.id ?? bs[0]?.id ?? "");
    }).catch(() => setError("Could not load your branches. Check your connection and reload."));
  }, []);
  function setBranchId(id: string) { setBranchIdState(id); try { localStorage.setItem("wms_scan_branch", id); } catch { /* ignore */ } }
  return { branches, branchId, setBranchId, branchName: branches.find(b => b.id === branchId)?.name ?? "", error };
}
