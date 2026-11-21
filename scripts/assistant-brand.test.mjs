import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {inflateSync} from "node:zlib";
const read=f=>fs.readFileSync(f);
function pngCheck(p,size){
 assert.equal(p.subarray(0,8).toString("hex"),"89504e470d0a1a0a");let i=8,colors=null,idat=[],alpha=null;
 while(i<p.length){const n=p.readUInt32BE(i),type=p.toString("ascii",i+4,i+8),data=p.subarray(i+8,i+8+n);if(type==="IHDR"){assert.equal(data.readUInt32BE(0),size);assert.equal(data.readUInt32BE(4),size);assert.equal(data[8],8);assert.equal(data[9],3)}if(type==="PLTE")colors=data;if(type==="tRNS")alpha=data;if(type==="IDAT")idat.push(data);i+=12+n}
 const raw=inflateSync(Buffer.concat(idat));assert.equal(raw.length,size*(size+1));assert.ok(colors);assert.ok(alpha);
 const palette=Array.from({length:colors.length/3},(_,j)=>[colors[j*3],colors[j*3+1],colors[j*3+2],alpha[j]]);
 assert.ok(palette.some(c=>c.join(",")==="92,41,214,255"));assert.ok(palette.some(c=>c.join(",")==="244,245,241,255"));
 const center=raw[Math.floor(size*.25)*(size+1)+Math.floor(size*.75)+1];assert.equal(palette[center].join(","),"92,41,214,255");
}
test("all app icons decode as violet, exact SVG silhouette retained",()=>{
 const svg=read("icons/icon.svg").toString();assert.match(svg,/#5C29D6/);assert.match(svg,/A16 16 0 1 0 48 32/);assert.match(svg,/A6 6 0 1 1 32 26/);
 for(const [file,n] of [["icon-192.png",192],["icon-512.png",512],["apple-touch-icon.png",180]])pngCheck(read("icons/"+file),n);
 const ico=read("icons/favicon.ico");assert.equal(ico.readUInt16LE(4),3);
 for(let i=0;i<3;i++){const off=6+16*i,n=ico[off],length=ico.readUInt32LE(off+8),start=ico.readUInt32LE(off+12);pngCheck(ico.subarray(start,start+length),n)}
});
test("main violet contrast against the logo white exceeds WCAG AA normal text",()=>{
 const lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
 const lum=([r,g,b])=>.2126*lin(r)+.7152*lin(g)+.0722*lin(b);
 assert.ok((lum([244,245,241])+.05)/(lum([92,41,214])+.05)>=4.5);
});
