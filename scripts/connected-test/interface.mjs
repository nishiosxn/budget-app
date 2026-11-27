import test from "node:test";
import assert from "node:assert/strict";
import {connected} from "./harness.mjs";
import {provision,setup,invite,rows} from "./financial-fixture.mjs";
import {visualRecorder} from "./visual.mjs";

const selectors={
 next:'[data-setup-action="next"]',
 title:".setup-builder-title h3",
 amount:key=>'[data-setup-amount="'+key+'"]',
 selected:key=>'[data-setup-select="'+key+'"]'
};

async function dismissInstall(page){
 const later=page.locator("[data-pwa-later]");
 if(await later.isVisible())await later.click();
}
async function waitText(page,selector,pattern){
 try{await page.locator(selector).filter({hasText:pattern}).waitFor({timeout:10000})}
 catch(error){
  const visible=await page.locator(selector).allTextContents();
  const gate=await page.locator("#cloudGateStatus,#pilotLoginStatus").allTextContents();
  throw Error("Expected "+pattern+" in "+selector+"; got "+JSON.stringify({visible,gate}),{cause:error});
 }
}

test("actual Smart Budget pages create, sync, undo and recover across two Chromium sessions",async t=>{
 const env=await connected(t);
 const visual=await visualRecorder(t);
 const [owner,partner]=await Promise.all(env.users.slice(0,2).map(user=>env.session(user)));
 const household=await provision(owner);
 const one=await owner.openApp(household);
 await waitText(one,selectors.title,/Votre foyer/);
 await dismissInstall(one);
 await visual.capture(one,"builder");
 await one.locator('[data-setup-mode="couple"]').click();
 await one.locator('[data-setup-household="personA"]').fill("Camille");
 await one.locator(selectors.next).click();
 await one.locator(selectors.amount("income:salary-b")).fill("1456.01");
 await one.locator(selectors.next).click();
 await one.locator(selectors.amount("expense:rent")).fill("100.02");
 await one.locator(selectors.next).click();
 await one.locator(selectors.selected("subscription:netflix")).check();
 await one.locator('[data-setup-period="subscription:netflix"]').selectOption("annual");
 await one.locator('[data-setup-sub-amount="subscription:netflix"]').fill("99.99");
 await one.locator(selectors.next).click();
 await one.locator(selectors.next).click();
 await one.locator(selectors.selected("expense:groceries")).check();
 await one.locator(selectors.amount("expense:groceries")).fill("240");
 await one.locator(selectors.next).click();
 await waitText(one,selectors.title,/Votre budget de départ/);
 await waitText(one,".setup-builder-summary",/348,35/);
 await one.locator(selectors.next).click();
 await one.locator("#setupBuilderBackdrop").waitFor({state:"hidden",timeout:10000});
 assert.equal((await setup(owner,household,"status")).status,"complete");
 await invite(owner,partner,household);
 const categories=await rows(partner,"categories",household);
 const budgets=await rows(partner,"budgets",household);
 const byId=id=>Number(budgets.find(b=>b.category_id===categories.find(c=>c.legacy_id===id)?.id)?.planned_amount);
 assert.equal(byId("salary-b"),1456.01);
 assert.equal(byId("setup-sub-netflix"),8.33);
 assert.equal(byId("groceries"),240);

 const two=await partner.openApp(household);
 await waitText(two,"#cloudSyncStatus",/Synchronisé/);
 await two.waitForFunction(()=>cloudRealtimeChannel?.state==="joined",null,{timeout:10000});
 await dismissInstall(one);
 await dismissInstall(two);
 for(const tab of ["overview","categories","history","tracking"]){
  await two.locator(`[data-tab="${tab}"]`).click();
  await visual.capture(two,tab);
 }
 await two.locator('[data-tab="overview"]').click();
 await two.locator("#settingsBtn").click();
 await visual.capture(two,"settings");
 await two.locator("#closeSettings").click();
 await two.locator('[data-add="expense"]').filter({visible:true}).first().click();
 await visual.capture(two,"transaction");
 await two.locator("#closeModal").click();
 await one.locator('[data-tab="categories"]').click();
 await one.locator('[data-demo-fill-all][data-section="Obligatoires"]').click();
 try{await waitText(two,"#expenseTotal",/340,02/)}
 catch(error){
  const active=await rows(partner,"transactions",household,"&archived_at=is.null");
  const snapshots=await Promise.all([one,two].map(page=>page.evaluate(()=>({
   status:document.querySelector("#cloudSyncStatus").textContent,channel:cloudRealtimeChannel?.state,
   month:state.selectedMonth,expense:metrics().expense,count:state.transactions.length
  }))));
  throw Error("Fill diagnostics: "+JSON.stringify({persisted:active.map(t=>t.amount),snapshots}),{cause:error});
 }
 await one.locator("#undoToastBtn").click();
 await waitText(two,"#expenseTotal",/0,00/);
 assert.deepEqual(await rows(partner,"transactions",household,"&archived_at=is.null"),[]);

 await env.startAssistant(household,[owner.user.id,partner.user.id]);
 await one.locator(".assistant-nav[data-open-assistant]").click();
 await one.locator("#pilotAssistant").waitFor({state:"visible",timeout:10000});
 await one.locator("#sbAssistantInput").fill("J’ai dépensé 28 € chez Lidl.");
 await one.locator("#send").click();
 await waitText(one,"#sbAssistantStatus",/0 token IA/);
 await waitText(one,".pilot-op",/Lidl/);
 await visual.capture(one,"assistant-review");
 owner.dropNextAssistantResponse("commit_atomic");
 await one.getByRole("button",{name:"Confirmer",exact:true}).click();
 await waitText(one,"#sbAssistantStatus",/Confirmation à vérifier/);
 one.once("dialog",dialog=>dialog.accept());
 await one.reload();
 await waitText(one,"#sbAssistantStatus",/Reçu vérifié/);
 await waitText(two,"#expenseTotal",/28,00/);
 const tx=await rows(partner,"transactions",household,"&archived_at=is.null");
 assert.equal(tx.length,1);
 assert.equal(Number(tx[0].amount),28);
 await visual.capture(one,"assistant-receipt");
 await two.goto(new URL("admin/",two.url()).href);
 await two.locator("#adminDeniedView:not([hidden]),#adminLoginView:not([hidden])").first().waitFor();
 await visual.capture(two,"admin");
 for(const [name,path] of [["builder-reference","preview/builder/"],["categories-reference","preview/category-distribution/"]]){
  await partner.openApp(household,path);
  await visual.capture(two,name);
 }
 await two.evaluate(()=>localStorage.removeItem("sb-127-auth-token"));
 await partner.page.reload();
 await two.goto(new URL("../../",two.url()).href);
 await two.locator("#cloudSignupModeBtn").waitFor();
 await visual.capture(two,"login");
 await two.locator("#cloudSignupModeBtn").click();
 await visual.capture(two,"signup");
});
