// ============================================================
//  PanCanAir — /api/lead
//  Vercel / Netlify / Cloudflare Pages serverless function.
//  Front-end calls this directly on form submit.
//  No webhooks. No CLI. Just deploy and set RESEND_API_KEY.
// ============================================================
//
//  DEPLOY:
//    1. Drop this file at /api/lead.js (Vercel) or /netlify/functions/lead.js (Netlify).
//    2. In your host's dashboard, add env var:
//         RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//       (and optionally FROM_EMAIL = "PanCanAir <leads@pancanair.com>")
//    3. Push. That's it. The form already calls /api/lead in the new index.html.
//
//  Pan will get an email at info@pancanair.com within ~3 seconds
//  of every form submission. The submitter gets an auto-reply if
//  they provided an email.
// ============================================================

// INTERNAL_EMAIL = where lead notifications go. Set this in Vercel env vars.
// Default = pancanair@gmail.com (works under Resend sandbox).
// After domain verification, change to "info@pancanair.com" (or any pancanair.com address).
const TO_INTERNAL = process.env.INTERNAL_EMAIL || "pancanair@gmail.com";
const FROM_EMAIL  = process.env.FROM_EMAIL || "PanCanAir <onboarding@resend.dev>";
// Until pancanair.com is verified in Resend, FROM_EMAIL falls back to
// onboarding@resend.dev (Resend's sandbox sender — no DNS needed).
// After domain verification, set FROM_EMAIL = "PanCanAir <leads@pancanair.com>"
// in your host's environment variables and redeploy.

const SUPABASE_URL  = "https://zfeewaswxkdiicegcsqz.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWV3YXN3eGtkaWljZWdjc3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzA5NjksImV4cCI6MjA5MTYwNjk2OX0.bRfFZlCHkPDqj5PBVnij9VM0gnWr9_eYYpHayB-GsPI";

// ---- helpers ----
const safe = (v) =>
  String(v ?? "&mdash;").replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;width:90px;color:rgba(26,23,20,.5);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;vertical-align:top">${label}</td>
    <td style="padding:8px 0;color:#1a1714;font-size:14px;vertical-align:top">${value || "&mdash;"}</td>
  </tr>`;
}

function internalHtml(r) {
  const isHot = (r.units || "").includes("500") || (r.units || "").includes("1,000");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f2ed;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-family:'DM Serif Display',Georgia,serif;font-size:30px;letter-spacing:-.02em;margin-bottom:6px">
      <b style="color:#1a1714">Pan</b><span style="color:#1D4EA0">Can</span><span style="color:#d94a2b">Air</span>
    </div>
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#d94a2b;margin-bottom:24px">
      ${isHot ? "&#128293; Priority lead &mdash; large building" : "New website lead"}
    </div>
    <div style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:20px;padding:28px 24px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <div style="font-family:'DM Serif Display',Georgia,serif;font-size:24px;line-height:1.15;margin-bottom:18px">
        ${safe(r.name) || "Anonymous lead"}
        ${r.company ? `<span style="display:block;font-style:italic;color:rgba(26,23,20,.55);font-size:18px;margin-top:2px">${safe(r.company)}</span>` : ""}
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
        ${row("Email",    r.email   ? `<a href="mailto:${safe(r.email)}" style="color:#d94a2b">${safe(r.email)}</a>`   : "&mdash;")}
        ${row("Phone",    r.phone   ? `<a href="tel:${safe(r.phone)}"   style="color:#d94a2b">${safe(r.phone)}</a>`   : "&mdash;")}
        ${row("Building", safe(r.building))}
        ${row("Units",    `<b>${safe(r.units)}</b>`)}
        ${row("Service",  safe(r.service))}
        ${row("Pain",     safe(r.pain))}
        ${row("Source",   safe(r.source || "website"))}
      </table>
      <div style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(0,0,0,.08);font-size:12px;color:rgba(26,23,20,.5)">
        Captured ${new Date(r.created_at || Date.now()).toLocaleString("en-CA", { timeZone: "America/Toronto" })} ET
      </div>
    </div>
    ${r.email ? `<div style="margin-top:18px;text-align:center">
      <a href="mailto:${safe(r.email)}?subject=Re:%20Your%20PanCanAir%20request"
         style="display:inline-block;background:#d94a2b;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:100px;text-decoration:none">
        Reply to ${safe((r.name || "").split(" ")[0] || "lead")} &rarr;
      </a>
    </div>` : ''}
  </div>
</body></html>`;
}

