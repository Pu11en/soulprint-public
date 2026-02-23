// API client for admin endpoints
// Authentication is handled by Cloudflare Access (JWT in cookies)

const API_BASE = '/api/admin';

export interface PendingDevice {
  requestId: string;
  deviceId: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  ts: number;
}

export interface PairedDevice {
  deviceId: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  createdAtMs: number;
  approvedAtMs: number;
}

export interface DeviceListResponse {
  pending: PendingDevice[];
  paired: PairedDevice[];
  raw?: string;
  stderr?: string;
  parseError?: string;
  error?: string;
}

export interface ApproveResponse {
  success: boolean;
  requestId: string;
  message?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface ApproveAllResponse {
  approved: string[];
  failed: Array<{ requestId: string; success: boolean; error?: string }>;
  message?: string;
  error?: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

async function apiRequest<T>(path: string, options: globalThis.RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  } as globalThis.RequestInit);

  if (response.status === 401) {
    throw new AuthError('Unauthorized - please log in via Cloudflare Access');
  }

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data;
}

export async function listDevices(): Promise<DeviceListResponse> {
  return apiRequest<DeviceListResponse>('/devices');
}

export async function approveDevice(requestId: string): Promise<ApproveResponse> {
  return apiRequest<ApproveResponse>(`/devices/${requestId}/approve`, {
    method: 'POST',
  });
}

export async function approveAllDevices(): Promise<ApproveAllResponse> {
  return apiRequest<ApproveAllResponse>('/devices/approve-all', {
    method: 'POST',
  });
}

export interface RestartGatewayResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function restartGateway(): Promise<RestartGatewayResponse> {
  return apiRequest<RestartGatewayResponse>('/gateway/restart', {
    method: 'POST',
  });
}

export interface StorageStatusResponse {
  configured: boolean;
  missing?: string[];
  lastSync: string | null;
  message: string;
}

export async function getStorageStatus(): Promise<StorageStatusResponse> {
  return apiRequest<StorageStatusResponse>('/storage');
}

export interface SyncResponse {
  success: boolean;
  message?: string;
  lastSync?: string;
  error?: string;
  details?: string;
}

export async function triggerSync(): Promise<SyncResponse> {
  return apiRequest<SyncResponse>('/storage/sync', {
    method: 'POST',
  });
}

// ============================================================
// Skills API
// ============================================================

export interface Skill {
  name: string;
  description: string;
  source: 'core' | 'custom';
  enabled: boolean;
  metadata: {
    author?: string;
    version?: string;
    priority?: string;
  };
}

export interface SkillsListResponse {
  skills: Skill[];
  total: number;
  enabled: number;
  disabled: number;
}

export interface SkillToggleResponse {
  success: boolean;
  skill: string;
  enabled: boolean;
  message: string;
  gatewayRestarted: boolean;
}

export async function fetchSkills(): Promise<SkillsListResponse> {
  return apiRequest<SkillsListResponse>('/skills');
}

export async function toggleSkill(skillName: string): Promise<SkillToggleResponse> {
  return apiRequest<SkillToggleResponse>(`/skills/${encodeURIComponent(skillName)}/toggle`, {
    method: 'POST',
  });
}

// ============================================================
// Conversations API
// ============================================================

export interface ConversationSummary {
  id: string;
  title: string;
  timestamp: string;
  messageCount: number;
  preview: string;
  channel?: string;
}

export interface ConversationsListResponse {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  message?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ConversationDetailResponse {
  id: string;
  title: string;
  timestamp: string;
  messages: ConversationMessage[];
  messageCount: number;
}

export async function fetchConversations(
  page: number = 1,
  pageSize: number = 20,
): Promise<ConversationsListResponse> {
  return apiRequest<ConversationsListResponse>(`/conversations?page=${page}&pageSize=${pageSize}`);
}

export async function fetchConversationDetail(id: string): Promise<ConversationDetailResponse> {
  return apiRequest<ConversationDetailResponse>(`/conversations/${encodeURIComponent(id)}`);
}

// ============================================================
// Fleet Status API
// ============================================================

export interface BotHealth {
  botId: string;
  platform: string;
  status: 'healthy' | 'cold' | 'unreachable' | 'error';
  assignedTo: string | null;
  workerUrl: string;
  responseTime: number | null;
  lastChecked: string;
}

export interface FleetStatusResponse {
  bots: BotHealth[];
  summary: {
    healthy: number;
    cold: number;
    unreachable: number;
    error: number;
    total: number;
  };
}

export async function fetchFleetStatus(): Promise<FleetStatusResponse> {
  return apiRequest<FleetStatusResponse>('/fleet-status');
}

// ============================================================
// Alerts API
// ============================================================

export interface AlertEntry {
  key: string;
  severity: 'error' | 'warning' | 'info' | 'resolved';
  title: string;
  message: string;
  bot: string;
  fields?: Record<string, string>;
  error?: string;
  timestamp: string;
}

export interface AlertsListResponse {
  alerts: AlertEntry[];
  cursor: string | null;
  hasMore: boolean;
}

export async function fetchAlerts(
  cursor?: string,
  severity?: string,
  limit: number = 50,
): Promise<AlertsListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (severity) params.set('severity', severity);
  params.set('limit', String(limit));
  return apiRequest<AlertsListResponse>(`/alerts?${params.toString()}`);
}

