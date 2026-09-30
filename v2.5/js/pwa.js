(()=>{
  const DISMISS_KEY="budget-foyer-v2.5-pwa-dismissed-at";
  const DISMISS_DELAY=7*24*60*60*1000;
  let deferredInstallPrompt=null;
  let showTimer=null;

  const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const isAndroid=()=>/android/i.test(navigator.userAgent);
  const isMobile=()=>window.matchMedia("(max-width: 820px)").matches||isIos()||isAndroid();

  function configureMobileShell(){
    const root=document.documentElement;
    const standalone=isStandalone();
    root.classList.toggle("mobile-web",isMobile());
    root.classList.toggle("display-standalone",standalone);
    root.classList.toggle("display-browser",!standalone);

    if(!isMobile())return;

    const viewport=document.querySelector('meta[name="viewport"]');
    if(viewport){
      viewport.setAttribute("content","width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover");
    }

    ["gesturestart","gesturechange","gestureend"].forEach(type=>{
      document.addEventListener(type,event=>event.preventDefault(),{passive:false});
    });
  }

  function registerServiceWorker(){
    if(!("serviceWorker" in navigator))return;
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{});
    },{once:true});
  }

  function recentlyDismissed(){
    try{
      const value=Number(localStorage.getItem(DISMISS_KEY)||0);
      return value>0&&Date.now()-value<DISMISS_DELAY;
    }catch{return false}
  }

  function rememberDismissal(){
    try{localStorage.setItem(DISMISS_KEY,String(Date.now()))}catch{}
  }

  function appIsVisible(){
    const gate=document.getElementById("cloudGate");
    if(!gate)return true;
    return gate.hidden||gate.getAttribute("aria-hidden")==="true"||!gate.classList.contains("open");
  }

  function closeInstallPrompt(remember=true){
    if(showTimer){clearTimeout(showTimer);showTimer=null}
    document.getElementById("pwaInstallBackdrop")?.remove();
    document.body.classList.remove("pwa-install-open");
    if(remember)rememberDismissal();
  }

  function shareIcon(){
    return '<span class="pwa-install-share" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V3"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8h14v-8"/></svg></span>';
  }

  function getInstructions(){
    if(isIos()){
      return {
        intro:"Ajoutez Budget à votre écran d’accueil pour l’ouvrir en plein écran, comme une application.",
        steps:[
          "Touchez le bouton "+shareIcon()+" <strong>Partager</strong> du navigateur.",
          "Faites défiler puis touchez <strong>Sur l’écran d’accueil</strong>.",
          "Touchez <strong>Ajouter</strong>.",
          "Ouvrez ensuite <strong>Budget</strong> depuis l’icône créée."
        ]
      };
    }
    if(isAndroid()){
      return {
        intro:"Installez Budget sur votre écran d’accueil pour l’ouvrir comme une application.",
        steps:deferredInstallPrompt?[
          "Touchez <strong>Installer l’application</strong> ci-dessous.",
          "Validez l’installation proposée par le navigateur.",
          "Ouvrez ensuite <strong>Budget</strong> depuis votre écran d’accueil."
        ]:[
          "Ouvrez le menu <strong>⋮</strong> de votre navigateur.",
          "Touchez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.",
          "Validez puis ouvrez <strong>Budget</strong> depuis l’icône créée."
        ]
      };
    }
    return {
      intro:"Ajoutez Budget à votre écran d’accueil pour l’utiliser comme une application.",
      steps:[
        "Ouvrez le menu de partage ou le menu du navigateur.",
        "Choisissez <strong>Ajouter à l’écran d’accueil</strong> ou <strong>Installer l’application</strong>.",
        "Validez l’ajout puis ouvrez <strong>Budget</strong> depuis l’icône créée."
      ]
    };
  }

  async function installFromBrowser(){
    if(!deferredInstallPrompt)return;
    const prompt=deferredInstallPrompt;
    deferredInstallPrompt=null;
    prompt.prompt();
    try{
      const choice=await prompt.userChoice;
      closeInstallPrompt(choice?.outcome!=="accepted");
    }catch{
      closeInstallPrompt(false);
    }
  }

  function showInstallPrompt(){
    showTimer=null;
    if(isStandalone()||!isMobile()||recentlyDismissed()||!appIsVisible()||document.getElementById("pwaInstallBackdrop"))return;

    const copy=getInstructions();
    const backdrop=document.createElement("div");
    backdrop.id="pwaInstallBackdrop";
    backdrop.className="pwa-install-backdrop";
    backdrop.setAttribute("role","presentation");

    const primary=deferredInstallPrompt
      ? '<button class="btn btn-income" type="button" data-pwa-install>Installer l’application</button>'
      : '<button class="btn btn-income" type="button" data-pwa-close>J’ai compris</button>';

    backdrop.innerHTML=
      '<section class="pwa-install-panel" role="dialog" aria-modal="true" aria-labelledby="pwaInstallTitle">'+
        '<div class="pwa-install-head">'+
          '<div class="pwa-install-brand"><div class="logo"><img src="icons/icon.svg" alt="" /></div><div><h2 id="pwaInstallTitle" class="pwa-install-title">Installer Budget</h2><p class="pwa-install-subtitle">Accès rapide · ouverture plein écran</p></div></div>'+
          '<button class="pwa-install-close" type="button" data-pwa-close aria-label="Fermer">×</button>'+
        '</div>'+
        '<p class="pwa-install-copy">'+copy.intro+'</p>'+
        '<ol class="pwa-install-steps">'+copy.steps.map(step=>'<li class="pwa-install-step"><span>'+step+'</span></li>').join("")+'</ol>'+
        '<div class="pwa-install-actions">'+primary+'<button class="btn btn-ghost pwa-install-later" type="button" data-pwa-later>Plus tard</button></div>'+
        '<p class="pwa-install-note">Une fois installé, ce message ne s’affichera plus quand Budget est ouvert depuis son icône.</p>'+
      '</section>';

    document.body.appendChild(backdrop);
    document.body.classList.add("pwa-install-open");

    backdrop.querySelectorAll("[data-pwa-close],[data-pwa-later]").forEach(button=>button.addEventListener("click",()=>closeInstallPrompt(true)));
    backdrop.querySelector("[data-pwa-install]")?.addEventListener("click",installFromBrowser);
    backdrop.addEventListener("click",event=>{if(event.target===backdrop)closeInstallPrompt(true)});
    backdrop.querySelector(".pwa-install-close")?.focus();
  }

  function schedulePrompt(){
    if(isStandalone()||!isMobile()||recentlyDismissed())return;
    if(appIsVisible()){
      if(!showTimer)showTimer=setTimeout(showInstallPrompt,850);
      return;
    }

    const gate=document.getElementById("cloudGate");
    if(!gate)return;
    const observer=new MutationObserver(()=>{
      if(appIsVisible()){
        observer.disconnect();
        if(!showTimer)showTimer=setTimeout(showInstallPrompt,850);
      }
    });
    observer.observe(gate,{attributes:true,attributeFilter:["class","aria-hidden","hidden"]});
  }

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    if(document.readyState!=="loading")schedulePrompt();
  });

  window.addEventListener("appinstalled",()=>{
    try{localStorage.removeItem(DISMISS_KEY)}catch{}
    closeInstallPrompt(false);
  });

  configureMobileShell();
  registerServiceWorker();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedulePrompt,{once:true});
  else schedulePrompt();
})();
