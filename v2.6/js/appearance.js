// V2.6 — apparence personnelle (par compte, sans modifier le foyer partagé)
const APPEARANCE_DEFAULT={color:"green",font:"current"};
const APPEARANCE_COLORS={
 green:{label:"Vert",accent:"#2f6b51",deep:"#173c2d",soft:"#e9f2ed",border:"#bfd2c6"},
 blue:{label:"Bleu",accent:"#3f6fa6",deep:"#243f60",soft:"#e9eff6",border:"#c4d2e2"},
 pink:{label:"Rose",accent:"#b6537c",deep:"#673047",soft:"#f7eaf0",border:"#e5c2d1"},
 purple:{label:"Violet",accent:"#7558a6",deep:"#443460",soft:"#f0ecf6",border:"#d2c7e2"},
 orange:{label:"Orange",accent:"#b36a3c",deep:"#673d23",soft:"#f7eee8",border:"#e3c9b7"}
};
const APPEARANCE_FONTS={
 current:{label:"Actuelle",sample:"Budget",stack:'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'},
 compact:{label:"Compacte",sample:"Budget",stack:'Arial,Helvetica,sans-serif'},
 rounded:{label:"Arrondie",sample:"Budget",stack:'"Trebuchet MS",Arial,sans-serif'},
 classic:{label:"Classique",sample:"Budget",stack:'Georgia,"Times New Roman",serif'},
 mono:{label:"Mono",sample:"Budget",stack:'ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace'}
};
let activeUserAppearance={...APPEARANCE_DEFAULT};

function normalizeUserAppearance(value){
 const color=APPEARANCE_COLORS[value?.color]?value.color:APPEARANCE_DEFAULT.color;
 const font=APPEARANCE_FONTS[value?.font]?value.font:APPEARANCE_DEFAULT.font;
 return {color,font};
}
function appearanceUserId(session=null){
 return String(session?.user?.id||globalThis.cloudSession?.user?.id||"").trim();
}
function appearanceStorageKey(userId=appearanceUserId()){
 return "budget-foyer-v2.6-appearance:"+(userId||"anonymous");
}
function hexToRgb(hex){
 const value=String(hex||"").replace("#","");
 if(!/^[0-9a-f]{6}$/i.test(value))return {r:47,g:107,b:81};
 return {r:parseInt(value.slice(0,2),16),g:parseInt(value.slice(2,4),16),b:parseInt(value.slice(4,6),16)};
}
function currentUserAppearance(){return {...activeUserAppearance}}
function appearanceFromLocal(userId=appearanceUserId()){
 try{return normalizeUserAppearance(JSON.parse(localStorage.getItem(appearanceStorageKey(userId))||"null"))}catch{return {...APPEARANCE_DEFAULT}}
}
function themeLogoMarkup(className="theme-logo"){
 return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="16" fill="currentColor"/><path d="M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z" fill="#F4F5F1"/></svg>`;
}
function applyUserAppearance(value,{persistLocal=false,userId=appearanceUserId()}={}){
 const appearance=normalizeUserAppearance(value),palette=APPEARANCE_COLORS[appearance.color],font=APPEARANCE_FONTS[appearance.font],rgb=hexToRgb(palette.accent),root=document.documentElement;
 activeUserAppearance=appearance;
 root.style.setProperty("--accent",palette.accent);
 root.style.setProperty("--accent-deep",palette.deep);
 root.style.setProperty("--accent-soft",palette.soft);
 root.style.setProperty("--accent-border",palette.border);
 root.style.setProperty("--accent-rgb",`${rgb.r},${rgb.g},${rgb.b}`);
 root.style.setProperty("--income",palette.accent);
 root.style.setProperty("--app-font",font.stack);
 root.dataset.appearanceColor=appearance.color;
 root.dataset.appearanceFont=appearance.font;
 if(persistLocal&&userId){
  try{localStorage.setItem(appearanceStorageKey(userId),JSON.stringify(appearance))}catch{}
 }
 return appearance;
}
function loadUserAppearanceFromSession(session){
 const user=session?.user||null,userId=appearanceUserId(session);
 if(!userId){applyUserAppearance(APPEARANCE_DEFAULT);return currentUserAppearance()}
 const metadata=user?.user_metadata?.budget_appearance;
 const appearance=metadata?normalizeUserAppearance(metadata):appearanceFromLocal(userId);
 return applyUserAppearance(appearance,{persistLocal:true,userId});
}
async function saveUserAppearance(value){
 const appearance=applyUserAppearance(value,{persistLocal:true});
 if(!globalThis.cloudClient||!globalThis.cloudSession?.user)return appearance;
 const current=globalThis.cloudSession.user.user_metadata||{};
 const {data,error}=await globalThis.cloudClient.auth.updateUser({data:{...current,budget_appearance:appearance}});
 if(error)throw error;
 if(data?.user&&globalThis.cloudSession)globalThis.cloudSession.user=data.user;
 return appearance;
}
function resetUserAppearance(){return applyUserAppearance(APPEARANCE_DEFAULT)}
function appearancePickerMarkup(context,value=currentUserAppearance()){
 const appearance=normalizeUserAppearance(value);
 return `<div class="appearance-picker" data-appearance-picker="${escapeHtml(context)}">
  <div class="appearance-picker-group">
   <span class="appearance-picker-label">Couleur principale</span>
   <div class="appearance-colors">
    ${Object.entries(APPEARANCE_COLORS).map(([id,item])=>`<button type="button" class="appearance-color ${appearance.color===id?"active":""}" data-appearance-color="${id}" style="--swatch:${item.accent}" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}"><i></i><span>${escapeHtml(item.label)}</span></button>`).join("")}
   </div>
  </div>
  <div class="appearance-picker-group">
   <span class="appearance-picker-label">Police</span>
   <div class="appearance-fonts">
    ${Object.entries(APPEARANCE_FONTS).map(([id,item])=>`<button type="button" class="appearance-font ${appearance.font===id?"active":""}" data-appearance-font="${id}" style="font-family:${item.stack}"><strong>${escapeHtml(item.sample)}</strong><span>${escapeHtml(item.label)}</span></button>`).join("")}
   </div>
  </div>
 </div>`;
}
function appearanceFromPickerEvent(target,current=currentUserAppearance()){
 const next=normalizeUserAppearance(current);
 const color=target.closest?.("[data-appearance-color]")?.dataset.appearanceColor;
 const font=target.closest?.("[data-appearance-font]")?.dataset.appearanceFont;
 if(color&&APPEARANCE_COLORS[color])next.color=color;
 if(font&&APPEARANCE_FONTS[font])next.font=font;
 return next;
}
