// V2.5 — initialisation finale de l'application
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeCategoryEditor();closeCategoryDelete();closeRecurrenceDelete();closeRecurrenceEdit();closeSettings();if(state.onboardingComplete)closeOnboarding()}});
syncHouseholdUi();
render();
initCloudAuth();