// ============================================================
// Public API (no auth required)
// ============================================================

async function publicRequest<T>(path: string, options: globalThis.RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  } as globalThis.RequestInit);

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data;
}

export interface SignupData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  platform?: 'telegram' | 'sms' | 'app';
  referralCode?: string;
  assessmentAnswers?: Record<string, string[]>;
  botName?: string;
  goal?: string;
  // Step 2 profile data (user research)
  role?: string;
  commPreference?: string;
  source?: string;
}

export interface SignupResponse {
  success: boolean;
  waitlist?: boolean;
  platform?: string;
  telegramBotUrl?: string;
  smsNumber?: string;
  workerUrl?: string;
  botId?: string;
  message?: string;
  accessCode?: string;
  clientName?: string;
  botName?: string;
}

export async function submitSignup(data: SignupData): Promise<SignupResponse> {
  return publicRequest<SignupResponse>('/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface LoginData {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  email?: string;
  clientName?: string;
  botName?: string;
  workerUrl?: string;
  telegramBotUrl?: string;
  error?: string;
}

export async function loginUser(data: LoginData): Promise<LoginResponse> {
  return publicRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface AvailabilityResponse {
  telegram: { available: number; total: number };
  sms: { available: number; total: number };
}

export async function fetchAvailability(): Promise<AvailabilityResponse> {
  return publicRequest<AvailabilityResponse>('/signup/availability');
}

export interface ValidateCodeResponse {
  valid: boolean;
  message: string;
}

export async function validateReferralCode(referralCode: string): Promise<ValidateCodeResponse> {
  return publicRequest<ValidateCodeResponse>('/signup/validate-code', {
    method: 'POST',
    body: JSON.stringify({ referralCode }),
  });
}

export interface ActivateResponse {
  success: boolean;
  redirectUrl: string;
  clientName: string;
  platform: string;
  smsNumber?: string;
}

export async function activateCode(code: string): Promise<ActivateResponse> {
  return publicRequest<ActivateResponse>('/activate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// ============================================================
// Metrics API
// ============================================================

export interface MetricsResponse {
  users: {
    total: number;
    list: Array<{ name: string; email: string; botId: string | null; signupDate: string | null }>;
  };
  waitlist: {
    total: number;
    list: Array<{ name: string; email: string; createdAt: string | null }>;
  };
  bots: { total: number; available: number; assigned: number };
  accessCodes: { total: number; used: number; unused: number };
  referrals: Array<{ code: string; personName: string; signupCount: number }>;
  activity: Array<{ type: string; email: string; name: string | null; createdAt: string | null }>;
  system: { syncFailures: number; alertCount: number };
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  return apiRequest<MetricsResponse>('/metrics');
}

// ============================================================
// Access Codes Admin API
// ============================================================

export interface AccessCodeEntry {
  code: string;
  clientName: string;
  email?: string;
  workerUrl: string;
  telegramBotUrl?: string;
  platform: string;
  createdAt: string;
  usedAt?: string;
  used: boolean;
}

export interface AccessCodesListResponse {
  codes: AccessCodeEntry[];
  total: number;
}

export async function fetchAccessCodes(): Promise<AccessCodesListResponse> {
  return apiRequest<AccessCodesListResponse>('/access-codes');
}

export interface GenerateCodeData {
  clientName: string;
  email?: string;
  workerUrl: string;
  telegramBotUrl?: string;
  platform: string;
}

export async function generateAccessCode(
  data: GenerateCodeData,
): Promise<AccessCodeEntry & { success: boolean }> {
  return apiRequest<AccessCodeEntry & { success: boolean }>('/access-codes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAccessCode(code: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/access-codes/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

// ============================================================
// Referral Codes Admin API
// ============================================================

export interface ReferralCodeEntry {
  code: string;
  personName: string;
  signupCount: number;
  createdAt?: string;
}

export interface ReferralsListResponse {
  referrals: ReferralCodeEntry[];
  total: number;
}

export async function fetchReferrals(): Promise<ReferralsListResponse> {
  return apiRequest<ReferralsListResponse>('/access-codes/referrals');
}

export async function seedReferrals(
  codes: Array<{ code: string; personName: string }>,
): Promise<{ success: boolean; seeded: number }> {
  return apiRequest<{ success: boolean; seeded: number }>('/access-codes/referrals/seed', {
    method: 'POST',
    body: JSON.stringify({ codes }),
  });
}

// ============================================================
// Bot Pool Admin API
// ============================================================

export interface BotPoolEntry {
  id: string;
  workerUrl: string;
  telegramBotUrl?: string;
  platform: string;
  status: 'available' | 'assigned';
  assignedTo?: string;
  assignedAt?: string;
}

export interface BotPoolResponse {
  bots: BotPoolEntry[];
  total: number;
  available: number;
  assigned: number;
}

export async function fetchBotPool(): Promise<BotPoolResponse> {
  return apiRequest<BotPoolResponse>('/access-codes/pool');
}

export async function addBotToPool(data: {
  id: string;
  workerUrl: string;
  telegramBotUrl?: string;
  platform?: string;
}): Promise<{ success: boolean; id: string }> {
  return apiRequest<{ success: boolean; id: string }>('/access-codes/pool', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
