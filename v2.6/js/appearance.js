// V2.6 — apparence personnelle (par compte, sans modifier le foyer partagé)
const APPEARANCE_DEFAULT={color:"green",font:"current",customColor:"#7c73d8"};
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

function validAppearanceHex(value){
 const raw=String(value||"").trim();
 return /^#[0-9a-f]{6}$/i.test(raw)?raw.toUpperCase():"";
}
function mixAppearanceHex(from,to,amount){
 const a=hexToRgb(from),b=hexToRgb(to),t=Math.max(0,Math.min(1,Number(amount)||0));
 const channel=(x,y)=>Math.round(x+(y-x)*t).toString(16).padStart(2,"0");
 return ("#"+channel(a.r,b.r)+channel(a.g,b.g)+channel(a.b,b.b)).toUpperCase();
}
function appearanceLuminance(hex){
 const {r,g,b}=hexToRgb(hex);
 const linear=value=>{const c=value/255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};
 return .2126*linear(r)+.7152*linear(g)+.0722*linear(b);
}
function normalizeUserAppearance(value){
 const color=value?.color==="custom"?"custom":APPEARANCE_COLORS[value?.color]?value.color:APPEARANCE_DEFAULT.color;
 const font=APPEARANCE_FONTS[value?.font]?value.font:APPEARANCE_DEFAULT.font;
 const customColor=validAppearanceHex(value?.customColor)||APPEARANCE_DEFAULT.customColor;
 return {color,font,customColor};
}
function appearancePalette(value){
 const appearance=normalizeUserAppearance(value);
 if(appearance.color!=="custom"){
  const preset=APPEARANCE_COLORS[appearance.color];
  return {...preset,base:preset.accent,surface:preset.accent};
 }
 const base=appearance.customColor,luminance=appearanceLuminance(base);
 const accent=luminance>.52?mixAppearanceHex(base,"#000000",.38):base;
 const surface=luminance>.62?mixAppearanceHex(base,"#000000",.22):base;
 return {
  label:"Personnalisé",
  base,
  accent,
  surface,
  deep:mixAppearanceHex(base,"#000000",.58),
  soft:mixAppearanceHex(base,"#FFFFFF",.88),
  border:mixAppearanceHex(base,"#FFFFFF",.60)
 };
}
function appearanceUserId(session=null){
 const active=typeof cloudSession!=="undefined"?cloudSession:null;
 return String(session?.user?.id||active?.user?.id||"").trim();
}
function appearanceStorageKey(userId=appearanceUserId()){
 return "budget-foyer-v2.6-appearance:"+(userId||"anonymous");
}
function hexToRgb(hex){
 const value=String(hex||"").replace("#","");
 if(!/^[0-9a-f]{6}$/i.test(value))return {r:47,g:107,b:81};
 return {r:parseInt(value.slice(0,2),16),g:parseInt(value.slice(2,4),16),b:parseInt(value.slice(4,6),16)};
}
function rgbToHex(r,g,b){
 const channel=value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,"0");
 return ("#"+channel(r)+channel(g)+channel(b)).toUpperCase();
}
function hexToHsv(hex){
 const {r,g,b}=hexToRgb(hex),rr=r/255,gg=g/255,bb=b/255;
 const max=Math.max(rr,gg,bb),min=Math.min(rr,gg,bb),delta=max-min;
 let h=0;
 if(delta){
  if(max===rr)h=60*(((gg-bb)/delta)%6);
  else if(max===gg)h=60*((bb-rr)/delta+2);
  else h=60*((rr-gg)/delta+4);
 }
 if(h<0)h+=360;
 return {h,s:max===0?0:delta/max,v:max};
}
function hsvToHex(h,s,v){
 h=((Number(h)||0)%360+360)%360;s=Math.max(0,Math.min(1,Number(s)||0));v=Math.max(0,Math.min(1,Number(v)||0));
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 let r=0,g=0,b=0;
 if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
 return rgbToHex((r+m)*255,(g+m)*255,(b+m)*255);
}
function currentUserAppearance(){return {...activeUserAppearance}}
function appearanceFromLocal(userId=appearanceUserId()){
 try{return normalizeUserAppearance(JSON.parse(localStorage.getItem(appearanceStorageKey(userId))||"null"))}catch{return {...APPEARANCE_DEFAULT}}
}
function themeLogoMarkup(className="theme-logo"){
 return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="16" fill="currentColor"/><path d="M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z" fill="#F4F5F1"/></svg>`;
}
function applyUserAppearance(value,{persistLocal=false,userId=appearanceUserId()}={}){
 const appearance=normalizeUserAppearance(value),palette=appearancePalette(appearance),font=APPEARANCE_FONTS[appearance.font],rgb=hexToRgb(palette.accent),root=document.documentElement;
 activeUserAppearance=appearance;
 root.style.setProperty("--theme-color",palette.base);
 root.style.setProperty("--accent",palette.accent);
 root.style.setProperty("--accent-surface",palette.surface);
 root.style.setProperty("--accent-deep",palette.deep);
 root.style.setProperty("--accent-soft",palette.soft);
 root.style.setProperty("--accent-border",palette.border);
 root.style.setProperty("--accent-rgb",`${rgb.r},${rgb.g},${rgb.b}`);
 root.style.setProperty("--income",palette.accent);
 root.style.setProperty("--app-font",font.stack);
 root.dataset.appearanceColor=appearance.color;
 root.dataset.appearanceFont=appearance.font;
 const svgIcon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="16" fill="${palette.base}"/><path d="M32 16 A16 16 0 1 0 48 32 H38 A6 6 0 1 1 32 26 Z" fill="#F4F5F1"/></svg>`;
 const favicon=document.querySelector('link[rel="icon"][type="image/svg+xml"]');
 if(favicon)favicon.href="data:image/svg+xml,"+encodeURIComponent(svgIcon);
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
 const client=typeof cloudClient!=="undefined"?cloudClient:null;
 const session=typeof cloudSession!=="undefined"?cloudSession:null;
 if(!client||!session?.user)return appearance;
 const current=session.user.user_metadata||{};
 const {data,error}=await client.auth.updateUser({data:{...current,budget_appearance:appearance}});
 if(error)throw error;
 if(data?.user&&session)session.user=data.user;
 return appearance;
}
function resetUserAppearance(){return applyUserAppearance(APPEARANCE_DEFAULT)}
function appearanceCustomPanelMarkup(appearance){
 const hsv=hexToHsv(appearance.customColor),left=(hsv.s*100).toFixed(2),top=((1-hsv.v)*100).toFixed(2),hue=(hsv.h/360*100).toFixed(2);
 return `<div class="appearance-custom-panel" data-appearance-custom-panel>
   <div class="appearance-sv" data-appearance-sv style="--picker-hue:${hsv.h.toFixed(2)}deg">
    <span class="appearance-sv-thumb" style="left:${left}%;top:${top}%"></span>
   </div>
   <div class="appearance-hue" data-appearance-hue>
    <span class="appearance-hue-thumb" style="left:${hue}%"></span>
   </div>
   <div class="appearance-hex-row">
    <span>HEX</span>
    <input type="text" inputmode="text" maxlength="7" autocomplete="off" spellcheck="false" data-appearance-hex value="${appearance.customColor}">
    <span class="appearance-custom-preview" style="--custom-preview:${appearance.customColor}"></span>
   </div>
  </div>`;
}
function appearancePickerMarkup(context,value=currentUserAppearance()){
 const appearance=normalizeUserAppearance(value);
 return `<div class="appearance-picker" data-appearance-picker="${escapeHtml(context)}">
  <div class="appearance-picker-group">
   <span class="appearance-picker-label">Couleur principale</span>
   <div class="appearance-colors">
    ${Object.entries(APPEARANCE_COLORS).map(([id,item])=>`<button type="button" class="appearance-color ${appearance.color===id?"active":""}" data-appearance-color="${id}" style="--swatch:${item.accent}" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}"><i></i><span>${escapeHtml(item.label)}</span></button>`).join("")}
    <button type="button" class="appearance-color appearance-color-custom ${appearance.color==="custom"?"active":""}" data-appearance-custom-toggle aria-expanded="${appearance.color==="custom"?"true":"false"}" title="Choisir une couleur personnalisée">
     <svg class="appearance-custom-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3L17.8 5a2.1 2.1 0 0 0-3 0L4 15.8V20Z"/><path d="m13.6 6.2 4.2 4.2"/><path d="M4 15.8 8.2 20"/></svg>
     <span>Personnalisé</span>
    </button>
   </div>
   ${appearance.color==="custom"?appearanceCustomPanelMarkup(appearance):""}
  </div>
  <div class="appearance-picker-group">
   <span class="appearance-picker-label">Police</span>
   <div class="appearance-fonts">
    ${Object.entries(APPEARANCE_FONTS).map(([id,item])=>`<button type="button" class="appearance-font ${appearance.font===id?"active":""}" data-appearance-font="${id}" style="font-family:${item.stack}"><strong>${escapeHtml(item.sample)}</strong><span>${escapeHtml(item.label)}</span></button>`).join("")}
   </div>
  </div>
 </div>`;
}
function appearanceCustomFromPointer(target,event,current=currentUserAppearance()){
 const appearance=normalizeUserAppearance(current),rect=target.getBoundingClientRect();
 const x=Math.max(0,Math.min(rect.width,event.clientX-rect.left)),y=Math.max(0,Math.min(rect.height,event.clientY-rect.top));
 const hsv=hexToHsv(appearance.customColor);
 if(target.matches("[data-appearance-sv]")){
  hsv.s=rect.width?x/rect.width:0;
  hsv.v=rect.height?1-y/rect.height:0;
 }else if(target.matches("[data-appearance-hue]")){
  hsv.h=rect.width?x/rect.width*360:0;
 }
 appearance.color="custom";
 appearance.customColor=hsvToHex(hsv.h,hsv.s,hsv.v);
 return appearance;
}
function syncAppearanceCustomPanel(root,value,{syncHex=true}={}){
 const appearance=normalizeUserAppearance(value),panel=root?.querySelector?.("[data-appearance-custom-panel]");
 if(!panel)return;
 const hsv=hexToHsv(appearance.customColor);
 const sv=panel.querySelector("[data-appearance-sv]"),svThumb=panel.querySelector(".appearance-sv-thumb"),hueThumb=panel.querySelector(".appearance-hue-thumb"),hex=panel.querySelector("[data-appearance-hex]"),preview=panel.querySelector(".appearance-custom-preview");
 if(sv)sv.style.setProperty("--picker-hue",hsv.h.toFixed(2)+"deg");
 if(svThumb){svThumb.style.left=(hsv.s*100)+"%";svThumb.style.top=((1-hsv.v)*100)+"%"}
 if(hueThumb)hueThumb.style.left=(hsv.h/360*100)+"%";
 if(hex&&syncHex&&document.activeElement!==hex){hex.value=appearance.customColor;hex.classList.remove("invalid")}
 if(preview)preview.style.setProperty("--custom-preview",appearance.customColor);
}
function bindAppearanceCustomPicker(root,getAppearance,onChange){
 if(!root||root.dataset.customPickerBound==="1")return;
 root.dataset.customPickerBound="1";
 let activeTarget=null;
 const update=(target,event,commit=false)=>{
  if(!target)return;
  const next=appearanceCustomFromPointer(target,event,getAppearance());
  syncAppearanceCustomPanel(root,next);
  onChange(next,{render:commit});
 };
 root.addEventListener("pointerdown",event=>{
  const target=event.target.closest("[data-appearance-sv],[data-appearance-hue]");
  if(!target)return;
  activeTarget=target;
  target.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  update(target,event,false);
 });
 root.addEventListener("pointermove",event=>{
  if(!activeTarget)return;
  event.preventDefault();
  update(activeTarget,event,false);
 });
 const end=event=>{
  if(!activeTarget)return;
  update(activeTarget,event,true);
  activeTarget=null;
 };
 root.addEventListener("pointerup",end);
 root.addEventListener("pointercancel",()=>{activeTarget=null});
 root.addEventListener("input",event=>{
  const input=event.target.closest("[data-appearance-hex]");
  if(!input)return;
  const hex=validAppearanceHex(input.value);
  input.classList.toggle("invalid",!hex);
  if(!hex)return;
  const next=normalizeUserAppearance(getAppearance());
  next.color="custom";next.customColor=hex;
  syncAppearanceCustomPanel(root,next,{syncHex:false});
  onChange(next,{render:false});
 });
 root.addEventListener("change",event=>{
  const input=event.target.closest("[data-appearance-hex]");
  if(!input)return;
  const hex=validAppearanceHex(input.value);
  if(!hex){input.value=normalizeUserAppearance(getAppearance()).customColor;input.classList.remove("invalid");return}
  const next=normalizeUserAppearance(getAppearance());next.color="custom";next.customColor=hex;onChange(next,{render:true});
 });
}
function appearanceFromPickerEvent(target,current=currentUserAppearance()){
 const next=normalizeUserAppearance(current);
 const customToggle=target.closest?.("[data-appearance-custom-toggle]");
 const color=target.closest?.("[data-appearance-color]")?.dataset.appearanceColor;
 const font=target.closest?.("[data-appearance-font]")?.dataset.appearanceFont;
 if(customToggle)next.color="custom";
 if(color&&APPEARANCE_COLORS[color])next.color=color;
 if(font&&APPEARANCE_FONTS[font])next.font=font;
 return next;
}
