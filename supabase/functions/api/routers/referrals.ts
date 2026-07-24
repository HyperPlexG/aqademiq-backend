// §2.10 — /v1/referrals. Port of referrals.controller.ts.
import { Hono } from 'hono';
import { referralsService, type RedeemDto } from '../services/referrals.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';

export const referralsRouter = new Hono();

referralsRouter.post('/validate', async (c) => {
  const b = await jsonBody(c.req);
  const dto: RedeemDto = {
    code: str(b, 'code', true, { min: 4, max: 32 })!,
  };
  return c.json(await referralsService.validate(dto));
});

referralsRouter.post('/redeem', async (c) => {
  const b = await jsonBody(c.req);
  const dto: RedeemDto = {
    code: str(b, 'code', true, { min: 4, max: 32 })!,
  };
  return c.json(await referralsService.redeem(dto), 201);
});

referralsRouter.get('/rewards/balance', async (c) => c.json(await referralsService.rewardBalance()));
