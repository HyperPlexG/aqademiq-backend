// isTokenDead decides whether to DELETE a user's device row, so its false
// positives are silent unsubscribes — someone stops getting reminders and
// nothing anywhere says why. These tests pin the narrowness deliberately: the
// real FCM payload that means "gone for good" passes, and every error that is
// our fault rather than the device's does not.
import { assertEquals } from 'jsr:@std/assert@1';
import { isTokenDead } from '../_shared/push.ts';

// Verbatim from a production notification_deliveries row, 2026-08-31.
const UNREGISTERED = `404: {
  "error": {
    "code": 404,
    "message": "NotRegistered",
    "status": "NOT_FOUND",
    "details": [
      {
        "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
        "errorCode": "UNREGISTERED"
      }
    ]
  }
}
`;

Deno.test('the real UNREGISTERED payload is treated as permanently dead', () => {
  assertEquals(isTokenDead(UNREGISTERED), true);
});

Deno.test('either spelling is enough on its own', () => {
  assertEquals(isTokenDead('404: {"error":{"errorCode":"UNREGISTERED"}}'), true);
  assertEquals(isTokenDead('404: {"error":{"message":"NotRegistered"}}'), true);
});

Deno.test('a send with no error is not a dead token', () => {
  assertEquals(isTokenDead(undefined), false);
  assertEquals(isTokenDead(''), false);
});

Deno.test('our own faults never cost a user their device row', () => {
  // Credentials: the service account, not the phone.
  assertEquals(isTokenDead('401: {"error":{"status":"UNAUTHENTICATED"}}'), false);
  assertEquals(isTokenDead('403: {"error":{"status":"PERMISSION_DENIED"}}'), false);
  // Transient: retrying is the correct response.
  assertEquals(isTokenDead('429: {"error":{"status":"RESOURCE_EXHAUSTED"}}'), false);
  assertEquals(isTokenDead('503: {"error":{"status":"UNAVAILABLE"}}'), false);
  assertEquals(isTokenDead('Http timeout'), false);
});

Deno.test('INVALID_ARGUMENT is not fatal, however much it looks like it', () => {
  // A malformed payload returns this too, so treating it as a dead token would
  // let one bad `data` value unsubscribe every device the sweep reached.
  assertEquals(
    isTokenDead('400: {"error":{"status":"INVALID_ARGUMENT","message":"Invalid registration token"}}'),
    false,
  );
});

Deno.test('the word has to stand alone', () => {
  // Guards against a substring match firing on prose that merely contains it.
  assertEquals(isTokenDead('500: server says DEREGISTERED_SOMETHING_ELSE'), false);
  assertEquals(isTokenDead('400: notregistereduser'), false);
});
