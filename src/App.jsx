import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Globe, Users, AlertTriangle, XCircle, X, Plus, Database, LayoutDashboard, Target, ChevronDown, ChevronRight, History } from "lucide-react";

// ── Fonts ──────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("wpf-fonts")) {
  const l = document.createElement("link");
  l.id = "wpf-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
}

// ── Constants ──────────────────────────────────────────────────
const STATUS_CFG = {
  Member:        { color:"#15803d", bg:"#dcfce7", dot:"#22c55e" },
  Negotiating:   { color:"#b45309", bg:"#fef3c7", dot:"#f59e0b" },
  Documentation: { color:"#1d4ed8", bg:"#dbeafe", dot:"#60a5fa" },
  Needed:        { color:"#b91c1c", bg:"#fee2e2", dot:"#ef4444" },
};
const ALL_STATUSES = ["", ...Object.keys(STATUS_CFG)];

const ISO_MAP = {
  Brazil:76, England:826, Australia:36, Taiwan:158, Mexico:484,
  Israel:376, Germany:276, Japan:392, Canada:124,
  "United States":840, France:250, Argentina:32, Colombia:170,
  "South Africa":710, Nigeria:566, Egypt:818, Poland:616,
  Spain:724, Italy:380, Turkey:792, "South Korea":410,
  Indonesia:360, Thailand:764, "New Zealand":554,
};

const CONTINENTS = ["All Continents","South America","North America","Europe","Asia","Oceania","Africa","Middle East"];
const STATUSES   = ["All Status","Member","Negotiating","Documentation","Needed"];
const QUARTERS   = ["","Q1","Q2","Q3","Q4"];
const GOAL       = 55;
const TODAY      = new Date("2026-03-05");

const fmt    = d => { if(!d) return "—"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };

// Auto-derive quarter from a date string (YYYY-MM-DD)
function quarterFromDate(dateStr) {
  if (!dateStr) return "";
  const month = parseInt(dateStr.slice(5, 7), 10);
  if (month <= 3)  return "Q1";
  if (month <= 6)  return "Q2";
  if (month <= 9)  return "Q3";
  return "Q4";
}
const fmtMMM = d => { if(!d) return "—"; const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };

function calcVig(inicio, fim) {
  if (!inicio || !fim) return { status:null, label:null, color:null };
  const end=new Date(fim), start=new Date(inicio);
  const left=Math.round((end-TODAY)/86400000);
  const total=Math.round((end-start)/86400000);
  if (left<0)   return { status:"Expired",  label:`expired ${Math.abs(left)}d ago`, color:"#dc2626" };
  if (left<=30) return { status:"Expiring", label:`${left} days left`,              color:"#d97706" };
  return            { status:"Active",   label:`${total} days`,                 color:"#16a34a" };
}

// ── Chart helpers ──────────────────────────────────────────────
// Returns the status of a record at the end of a given month (YYYY-MM)
function statusAtMonth(record, ym) {
  const endOfMonth = new Date(ym.slice(0,4), parseInt(ym.slice(5,7)), 0); // last day of month
  const hist = [...(record.statusHistory||[])].sort((a,b)=>a.date.localeCompare(b.date));
  let current = null;
  for (const h of hist) {
    if (new Date(h.date) <= endOfMonth) current = h.toStatus;
    else break;
  }
  return current;
}

// Build chart data from all records' status histories
function buildChartData(data) {
  // Collect all months present in any history
  const monthSet = new Set();
  data.forEach(r => (r.statusHistory||[]).forEach(h => {
    if (h.date && h.date.length >= 7) monthSet.add(h.date.slice(0,7));
  }));
  if (monthSet.size === 0) return [];

  // Sort months
  const months = [...monthSet].sort();
  // Expand to include all months from first to current
  const first = months[0];
  const expanded = [];
  let cur = new Date(first + "-01");
  const last = new Date("2026-03-01");
  while (cur <= last) {
    const ym = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
    expanded.push(ym);
    cur.setMonth(cur.getMonth()+1);
  }

  return expanded.map(ym => {
    const counts = { Member:0, Documentation:0, Negotiating:0, Needed:0 };
    data.forEach(r => {
      const s = statusAtMonth(r, ym);
      if (s && counts[s] !== undefined) counts[s]++;
    });
    // Label: "Jun 25"
    const dt = new Date(ym+"-01");
    const label = dt.toLocaleDateString("en-US",{month:"short",year:"2-digit"}).replace(","," ");
    return { m: label, ym, ...counts };
  });
}

