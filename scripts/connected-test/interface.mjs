import test from "node:test";
import assert from "node:assert/strict";
import {connected} from "./harness.mjs";
import {provision,setup,invite,rows} from "./financial-fixture.mjs";

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
 const [owner,partner]=await Promise.all(env.users.slice(0,2).map(user=>env.session(user)));
 const household=await provision(owner);
 const one=await owner.openApp(household);
 await waitText(one,selectors.title,/Votre foyer/);
 await dismissInstall(one);
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
 await dismissInstall(one);
 await dismissInstall(two);
 await one.locator('[data-tab="categories"]').click();
 await one.locator('[data-demo-fill-all][data-section="Obligatoires"]').click();
 await waitText(two,"#expenseTotal",/340,02/);
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
 owner.dropNextAssistantResponse("commit_atomic");
 await one.getByRole("button",{name:"Confirmer",exact:true}).click();
 await waitText(one,"#sbAssistantStatus",/Confirmation à vérifier/);
 await one.reload();
 await waitText(one,"#sbAssistantStatus",/Reçu vérifié/);
 await waitText(two,"#expenseTotal",/28,00/);
 const tx=await rows(partner,"transactions",household,"&archived_at=is.null");
 assert.equal(tx.length,1);
 assert.equal(Number(tx[0].amount),28);
});
