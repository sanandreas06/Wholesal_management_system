'use client';
import { useEffect, useState } from "react";
import { authApi, AuthOptions, NO_OPTIONS } from "../../lib/authApi";

/** Asks the server what this site can do (email codes, which social providers). Also wakes a sleeping free-tier server early. */
export function useAuthOptions() {
  const [options, setOptions] = useState<AuthOptions>(NO_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let live = true;
    authApi.get<AuthOptions>("/auth/options").then((o) => { if (live) setOptions(o); }).catch(() => { if (live) setOffline(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  return { options, loading, offline };
}
