import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const box={};vm.createContext(box);
vm.runInContext(fs.readFileSync("js/assistant-core.js","utf8"),box);
vm.runInContext(fs.readFileSync("preview/assistant/live/category-rules.js","utf8"),box);
const util=box.SmartBudgetCategoryRules;
const rows=[
 {id:"uuid-courses",legacy_id:"courses",name:"Courses",type:"expense",is_saving:false,owner_slot:"B",created_from:"2026-09-01",excluded_months:[]},
 {id:"uuid-food",legacy_id:"food",name:"Restaurants / fast-food",type:"expense",is_saving:false,owner_slot:"B",created_from:"2026-09-01",excluded_months:[]},
 {id:"uuid-income",legacy_id:"income",name:"Revenus supplémentaires",type:"income",is_saving:false,owner_slot:"B",created_from:"2026-09-01",excluded_months:[]},
 {id:"uuid-salary",legacy_id:"salary",name:"Salaire",type:"income",is_saving:false,owner_slot:"B",created_from:"2026-09-01",excluded_months:[]},
 {id:"uuid-aid",legacy_id:"aid",name:"Aides",type:"income",is_saving:false,owner_slot:"B",created_from:"2026-09-01",excluded_months:[]},
 {id:"uuid-savings",legacy_id:"savings",name:"Épargne",type:"expense",is_saving:true,owner_slot:"B",created_from:"2026-09-01",excluded_months:[]}
];
const c=util.fromRows(rows);
const op=(label,kind="expense",date="2026-11-19")=>({label,kind,date});
test("current expense, income and saving categories are mapped from household rows",()=>{
 assert.equal(c.length,6);
 assert.deepEqual(Array.from(c,x=>x.name),["Courses","Restaurants / fast-food","Revenus supplémentaires","Salaire","Aides","Épargne"]);
 assert.equal(c.find(x=>x.id==="salary").kind,"income");
 assert.equal(c.find(x=>x.id==="savings").kind,"saving");
 assert.equal(c.find(x=>x.id==="courses").createdFrom,"2026-09");
});
test("merchant keyword match uses word boundaries, longest match and accents",()=>{
 assert.equal(util.match(op("Lidl Drive"),c,{lidl:"courses"}),"courses");
 assert.equal(util.match(op("Commande LIDL aujourd'hui"),c,{lidl:"courses"}),"courses");
 assert.equal(util.match(op("Chez McDonald's"),c,{"McDonald's":"food"}),"food");
 assert.equal(util.match(op("Lena"),c,{lena:"income"}),null);
 assert.equal(util.match(op("Actionnaire"),c,{action:"courses"}),null);
 assert.equal(util.match(op("Commande Lidl Drive"),c,{"lidl":"food","lidl drive":"courses"}),"courses");
 assert.equal(util.match(op("J'ai reçu de Léna","income"),c,{"léna":"income"}),"income");
});
test("rules never assign an incompatible, hidden or not-yet-active category",()=>{
 assert.equal(util.match(op("Lidl","income"),c,{lidl:"courses"}),null);
 assert.equal(util.match(op("Salaire","expense"),c,{salaire:"salary"}),null);
 assert.equal(util.match(op("Lidl","plan"),c,{lidl:"courses"}),null);
 assert.equal(util.match(op("Lidl"),[{...c[0],hiddenMonths:["2026-11"]}],{lidl:"courses"}),null);
 assert.equal(util.match(op("Lidl"),[{...c[0],createdFrom:"2027-01"}],{lidl:"courses"}),null);
});
test("ambiguous equal-length keywords cannot silently override category",()=>{
 assert.equal(util.match(op("Boutique AX BY"),c,{"ax":"courses","by":"food"}),null);
 assert.equal(util.match(op("Lidl drive"),c,{"lidl":"food","drive":"food"}),"food");
 assert.equal(util.match(op("Lidl"),c,{lidl:"wrong"}),null);
});
test("catalog rows have a strict maximum and invalid rows are ignored",()=>{
 assert.throws(()=>util.fromRows(Array.from({length:301},()=>({}))));
 const data=util.fromRows([...rows,{id:"uuid-aid",legacy_id:"aid",name:"Duplicate",type:"income"},{id:"bad",name:"",type:"expense"}]);
 assert.equal(data.length,6);
});

test("selector covers the entire Smart Budget automatic category taxonomy, even if no household categories exist",()=>{
 const expected=box.SmartBudgetAssistantCore.categoryRules;
 const options=util.catalogOptions([]);
 assert.equal(options.length,expected.length);
 assert.deepEqual(Array.from(options,x=>x.name),Array.from(expected,x=>x.name));
 assert.equal(new Set(Array.from(options,x=>x.value)).size,options.length);
 assert.ok(options.some(x=>x.name==="Carburant"&&x.value==="rule:fuel"));
 assert.ok(options.some(x=>x.name==="Vêtements"&&x.value==="rule:clothing"));
 assert.ok(options.some(x=>x.name==="Revenus supplémentaires"&&x.kind==="income"));
 assert.ok(options.some(x=>x.name==="Épargne"&&x.kind==="saving"));
});
test("household-specific categories are included without duplicating standard taxonomy names",()=>{
 const opts=util.catalogOptions(c.concat([{id:"other",name:"Netflix",kind:"expense"}]));
 assert.equal(opts.filter(x=>x.name==="Courses").length,1);
 assert.ok(opts.find(x=>x.name==="Netflix"&&x.value==="id:other"));
});
test("saved taxonomy selection resolves existing category or proposes creation when missing",()=>{
 const existing=util.resolve(op("Chez Lidl"),c,{lidl:"rule:groceries"});
 assert.equal(existing.categoryId,"courses");
 assert.equal(existing.ruleKey,"groceries");
 const missing=util.resolve(op("Commande chez Zara"),c,{zara:"rule:clothing"});
 assert.equal(missing.categoryId,null);
 assert.equal(missing.ruleKey,"clothing");
 assert.equal(missing.source,"new");
 const proposed=box.SmartBudgetAssistantCore.draftCategorySuggestion({kind:"expense",categoryId:null}, {categories:c},"clothing");
 assert.equal(proposed.name,"Vêtements");
 assert.equal(util.resolve(op("Commande chez Zara","income"),c,{zara:"rule:clothing"}),null);
 assert.equal(util.match(op("Chez Lidl"),c,{lidl:"rule:groceries"}),"courses");
});
test("existing legacy saved id targets and new id-prefixed household choices both work",()=>{
 assert.equal(util.resolve(op("Commande Lidl"),c,{lidl:"courses"}).categoryId,"courses");
 assert.equal(util.resolve(op("Commande Lidl"),c,{lidl:"id:courses"}).categoryId,"courses");
 assert.equal(util.resolve(op("Commande Lidl"),c,{lidl:"rule:nonexistent"}),null);
});
