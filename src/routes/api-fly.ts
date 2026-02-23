/**
 * Fly.io Provisioning API Routes
 * Handles creating/managing per-user Clawdbot containers
 */

import { Hono } from 'hono';
import { createFlyProvisioner } from '../lib/fly-provisioner';
import type { MoltbotEnv } from '../types';

const app = new Hono<{ Bindings: MoltbotEnv }>();

/**
 * GET /api/fly/status
 * Check if Fly.io provisioning is available
 */
app.get('/status', async (c) => {
  const hasToken = !!c.env.FLY_API_TOKEN;
  return c.json({
    available: hasToken,
    template: 'soulprint-template',
    region: 'ord',
  });
});

/**
 * POST /api/fly/provision
 * Provision a new Clawdbot container for a user
 * 
 * Body: { userId, telegramBotToken, soulName?, timezone? }
 */
app.post('/provision', async (c) => {
  if (!c.env.FLY_API_TOKEN) {
    return c.json({ error: 'Fly.io not configured' }, 503);
  }

  const body = await c.req.json<{
    userId: string;
    telegramBotToken: string;
    soulName?: string;
    timezone?: string;
  }>();

  if (!body.userId || !body.telegramBotToken) {
    return c.json({ error: 'Missing userId or telegramBotToken' }, 400);
  }

  const provisioner = createFlyProvisioner(c.env as { FLY_API_TOKEN: string });
  
  const result = await provisioner.provisionUser({
    userId: body.userId,
    telegramBotToken: body.telegramBotToken,
    soulName: body.soulName,
    timezone: body.timezone,
  });

  if (result.success) {
    return c.json({
      success: true,
      appName: result.appName,
      appUrl: result.appUrl,
      machineId: result.machineId,
    });
  } else {
    return c.json({
      success: false,
      error: result.error,
    }, 500);
  }
});

/**
 * GET /api/fly/app/:appName
 * Get status of a user's app
 */
app.get('/app/:appName', async (c) => {
  if (!c.env.FLY_API_TOKEN) {
    return c.json({ error: 'Fly.io not configured' }, 503);
  }

  const { appName } = c.req.param();
  const provisioner = createFlyProvisioner(c.env as { FLY_API_TOKEN: string });
  
  const status = await provisioner.getAppStatus(appName);
  
  if (status) {
    return c.json({
      exists: true,
      ...status,
      url: `https://${appName}.fly.dev`,
    });
  } else {
    return c.json({ exists: false }, 404);
  }
});

/**
 * POST /api/fly/app/:appName/wake
 * Wake up a stopped container
 */
app.post('/app/:appName/wake', async (c) => {
  if (!c.env.FLY_API_TOKEN) {
    return c.json({ error: 'Fly.io not configured' }, 503);
  }

  const { appName } = c.req.param();
  const body = await c.req.json<{ machineId: string }>();

  if (!body.machineId) {
    return c.json({ error: 'Missing machineId' }, 400);
  }

  const provisioner = createFlyProvisioner(c.env as { FLY_API_TOKEN: string });
  const success = await provisioner.wakeMachine(appName, body.machineId);

  return c.json({ success });
});

/**
 * POST /api/fly/app/:appName/stop
 * Stop a container (for cost savings)
 */
app.post('/app/:appName/stop', async (c) => {
  if (!c.env.FLY_API_TOKEN) {
    return c.json({ error: 'Fly.io not configured' }, 503);
  }

  const { appName } = c.req.param();
  const body = await c.req.json<{ machineId: string }>();

  if (!body.machineId) {
    return c.json({ error: 'Missing machineId' }, 400);
  }

  const provisioner = createFlyProvisioner(c.env as { FLY_API_TOKEN: string });
  const success = await provisioner.stopMachine(appName, body.machineId);

  return c.json({ success });
});

/**
 * DELETE /api/fly/app/:appName
 * Delete a user's app
 */
app.delete('/app/:appName', async (c) => {
  if (!c.env.FLY_API_TOKEN) {
    return c.json({ error: 'Fly.io not configured' }, 503);
  }

  const { appName } = c.req.param();
  const provisioner = createFlyProvisioner(c.env as { FLY_API_TOKEN: string });
  
  const success = await provisioner.deleteApp(appName);

  return c.json({ success });
});

export { app as flyApi };
