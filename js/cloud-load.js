// V2.5.1 — chargement Supabase vers l'état de session + baseline en mémoire
async function cloudLoadState(){
 if(!activeHouseholdId)throw new Error("Aucun foyer actif.");
 setCloudStatus("Chargement du cloud…","syncing");
 const householdRequest=cloudClient.from("households").select("*").eq("id",activeHouseholdId).single();
 const categoriesRequest=cloudClient.from("categories").select("*").eq("household_id",activeHouseholdId).order("sort_order");
 const budgetsRequest=cloudClient.from("budgets").select("*").eq("household_id",activeHouseholdId).order("month");
 const transactionsRequest=cloudClient.from("transactions").select("*").eq("household_id",activeHouseholdId).order("transaction_date");
 const recurrencesRequest=cloudClient.from("recurrences").select("*").eq("household_id",activeHouseholdId).order("start_month");
 const openingBalancesRequest=cloudClient.from("account_opening_balances").select("*").eq("household_id",activeHouseholdId).order("month");
 const [householdRes,categoriesRes,budgetsRes,transactionsRes,recurrencesRes,openingBalancesRes]=await Promise.all([
  householdRequest,categoriesRequest,budgetsRequest,transactionsRequest,recurrencesRequest,openingBalancesRequest
 ]);
 for(const result of [householdRes,categoriesRes,budgetsRes,transactionsRes,recurrencesRes,openingBalancesRes])if(result.error)throw result.error;

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
 const allBudgetRows=budgetsRes.data||[];
 const allTransactionRows=transactionsRes.data||[];
 const allRecurrenceRows=recurrencesRes.data||[];
 if(typeof loadAccountOpeningBalanceRows==="function")loadAccountOpeningBalanceRows(openingBalancesRes.data||[]);
 applyCloudBudgets(allBudgetRows.filter(row=>!row.archived_at),idMap,next);
 next.transactions=[
  ...cloudTransactionsToLocal(allTransactionRows.filter(row=>!row.archived_at),idMap),
  ...cloudRecurrencesToLocal(allRecurrenceRows.filter(row=>!row.archived_at),idMap)
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
 if(typeof cloudCaptureRemoteBaseline==="function")cloudCaptureRemoteBaseline({
  household,
  categories:categoryRows,
  budgets:allBudgetRows,
  transactions:allTransactionRows,
  recurrences:allRecurrenceRows
 });
 if(typeof setCloudSyncedBaseline==="function")setCloudSyncedBaseline();
 if(typeof clearCurrentCloudDataCache==="function")clearCurrentCloudDataCache();
 if(typeof cloudClearConflict==="function")cloudClearConflict();
 setCloudStatus("Synchronisé","ok");
 return state;
}