// ── Initial data ───────────────────────────────────────────────
const INIT = [
  {
    id:1, country:"Brazil", continent:"South America", empresa:"CBTH", memberStatus:"Member",
    quarter:"Q1", inicio:"2026-03-04", fim:"2026-07-29", rep:"João Silva", email:"joao@cbth.com", tel:"+55 11 9999-0001",
    statusHistory:[
      {id:"h1a", date:"2025-08-01", fromStatus:"",            toStatus:"Negotiating"},
      {id:"h1b", date:"2025-11-15", fromStatus:"Negotiating", toStatus:"Documentation"},
      {id:"h1c", date:"2026-01-10", fromStatus:"Documentation",toStatus:"Member"},
    ]
  },
  {
    id:2, country:"England", continent:"Europe", empresa:"", memberStatus:"Needed",
    quarter:"", inicio:"", fim:"", rep:"", email:"", tel:"",
    statusHistory:[
      {id:"h2a", date:"2025-09-01", fromStatus:"", toStatus:"Needed"},
    ]
  },
  {
    id:3, country:"Australia", continent:"Oceania", empresa:"MGM", memberStatus:"Negotiating",
    quarter:"", inicio:"", fim:"", rep:"Mike Chen", email:"m@mgm.au", tel:"+61 2 0000-0003",
    statusHistory:[
      {id:"h3a", date:"2025-07-01", fromStatus:"",            toStatus:"Needed"},
      {id:"h3b", date:"2025-10-01", fromStatus:"Needed",      toStatus:"Negotiating"},
    ]
  },
  {
    id:4, country:"Taiwan", continent:"Asia", empresa:"MGM 2", memberStatus:"Documentation",
    quarter:"", inicio:"", fim:"", rep:"Li Wei", email:"l@mgm2.tw", tel:"+886 2 0000",
    statusHistory:[
      {id:"h4a", date:"2025-09-15", fromStatus:"",            toStatus:"Negotiating"},
      {id:"h4b", date:"2025-12-01", fromStatus:"Negotiating", toStatus:"Documentation"},
    ]
  },
  {
    id:5, country:"Mexico", continent:"North America", empresa:"CTP", memberStatus:"Member",
    quarter:"Q1", inicio:"2026-03-04", fim:"2026-03-31", rep:"Carlos Torres", email:"c@ctp.mx", tel:"+52 55 0000",
    statusHistory:[
      {id:"h5a", date:"2025-06-01", fromStatus:"",            toStatus:"Negotiating"},
      {id:"h5b", date:"2025-11-01", fromStatus:"Negotiating", toStatus:"Member"},
    ]
  },
  {
    id:6, country:"Israel", continent:"Middle East", empresa:"fake", memberStatus:"Member",
    quarter:"Q1", inicio:"2026-03-01", fim:"2026-03-03", rep:"David Levi", email:"d@fake.il", tel:"+972 3 0000",
    statusHistory:[
      {id:"h6a", date:"2025-10-01", fromStatus:"",            toStatus:"Negotiating"},
      {id:"h6b", date:"2026-02-01", fromStatus:"Negotiating", toStatus:"Member"},
    ]
  },
  {
    id:7, country:"Germany", continent:"Europe", empresa:"DPF", memberStatus:"Negotiating",
    quarter:"", inicio:"", fim:"", rep:"Hans Müller", email:"h@dpf.de", tel:"+49 30 0000",
    statusHistory:[
      {id:"h7a", date:"2025-11-01", fromStatus:"", toStatus:"Negotiating"},
    ]
  },
  {
    id:8, country:"Japan", continent:"Asia", empresa:"JWF", memberStatus:"Documentation",
    quarter:"", inicio:"", fim:"", rep:"Kenji Tanaka", email:"k@jwf.jp", tel:"+81 3 0000",
    statusHistory:[
      {id:"h8a", date:"2025-08-15", fromStatus:"",            toStatus:"Needed"},
      {id:"h8b", date:"2025-12-15", fromStatus:"Needed",      toStatus:"Documentation"},
    ]
  },
  {
    id:9, country:"Canada", continent:"North America", empresa:"CWF", memberStatus:"Member",
    quarter:"Q2", inicio:"2025-06-01", fim:"2026-06-01", rep:"Sarah Lee", email:"s@cwf.ca", tel:"+1 416 000",
    statusHistory:[
      {id:"h9a", date:"2025-06-01", fromStatus:"", toStatus:"Member"},
    ]
  },
];

// ── Badge ──────────────────────────────────────────────────────
function Badge({ status }) {
  const c = STATUS_CFG[status]; if(!c) return null;
  return (
    <span style={{background:c.bg,color:c.color,padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c.dot,display:"inline-block"}}/>
      {status}
    </span>
  );
}

