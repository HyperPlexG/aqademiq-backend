// The dedup key is the only thing standing between one broadcast and sending it
// to the same person twice. A pass that dies half-way through tens of thousands
// of accounts is expected — the next tick must reach exactly the ones it missed,
// which only holds if the key is stable per (announcement, user) and collides
// for nobody else.
import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { announcementDedupKey } from './services/notifications.service.ts';

const USER_A = '4e1c882f-be3d-42de-9c22-2da8551a63d3';
const USER_B = 'c7a2c849-2636-4f85-a743-4b74babf578c';

Deno.test('the same user and announcement always produce the same key', () => {
  assertEquals(
    announcementDedupKey('thanks-for-downloading', USER_A),
    announcementDedupKey('thanks-for-downloading', USER_A),
  );
});

Deno.test('two users never share a key for one announcement', () => {
  assertNotEquals(
    announcementDedupKey('thanks-for-downloading', USER_A),
    announcementDedupKey('thanks-for-downloading', USER_B),
  );
});

Deno.test('one user gets a fresh key for each announcement', () => {
  assertNotEquals(
    announcementDedupKey('thanks-for-downloading', USER_A),
    announcementDedupKey('semester-two-is-live', USER_A),
  );
});

Deno.test('announcement keys cannot collide with reminder keys', () => {
  // Reminders claim `before_task:<task_id>`; both live in the same unique column,
  // so an announcement that happened to mint that shape would silently suppress
  // somebody's task reminder.
  const key = announcementDedupKey('thanks-for-downloading', USER_A);
  assertEquals(key.startsWith('announce:'), true);
  assertEquals(key.startsWith('before_task:'), false);
});

Deno.test('the prefix the sweep queries with matches the key it writes', () => {
  // The recipient query finds who is left with `'announce:' || slug || ':' || id`
  // while the claim writes announcementDedupKey(). If those two ever drift, the
  // query stops seeing existing claims and every tick re-sends to everybody.
  const slug = 'thanks-for-downloading';
  assertEquals(announcementDedupKey(slug, USER_A), `announce:${slug}:` + USER_A);
});