// ---- service-aware copy: each chip the user picks gets a tailored email body ----
const SERVICE_COPY = {
  "Maintenance Contract": {
    headline: "Let's lock in your maintenance plan.",
    intro: "You picked our flat-rate maintenance contract — the one most GTA property managers move to after their first surprise repair bill. Pan or a senior tech will reach out within <b>24 hours</b> with a one-page proposal grounded in real comps for buildings like yours.",
    nextLabel: "What happens next on your contract",
    next: [
      "We review your building size, system mix, and current pain points.",
      "We benchmark against the 20+ active GTA buildings we manage (1,100+ units serviced) to ground your flat rate.",
      "You get a one-page contract proposal — boilers, chillers, RTUs, MAUs, controls — all-in, no asterisks."
    ]
  },
  "24/7 Emergency Dispatch": {
    headline: "Emergency call received — we're on it.",
    intro: "If this is an active emergency right now, <b>call (437) 410-2100</b>. We dispatch a senior tech 24/7 across the GTA — average on-site response under 2 hours including nights, weekends, and holidays. Otherwise, Pan will reach out within the next business hour to confirm dispatch and timing.",
    nextLabel: "What happens next on your dispatch",
    next: [
      "We confirm building access, system, and severity.",
      "Senior tech rolls within 2 hours (most often under 90 min in core GTA).",
      "On-site diagnosis + same-day fix where possible. Flat-rate billing afterward."
    ]
  },
  "Free Building Audit": {
    headline: "Your free building audit is queued.",
    intro: "You requested our complimentary HVAC audit — no commitment, no pressure. We'll walk every system in your building, document deferred maintenance, and email you a one-page assessment with flat-rate options within <b>48 hours</b>.",
    nextLabel: "What happens during your audit",
    next: [
      "90-minute on-site walkthrough — boilers, chillers, MAUs, pumps, controls, RTUs.",
      "We photograph every system, log condition, and flag anything urgent.",
      "You get a board-ready PDF with flat-rate maintenance options. No upsell. Zero obligation."
    ]
  },
  "Boilers + Hydronic": {
    headline: "Boiler + hydronic specialist incoming.",
    intro: "Boilers are our specialty. Pan or a TSSA-licensed boiler tech will reach out within <b>24 hours</b> with a flat-rate proposal — covering the boiler, expansion tank, glycol loops, header isolation, three-way valves, and pressure-reducing setup.",
    nextLabel: "What we cover for boilers",
    next: [
      "Cast-iron, fire-tube, and condensing — we service every type the GTA runs.",
      "Annual TSSA inspection prep, log book updates, and pressure-vessel certs included.",
      "Flat-rate proposal grounded in real comps — no per-call surprise billing."
    ]
  },
  "Chillers + Cooling Towers": {
    headline: "Chiller specialist incoming.",
    intro: "Chillers + cooling towers — our wheelhouse. A senior chiller tech will reach out within <b>24 hours</b> with a proposal covering the chiller plant, cooling tower water treatment, condenser water loops, and BAS integration.",
    nextLabel: "What we cover for chillers",
    next: [
      "Air-cooled and water-cooled, scroll/screw/centrifugal — every variety.",
      "Cooling tower basin cleaning, fill replacement, ASHRAE 188 (Legionella) program.",
      "Annual plant tune + flat-rate maintenance. No per-call surprise billing."
    ]
  },
  "Rooftop Units (RTU)": {
    headline: "RTU + MAU specialist incoming.",
    intro: "Rooftop and makeup-air units — including the ones in stack penthouses everyone else avoids. Pan or a senior RTU tech will reach out within <b>24 hours</b> with a flat-rate proposal covering belt drives, economizers, refrigerant work, burner assemblies, and full controls integration.",
    nextLabel: "What we cover for RTUs / MAUs",
    next: [
      "Package units, MAUs, gas-fired heaters — penthouse and rooftop.",
      "Refrigerant recovery + recharge, burner tuning, damper service, sensor calibration.",
      "Flat-rate maintenance + emergency dispatch — one contract for everything."
    ]
  }
};
const DEFAULT_COPY = {
  headline: "We've got it.",
  intro: "Your request just landed in our queue. Pan or one of our senior techs will reach out within <b>24 hours</b> with a flat-rate proposal tailored to your building.",
  nextLabel: "What happens next",
  next: [
    "We review your building size, system mix, and current pain points.",
    "We pull comparable jobs in the GTA to ground the proposal in real numbers.",
    "You get a one-page flat-rate quote &mdash; boilers, chillers, RTUs, MAUs, controls, all-in."
  ]
};

