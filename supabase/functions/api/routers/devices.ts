// §2.9/§4.5 — /v1/devices. Port of devices.controller.ts.
import { Hono } from 'hono';
import { devicesService, type RegisterDeviceDto, type UpdateDeviceDto } from '../services/devices.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';

export const devicesRouter = new Hono();

// POST /devices — register or re-register.
devicesRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: RegisterDeviceDto = {
    push_token: str(b, 'push_token', true, { min: 1, max: 512 })!,
    platform: str(b, 'platform', true, { enum: ['ios', 'android'] })!,
    token_provider: str(b, 'token_provider', true, { enum: ['apns', 'fcm'] })!,
    timezone: str(b, 'timezone', true, { min: 1, max: 64 })!,
    permission: str(b, 'permission', false, { enum: ['granted', 'denied', 'provisional'] }),
  };
  return c.json(await devicesService.register(dto), 201);
});

// PATCH /devices/:id — update push token / timezone.
devicesRouter.patch('/:id', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateDeviceDto = {
    push_token: str(b, 'push_token', false, { min: 1, max: 512 }),
    timezone: str(b, 'timezone', false, { min: 1, max: 64 }),
    permission: str(b, 'permission', false, { enum: ['granted', 'denied', 'provisional'] }),
  };
  return c.json(await devicesService.update(c.req.param('id'), dto));
});

// DELETE /devices/:id — revoke.
devicesRouter.delete('/:id', async (c) => c.json(await devicesService.remove(c.req.param('id'))));

// POST /devices/:id/heartbeat — confirm alive; optional tz refresh.
devicesRouter.post('/:id/heartbeat', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateDeviceDto = {
    push_token: str(b, 'push_token', false, { min: 1, max: 512 }),
    timezone: str(b, 'timezone', false, { min: 1, max: 64 }),
    permission: str(b, 'permission', false, { enum: ['granted', 'denied', 'provisional'] }),
  };
  return c.json(await devicesService.heartbeat(c.req.param('id'), dto), 201);
});
