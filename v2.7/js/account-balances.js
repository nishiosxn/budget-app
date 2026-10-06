// V2.6 — soldes d'ouverture mensuels, stockés séparément du budget et des transactions
let accountOpeningBalances=new Map();
let accountBalanceEditSlot=null;

function accountOpeningKey(label,slot){
 return `${monthKey(label)}|${slot}`;
}
function accountOpeningBalanceDefined(label,slot){
 return accountOpeningBalances.has(accountOpeningKey(label,slot));
}
function accountOpeningBalanceFor(label,slot){
 return Number(accountOpeningBalances.get(accountOpeningKey(label,slot))||0);
}
function loadAccountOpeningBalanceRows(rows){
 accountOpeningBalances=new Map();
 for(const row of rows||[]){
  const key=`${String(row.month||"").slice(0,7)}|${row.owner_slot}`;
  if(/^[0-9]{4}-[0-9]{2}\|[BA]$/.test(key))accountOpeningBalances.set(key,Number(row.amount)||0);
 }
}
function serializeAccountOpeningBalances(){
 return [...accountOpeningBalances.entries()].map(([key,amount])=>{
  const [month,owner_slot]=key.split("|");
  return {month,owner_slot,amount:Number(amount)||0};
 }).filter(row=>/^\d{4}-\d{2}$/.test(row.month)&&["B","A"].includes(row.owner_slot)).sort((a,b)=>(a.month+a.owner_slot).localeCompare(b.month+b.owner_slot));
}
async function clearAccountOpeningBalances(){
 if(!activeHouseholdId){loadAccountOpeningBalanceRows([]);return}
 if(!cloudClient)throw new Error("Cloud indisponible.");
 cloudIgnoreRealtimeUntil=Date.now()+3000;
 const result=await cloudClient.from("account_opening_balances").delete().eq("household_id",activeHouseholdId);
 if(result.error)throw result.error;
 loadAccountOpeningBalanceRows([]);
}
async function replaceAccountOpeningBalancesFromBackup(rows){
 await clearAccountOpeningBalances();
 const normalized=(Array.isArray(rows)?rows:[]).map(row=>({
  month:String(row?.month||"").slice(0,7),
  owner_slot:row?.owner_slot,
  amount:Math.round((Number(row?.amount)||0)*100)/100
 })).filter(row=>/^\d{4}-\d{2}$/.test(row.month)&&["B","A"].includes(row.owner_slot));
 if(!normalized.length)return;
 const payload=normalized.map(row=>({household_id:activeHouseholdId,month:row.month+"-01",owner_slot:row.owner_slot,amount:row.amount}));
 cloudIgnoreRealtimeUntil=Date.now()+3000;
 const result=await cloudClient.from("account_opening_balances").insert(payload);
 if(result.error)throw result.error;
 loadAccountOpeningBalanceRows(normalized);
}
function accountBalancePersonName(slot){
 return slot==="B"?state.household.personB:state.household.personA;
}
function closeAccountBalanceEditor(){
 const backdrop=document.getElementById("accountBalanceBackdrop");
 if(!backdrop)return;
 backdrop.classList.remove("open");
 backdrop.setAttribute("aria-hidden","true");
 accountBalanceEditSlot=null;
}
function openAccountBalanceEditor(slot){
 if(!["B","A"].includes(slot))return;
 accountBalanceEditSlot=slot;
 const backdrop=document.getElementById("accountBalanceBackdrop");
 const title=document.getElementById("accountBalanceTitle");
 const kind=document.getElementById("accountBalanceKind");
 const input=document.getElementById("accountOpeningInput");
 if(!backdrop||!input)return;
 title.textContent="Solde de départ";
 kind.textContent=`${accountBalancePersonName(slot)} · ${state.selectedMonth}`;
 input.value=accountOpeningBalanceDefined(state.selectedMonth,slot)?accountOpeningBalanceFor(state.selectedMonth,slot).toFixed(2):"0.00";
 backdrop.classList.add("open");
 backdrop.setAttribute("aria-hidden","false");
 setTimeout(()=>{input.focus();input.select()},70);
}
async function saveAccountOpeningBalance(){
 const slot=accountBalanceEditSlot;
 const input=document.getElementById("accountOpeningInput");
 if(!slot||!input||!cloudClient||!activeHouseholdId)return;
 const raw=String(input.value||"").replace(",",".").trim();
 const amount=Math.round((Number(raw)||0)*100)/100;
 const key=monthKey(state.selectedMonth),month=cloudMonthDate(key);
 if(!month)return;
 const button=document.getElementById("saveAccountOpening");
 if(button)button.disabled=true;
 setCloudStatus("Synchronisation…","syncing");
 try{
  cloudIgnoreRealtimeUntil=Date.now()+2500;
  const result=await cloudClient.from("account_opening_balances").upsert({
   household_id:activeHouseholdId,
   month,
   owner_slot:slot,
   amount,
   updated_at:new Date().toISOString()
  },{onConflict:"household_id,month,owner_slot"}).select("*").single();
  if(result.error)throw result.error;
  accountOpeningBalances.set(`${key}|${slot}`,Number(result.data.amount)||0);
  closeAccountBalanceEditor();
  render();
  setCloudStatus("Synchronisé","ok");
  if(typeof showUndoToast==="function")showUndoToast(`Solde de départ enregistré : ${euro(amount)}`);
 }catch(error){
  console.error("Account opening balance",error);
  setCloudStatus("Échec de synchronisation · réessayer","error");
 }finally{
  if(button)button.disabled=false;
 }
}

if(typeof document!=="undefined"){
 document.addEventListener("click",event=>{
  const trigger=event.target.closest("[data-edit-opening-balance]");
  if(trigger)openAccountBalanceEditor(trigger.dataset.editOpeningBalance);
 });
 document.getElementById("closeAccountBalance")?.addEventListener("click",closeAccountBalanceEditor);
 document.getElementById("cancelAccountBalance")?.addEventListener("click",closeAccountBalanceEditor);
 document.getElementById("saveAccountOpening")?.addEventListener("click",saveAccountOpeningBalance);
 document.getElementById("accountBalanceBackdrop")?.addEventListener("click",event=>{if(event.target.id==="accountBalanceBackdrop")closeAccountBalanceEditor()});
 document.getElementById("accountOpeningInput")?.addEventListener("keydown",event=>{if(event.key==="Escape")closeAccountBalanceEditor()});
}
