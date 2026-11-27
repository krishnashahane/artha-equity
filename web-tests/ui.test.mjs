import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trapFocus} from '../public/focus.js';
const element=(visible=true,disabled=false)=>({disabled,tabIndex:0,getClientRects:()=>visible?[{}]:[],focus(){this.focused=true;}});
test('focus trap wraps both ways and ignores hidden or disabled controls',()=>{
  const first=element(),last=element(),hidden=element(false),disabled=element(true,true),controls=[hidden,first,disabled,last];
  const modal={querySelectorAll:()=>controls,contains:x=>controls.includes(x)};
  let prevented=0;const ev={key:'Tab',shiftKey:false,preventDefault(){prevented++;}};
  trapFocus(ev,modal,last);assert.equal(first.focused,true);assert.equal(prevented,1);
  ev.shiftKey=true;trapFocus(ev,modal,first);assert.equal(last.focused,true);assert.equal(prevented,2);
  first.focused=false;trapFocus(ev,modal,{});assert.equal(first.focused,true);
});
test('empty dialogs retain focus and non-Tab keys are untouched',()=>{
  const modal={querySelectorAll:()=>[],focus(){this.focused=true;}};let prevented=false;
  trapFocus({key:'Tab',preventDefault(){prevented=true;}},modal,null);assert.ok(prevented&&modal.focused);
  trapFocus({key:'Escape',preventDefault(){throw Error('unexpected');}},modal,null);
});
function luminance(hex){const v=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function contrast(a,b){const x=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (x[1]+.05)/(x[0]+.05);}
test('theme text, links and button tokens have AA contrast',()=>{
  for(const [fg,bg] of [['595960','f5f5f7'],['595960','ffffff'],['005ebd','ffffff'],['1c7030','f5f5f7'],['80580f','f5f5f7'],['ffffff','005ebd'],['c0c0c8','202024'],['c0c0c8','141416'],['9cc5ff','202024']])assert.ok(contrast(fg,bg)>=4.5,`${fg}/${bg}`);
  const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/prefers-color-scheme:dark/);assert.match(css,/max-width:1179px/);assert.match(css,/min-width:768px/);
});