function customerHtml(r) {
  const first = (r.name || "").split(" ")[0] || "there";
  const copy  = SERVICE_COPY[r.service] || DEFAULT_COPY;
  const summaryChip = (label) => `<span style="display:inline-block;background:rgba(217,74,43,.08);color:#d94a2b;font-size:11px;font-weight:700;letter-spacing:.06em;padding:5px 11px;border-radius:100px;margin-right:6px">${safe(label)}</span>`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f2ed;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="font-family:'DM Serif Display',Georgia,serif;font-size:30px;letter-spacing:-.02em;margin-bottom:32px">
      <b>Pan</b><span style="color:#1D4EA0">Can</span><span style="color:#d94a2b">Air</span>
    </div>
    <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:30px;line-height:1.12;letter-spacing:-.02em;margin:0 0 12px">
      Thanks, ${safe(first)}.
    </h1>
    <h2 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;line-height:1.2;font-style:italic;color:rgba(26,23,20,.7);margin:0 0 22px">${copy.headline}</h2>
    <div style="margin:0 0 22px">
      ${r.service ? summaryChip(r.service) : ''}
      ${r.units   ? summaryChip(r.units)   : ''}
    </div>
    <p style="font-size:16px;line-height:1.62;color:rgba(26,23,20,.82);margin:0 0 24px">
      ${copy.intro}
    </p>
    <div style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:20px 22px;margin:0 0 24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#d94a2b;margin-bottom:10px">${copy.nextLabel}</div>
      <ol style="margin:0;padding-left:18px;font-size:14px;line-height:1.65;color:rgba(26,23,20,.78)">
        ${copy.next.map(step => `<li style="margin-bottom:6px">${step}</li>`).join('')}
      </ol>
    </div>
    <p style="font-size:14px;color:rgba(26,23,20,.6);margin:0 0 6px">Need it sooner?</p>
    <p style="font-size:15px;margin:0 0 32px">
      Call <a href="tel:+14374102100" style="color:#d94a2b;font-weight:700">+1 (437) 410-2100</a> &mdash; 24/7 emergency dispatch.
    </p>
    <div style="border-top:1px solid rgba(0,0,0,.08);padding-top:20px;font-size:12px;color:rgba(26,23,20,.5);line-height:1.6">
      PanCanAir &middot; Toronto&ndash;GTA &middot; TSSA Licensed &middot; ASHRAE &middot; ACMO &middot; BOMA<br>
      info@pancanair.com &middot; pancanair.com
    </div>
  </div>
</body></html>`;
}

// ---- Resend sender ----
async function sendEmail({ to, subject, html, reply_to }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[/api/lead] RESEND_API_KEY missing");
    return { ok: false, error: "missing_api_key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: reply_to || TO_INTERNAL,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[/api/lead] Resend error", res.status, text);
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, status: res.status };
}

// ---- Supabase insert (best-effort; doesn't block email send) ----
async function saveToSupabase(row) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) console.warn("[/api/lead] Supabase insert failed", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.warn("[/api/lead] Supabase exception", e);
    return false;
  }
}

// ---- Handler — Vercel-compatible (also works on Netlify w/ default export) ----
export default async function handler(req, res) {
  // CORS — allow same-origin from pancanair.com
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      fn: "lead",
      has_key: !!process.env.RESEND_API_KEY,
      from: FROM_EMAIL,
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ ok: false, error: "no_body" });

  const lead = {
    name:     body.name     || "",
    email:    body.email    || "",
    company:  body.company  || "",
    phone:    body.phone    || "",
    building: body.building || "",
    units:    body.units    || "",
    service:  body.service  || "",
    pain:     body.pain     || "",
    source:   body.source   || "website",
    created_at: new Date().toISOString(),
  };

  // 1) Persist to Supabase (don't await blockingly to keep latency low — but await to confirm)
  const saved = await saveToSupabase(lead);

  // 2) Notify Pan
  const internalSubject =
    `${(lead.units || "").includes("500") || (lead.units || "").includes("1,000") ? "&#128293; Priority " : "New "}` +
    `lead &mdash; ${lead.name || "anonymous"} &middot; ${lead.units || "&mdash;"} &middot; ${lead.building || "&mdash;"}`;
  const internal = await sendEmail({
    to: TO_INTERNAL,
    subject: internalSubject.replace(/&[a-z]+;|&#\d+;/g, m => ({"&mdash;":"—","&middot;":"·","&#128293;":"🔥"}[m] || m)),
    html: internalHtml(lead),
    reply_to: lead.email || undefined,
  });

  // 3) Auto-reply to lead (only with valid-looking email)
  let customer = { ok: true, skipped: true };
  if (lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    customer = await sendEmail({
      to: lead.email,
      subject: "We've got your request — PanCanAir",
      html: customerHtml(lead),
    });
  }

  return res.status(internal.ok ? 200 : 502).json({
    ok: internal.ok,
    saved,
    internal,
    customer,
  });
}
