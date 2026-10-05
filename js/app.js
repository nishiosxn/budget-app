// V2.5 — initialisation finale de l'application
function enterPrimaryActionFor(input){
 if(input.closest("#modalBackdrop"))return document.getElementById("saveTransaction");
 if(input.closest("#categoryEditBackdrop"))return document.getElementById("saveCategoryEdit");
 if(input.closest("#recurrenceEditBackdrop"))return document.getElementById("saveRecurrenceEdit");
 if(input.closest("#accountBalanceBackdrop"))return document.getElementById("saveAccountOpening");
 if(input.closest(".settings-household"))return document.getElementById("saveHouseholdBtn");
 if(["setupHouseholdName","setupPersonB","setupPersonA"].includes(input.id))return document.getElementById("createNewBudgetBtn");
 if(input.closest("#cloudLoginView"))return document.getElementById("cloudAuthSubmitBtn");
 if(input.closest("#cloudInviteView"))return document.getElementById("cloudAcceptInviteBtn");
 if(input.closest("#cloudResetView"))return document.getElementById("cloudResetPasswordBtn");
 return null;
}
document.querySelectorAll('input:not([type="file"])').forEach(input=>input.setAttribute("enterkeyhint","done"));
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"){closeModal();closeCategoryEditor();closeCategoryDelete();closeRecurrenceDelete();closeRecurrenceEdit();closeSettings();if(state.onboardingComplete)closeOnboarding();return}
 if(e.key!=="Enter"||e.isComposing||e.repeat||e.defaultPrevented)return;
 const input=e.target;
 if(!(input instanceof HTMLInputElement)||["file","button","submit","checkbox","radio"].includes(input.type))return;
 const action=enterPrimaryActionFor(input);
 if(!action||action.disabled||action.hidden)return;
 e.preventDefault();
 input.blur();
 action.click();
});
syncHouseholdUi();
render();
initCloudAuth();
