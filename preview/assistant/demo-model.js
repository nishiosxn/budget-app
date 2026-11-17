/* Local, deliberately limited fixture provider. Never an AI model. */
(function(root){
 const examples=["J’ai dépensé 20 € chez Lidl et 10 € chez Action.","Finalement Lidl, c’était 35 €.","Noa a payé 45,90 € de carburant hier.","J’ai reçu un cadeau de 150 €.","Je touche 1 100 € tous les 5 du mois.","Netflix coûte 13,49 € chaque mois.","Prévois 250 € de courses par mois.","Combien reste-t-il ce mois-ci ?","J’ai dépensé chez Lidl."];
 const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9,€]+/g," ").trim();
 const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 function context(now=new Date()){
 const today=dateKey(now);return {today,firstMonth:(now.getFullYear()-1)+"-12",lastMonth:(now.getFullYear()+2)+"-12",selectedMonth:today.slice(0,7),solo:false,actor:"B",members:{B:"Camille",A:"Noa"},categories:[{id:"food",name:"Courses",kind:"expense",owner:"common"},{id:"home",name:"Maison",kind:"expense",owner:"common"},{id:"fuel",name:"Carburant",kind:"expense",owner:"common"},{id:"gift",name:"Cadeaux reçus",kind:"income",owner:"B"},{id:"salary",name:"Salaire",kind:"income",owner:"B"},{id:"sub",name:"Abonnements",kind:"expense",owner:"B"}]};}
 const op=(kind,categoryId,owner,amountCents,date,label,frequency="once")=>({kind,categoryId,owner,amountCents,date,label,frequency});
 const draft=(...operations)=>({kind:"draft",operations});
 const clarify=message=>({kind:"clarify",message});
 function infer(command,ctx,previous){
 if(norm(command)===norm("J’ai dépensé 20 €"))return clarify("Dans quelle catégorie ou chez quel commerçant ?");
 if(norm(command)===norm("J’ai fait un virement"))return clarify("Quel montant et s’agit-il d’un revenu, d’une dépense ou d’un transfert interne ?");
 if(norm(command)===norm("Ajoute 10 € au budget"))return clarify("Quel budget veux-tu ajuster ?");
 const idx=examples.findIndex(e=>norm(e)===norm(command));const d=ctx.today,month=d.slice(0,7);
 switch(idx){
 case 0:return draft(op("expense","food","B",2000,d,"Lidl"),op("expense","home","B",1000,d,"Action"));
 case 1:if(previous?.kind!=="draft"||!previous.operations.some(o=>o.label==="Lidl"))return clarify("Commence par le premier exemple de dépenses Lidl et Action.");return draft(...previous.operations.map(o=>o.label==="Lidl"?{...o,amountCents:3500}:o));
 case 2:{const yesterday=new Date(d+"T12:00:00");yesterday.setDate(yesterday.getDate()-1);return draft(op("expense","fuel","A",4590,dateKey(yesterday),"Carburant"));}
 case 3:return draft(op("income","gift","B",15000,d,"Cadeau"));
 case 4:return draft(op("income","salary","B",110000,month+"-05","Salaire","monthly"));
 case 5:return draft(op("expense","sub","B",1349,month+"-10","Netflix","monthly"));
 case 6:return draft(op("plan","food","common",25000,month+"-01","Budget courses","monthly"));
 case 7:return {kind:"query",query:"summary",month,compareMonth:null,categoryId:null,owner:null};
 case 8:return clarify("Quel montant as-tu dépensé chez Lidl ?");
 default:return clarify("Cette démo locale ne comprend que les exemples proposés. Le véritable modèle IA n’est pas encore connecté.");
 }}
 root.SmartBudgetDemo=Object.freeze({examples:Object.freeze(examples),context,infer});
})(globalThis);