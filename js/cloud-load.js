// V2.4 — chargement Supabase vers le cache local V5
async function cloudLoadState(){
 if(!activeHouseholdId)throw new Error("Aucun foyer actif.");
 setCloudStatus("Chargement du cloud…","syncing");
 const householdRequest=cloudClient.from("households").select("*").eq("id",activeHouseholdId).single();
 const categoriesRequest=cloudClient.from("categories").select("*").eq("household_id",activeHouseholdId).order("sort_order");
 const budgetsRequest=cloudClient.from("budgets").select("*").eq("household_id",activeHouseholdId).is("archived_at",null).order("month");
 const transactionsRequest=cloudClient.from("transactions").select("*").eq("household_id",activeHouseholdId).is("archived_at",null).order("transaction_date");
 const recurrencesRequest=cloudClient.from("recurrences").select("*").eq("household_id",activeHouseholdId).is("archived_at",null).order("start_month");
 const [householdRes,categoriesRes,budgetsRes,transactionsRes,recurrencesRes]=await Promise.all([
  householdRequest,categoriesRequest,budgetsRequest,transactionsRequest,recurrencesRequest
 ]);
 for(const result of [householdRes,categoriesRes,budgetsRes,transactionsRes,recurrencesRes])if(result.error)throw result.error;

 const household=householdRes.data;
 const selectedMonth=state.selectedMonth||currentMonthLabel();
 const next=seedState();
 next.onboardingComplete=true;
 next.selectedMonth=selectedMonth;
 next.household=normalizeHousehold({
  name:household.name,
  personB:household.person_b_label,
  personA:household.person_a_label
 });
 const categoryRows=categoriesRes.data||[];
 const createdMonths=categoryRows.map(row=>String(row.created_from||"").slice(0,7)).filter(key=>/^\d{4}-\d{2}$/.test(key)).sort();
 next.createdMonth=createdMonths[0]||monthKey(selectedMonth);
 const idMap=cloudCategoriesToLocal(categoryRows,next);
 applyCloudBudgets(budgetsRes.data||[],idMap,next);
 next.transactions=[
  ...cloudTransactionsToLocal(transactionsRes.data||[],idMap),
  ...cloudRecurrencesToLocal(recurrencesRes.data||[],idMap)
 ];

 cloudApplyingRemote=true;
 try{
  state=normalizeState(next);
  saveState();
  reloadUiFromState();
 }finally{cloudApplyingRemote=false}
 const index=cloudHouseholds.findIndex(item=>item.id===household.id);
 if(index>=0)cloudHouseholds[index]=household;else cloudHouseholds.push(household);
 updateCloudHouseholdUi();
 if(typeof setCloudSyncedBaseline==="function")setCloudSyncedBaseline();
 setCloudStatus("Synchronisé","ok");
 return state;
}
