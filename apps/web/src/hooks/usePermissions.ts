'use client';
import { useEffect, useState } from "react";
import { getSessionUser } from "../lib/session";

export function usePermissions(...permissions: string[]): boolean[] {
  const [flags, setFlags] = useState<boolean[]>(permissions.map(() => false));
  useEffect(() => {
    const user = getSessionUser();
    setFlags(permissions.map(p => !!user?.permissions.includes(p)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return flags;
}