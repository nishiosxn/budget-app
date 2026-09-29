// V2.2 — initialisation finale de l'application
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeCategoryEditor();closeCategoryDelete();closeRecurrenceDelete();closeRecurrenceEdit();closeSettings()}});
render();
