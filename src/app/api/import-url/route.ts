import dns from "node:dns/promises";
import net from "node:net";
import { parseWebPage } from "@/lib/cite";


function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

async function assertPublic(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs are supported");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed");
  const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error("That address is not publicly reachable");
}

/** Fetch a public web page and extract card metadata with deterministic rules (no AI). */
export async function POST(req: Request) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) return Response.json({ error: "url required" }, { status: 400 });
    let u = new URL(url);
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      await assertPublic(u);
      res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "user-agent": "OpenFlowImporter/1.0", accept: "text/html" } });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u); continue; }
      break;
    }
    if (!res || !res.ok) return Response.json({ error: `Fetch failed (${res?.status ?? "no response"})` }, { status: 502 });
    if (!(res.headers.get("content-type") ?? "").includes("html")) return Response.json({ error: "That URL is not an HTML page" }, { status: 415 });
    const reader = res.body?.getReader();
    let html = "";
    let size = 0;
    const dec = new TextDecoder();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) { await reader.cancel(); break; }
      html += dec.decode(value, { stream: true });
    }
    return Response.json({ card: parseWebPage(html, u.toString()) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 400 });
  }
}
