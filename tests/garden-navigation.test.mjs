import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapGesture, clearSegment, findRoute } from '../garden-navigation.mjs';
const pointer=(id,x=20,y=30,extra={})=>({pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch',...extra});

test('small finger jitter remains a tap; a drag returning to its origin never becomes a tap',()=>{
  const g=new TapGesture();g.down(pointer(1),0);assert.equal(g.move(pointer(1,24,34)),false);assert.equal(g.up(pointer(1,24,34),100),true);
  g.down(pointer(1),200);g.move(pointer(1,80,30));g.move(pointer(1));assert.equal(g.up(pointer(1),400),false);
});
test('pinch, cancelled gestures, long press and secondary mouse buttons never command the cat',()=>{
  const g=new TapGesture();g.down(pointer(1),0);g.down(pointer(2),10);assert.equal(g.up(pointer(2),20),false);assert.equal(g.up(pointer(1),30),false);
  g.down(pointer(3),40);g.cancel(3);assert.equal(g.up(pointer(3),50),false);
  g.down(pointer(4),60);assert.equal(g.up(pointer(4),800),false);
  g.down(pointer(5,20,30,{button:2,pointerType:'mouse'}),900);assert.equal(g.up(pointer(5,20,30,{button:2}),950),false);
  g.down(pointer(6),1000);assert.equal(g.up(pointer(6),1100),true);
});
test('route goes around a pond, preserving clearance along every segment',()=>{
  const walkable=(x,z)=>Math.abs(x)<12&&Math.abs(z)<12&&(x/4)**2+(z/3)**2>=1;
  const start={x:-7,z:0},end={x:7,z:0},route=findRoute(start,end,walkable,{bound:12});
  assert.ok(route?.length>1);let previous=start;for(const point of route){assert.ok(clearSegment(previous,point,walkable));previous=point;}assert.deepEqual(route.at(-1),end);
});
test('unreachable targets and blocked corners are rejected',()=>{
  const walkable=(x,z)=>Math.abs(x)<5&&Math.abs(z)<5&&Math.abs(x)>.3;
  assert.equal(findRoute({x:-2,z:0},{x:2,z:0},walkable,{bound:6}),null);
  assert.equal(findRoute({x:-2,z:0},{x:0,z:0},walkable,{bound:6}),null);
});
test('a new near target produces a route from current position without jumping to an old route',()=>{
  assert.deepEqual(findRoute({x:5,z:6},{x:4,z:7},()=>true),[{x:4,z:7}]);
});
