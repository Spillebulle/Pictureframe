const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
let now = 0, id = 0, reduce = false;
const frames = new Map();
const context = {
  window: { innerWidth: 1200, innerHeight: 900, matchMedia: () => ({matches:reduce}), removeEventListener() {} },
  performance: { now: () => now },
  requestAnimationFrame: cb => { frames.set(++id, cb); return id; },
  cancelAnimationFrame: key => frames.delete(key),
  setTimeout: () => 1, clearTimeout() {}
};
let source = fs.readFileSync(require('path').join(__dirname, '../content/viewer.js'), 'utf8');
source = source.replace('  window.__pictureframeViewer = new PictureframeViewer();', '  window.Viewer = PictureframeViewer;');
vm.runInNewContext(source, context);
const V = context.window.Viewer;
V.prototype.initShadowDom = function() {
  this.canvas = {style:{}, classList:{add(){},remove(){}}};
  this.zoomDisplay = {};
  this.img = {naturalWidth:2400, naturalHeight:1600};
  this.overlay = {classList:{remove(){}}};
  this.viewport = {getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},classList:{add(){},remove(){}}};
};
function tick(ms=16.6667) { now += ms; const batch = [...frames.values()]; frames.clear(); batch.forEach(cb=>cb(now)); }
function settle() { for(let n=0;frames.size && n<200;n++) tick(); assert.equal(frames.size,0); }
function near(a,b) { assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`); }
let v = new V();
v.zoomAt(2,400,300);
assert.equal(v.scale,1);
tick(); assert.ok(v.scale>1 && v.scale<2);
for(let n=0;n<5;n++) { tick(); near((400-v.translateX)/v.scale,400); near((300-v.translateY)/v.scale,300); }
v.zoomAt(2,400,300); settle(); near(v.scale,4);
near((400-v.translateX)/v.scale,400);
const before=v.viewState(); v.zoomAt(0.5,800,200); near(v.scale,before.scale);
const wx=(800-before.x)/before.scale; tick(); near((800-v.translateX)/v.scale,wx); settle(); near(v.scale,2);
v.rotation=90; v.flipH=true; v.zoomAt(2,100,100); settle(); assert.equal(v.rotation,90); assert.equal(v.flipH,true);
v.zoomAt(1e6,0,0); settle(); near(v.scale,50);
v.zoomAt(1e-6,0,0); settle(); near(v.scale,0.05);
v.fitToScreen(false); const fitted=v.viewState(); near(v.scale,0.45);
v.setActualSize(); near(v.scale,fitted.scale); tick(160); assert.ok(v.scale>fitted.scale && v.scale<1); settle(); near(v.scale,1); near(v.translateX,-600);
v.fitToScreen(); settle(); near(v.scale,fitted.scale); near(v.translateX,fitted.x);
v.zoomAt(2,400,300); tick(); const visible=v.viewState();
v.onPointerDown({button:0,clientX:10,clientY:10,pointerId:1});
assert.equal(frames.size,0); near(v.initialTx,visible.x);
v.onPointerMove({clientX:30,clientY:40}); near(v.translateX,visible.x+20); near(v.translateY,visible.y+30);
v.isPanning=false;
reduce=true; v.zoomAt(2,400,300); assert.equal(frames.size,0);
v.setActualSize(); near(v.scale,1); assert.equal(frames.size,0);
reduce=false;
const wheel = {preventDefault(){},stopPropagation(){},clientX:200,clientY:300,deltaY:-100,deltaMode:0};
v.onWheel(wheel); v.onWheel(wheel); settle(); near(v.scale,1.18**2);
v.onWheel({...wheel,deltaY:0}); assert.equal(frames.size,0);
v.settings.invertZoom=true; v.onWheel(wheel); settle(); near(v.scale,1.18);
v.zoomAt(2,200,300); v.isOpen=true; v.close(); assert.equal(frames.size,0);
// Same elapsed time should yield the same smoothing at different refresh rates.
function atRate(dt) { let x=new V(); x.zoomAt(2,400,300); for(let i=0;i<120/dt;i++) tick(dt); x.stopZoomAnimation(); return x.scale; }
near(atRate(10),atRate(20));
console.log('PASS: smooth intermediate frames, anchor stability, accumulated input, moving anchor, rotation/flip, limits, fit/actual tween, drag interruption, reduced motion, wheel normalization/inversion, close cancellation, frame-rate independence.');
