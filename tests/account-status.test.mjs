import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountStatus } from '../src/lib/server/account-status.ts';
const token = 'test.access-token-for-qualification';
function fixture({ row = { id:'owner', email:'owner@example.invalid', frozen:0 }, claims = {sub:'owner'}, code=200, fail=false }={}) {
 const seen=[];
 const auth={async handler(r) { seen.push(r); return Response.json(claims,{status:code}); }};
 const db={prepare(sql){assert.match(sql,/WHERE id = \?/);return {bind(id){seen.push(id);return {async first(){if(fail)throw Error('db down');return row;}}}}}};
 return {auth,db,seen};
}
const request=(extra='',headers={authorization:'Bearer '+token})=>new Request('https://identity.example/api/account/status'+extra,{headers});
test('requires bearer, never cookie-only or a selected account',async()=>{
 const f=fixture();for(const h of [{},{cookie:'better-auth.session_token=valid'},{authorization:'Bearer bad'},{authorization:'Basic abc'}])assert.equal((await accountStatus(request('',h),f.auth,f.db)).status,401);
 assert.equal(f.seen.length,0);
});
test('uses only provider-validated sub; forwards neither cookies nor query',async()=>{
 const f=fixture();const r=await accountStatus(request('?userId=victim',{authorization:'Bearer '+token,cookie:'secret=x'}),f.auth,f.db);
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{sub:'owner',email:'owner@example.invalid',frozen:false});
 assert.equal(f.seen[0].url,'https://identity.example/api/auth/oauth2/userinfo');assert.equal(f.seen[0].headers.get('cookie'),null);assert.equal(f.seen[1],'owner');
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('vary'),'Authorization');
});
test('fresh frozen state is returned without private reasons or side effects',async()=>{
 const row={id:'owner',email:'owner@example.invalid',frozen:0,frozen_reason:'private'};const f=fixture({row});
 assert.equal((await (await accountStatus(request(),f.auth,f.db)).json()).frozen,false);
 row.frozen=1;assert.deepEqual(await (await accountStatus(request(),f.auth,f.db)).json(),{sub:'owner',email:'owner@example.invalid',frozen:true});
 row.frozen=0;assert.equal((await (await accountStatus(request(),f.auth,f.db)).json()).frozen,false);
});
test('provider refusals, absent subject, deleted or malformed users and DB outage fail closed',async()=>{
 for(const opts of [{code:401},{claims:{}},{claims:{sub:5}},{row:null},{row:{id:'other',email:'x',frozen:0}},{row:{id:'owner',email:'x',frozen:null}},{row:{id:'owner',email:'x',frozen:'0'}},{fail:true}]){
 const f=fixture(opts),r=await accountStatus(request(),f.auth,f.db);assert.ok(r.status>=400,JSON.stringify(opts));assert.equal(r.headers.get('cache-control'),'no-store');
 }
});
