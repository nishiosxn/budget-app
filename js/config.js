// V2.2 — configuration, utilitaires et navigation temporelle
const MONTHS=["Septembre 2026","Octobre 2026","Novembre 2026","Décembre 2026","Janvier 2027","Février 2027","Mars 2027","Avril 2027","Mai 2027","Juin 2027","Juillet 2027","Août 2027","Septembre 2027","Octobre 2027","Novembre 2027","Décembre 2027","Janvier 2028","Février 2028","Mars 2028","Avril 2028","Mai 2028","Juin 2028","Juillet 2028","Août 2028","Septembre 2028"];

const STORAGE_KEY="budget-foyer-v2";
const V1_STORAGE_KEY="budget-foyer-v1";
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const euro=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",minimumFractionDigits:2}).format(Number(n)||0);
const escapeHtml=s=>String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function monthKey(label){const parts=label.split(" ");const m={Janvier:"01",Février:"02",Mars:"03",Avril:"04",Mai:"05",Juin:"06",Juillet:"07",Août:"08",Septembre:"09",Octobre:"10",Novembre:"11",Décembre:"12"};return `${parts[1]}-${m[parts[0]]}`}
function labelFromYM(year,month){const names=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];return `${names[month-1]} ${year}`}
function appendNextMonth(){const last=MONTHS[MONTHS.length-1],key=monthKey(last),[y,m]=key.split("-").map(Number),d=new Date(y,m,1);MONTHS.push(labelFromYM(d.getFullYear(),d.getMonth()+1));return MONTHS[MONTHS.length-1]}
function ensureMonthAvailable(label){if(MONTHS.includes(label))return;const target=monthKey(label);let guard=0;while(monthKey(MONTHS[MONTHS.length-1])<target&&guard++<240)appendNextMonth()}
