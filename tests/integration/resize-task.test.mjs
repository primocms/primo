import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createResizeTask} from '../../src/lib/resize_task.js'
function frames(){let id=0;const pending=new Map(),canceled=[];return{pending,canceled,requestFrame:fn=>{pending.set(++id,fn);return id},cancelFrame:id=>{canceled.push(id);pending.delete(id)},flush(){const batch=[...pending.values()];pending.clear();for(const fn of batch)fn()}}}
test('resize deliveries coalesce into a future frame using the latest dimensions',()=>{
 const f=frames(),heights=[];let height=100;const task=createResizeTask(()=>heights.push(height),f)
 task.schedule();height=200;task.schedule();assert.deepEqual(heights,[]);assert.equal(f.pending.size,1);f.flush();assert.deepEqual(heights,[200])
})
test('a resize discovered during a layout write schedules a subsequent frame',()=>{
 const f=frames();let count=0;const task=createResizeTask(()=>{if(++count===1)task.schedule()},f)
 task.schedule();f.flush();assert.equal(count,1);assert.equal(f.pending.size,1);f.flush();assert.equal(count,2)
})
test('disposal cancels queued writes and ignores late callbacks from a detached frame',()=>{
 const f=frames();let count=0;const task=createResizeTask(()=>count++,f);task.schedule();const late=[...f.pending.values()][0];task.dispose();late();task.schedule();f.flush();assert.equal(count,0);assert.equal(f.canceled.length,1);assert.equal(f.pending.size,0)
})
test('a settled resize task remains available for later viewport and content changes',()=>{
 const f=frames();let count=0;const task=createResizeTask(()=>count++,f);task.schedule();f.flush();task.schedule();f.flush();task.dispose();assert.equal(count,2);assert.equal(f.canceled.length,0)
})
