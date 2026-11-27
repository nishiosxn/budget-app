import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

export async function verified(promise,message){
 const response=await promise;
 assert.ok(response.ok,(message||"disposable response")+" returned "+response.status+(response.data?.code?" ("+response.data.code+")":""));
 return response.data;
}
export const householdFilter=h=>"?household_id=eq."+encodeURIComponent(h);
export function rows(session,table,household,query=""){
 return verified(session.call("/rest/v1/"+table+householdFilter(household)+query),table);
}
export function insert(session,table,body){
 return verified(session.call("/rest/v1/"+table,{method:"POST",headers:{Prefer:"return=representation"},body}),"insert "+table);
}
export function category(id,name,type,amountCents,owner="B",section=null,saving=false){
 return {id,name,type,owner,section,saving,custom:true,amountCents};
}
export function payload(mode="couple"){
 const b=[
  category("income","Revenus supplémentaires","income",175601),
  category("salary","Salaire","income",90000),
  category("restaurants","Restaurants","expense",10000,"B","Vie courante"),
  category("groceries","Courses","expense",24000,"B","Vie courante"),
  category("home","Maison / entretien","expense",8000,"B","Vie courante"),
  category("transport","Transport","expense",6000,"B","Vie courante"),
  category("fuel","Carburant","expense",3000,"B","Vie courante"),
  category("sub","Abonnements","expense",833,"B","Abonnements"),
  category("saving","Épargne","expense",2000,"B","Obligatoires",true)
 ];
 return {name:"Foyer de recette",personA:"Camille",personB:"Alex",mode,month:"2025-01-01",appearance:{color:"purple"},categories:b};
}
export const builderArgs=(h,action,request=null,draft=null)=>({p_household:h,p_action:action,p_request:request,p_draft:draft});
export function setup(session,h,action,request,draft){
 return verified(session.rpc("budget_builder_setup",builderArgs(h,action,request,draft)),"Builder "+action);
}
export function provision(session){
 return verified(session.rpc("provision_budget_builder",{p_name:"Foyer provisoire",p_display_name:"Alex"}),"provision");
}
export async function completeSetup(session,mode){
 const h=await provision(session),req=randomUUID(),draft=payload(mode);
 assert.equal((await setup(session,h,"stage",req,draft)).status,"staged");
 assert.equal((await setup(session,h,"commit",req)).status,"complete");
 return {h,req,draft};
}
export async function invite(owner,partner,h){
 const token=await verified(owner.rpc("create_household_invite",{p_household_id:h,p_slot:"A"}),"invite");
 assert.equal(await verified(partner.rpc("accept_household_invite",{p_token:token,p_display_name:"Camille"}),"accept invite"),h);
}