// ── Staircase Block ────────────────────────────────────────────
function StaircaseBlock({ data, onStepClick }) {
  const members = useMemo(() => data.filter(r => r.memberStatus === "Member" && r.country), [data]);

  const steps = useMemo(() => {
    const qCounts = { Q1:0, Q2:0, Q3:0, Q4:0 };
    members.forEach(r => { if (r.quarter && qCounts[r.quarter] !== undefined) qCounts[r.quarter]++; });
    let cumulative = 0;
    return ["Q1","Q2","Q3","Q4"].map((q, i) => {
      const count = qCounts[q];
      cumulative += count;
      return {
        q, count, cumulative,
        rows: members.filter(r => r.quarter === q),
        label: ["Jan – Mar","Apr – Jun","Jul – Sep","Oct – Dec"][i],
        color: ["#22c55e","#60a5fa","#f59e0b","#a78bfa"][i],
      };
    });
  }, [members]);

  const totalMembers = members.length;
  const pct = Math.min((totalMembers / GOAL) * 100, 100);
  const BASE_H = 48, STEP_INC = 28;

  return (
    <div style={{background:"#fff",borderRadius:12,padding:"22px 24px",marginBottom:18,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <Target size={15} color="#6366f1"/>
            <h2 style={{fontSize:14,fontWeight:700,margin:0}}>Path to 55 Federations</h2>
          </div>
          <p style={{fontSize:11,color:"#9ca3af",margin:0}}>Quarterly member acquisition target · Click a step to see records</p>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:28,fontWeight:700,color:"#1a1a1a",lineHeight:1,fontFamily:"'Playfair Display',Georgia,serif"}}>
            {totalMembers}<span style={{fontSize:14,color:"#9ca3af",fontWeight:400,marginLeft:4}}>/ {GOAL}</span>
          </div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{Math.round(pct)}% of goal</div>
        </div>
      </div>
      <div style={{height:4,background:"#f3f4f6",borderRadius:4,marginBottom:22,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#22c55e,#60a5fa)",borderRadius:4,transition:"width 0.6s ease"}}/>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:10}}>
        {steps.map((step, i) => {
          const stepH = BASE_H + STEP_INC * (i + 1);
          const isActive = step.count > 0;
          return (
            <div key={step.q} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{marginBottom:8,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,lineHeight:1,fontFamily:"'Playfair Display',Georgia,serif",color:isActive?step.color:"#d1d5db"}}>{step.count}</div>
                <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>new members</div>
              </div>
              <button
                onClick={() => step.rows.length > 0 && onStepClick({
                  title:`${step.q} Members`, subtitle:step.label,
                  rows:[...step.rows].sort((a,b)=>{
                    if(!a.inicio) return 1; if(!b.inicio) return -1;
                    return new Date(a.inicio)-new Date(b.inicio);
                  }),
                })}
                style={{width:"100%",height:stepH,
                  background:isActive?`linear-gradient(180deg,${step.color}22 0%,${step.color}44 100%)`:"#f9fafb",
                  border:`2px solid ${isActive?step.color:"#e5e7eb"}`,
                  borderRadius:"10px 10px 0 0",cursor:step.rows.length>0?"pointer":"default",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",
                  padding:"12px 8px 0",transition:"all 0.2s",}}
                onMouseEnter={e=>{if(isActive){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${step.color}33`;}}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                {isActive && (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:"100%"}}>
                    <span style={{background:step.color,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>
                      {step.cumulative} total
                    </span>
                    <span style={{background:"#fff",color:step.color,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,border:`1px solid ${step.color}`,whiteSpace:"nowrap"}}>
                      +{step.count} new
                    </span>
                  </div>
                )}
                <span style={{fontSize:13,fontWeight:700,color:isActive?step.color:"#9ca3af",marginTop:"auto",paddingBottom:10}}>{step.q}</span>
              </button>
              <div style={{fontSize:10,color:"#9ca3af",textAlign:"center",marginTop:6,whiteSpace:"nowrap"}}>{step.label}</div>
            </div>
          );
        })}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:56}}>
          <div style={{marginBottom:8,textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,lineHeight:1,fontFamily:"'Playfair Display',Georgia,serif",color:"#6366f1"}}>{GOAL}</div>
            <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>goal</div>
          </div>
          <div style={{width:48,height:BASE_H+STEP_INC*5,background:"linear-gradient(180deg,#eef2ff,#c7d2fe)",border:"2px dashed #818cf8",borderRadius:"10px 10px 0 0",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Target size={16} color="#6366f1"/>
          </div>
          <div style={{fontSize:10,color:"#9ca3af",marginTop:6}}>target</div>
        </div>
      </div>
    </div>
  );
}

// ── Records Modal ──────────────────────────────────────────────
function RecordsModal({ title, subtitle, rows, onClose, onEdit }) {
  const vigDot = {"Active":"#22c55e","Expiring":"#f59e0b","Expired":"#ef4444"};
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,width:860,maxWidth:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #f3f4f6",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:17,fontWeight:700,fontFamily:"'Playfair Display',Georgia,serif"}}>{title}</h2>
            {subtitle&&<p style={{margin:"2px 0 0",fontSize:12,color:"#6b7280"}}>{subtitle}</p>}
          </div>
          <span style={{background:"#f3f4f6",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,color:"#374151"}}>{rows.length} records</span>
          <button onClick={onClose} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:"50%",width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280"}}><X size={13}/></button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {rows.length===0
            ?<div style={{padding:40,textAlign:"center",color:"#9ca3af",fontSize:14}}>No records found</div>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0,background:"#fafafa"}}>
                <tr>{["Country","Continent","Company","Quarter","Status","Start","End","Vigência"].map(h=>(
                  <th key={h} style={{textAlign:"left",fontSize:11,color:"#9ca3af",fontWeight:600,padding:"10px 16px",borderBottom:"1px solid #f3f4f6",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map(r=>{
                  const v=calcVig(r.inicio,r.fim);
                  return (
                    <tr key={r.id} onClick={()=>onEdit&&onEdit(r)} style={{cursor:"pointer",borderBottom:"1px solid #f9fafb"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f8faff"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"11px 16px",fontSize:13,fontWeight:600}}>{r.country||"—"}</td>
                      <td style={{padding:"11px 16px",fontSize:12,color:"#6b7280"}}>{r.continent||"—"}</td>
                      <td style={{padding:"11px 16px",fontSize:12}}>{r.empresa||"—"}</td>
                      <td style={{padding:"11px 16px",fontSize:12,fontWeight:700,color:"#6366f1"}}>{r.quarter||"—"}</td>
                      <td style={{padding:"11px 16px"}}><Badge status={r.memberStatus}/></td>
                      <td style={{padding:"11px 16px",fontSize:12,color:"#6b7280"}}>{fmt(r.inicio)}</td>
                      <td style={{padding:"11px 16px",fontSize:12,color:"#6b7280"}}>{fmt(r.fim)}</td>
                      <td style={{padding:"11px 16px"}}>
                        {v.status?<span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:vigDot[v.status],flexShrink:0}}/><span style={{fontSize:12,color:v.color,fontWeight:600}}>{v.status} · {v.label}</span></span>:<span style={{color:"#d1d5db"}}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({ row, onClose, onSave }) {
  const [f, setF] = useState({...row});
  const v = calcVig(f.inicio, f.fim);
  const set = (k,val) => setF(p=>({...p,[k]:val}));
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:520,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
          <Globe size={18} color="#f59e0b"/>
          <h2 style={{fontSize:18,fontWeight:700,margin:0,fontFamily:"'Playfair Display',Georgia,serif"}}>{f.country||"New Country"}</h2>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"1px solid #e5e7eb",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af"}}><X size={12}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          {[
            {k:"country",     label:"Country",    type:"text"},
            {k:"continent",   label:"Continent",  type:"select",opts:CONTINENTS.slice(1)},
            {k:"empresa",     label:"Company",    type:"text"},
            {k:"memberStatus",label:"Status",     type:"select",opts:Object.keys(STATUS_CFG)},
            {k:"inicio",      label:"Start Date (sets Quarter)", type:"date"},
            {k:"fim",         label:"End Date",   type:"date"},
          ].map(({k,label,type,opts})=>(
            <div key={k}>
              <label style={{fontSize:10,color:"#9ca3af",fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
              {type==="select"
                ?<select value={f[k]||""} onChange={e=>set(k,e.target.value)} style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:8,padding:"7px 10px",fontSize:13,background:"#fff"}}>
                  {(opts||[]).map(o=><option key={o} value={o}>{o||"—"}</option>)}
                </select>
                :<input type={type} value={f[k]||""} onChange={e=>{
                    set(k,e.target.value);
                    if(k==="inicio") set("quarter", quarterFromDate(e.target.value));
                  }}
                  style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:8,padding:"7px 10px",fontSize:13,boxSizing:"border-box"}}/>
              }
            </div>
          ))}
          {/* Quarter display — auto-derived, read-only */}
          <div>
            <label style={{fontSize:10,color:"#9ca3af",fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>Quarter (auto)</label>
            <div style={{border:"1px solid #f3f4f6",borderRadius:8,padding:"7px 10px",fontSize:13,background:"#f9fafb",color:f.quarter?"#6366f1":"#c4c9d4",fontWeight:f.quarter?700:400}}>
              {f.quarter || "— set Start Date"}
            </div>
          </div>
        </div>
        {v.status&&(
          <div style={{background:"#f9fafb",borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:v.color,flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:600,color:v.color}}>{v.status}</span>
            <span style={{fontSize:12,color:"#6b7280",marginLeft:4}}>{v.label}</span>
          </div>
        )}
        <div style={{borderTop:"1px solid #f3f4f6",paddingTop:14,marginBottom:18}}>
          <p style={{fontSize:10,fontWeight:700,color:"#9ca3af",letterSpacing:1,margin:"0 0 12px"}}>CONTACT</p>
          {[{k:"rep",label:"Representative"},{k:"email",label:"Email"},{k:"tel",label:"Phone"}].map(({k,label})=>(
            <div key={k} style={{marginBottom:10}}>
              <label style={{fontSize:11,color:"#9ca3af",display:"block",marginBottom:3}}>{label}</label>
              <input value={f[k]||""} onChange={e=>set(k,e.target.value)} placeholder="Click to edit"
                style={{width:"100%",border:"none",borderBottom:"1px solid #e5e7eb",padding:"4px 0",fontSize:13,background:"transparent",outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",fontSize:13}}>Cancel</button>
          <button onClick={()=>{onSave(f);onClose();}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#1a1a1a",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── World Map ──────────────────────────────────────────────────
function WorldMap({ countries, onCountryClick }) {
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current; if(!el) return;
    let cancelled = false;
    const byIso = {};
    countries.forEach(c=>{ if(c.country&&ISO_MAP[c.country]) byIso[ISO_MAP[c.country]]=c; });
    const render=(topo,world)=>{
      if(cancelled||!containerRef.current) return;
      const W=el.clientWidth||900, H=Math.round(W*0.52);
      d3.select(el).selectAll("*").remove();
      const svg=d3.select(el).append("svg").attr("width","100%").attr("height",H).attr("viewBox",`0 0 ${W} ${H}`);
      svg.append("rect").attr("width",W).attr("height",H).attr("fill","#f1f5f9").attr("rx",8);
      const proj=d3.geoNaturalEarth1().fitSize([W,H],{type:"Sphere"});
      const path=d3.geoPath().projection(proj);
      const features=topo.feature(world,world.objects.countries).features;
      svg.selectAll("path").data(features).enter().append("path")
        .attr("d",path)
        .attr("fill",d=>{const c=byIso[+d.id];return c?(STATUS_CFG[c.memberStatus]?.dot||"#cbd5e1"):"#dde3ea";})
        .attr("stroke","#fff").attr("stroke-width",d=>byIso[+d.id]?1:0.4)
        .style("cursor",d=>byIso[+d.id]?"pointer":"default")
        .on("mouseenter",function(e,d){if(byIso[+d.id])d3.select(this).attr("opacity",0.72);})
        .on("mouseleave",function(e,d){d3.select(this).attr("opacity",1);})
        .on("click",(e,d)=>{const c=byIso[+d.id];if(c)onCountryClick(c);});
      Object.entries(byIso).forEach(([iso,c])=>{
        const feat=features.find(f=>+f.id===+iso);if(!feat)return;
        const cen=path.centroid(feat);if(!cen||isNaN(cen[0])||isNaN(cen[1]))return;
        svg.append("text").attr("x",cen[0]).attr("y",cen[1]-6)
          .attr("text-anchor","middle").attr("font-size","9").attr("font-weight","700")
          .attr("fill","#1e293b").attr("pointer-events","none")
          .style("text-shadow","0 1px 2px rgba(255,255,255,0.9)").text(c.country);
      });
    };
    const loadAndRender=(topo)=>{
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        .then(r=>r.json()).then(world=>{if(!cancelled)render(topo,world);})
        .catch(()=>{if(!cancelled&&containerRef.current)containerRef.current.innerHTML='<p style="text-align:center;padding:60px;color:#9ca3af;font-size:13px">Map unavailable</p>';});
    };
    if(window.topojson){loadAndRender(window.topojson);}
    else{
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s.onload=()=>{if(!cancelled)loadAndRender(window.topojson);};
      s.onerror=()=>{if(!cancelled&&containerRef.current)containerRef.current.innerHTML='<p style="text-align:center;padding:60px;color:#9ca3af;font-size:13px">Map unavailable</p>';};
      document.head.appendChild(s);
    }
    return()=>{cancelled=true;};
  },[countries]);
  return <div ref={containerRef} style={{width:"100%",minHeight:460,borderRadius:8,overflow:"hidden"}}/>;
}

// ── Editable Cell ──────────────────────────────────────────────
function EditableCell({ value, onChange, type="text", opts }) {
  const [editing,setEditing]=useState(false);
  const [v,setV]=useState(value);
  useEffect(()=>setV(value),[value]);
  if(editing){
    if(type==="select") return(
      <select autoFocus value={v||""} onChange={e=>setV(e.target.value)} onBlur={()=>{onChange(v);setEditing(false);}}
        style={{border:"1px solid #60a5fa",borderRadius:6,padding:"2px 6px",fontSize:12,background:"#fff",width:"100%"}}>
        {(opts||[]).map(o=><option key={o} value={o}>{o||"—"}</option>)}
      </select>
    );
    return <input autoFocus type={type} value={v||""} onChange={e=>setV(e.target.value)}
      onBlur={()=>{onChange(v);setEditing(false);}}
      onKeyDown={e=>{if(e.key==="Enter"){onChange(v);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
      style={{border:"1px solid #60a5fa",borderRadius:6,padding:"2px 6px",fontSize:12,width:"100%",boxSizing:"border-box"}}/>;
  }
  return(
    <span onClick={()=>setEditing(true)}
      style={{cursor:"text",display:"block",padding:"3px 4px",borderRadius:4,fontSize:12,color:v?"#374151":"#c4c9d4",minHeight:20}}
      onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      {type==="date"?fmt(v):(v||"—")}
    </span>
  );
}

// ── Status History Editor (inline in Master Data) ──────────────
function StatusHistoryEditor({ record, onUpdate }) {
  const hist = useMemo(()=>[...(record.statusHistory||[])].sort((a,b)=>a.date.localeCompare(b.date)),[record.statusHistory]);

  const updateEntry = (id, field, val) => {
    const updated = (record.statusHistory||[]).map(h=>h.id===id?{...h,[field]:val}:h);
    onUpdate({...record, statusHistory: updated});
  };

  const addEntry = () => {
    const newH = {id:`h${Date.now()}`, date:"", fromStatus:"", toStatus:""};
    onUpdate({...record, statusHistory:[...(record.statusHistory||[]), newH]});
  };

  const removeEntry = (id) => {
    onUpdate({...record, statusHistory:(record.statusHistory||[]).filter(h=>h.id!==id)});
  };

  return (
    <tr>
      <td colSpan={12} style={{padding:"0 0 0 48px",background:"#f8faff",borderBottom:"2px solid #e0e7ff"}}>
        <div style={{padding:"14px 16px 14px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <History size={13} color="#6366f1"/>
            <span style={{fontSize:11,fontWeight:700,color:"#6366f1",textTransform:"uppercase",letterSpacing:.8}}>
              Status History — {record.country||"(no name)"}
            </span>
            <span style={{fontSize:10,color:"#9ca3af",background:"#eef2ff",padding:"1px 7px",borderRadius:10}}>{hist.length} entries</span>
          </div>

          {hist.length === 0 && (
            <div style={{fontSize:12,color:"#9ca3af",padding:"8px 0",fontStyle:"italic"}}>No status changes recorded yet.</div>
          )}

          {hist.length > 0 && (
            <table style={{width:"100%",borderCollapse:"collapse",marginBottom:8}}>
              <thead>
                <tr>
                  {["Date","From Status","→  To Status",""].map(h=>(
                    <th key={h} style={{textAlign:"left",fontSize:10,color:"#9ca3af",fontWeight:600,padding:"4px 10px",borderBottom:"1px solid #e0e7ff",textTransform:"uppercase",letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hist.map(h=>(
                  <tr key={h.id} style={{borderBottom:"1px solid #eef2ff"}}>
                    <td style={{padding:"5px 10px",minWidth:110}}>
                      <EditableCell value={h.date} type="date" onChange={val=>updateEntry(h.id,"date",val)}/>
                    </td>
                    <td style={{padding:"5px 10px",minWidth:130}}>
                      <EditableCell value={h.fromStatus} type="select" opts={ALL_STATUSES} onChange={val=>updateEntry(h.id,"fromStatus",val)}/>
                    </td>
                    <td style={{padding:"5px 10px",minWidth:130}}>
                      <EditableCell value={h.toStatus} type="select" opts={ALL_STATUSES.slice(1)} onChange={val=>updateEntry(h.id,"toStatus",val)}/>
                    </td>
                    <td style={{padding:"5px 6px",textAlign:"center"}}>
                      <button onClick={()=>removeEntry(h.id)}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#e5e7eb",padding:3,borderRadius:4,display:"flex",alignItems:"center",transition:"color .1s"}}
                        onMouseEnter={e=>e.currentTarget.style.color="#ef4444"}
                        onMouseLeave={e=>e.currentTarget.style.color="#e5e7eb"}>
                        <X size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button onClick={addEntry}
            style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"1px dashed #a5b4fc",borderRadius:6,
              padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#6366f1",fontWeight:600,transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#eef2ff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
            <Plus size={11}/> Add status change
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Dashboard Tab ──────────────────────────────────────────────
function DashboardTab({ data, setData }) {
  const [kpiModal,   setKpiModal]   = useState(null);
  const [chartModal, setChartModal] = useState(null);
  const [stairModal, setStairModal] = useState(null);
  const [editModal,  setEditModal]  = useState(null);
  const [sfilt, setSfilt] = useState("All Status");
  const [cfilt, setCfilt] = useState("All Continents");

  const named   = useMemo(()=>data.filter(c=>c.country),[data]);
  const chartData = useMemo(()=>buildChartData(data),[data]);

  const kpis = useMemo(()=>({
    total:    {val:named.length,rows:named},
    active:   {val:named.filter(c=>c.memberStatus==="Member").length,rows:named.filter(c=>c.memberStatus==="Member")},
    expiring: {val:named.filter(c=>calcVig(c.inicio,c.fim).status==="Expiring").length,rows:named.filter(c=>calcVig(c.inicio,c.fim).status==="Expiring")},
    expired:  {val:named.filter(c=>calcVig(c.inicio,c.fim).status==="Expired").length,rows:named.filter(c=>calcVig(c.inicio,c.fim).status==="Expired")},
  }),[named]);

  const filtered = useMemo(()=>data.filter(c=>{
    if(sfilt!=="All Status"&&c.memberStatus!==sfilt) return false;
    if(cfilt!=="All Continents"&&c.continent!==cfilt) return false;
    return true;
  }),[data,sfilt,cfilt]);

  const save=(updated)=>setData(p=>p.map(c=>c.id===updated.id?{
    ...updated,
    quarter: updated.inicio ? quarterFromDate(updated.inicio) : updated.quarter
  }:c));
  const addRow=()=>{
    const id=Date.now();
    const novo={id,country:"",continent:"",empresa:"",memberStatus:"Needed",quarter:"",inicio:"",fim:"",rep:"",email:"",tel:"",statusHistory:[]};
    setData(p=>[...p,novo]); setEditModal(novo);
  };

  const KPI_DEFS=[
    {key:"total",    icon:<Globe size={20} color="#6366f1"/>,         label:"Total Countries",      iconBg:"#eef2ff"},
    {key:"active",   icon:<Users size={20} color="#22c55e"/>,         label:"Active Members",       iconBg:"#dcfce7"},
    {key:"expiring", icon:<AlertTriangle size={20} color="#f59e0b"/>, label:"Expiring Memberships", iconBg:"#fef3c7"},
    {key:"expired",  icon:<XCircle size={20} color="#ef4444"/>,       label:"Expired Memberships",  iconBg:"#fee2e2"},
  ];
  const vigDot={"Active":"#22c55e","Expiring":"#f59e0b","Expired":"#ef4444"};

  return (
    <div style={{maxWidth:1160,margin:"0 auto",padding:"32px 20px",background:"#f7f6f3"}}>
      <div style={{marginBottom:26}}>
        <h1 style={{fontSize:28,fontWeight:700,margin:"0 0 3px",fontFamily:"'Playfair Display',Georgia,serif"}}>WPF Member Nations</h1>
        <p style={{fontSize:12,color:"#9ca3af",margin:0,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:500}}>World Poker Federation · Member tracking</p>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {KPI_DEFS.map(({key,icon,label,iconBg})=>(
          <button key={key} onClick={()=>setKpiModal({title:label,rows:kpis[key].rows,subtitle:`${kpis[key].val} countries`})}
            style={{background:"#fff",borderRadius:12,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)",display:"flex",alignItems:"center",gap:14,cursor:"pointer",border:"1.5px solid transparent",textAlign:"left",transition:"all 0.15s",width:"100%"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#e0e7ff";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.10)";e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.07)";e.currentTarget.style.transform="translateY(0)";}}>
            <div style={{padding:10,background:iconBg,borderRadius:10,flexShrink:0}}>{icon}</div>
            <div>
              <div style={{fontSize:30,fontWeight:600,lineHeight:1,color:"#1a1a1a",fontFamily:"'Playfair Display',Georgia,serif"}}>{kpis[key].val}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:3,fontWeight:500}}>{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Staircase */}
      <StaircaseBlock data={data} onStepClick={setStairModal}/>

      {/* Map */}
      <div style={{background:"#fff",borderRadius:12,padding:22,marginBottom:18,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <h2 style={{fontSize:14,fontWeight:700,margin:0}}>Member Map</h2>
          <div style={{display:"flex",gap:16}}>
            {Object.entries(STATUS_CFG).map(([s,c])=>(
              <span key={s} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#6b7280"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,flexShrink:0}}/>{s}
              </span>
            ))}
          </div>
        </div>
        <WorldMap countries={named} onCountryClick={setEditModal}/>
      </div>

      {/* Chart — now driven by real data */}
      <div style={{background:"#fff",borderRadius:12,padding:22,marginBottom:18,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
        <div style={{marginBottom:14}}>
          <h2 style={{fontSize:14,fontWeight:700,margin:"0 0 2px"}}>Monthly Status Progression</h2>
          <p style={{fontSize:11,color:"#9ca3af",margin:0}}>Derived from status history · Click a month to see records</p>
        </div>
        {chartData.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:"#9ca3af",fontSize:13}}>No status history data yet — add changes in Master Data</div>
          :<ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{top:5,right:10,left:-24,bottom:0}}
              onClick={d=>{if(d?.activeLabel) setChartModal({title:`Records — ${d.activeLabel}`,rows:named,subtitle:"All current records"});}}
              style={{cursor:"pointer"}}>
              <defs>
                {[["m","#22c55e"],["doc","#60a5fa"],["n","#f59e0b"],["nd","#ef4444"]].map(([id,c])=>(
                  <linearGradient key={id} id={`cg${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.8}/><stop offset="95%" stopColor={c} stopOpacity={0.4}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="m" tick={{fontSize:11,fill:"#9ca3af"}}/>
              <YAxis tick={{fontSize:11,fill:"#9ca3af"}}/>
              <Tooltip contentStyle={{borderRadius:8,border:"1px solid #e5e7eb",fontSize:12}}/>
              <Legend wrapperStyle={{fontSize:11,paddingTop:10}}/>
              <Area type="monotone" dataKey="Member"        stackId="1" stroke="#22c55e" fill="url(#cgm)"   strokeWidth={2}/>
              <Area type="monotone" dataKey="Documentation" stackId="1" stroke="#60a5fa" fill="url(#cgdoc)" strokeWidth={2}/>
              <Area type="monotone" dataKey="Negotiating"   stackId="1" stroke="#f59e0b" fill="url(#cgn)"   strokeWidth={2}/>
              <Area type="monotone" dataKey="Needed"        stackId="1" stroke="#ef4444" fill="url(#cgnd)"  strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        }
      </div>

      {/* Table */}
      <div style={{background:"#fff",borderRadius:12,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <h2 style={{fontSize:14,fontWeight:700,margin:0}}>Countries</h2>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{background:"#f3f4f6",padding:"3px 10px",borderRadius:20,fontSize:11,color:"#9ca3af"}}>{filtered.length} of {data.length}</span>
            {[{val:sfilt,set:setSfilt,opts:STATUSES},{val:cfilt,set:setCfilt,opts:CONTINENTS}].map((sel,i)=>(
              <select key={i} value={sel.val} onChange={e=>sel.set(e.target.value)}
                style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#374151",background:"#fff",cursor:"pointer"}}>
                {sel.opts.map(o=><option key={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"2px solid #f3f4f6"}}>
                {["Country","Continent","Company","Quarter","Status","Start","End","Vigência","Days"].map(h=>(
                  <th key={h} style={{textAlign:"left",fontSize:10,color:"#9ca3af",fontWeight:600,padding:"8px 12px",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=>{
                const v=calcVig(c.inicio,c.fim);
                return (
                  <tr key={c.id} onClick={()=>setEditModal(c)} style={{borderBottom:"1px solid #f9fafb",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8faff"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"10px 12px",fontSize:13,fontWeight:600,color:c.country?"#111827":"#d1d5db"}}>{c.country||"—"}</td>
                    <td style={{padding:"10px 12px"}}>{c.continent?<span style={{background:"#f3f4f6",borderRadius:20,padding:"2px 9px",fontSize:11,color:"#374151"}}>{c.continent}</span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:c.empresa?"#374151":"#d1d5db"}}>{c.empresa||"—"}</td>
                    <td style={{padding:"10px 12px"}}>{c.quarter?<span style={{fontSize:12,fontWeight:700,color:"#6366f1"}}>{c.quarter}</span>:<span style={{color:"#d1d5db",fontSize:12}}>—</span>}</td>
                    <td style={{padding:"10px 12px"}}><Badge status={c.memberStatus}/></td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#6b7280"}}>{fmt(c.inicio)}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#6b7280"}}>{fmt(c.fim)}</td>
                    <td style={{padding:"10px 12px"}}>{v.status?<span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:vigDot[v.status],flexShrink:0}}/><span style={{fontSize:12,color:v.color,fontWeight:600}}>{v.status}</span></span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                    <td style={{padding:"10px 12px",fontSize:12,fontWeight:600,color:v.color||"#9ca3af"}}>{v.label||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} style={{marginTop:12,display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#9ca3af",padding:"5px 4px"}}>
          <Plus size={13}/> New country
        </button>
      </div>

      {kpiModal   &&<RecordsModal {...kpiModal}   onClose={()=>setKpiModal(null)}   onEdit={r=>{setKpiModal(null);  setEditModal(r);}}/>}
      {stairModal &&<RecordsModal {...stairModal} onClose={()=>setStairModal(null)} onEdit={r=>{setStairModal(null);setEditModal(r);}}/>}
      {chartModal &&<RecordsModal {...chartModal} onClose={()=>setChartModal(null)} onEdit={r=>{setChartModal(null);setEditModal(r);}}/>}
      {editModal  &&<EditModal row={editModal} onClose={()=>setEditModal(null)} onSave={save}/>}
    </div>
  );
}

// ── Data Tab ───────────────────────────────────────────────────
function DataTab({ data, setData }) {
  const [sfilt,  setSfilt]   = useState("All Status");
  const [cfilt,  setCfilt]   = useState("All Continents");
  const [search, setSearch]  = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const [editModal, setEditModal] = useState(null);

  const filtered = useMemo(()=>data.filter(r=>{
    if(sfilt!=="All Status"&&r.memberStatus!==sfilt) return false;
    if(cfilt!=="All Continents"&&r.continent!==cfilt) return false;
    if(search){const q=search.toLowerCase();return [r.country,r.empresa,r.rep,r.email,r.continent,r.quarter].some(v=>v?.toLowerCase().includes(q));}
    return true;
  }),[data,sfilt,cfilt,search]);

  const save = (updated) => setData(p=>p.map(c=>c.id===updated.id?{
    ...updated,
    quarter: updated.inicio ? quarterFromDate(updated.inicio) : updated.quarter
  }:c));
  const del  = (id)      => setData(p=>p.filter(c=>c.id!==id));

  const toggleExpand = (id) => setExpanded(prev=>{
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const addRow = () => {
    const id=Date.now();
    const novo={id,country:"",continent:"",empresa:"",memberStatus:"Needed",quarter:"",inicio:"",fim:"",rep:"",email:"",tel:"",statusHistory:[]};
    setData(p=>[...p,novo]); setEditModal(novo);
  };

  const COLS=[
    {key:"country",      label:"Country",   w:120},
    {key:"continent",    label:"Continent", w:120},
    {key:"empresa",      label:"Company",   w:110},
    {key:"memberStatus", label:"Status",    w:120},
    {key:"quarter",      label:"Quarter",   w:80},
    {key:"inicio",       label:"Start",     w:95},
    {key:"fim",          label:"End",       w:95},
    {key:"rep",          label:"Rep.",       w:130},
    {key:"email",        label:"Email",     w:160},
    {key:"tel",          label:"Phone",     w:130},
  ];
  const vigDot={"Active":"#22c55e","Expiring":"#f59e0b","Expired":"#ef4444"};

  return (
    <div style={{maxWidth:1400,margin:"0 auto",padding:"32px 20px"}}>
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:26,fontWeight:700,margin:"0 0 3px",fontFamily:"'Playfair Display',Georgia,serif"}}>Master Data</h1>
        <p style={{fontSize:12,color:"#9ca3af",margin:0,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:500}}>Complete database · expand any row to edit status history</p>
      </div>

      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search countries, companies, quarters..."
          style={{flex:1,minWidth:200,border:"1px solid #e5e7eb",borderRadius:8,padding:"7px 14px",fontSize:13,outline:"none"}}/>
        {[{val:sfilt,set:setSfilt,opts:STATUSES},{val:cfilt,set:setCfilt,opts:CONTINENTS}].map((sel,i)=>(
          <select key={i} value={sel.val} onChange={e=>sel.set(e.target.value)}
            style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"7px 12px",fontSize:12,background:"#fff",cursor:"pointer"}}>
            {sel.opts.map(o=><option key={o}>{o}</option>)}
          </select>
        ))}
        <span style={{fontSize:11,color:"#9ca3af",background:"#f3f4f6",padding:"4px 10px",borderRadius:20}}>{filtered.length} records</span>
        <button onClick={addRow} style={{display:"flex",alignItems:"center",gap:6,background:"#1a1a1a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>
          <Plus size={13}/> Add Country
        </button>
      </div>

      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#fafafa",borderBottom:"2px solid #f3f4f6"}}>
                {/* Expand toggle column */}
                <th style={{width:36,padding:"11px 6px 11px 14px"}}/>
                {COLS.map(c=>(
                  <th key={c.key} style={{textAlign:"left",padding:"11px 14px",fontSize:10,color:"#9ca3af",fontWeight:700,whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:.6,minWidth:c.w}}>{c.label}</th>
                ))}
                <th style={{padding:"11px 14px",fontSize:10,color:"#9ca3af",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,minWidth:90}}>Vigência</th>
                <th style={{padding:"11px 14px",fontSize:10,color:"#9ca3af",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,minWidth:60}}>History</th>
                <th style={{width:36}}/>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row,i)=>{
                const v=calcVig(row.inicio,row.fim);
                const isOpen=expanded.has(row.id);
                const histCount=(row.statusHistory||[]).length;
                return (
                  <>
                    <tr key={row.id} style={{borderBottom:isOpen?"none":"1px solid #f3f4f6",background:isOpen?"#f8faff":i%2===0?"#fff":"#fafbfc",transition:"background 0.1s"}}
                      onMouseEnter={e=>{if(!isOpen)e.currentTarget.style.background="#f0f7ff";}}
                      onMouseLeave={e=>{if(!isOpen)e.currentTarget.style.background=i%2===0?"#fff":"#fafbfc";}}>

                      {/* Expand arrow */}
                      <td style={{padding:"4px 6px 4px 14px",verticalAlign:"middle",textAlign:"center"}}>
                        <button onClick={()=>toggleExpand(row.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:isOpen?"#6366f1":"#9ca3af",padding:3,borderRadius:4,display:"flex",alignItems:"center",transition:"color .15s"}}
                          title={isOpen?"Hide status history":"Show status history"}>
                          {isOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                        </button>
                      </td>

                      {COLS.map(c=>(
                        <td key={c.key} style={{padding:"4px 14px",verticalAlign:"middle"}} onClick={e=>e.stopPropagation()}>
                          {c.key==="memberStatus"
                            ?<EditableCell value={row[c.key]} type="select" opts={Object.keys(STATUS_CFG)} onChange={val=>save({...row,[c.key]:val})}/>
                            :c.key==="continent"
                            ?<EditableCell value={row[c.key]} type="select" opts={CONTINENTS.slice(1)} onChange={val=>save({...row,[c.key]:val})}/>
                            :c.key==="quarter"
                            ?<span style={{fontSize:12,fontWeight:700,color:row[c.key]?"#6366f1":"#d1d5db",padding:"3px 4px",display:"block"}} title="Auto-derived from Start date">{row[c.key]||"—"}</span>
                            :c.key==="inicio"||c.key==="fim"
                            ?<EditableCell value={row[c.key]} type="date" onChange={val=>save({...row,[c.key]:val})}/>
                            :<EditableCell value={row[c.key]} onChange={val=>save({...row,[c.key]:val})}/>
                          }
                        </td>
                      ))}

                      <td style={{padding:"4px 14px",verticalAlign:"middle"}}>
                        {v.status
                          ?<span style={{display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:vigDot[v.status],flexShrink:0}}/>
                            <span style={{color:v.color,fontWeight:600,fontSize:11}}>{v.status}</span>
                          </span>
                          :<span style={{color:"#e5e7eb"}}>—</span>}
                      </td>

                      {/* History badge */}
                      <td style={{padding:"4px 14px",verticalAlign:"middle"}}>
                        <button onClick={()=>toggleExpand(row.id)}
                          style={{display:"inline-flex",alignItems:"center",gap:4,background:isOpen?"#eef2ff":"#f3f4f6",
                            border:"none",borderRadius:20,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:600,
                            color:isOpen?"#6366f1":"#9ca3af",transition:"all .15s"}}>
                          <History size={10}/>{histCount}
                        </button>
                      </td>

                      <td style={{padding:"4px 8px",verticalAlign:"middle",textAlign:"center"}}>
                        <button onClick={()=>del(row.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#e5e7eb",padding:4,borderRadius:6,display:"flex",alignItems:"center",transition:"color 0.1s"}}
                          onMouseEnter={e=>e.currentTarget.style.color="#ef4444"}
                          onMouseLeave={e=>e.currentTarget.style.color="#e5e7eb"}>
                          <X size={13}/>
                        </button>
                      </td>
                    </tr>

                    {/* Inline history editor */}
                    {isOpen && (
                      <StatusHistoryEditor key={`hist-${row.id}`} record={row} onUpdate={save}/>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:"#9ca3af",fontSize:13}}>No records match the filters</div>}
      </div>
      {editModal&&<EditModal row={editModal} onClose={()=>setEditModal(null)} onSave={save}/>}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function App() {
  const [data,setData]=useState(INIT);
  const [tab,setTab]=useState("dashboard");

  return (
    <div style={{background:"#f7f6f3",minHeight:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #ede9e3",padding:"0 20px",position:"sticky",top:0,zIndex:100,display:"flex",alignItems:"center",gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 0",marginRight:24}}>
          <div style={{width:28,height:28,background:"#1a1a1a",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Globe size={15} color="#fff"/>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:"#1a1a1a",fontFamily:"'Playfair Display',Georgia,serif",letterSpacing:".2px"}}>WPF</span>
        </div>
        {[{id:"dashboard",label:"Dashboard",icon:<LayoutDashboard size={14}/>},{id:"data",label:"Master Data",icon:<Database size={14}/>}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"14px 14px",background:"none",border:"none",cursor:"pointer",
              fontSize:13,fontWeight:tab===t.id?600:400,color:tab===t.id?"#1a1a1a":"#9ca3af",fontFamily:"'DM Sans',system-ui,sans-serif",
              borderBottom:tab===t.id?"2px solid #1a1a1a":"2px solid transparent",transition:"all 0.15s",marginBottom:"-1px"}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab==="dashboard"
        ?<DashboardTab data={data} setData={setData}/>
        :<DataTab      data={data} setData={setData}/>
      }
    </div>
  );
}
