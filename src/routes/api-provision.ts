// API routes for Railway provisioning
import { Hono } from 'hono';
import { createUserProject, updateUserWorkspace, deleteUserContainer } from '../railway-provisioner';

const ADMIN_KEY = 'archeforge-admin-2026';

export function registerProvisionRoutes(app: Hono<{ Bindings: any }>) {
  
  // POST /api/admin/provision-container - Create a Railway container for a user
  app.post('/api/admin/provision-container', async (c) => {
    const adminKey = c.req.header('X-Admin-Key');
    if (adminKey !== ADMIN_KEY) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { email } = body;
    
    if (!email) {
      return c.json({ error: 'Email required' }, 400);
    }
    
    // Get user from KV
    const userKey = `user:${email.toLowerCase()}`;
    const userData = await c.env.SESSIONS.get(userKey);
    
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const user = JSON.parse(userData);
    
    // Check if already has container
    if (user.railwayUrl) {
      return c.json({ 
        success: true, 
        message: 'Container already exists',
        railwayUrl: user.railwayUrl 
      });
    }
    
    // Create container
    const result = await createUserProject({
      userId: user.id,
      email: user.email,
      botName: user.botName || 'Asset',
      soulMd: user.soulMd,
      identityMd: user.identityMd,
      agentsMd: user.agentsMd,
      userMd: user.userMd,
      toolsMd: user.toolsMd,
      memoryMd: user.memoryMd,
    });
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    // Save to user
    user.railwayProjectId = result.serviceId?.split('/')[0]; // Project ID from service path
    user.railwayServiceId = result.serviceId;
    user.railwayUrl = result.serviceUrl;
    await c.env.SESSIONS.put(userKey, JSON.stringify(user));
    
    return c.json({
      success: true,
      railwayUrl: result.serviceUrl,
      serviceId: result.serviceId,
    });
  });
  
  // POST /api/admin/sync-workspace - Sync workspace to user's container
  app.post('/api/admin/sync-workspace', async (c) => {
    const adminKey = c.req.header('X-Admin-Key');
    if (adminKey !== ADMIN_KEY) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { email, workspace } = body;
    
    if (!email) {
      return c.json({ error: 'Email required' }, 400);
    }
    
    const userKey = `user:${email.toLowerCase()}`;
    const userData = await c.env.SESSIONS.get(userKey);
    
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const user = JSON.parse(userData);
    
    if (!user.railwayServiceId || !user.railwayProjectId) {
      return c.json({ error: 'User has no container' }, 400);
    }
    
    const success = await updateUserWorkspace(
      user.railwayServiceId,
      user.railwayProjectId,
      workspace
    );
    
    return c.json({ success });
  });
  
  // DELETE /api/admin/delete-container - Delete user's container
  app.delete('/api/admin/delete-container', async (c) => {
    const adminKey = c.req.header('X-Admin-Key');
    if (adminKey !== ADMIN_KEY) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { email } = body;
    
    if (!email) {
      return c.json({ error: 'Email required' }, 400);
    }
    
    const userKey = `user:${email.toLowerCase()}`;
    const userData = await c.env.SESSIONS.get(userKey);
    
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const user = JSON.parse(userData);
    
    if (!user.railwayProjectId) {
      return c.json({ error: 'User has no container' }, 400);
    }
    
    const success = await deleteUserContainer(user.railwayProjectId);
    
    // Always clear local record (Railway project may have been deleted manually)
    delete user.railwayProjectId;
    delete user.railwayServiceId;
    delete user.railwayUrl;
    await c.env.SESSIONS.put(userKey, JSON.stringify(user));
    
    return c.json({ success: true, railwayDeleteSuccess: success });
  });
  
  // GET /api/admin/container-status - Check container status
  app.get('/api/admin/container-status', async (c) => {
    const adminKey = c.req.header('X-Admin-Key');
    if (adminKey !== ADMIN_KEY) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const email = c.req.query('email');
    
    if (!email) {
      return c.json({ error: 'Email required' }, 400);
    }
    
    const userKey = `user:${email.toLowerCase()}`;
    const userData = await c.env.SESSIONS.get(userKey);
    
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const user = JSON.parse(userData);
    
    if (!user.railwayUrl) {
      return c.json({ hasContainer: false });
    }
    
    // Check if container is responding
    try {
      const response = await fetch(user.railwayUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      return c.json({
        hasContainer: true,
        railwayUrl: user.railwayUrl,
        status: response.ok ? 'healthy' : 'unhealthy',
        statusCode: response.status,
      });
    } catch (e: any) {
      return c.json({
        hasContainer: true,
        railwayUrl: user.railwayUrl,
        status: 'unreachable',
        error: e.message,
      });
    }
  });
}
