/**
 * Token Validator
 * Validates that a personal access token has access to a specific repository
 * by making a lightweight API call to the platform.
 */

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  repoName?: string;
}

/**
 * Parse owner and repo name from a Git URL
 */
function parseRepoUrl(url: string): { host: string; owner: string; repo: string; pathSegments: string[] } | null {
  try {
    // Remove .git suffix
    const cleanUrl = url.replace(/\.git$/, '');
    const parsed = new URL(cleanUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (segments.length < 2) return null;

    return {
      host: parsed.hostname,
      owner: segments[0],
      repo: segments[segments.length - 1],
      pathSegments: segments,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a GitHub token against a specific repository
 */
async function validateGitHubToken(url: string, token: string): Promise<TokenValidationResult> {
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    return { valid: false, error: 'Could not parse repository URL' };
  }

  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'HexaScan-RepoScanner',
      },
    });

    if (response.ok) {
      const data = await response.json() as any;
      return { valid: true, repoName: data.full_name };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired access token' };
    }

    if (response.status === 403) {
      return { valid: false, error: 'Token does not have permission to access this repository. Ensure the token has "Contents: Read-only" permission for this specific repository.' };
    }

    if (response.status === 404) {
      return { valid: false, error: 'Repository not found or token does not have access. For fine-grained tokens, ensure this specific repository is selected under "Repository access".' };
    }

    return { valid: false, error: `GitHub API returned status ${response.status}` };
  } catch (error: any) {
    return { valid: false, error: `Failed to validate token: ${error.message}` };
  }
}

/**
 * Validate a GitLab token against a specific repository
 */
async function validateGitLabToken(url: string, token: string): Promise<TokenValidationResult> {
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    return { valid: false, error: 'Could not parse repository URL' };
  }

  // GitLab project path can include groups/subgroups
  const projectPath = encodeURIComponent(parsed.pathSegments.join('/'));
  const apiUrl = `https://gitlab.com/api/v4/projects/${projectPath}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'PRIVATE-TOKEN': token,
        'User-Agent': 'HexaScan-RepoScanner',
      },
    });

    if (response.ok) {
      const data = await response.json() as any;
      return { valid: true, repoName: data.path_with_namespace };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired access token' };
    }

    if (response.status === 403) {
      return { valid: false, error: 'Token does not have permission to access this repository. Ensure the token has the "read_repository" scope.' };
    }

    if (response.status === 404) {
      return { valid: false, error: 'Repository not found or token does not have access to this project.' };
    }

    return { valid: false, error: `GitLab API returned status ${response.status}` };
  } catch (error: any) {
    return { valid: false, error: `Failed to validate token: ${error.message}` };
  }
}

/**
 * Validate a Bitbucket app password against a specific repository
 */
async function validateBitbucketToken(url: string, token: string): Promise<TokenValidationResult> {
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    return { valid: false, error: 'Could not parse repository URL' };
  }

  const apiUrl = `https://api.bitbucket.org/2.0/repositories/${parsed.owner}/${parsed.repo}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'HexaScan-RepoScanner',
      },
    });

    if (response.ok) {
      const data = await response.json() as any;
      return { valid: true, repoName: data.full_name };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired app password' };
    }

    if (response.status === 403) {
      return { valid: false, error: 'App password does not have permission. Ensure "Repositories: Read" is enabled.' };
    }

    if (response.status === 404) {
      return { valid: false, error: 'Repository not found or token does not have access.' };
    }

    return { valid: false, error: `Bitbucket API returned status ${response.status}` };
  } catch (error: any) {
    return { valid: false, error: `Failed to validate token: ${error.message}` };
  }
}

/**
 * Validate an Azure DevOps token against a specific repository
 * URL format: https://dev.azure.com/{org}/{project}/_git/{repo}
 */
async function validateAzureDevOpsToken(url: string, token: string): Promise<TokenValidationResult> {
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    return { valid: false, error: 'Could not parse repository URL' };
  }

  // Azure DevOps URL: /org/project/_git/repo => segments = [org, project, _git, repo]
  const segments = parsed.pathSegments;
  let org: string;
  let project: string;
  let repo: string;

  if (parsed.host.includes('dev.azure.com') && segments.length >= 4 && segments[2] === '_git') {
    org = segments[0];
    project = segments[1];
    repo = segments[3];
  } else if (parsed.host.includes('visualstudio.com') && segments.length >= 3 && segments[1] === '_git') {
    // {org}.visualstudio.com/{project}/_git/{repo}
    org = parsed.host.split('.')[0];
    project = segments[0];
    repo = segments[2];
  } else {
    return { valid: false, error: 'Could not parse Azure DevOps repository URL. Expected format: https://dev.azure.com/{org}/{project}/_git/{repo}' };
  }

  const apiUrl = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}?api-version=7.0`;

  try {
    const basicAuth = Buffer.from(`:${token}`).toString('base64');
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'User-Agent': 'HexaScan-RepoScanner',
      },
    });

    if (response.ok) {
      const data = await response.json() as any;
      return { valid: true, repoName: data.name };
    }

    if (response.status === 401 || response.status === 203) {
      return { valid: false, error: 'Invalid or expired personal access token' };
    }

    if (response.status === 403) {
      return { valid: false, error: 'Token does not have permission. Ensure "Code: Read" scope is enabled.' };
    }

    if (response.status === 404) {
      return { valid: false, error: 'Repository not found or token does not have access.' };
    }

    return { valid: false, error: `Azure DevOps API returned status ${response.status}` };
  } catch (error: any) {
    return { valid: false, error: `Failed to validate token: ${error.message}` };
  }
}

/**
 * Validate a token against a repository for the given platform
 * Returns validation result with error details if token is invalid.
 */
export async function validateRepositoryToken(
  url: string,
  token: string,
  platform: string
): Promise<TokenValidationResult> {
  switch (platform) {
    case 'GITHUB':
      return validateGitHubToken(url, token);
    case 'GITLAB':
      return validateGitLabToken(url, token);
    case 'BITBUCKET':
      return validateBitbucketToken(url, token);
    case 'AZURE_DEVOPS':
      return validateAzureDevOpsToken(url, token);
    case 'OTHER':
      // Can't validate unknown platforms - skip validation
      return { valid: true };
    default:
      return { valid: true };
  }
}
