// The checks the Apple re-link makes on top of the token's signature.
//
// Signature, issuer, audience and expiry are jose's job against Apple's JWKS.
// What is ours: the nonce (so a token captured elsewhere cannot be replayed
// to re-link someone else's account) and which audiences count as this app.
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { appleAudiences, appleIdentityFrom, sha256Hex } from './services/apple-relink.service.ts';

Deno.test('a token minted for this request is accepted', async () => {
  const nonce = 'f3c1a9e0-raw-nonce-from-the-device';
  const id = await appleIdentityFrom({ sub: 'new-1', nonce: await sha256Hex(nonce), email: 'a@privaterelay.appleid.com' }, nonce);
  assertEquals(id, { sub: 'new-1', email: 'a@privaterelay.appleid.com' });
});

Deno.test('a token minted for a different nonce is refused', async () => {
  await assertRejects(
    async () => await appleIdentityFrom({ sub: 'new-1', nonce: await sha256Hex('someone else') }, 'mine'),
    Error,
    'not issued for this request',
  );
});

Deno.test('the raw nonce itself in the token is not enough', async () => {
  // Apple holds the hash; a token carrying the raw value was not minted by our app.
  await assertRejects(async () => await appleIdentityFrom({ sub: 'new-1', nonce: 'mine' }, 'mine'));
});

Deno.test('a token without a subject is refused', async () => {
  await assertRejects(async () => await appleIdentityFrom({ nonce: await sha256Hex('n') }, 'n'));
});

Deno.test('no email on this sign-in reads as unchanged, not as blank', async () => {
  const id = await appleIdentityFrom({ sub: 's', nonce: await sha256Hex('n'), email: '' }, 'n');
  assertEquals(id.email, null);
});

Deno.test('audiences come from APPLE_OAUTH_CLIENT_IDS, else the bundle id', () => {
  assertEquals(appleAudiences(undefined), ['com.r13.aqademiq']);
  assertEquals(appleAudiences(' com.r13.aqademiq , com.r13.aqademiq.web '), ['com.r13.aqademiq', 'com.r13.aqademiq.web']);
});
