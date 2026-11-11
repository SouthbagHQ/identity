import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticateInternal } from '../src/lib/server/internal-api.ts';
const event = (env, token = 'old-bank') => ({platform:{env}, request:new Request('https://identity.example/api/internal/freeze', {headers: token ? {authorization:'Bearer '+token}: {}})});
test('overlap accepts old and next keys with their original actor, rejects unknown', async () => {
 const env={INTERNAL_API_SECRETS:JSON.stringify({'southbag-online-banking':'old-bank'}),INTERNAL_API_SECRETS_NEXT:JSON.stringify({'southbag-online-banking':'new-bank','southbag-social':'new-social'})};
 for(const [token,actor] of [['old-bank','southbag-online-banking'],['new-bank','southbag-online-banking'],['new-social','southbag-social']]) assert.deepEqual(await authenticateInternal(event(env,token)),{actor});
 assert.equal((await authenticateInternal(event(env,'wrong'))).status,403);
 assert.equal((await authenticateInternal(event(env,null))).status,401);
});
test('bad optional map cannot break old keys; malformed maps never authenticate',async()=>{
 for(const raw of ['bad','null','[]','5','{"actor":null}','{"actor":{}}']){
  assert.deepEqual(await authenticateInternal(event({INTERNAL_API_SECRETS:'{"bank":"old-bank"}',INTERNAL_API_SECRETS_NEXT:raw})),{actor:'bank'});
  assert.ok((await authenticateInternal(event({INTERNAL_API_SECRETS:raw,INTERNAL_API_SECRETS_NEXT:raw}))).status>=400);
 }
 assert.equal((await authenticateInternal(event({}))).status,503);
 assert.deepEqual(await authenticateInternal(event({INTERNAL_API_SECRETS_NEXT:'{"social":"old-bank"}'})),{actor:'social'});
});
