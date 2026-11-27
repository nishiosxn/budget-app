import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";

const widths=[320,375,390,430,768,1024,1280,1440,1920];

export async function visualRecorder(t){
 const output=process.env.SB_VISUAL_OUTPUT;
 const measurements=[];
 if(output){
  await mkdir(output,{recursive:true});
  t.after(()=>writeFile(join(output,"measurements.json"),JSON.stringify(measurements,null,2)));
 }
 return {async shot(page,name){
  if(output)await page.screenshot({path:join(output,name+".png"),animations:"disabled"});
 },async capture(page,name){
  if(!output)return;
  const originalViewport=page.viewportSize();
  try{
   for(const theme of ["light","dark"]){
    await page.emulateMedia({colorScheme:theme,reducedMotion:"reduce"});
    for(const width of widths){
     await page.setViewportSize({width,height:width<600?844:960});
     await page.evaluate(()=>document.fonts.ready.then(()=>true));
     const layout=await page.evaluate(()=>{
      const root=document.documentElement;
      const outside=[...document.querySelectorAll("body *")].filter(element=>{
       if(!(element instanceof HTMLElement)||!element.offsetWidth||getComputedStyle(element).visibility!=="visible")return false;
       const box=element.getBoundingClientRect();
       return box.left>=0&&box.right>root.clientWidth+1&&!element.closest(".table-wrap");
      }).slice(0,12).map(element=>element.id||element.className);
      return {viewport:root.clientWidth,content:root.scrollWidth,outside,appTheme:root.dataset.budgetTheme||root.dataset.assistantTheme};
     });
     measurements.push({page:name,width,theme,...layout});
     if(width===390||width===1440)await page.screenshot({path:join(output,`${name}-${width}-${theme}.png`),animations:"disabled"});
    }
   }
  }finally{
   await page.setViewportSize(originalViewport);
   await page.emulateMedia({colorScheme:"light",reducedMotion:"reduce"});
  }
 }};
}
