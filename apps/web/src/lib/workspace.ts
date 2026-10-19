/** Workspace addresses. Every page inside the app carries the company's workspace ID, so a copied link says which company it belongs to:
 *    /w/acmetrader-k7f2/sales
 *  The pages themselves still live at /sales; middleware.ts maps the longer address onto them. */

const RE = /^\/w\/([a-z0-9-]{2,40})(\/.*)?$/i;

/** "/w/acme-k7f2/sales" -> { ws: "acme-k7f2", path: "/sales" }; "/sales" -> { ws: null, path: "/sales" }. */
export function splitWorkspace(pathname: string | null | undefined): { ws: string | null; path: string } {
  const p = pathname || "/";
  const m = p.match(RE);
  return m ? { ws: m[1].toLowerCase(), path: m[2] || "/dashboard" } : { ws: null, path: p };
}

/** "/sales" + "acme-k7f2" -> "/w/acme-k7f2/sales". */
export function withWorkspace(path: string, ws: string) {
  return `/w/${ws}${path.startsWith("/") ? path : `/${path}`}`;
}
