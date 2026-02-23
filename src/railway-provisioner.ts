// Railway Per-User Container Provisioner
// Creates isolated OpenClaw instances for each SoulPrint user

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_TOKEN = '15881809-5be4-4b08-9889-76d67d39f1b3';
const TEMPLATE_REPO = 'Pu11en/soulprint-openclaw';
const AWS_ACCESS_KEY_ID = 'AKIA36MTOXRJID6CNDWN';
const AWS_SECRET_ACCESS_KEY = '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';
const AWS_REGION = 'us-east-1';

interface UserWorkspace {
  userId: string;
  email: string;
  botName: string;
  soulMd?: string;
  identityMd?: string;
  agentsMd?: string;
  userMd?: string;
  toolsMd?: string;
  memoryMd?: string;
}

interface ProvisionResult {
  success: boolean;
  serviceId?: string;
  serviceUrl?: string;
  error?: string;
}

async function railwayQuery(query: string, variables?: Record<string, any>): Promise<any> {
  const response = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RAILWAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  
  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

// Create a new project for a user
export async function createUserProject(workspace: UserWorkspace): Promise<ProvisionResult> {
  const projectName = `sp-${workspace.userId.slice(0, 8)}`;
  
  try {
    // 1. Create project
    const createProjectMutation = `
      mutation CreateProject($name: String!) {
        projectCreate(input: { name: $name }) {
          id
          name
        }
      }
    `;
    
    const projectResult = await railwayQuery(createProjectMutation, { name: projectName });
    const projectId = projectResult.projectCreate.id;
    console.log(`[PROVISION] Created project: ${projectId}`);
    
    // 2. Create service from GitHub repo
    const createServiceMutation = `
      mutation CreateService($projectId: String!, $repo: String!) {
        serviceCreate(input: { 
          projectId: $projectId,
          source: { repo: $repo }
        }) {
          id
          name
        }
      }
    `;
    
    const serviceResult = await railwayQuery(createServiceMutation, {
      projectId,
      repo: TEMPLATE_REPO,
    });
    const serviceId = serviceResult.serviceCreate.id;
    console.log(`[PROVISION] Created service: ${serviceId}`);
    
    // 3. Set environment variables
    const envVars = {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      SOULPRINT_USER_ID: workspace.userId,
      SOULPRINT_BOT_NAME: workspace.botName,
      SOUL_MD: workspace.soulMd || '',
      IDENTITY_MD: workspace.identityMd || '',
      AGENTS_MD: workspace.agentsMd || '',
      USER_MD: workspace.userMd || '',
      TOOLS_MD: workspace.toolsMd || '',
      MEMORY_MD: workspace.memoryMd || '',
    };
    
    // Get the default environment
    const getEnvQuery = `
      query GetEnvironments($projectId: String!) {
        project(id: $projectId) {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;
    
    const envResult = await railwayQuery(getEnvQuery, { projectId });
    const environmentId = envResult.project.environments.edges[0]?.node?.id;
    
    if (environmentId) {
      // Set each variable
      for (const [key, value] of Object.entries(envVars)) {
        const setVarMutation = `
          mutation SetVariable($projectId: String!, $environmentId: String!, $serviceId: String!, $name: String!, $value: String!) {
            variableUpsert(input: {
              projectId: $projectId,
              environmentId: $environmentId,
              serviceId: $serviceId,
              name: $name,
              value: $value
            })
          }
        `;
        
        await railwayQuery(setVarMutation, {
          projectId,
          environmentId,
          serviceId,
          name: key,
          value: value,
        });
      }
      console.log(`[PROVISION] Set ${Object.keys(envVars).length} env vars`);
    }
    
    // 4. Create domain
    const createDomainMutation = `
      mutation CreateDomain($serviceId: String!, $environmentId: String!) {
        serviceDomainCreate(input: {
          serviceId: $serviceId,
          environmentId: $environmentId
        }) {
          domain
        }
      }
    `;
    
    const domainResult = await railwayQuery(createDomainMutation, {
      serviceId,
      environmentId,
    });
    const serviceUrl = `https://${domainResult.serviceDomainCreate.domain}`;
    console.log(`[PROVISION] Created domain: ${serviceUrl}`);
    
    return {
      success: true,
      serviceId,
      serviceUrl,
    };
    
  } catch (error: any) {
    console.error(`[PROVISION] Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Update workspace files for existing container
export async function updateUserWorkspace(
  serviceId: string,
  projectId: string,
  workspace: Partial<UserWorkspace>
): Promise<boolean> {
  try {
    // Get environment ID
    const getEnvQuery = `
      query GetEnvironments($projectId: String!) {
        project(id: $projectId) {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;
    
    const envResult = await railwayQuery(getEnvQuery, { projectId });
    const environmentId = envResult.project.environments.edges[0]?.node?.id;
    
    if (!environmentId) {
      throw new Error('No environment found');
    }
    
    const updates: Record<string, string> = {};
    if (workspace.soulMd !== undefined) updates.SOUL_MD = workspace.soulMd;
    if (workspace.identityMd !== undefined) updates.IDENTITY_MD = workspace.identityMd;
    if (workspace.agentsMd !== undefined) updates.AGENTS_MD = workspace.agentsMd;
    if (workspace.userMd !== undefined) updates.USER_MD = workspace.userMd;
    if (workspace.toolsMd !== undefined) updates.TOOLS_MD = workspace.toolsMd;
    if (workspace.memoryMd !== undefined) updates.MEMORY_MD = workspace.memoryMd;
    
    for (const [key, value] of Object.entries(updates)) {
      const setVarMutation = `
        mutation SetVariable($projectId: String!, $environmentId: String!, $serviceId: String!, $name: String!, $value: String!) {
          variableUpsert(input: {
            projectId: $projectId,
            environmentId: $environmentId,
            serviceId: $serviceId,
            name: $name,
            value: $value
          })
        }
      `;
      
      await railwayQuery(setVarMutation, {
        projectId,
        environmentId,
        serviceId,
        name: key,
        value: value,
      });
    }
    
    console.log(`[PROVISION] Updated ${Object.keys(updates).length} workspace files`);
    return true;
    
  } catch (error: any) {
    console.error(`[PROVISION] Update error:`, error.message);
    return false;
  }
}

// Delete user container
export async function deleteUserContainer(projectId: string): Promise<boolean> {
  try {
    const deleteMutation = `
      mutation DeleteProject($projectId: String!) {
        projectDelete(id: $projectId)
      }
    `;
    
    await railwayQuery(deleteMutation, { projectId });
    console.log(`[PROVISION] Deleted project: ${projectId}`);
    return true;
    
  } catch (error: any) {
    console.error(`[PROVISION] Delete error:`, error.message);
    return false;
  }
}
