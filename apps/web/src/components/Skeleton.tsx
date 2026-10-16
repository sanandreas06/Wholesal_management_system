/** Grey shimmer placeholders shown while data loads, so the page keeps its shape. */
export function Skeleton({ h = 16, w = "100%", r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="kpi5">{[0, 1, 2, 3, 4].map(i => <div key={i} className="kcard"><Skeleton h={14} w="55%" /><div style={{ height: 14 }} /><Skeleton h={26} w="70%" /><div style={{ height: 10 }} /><Skeleton h={12} w="45%" /></div>)}</div>
      <div className="g3 a">{[0, 1, 2].map(i => <div key={i} className="card2"><Skeleton h={16} w="40%" /><div style={{ height: 14 }} /><Skeleton h={170} r={10} /></div>)}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={18} /></div>)}
    </div>
  );
}
