import fs from "node:fs";
import path from "node:path";

export function validateDocumentation(files,{modular=true}={}){
  const errors=[];
  const required=[
    "AGENTS.md","README.md","workstate.md","CHANGELOG.md",
    "docs/ASSISTANT_WORKFLOW.md","docs/WORKFLOW_AUDIT.md"
  ];

  for(const file of required){
    if(typeof files[file]!=="string"||!files[file].trim()) errors.push(`${file} manquant ou vide`);
  }

  const versionPattern=/Version du code\s*:\s*`(V\d+(?:\.\d+){0,2})`/g;
  const versions={};
  for(const file of ["README.md","workstate.md"]){
    const matches=[...(files[file]||"").matchAll(versionPattern)];
    if(matches.length!==1) errors.push(`${file}: un unique champ Version du code est requis`);
    else versions[file]=matches[0][1];
  }

  const version=versions["README.md"];
  if(version&&versions["workstate.md"]&&version!==versions["workstate.md"]){
    errors.push("Versions du README et du workstate différentes");
  }

  if(version){
    const headings=[...(files["CHANGELOG.md"]||"").matchAll(/^##\s+(V\d+(?:\.\d+){0,2})(?=\s|$)/gm)].map(match=>match[1]);
    if(!headings.includes(version)) errors.push(`CHANGELOG.md: entrée ${version} absente`);

    if(modular){
      const uiVersions=[...(files["index.html"]||"").matchAll(/(?:Budget foyer · |settings-version">)(V\d+(?:\.\d+){0,2})(?=\s|<)/g)].map(match=>match[1]);
      if(!uiVersions.length||uiVersions.some(item=>item!==version)){
        errors.push(`index.html: version affichée incohérente avec ${version}`);
      }
    }
  }

  for(const file of required){
    const markdown=(files[file]||"").replace(/```[\s\S]*?```/g,"");
    for(const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
      const target=match[1].trim().split(/\s+"/)[0].replace(/^<|>$/g,"").split(/[?#]/)[0];
      if(!target||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      let decoded;
      try{decoded=decodeURIComponent(target)}catch{
        errors.push(`${file}: lien invalide ${target}`);
        continue;
      }
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),decoded));
      if(!Object.hasOwn(files,resolved)) errors.push(`${file}: lien local absent ${target}`);
    }
  }

  return errors;
}

export function readDocumentationFiles(root){
  const files={};

  function visit(relative){
    const directory=path.join(root,relative);
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.name===".git") continue;
      const name=path.posix.join(relative,entry.name);
      if(entry.isDirectory()) visit(name);
      else files[name]=/\.(?:md|html)$/.test(name)?fs.readFileSync(path.join(root,name),"utf8"):"";
    }
  }

  visit(".");
  return files;
}
