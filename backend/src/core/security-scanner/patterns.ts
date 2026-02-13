/**
 * Security Scanner Patterns
 * Regex patterns for detecting security issues in source code
 */

export interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  category: 'SECRET' | 'BACKDOOR' | 'MALWARE' | 'INJECTION' | 'VULNERABILITY' | 'OBFUSCATION' | 'DATA_EXFILTRATION' | 'CRYPTO_MINER' | 'SECURITY_FLAW' | 'OTHER';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  pattern: RegExp;
  filePatterns?: RegExp[]; // Only scan specific file types
  excludePatterns?: RegExp[]; // Skip certain files
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

/**
 * Patterns for detecting hardcoded secrets
 */
export const SECRET_PATTERNS: SecurityPattern[] = [
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    description: 'Hardcoded AWS access key ID detected',
    category: 'SECRET',
    severity: 'CRITICAL',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    confidence: 'HIGH',
    recommendation: 'Remove hardcoded AWS credentials and use environment variables or AWS IAM roles',
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Access Key',
    description: 'Hardcoded AWS secret access key detected',
    category: 'SECRET',
    severity: 'CRITICAL',
    pattern: /(?:aws_secret_access_key|aws_secret_key|aws_secret|secret_access_key|secretAccessKey)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    confidence: 'HIGH',
    recommendation: 'Remove hardcoded AWS credentials and use environment variables or AWS IAM roles',
  },
  {
    id: 'github-token',
    name: 'GitHub Personal Access Token',
    description: 'Hardcoded GitHub token detected',
    category: 'SECRET',
    severity: 'CRITICAL',
    pattern: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/g,
    confidence: 'HIGH',
    recommendation: 'Remove GitHub tokens and use GitHub Actions secrets or environment variables',
  },
  {
    id: 'generic-api-key',
    name: 'Generic API Key',
    description: 'Potential hardcoded API key detected',
    category: 'SECRET',
    severity: 'HIGH',
    pattern: /(?:api[_-]?key|apikey|api_secret|apisecret)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    confidence: 'MEDIUM',
    recommendation: 'Move API keys to environment variables or a secrets manager',
  },
  {
    id: 'private-key',
    name: 'Private Key',
    description: 'Private key content detected in source code',
    category: 'SECRET',
    severity: 'CRITICAL',
    pattern: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE KEY-----/gi,
    confidence: 'HIGH',
    recommendation: 'Remove private keys from source code and use secure key management',
  },
  {
    id: 'password-in-string',
    name: 'Hardcoded Password',
    description: 'Potential hardcoded password detected',
    category: 'SECRET',
    severity: 'HIGH',
    pattern: /(?:password|passwd|pwd|secret|credential)\s*[:=]\s*['"]([^'"]{8,})['"](?!\s*\+)/gi,
    excludePatterns: [/\.test\.|\.spec\.|_test\.|test_|mock|example|sample/i],
    confidence: 'MEDIUM',
    recommendation: 'Remove hardcoded passwords and use environment variables or secrets manager',
  },
  {
    id: 'database-connection-string',
    name: 'Database Connection String',
    description: 'Database connection string with credentials detected',
    category: 'SECRET',
    severity: 'CRITICAL',
    pattern: /(?:mongodb|mysql|postgres|postgresql|redis|amqp|rabbitmq):\/\/[^:]+:[^@]+@[^\/\s]+/gi,
    confidence: 'HIGH',
    recommendation: 'Use environment variables for database connection strings',
  },
  {
    id: 'jwt-secret',
    name: 'JWT Secret',
    description: 'Potential JWT secret key detected',
    category: 'SECRET',
    severity: 'HIGH',
    pattern: /(?:jwt[_-]?secret|jwt[_-]?key|secret[_-]?key)\s*[:=]\s*['"]([^'"]{16,})['"]?/gi,
    confidence: 'MEDIUM',
    recommendation: 'Move JWT secrets to environment variables',
  },
  {
    id: 'stripe-key',
    name: 'Stripe API Key',
    description: 'Hardcoded Stripe API key detected',
    category: 'SECRET',
    severity: 'CRITICAL',
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,}|rk_live_[a-zA-Z0-9]{24,})\b/g,
    confidence: 'HIGH',
    recommendation: 'Remove Stripe API keys and use environment variables',
  },
  {
    id: 'slack-webhook',
    name: 'Slack Webhook URL',
    description: 'Hardcoded Slack webhook URL detected',
    category: 'SECRET',
    severity: 'MEDIUM',
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+/gi,
    confidence: 'HIGH',
    recommendation: 'Move Slack webhook URLs to environment variables',
  },
];

/**
 * Patterns for detecting backdoors and malicious code
 */
export const BACKDOOR_PATTERNS: SecurityPattern[] = [
  {
    id: 'php-eval-base64',
    name: 'PHP Base64 Eval',
    description: 'Suspicious PHP code using eval with base64 decode - common backdoor pattern',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /\beval\s*\(\s*(?:base64_decode|gzinflate|gzuncompress|str_rot13|strrev)\s*\(/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Remove this code immediately and audit for compromise',
  },
  {
    id: 'php-preg-replace-e',
    name: 'PHP preg_replace /e modifier',
    description: 'Dangerous PHP preg_replace with /e modifier allowing code execution',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /preg_replace\s*\(\s*['"][^'"]*\/e['"]/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Replace with preg_replace_callback()',
  },
  {
    id: 'php-shell-exec',
    name: 'PHP Shell Execution',
    description: 'PHP code executing shell commands from user input',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /(?:exec|shell_exec|system|passthru|popen|proc_open)\s*\(\s*\$(?:_(?:GET|POST|REQUEST|COOKIE)|[a-z_]+)\s*\[/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Never pass user input directly to shell commands',
  },
  {
    id: 'php-assert-execution',
    name: 'PHP Assert Code Execution',
    description: 'PHP assert() used for code execution',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /\bassert\s*\(\s*\$(?:_(?:GET|POST|REQUEST|COOKIE)|[a-z_]+)\s*\[/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Remove assert calls with user input',
  },
  {
    id: 'js-eval-dynamic',
    name: 'JavaScript Dynamic Eval',
    description: 'JavaScript eval with variable input - potential code injection',
    category: 'BACKDOOR',
    severity: 'HIGH',
    pattern: /\beval\s*\(\s*(?:atob|decodeURIComponent|unescape)\s*\(/gi,
    filePatterns: [/\.(js|jsx|ts|tsx)$/i],
    confidence: 'HIGH',
    recommendation: 'Remove eval() usage and use safer alternatives',
  },
  {
    id: 'python-exec-input',
    name: 'Python Exec with Input',
    description: 'Python exec/eval with external input',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /(?:exec|eval)\s*\(\s*(?:request\.|input\(|sys\.argv)/gi,
    filePatterns: [/\.py$/i],
    confidence: 'HIGH',
    recommendation: 'Never use exec/eval with user input',
  },
  {
    id: 'webshell-common',
    name: 'Web Shell Indicator',
    description: 'Common web shell patterns detected',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /(?:c99shell|r57shell|wso\d|b374k|c100|weevely|antsword|chopper|godzilla)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Remove this file immediately - likely a web shell',
  },
  {
    id: 'remote-file-include',
    name: 'Remote File Include',
    description: 'Code includes remote files from URL',
    category: 'BACKDOOR',
    severity: 'CRITICAL',
    pattern: /(?:include|require|include_once|require_once)\s*\(\s*['"]?https?:\/\//gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Never include files from remote URLs',
  },
];

/**
 * Patterns for detecting data exfiltration
 */
export const EXFILTRATION_PATTERNS: SecurityPattern[] = [
  {
    id: 'curl-post-data',
    name: 'Data Exfiltration via cURL',
    description: 'Code sending data to external server via cURL',
    category: 'DATA_EXFILTRATION',
    severity: 'HIGH',
    pattern: /curl_setopt\s*\([^,]+,\s*CURLOPT_(?:POST|POSTFIELDS)[^;]+\$(?:_(?:SERVER|ENV)|config|settings|password|secret|key)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'MEDIUM',
    recommendation: 'Review data being sent to external services',
  },
  {
    id: 'file-get-contents-post',
    name: 'Data Exfiltration via file_get_contents',
    description: 'PHP sending data externally using file_get_contents',
    category: 'DATA_EXFILTRATION',
    severity: 'HIGH',
    pattern: /file_get_contents\s*\(\s*['"]https?:\/\/[^'"]+['"]\s*,\s*false\s*,\s*stream_context_create/gi,
    filePatterns: [/\.php$/i],
    confidence: 'MEDIUM',
    recommendation: 'Review data being sent to external services',
  },
  {
    id: 'fetch-post-sensitive',
    name: 'JavaScript Fetch POST',
    description: 'JavaScript sending potentially sensitive data externally',
    category: 'DATA_EXFILTRATION',
    severity: 'MEDIUM',
    pattern: /fetch\s*\(\s*['"][^'"]+['"]\s*,\s*\{[^}]*method\s*:\s*['"]POST['"][^}]*body\s*:\s*JSON\.stringify\s*\([^)]*(?:password|token|secret|key|credential)/gi,
    filePatterns: [/\.(js|jsx|ts|tsx)$/i],
    confidence: 'MEDIUM',
    recommendation: 'Ensure sensitive data is only sent to trusted endpoints',
  },
  {
    id: 'email-sensitive-data',
    name: 'Sensitive Data in Email',
    description: 'Code sending sensitive data via email',
    category: 'DATA_EXFILTRATION',
    severity: 'HIGH',
    pattern: /mail\s*\([^)]*(?:password|secret|key|token|credential)[^)]*\)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'MEDIUM',
    recommendation: 'Never send sensitive data in emails',
  },
];

/**
 * Patterns for detecting injection vulnerabilities
 */
export const INJECTION_PATTERNS: SecurityPattern[] = [
  {
    id: 'sql-injection-php',
    name: 'SQL Injection (PHP)',
    description: 'Potential SQL injection vulnerability - query built with user input',
    category: 'INJECTION',
    severity: 'CRITICAL',
    pattern: /(?:mysql_query|mysqli_query|pg_query|sqlite_query|\$(?:pdo|db|conn|mysqli|connection)->query)\s*\(\s*['"][^'"]*\$(?:_(?:GET|POST|REQUEST|COOKIE)|[a-z_]+)\s*\[/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use prepared statements/parameterized queries',
  },
  {
    id: 'sql-injection-concat',
    name: 'SQL Injection (String Concat)',
    description: 'SQL query built using string concatenation with variables',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+[^;]*\s*\+\s*\$?(?:req(?:uest)?|params?|input|user|query)/gi,
    confidence: 'MEDIUM',
    recommendation: 'Use prepared statements instead of string concatenation',
  },
  {
    id: 'xss-echo-unescaped',
    name: 'XSS (Unescaped Output)',
    description: 'Unescaped user input in HTML output',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: /(?:echo|print)\s+\$_(?:GET|POST|REQUEST|COOKIE)\s*\[/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use htmlspecialchars() or proper escaping',
  },
  {
    id: 'command-injection',
    name: 'Command Injection',
    description: 'Shell command built with user-controlled input',
    category: 'INJECTION',
    severity: 'CRITICAL',
    pattern: /(?:exec|system|shell_exec|passthru|popen|proc_open|`)\s*\([^)]*\$(?:_(?:GET|POST|REQUEST)|argv|input)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use escapeshellarg() and escapeshellcmd()',
  },
  {
    id: 'ldap-injection',
    name: 'LDAP Injection',
    description: 'LDAP query with unsanitized user input',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: /ldap_search\s*\([^,]+,\s*[^,]+,\s*['"][^'"]*\$_(?:GET|POST|REQUEST)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Sanitize LDAP filter special characters',
  },
  {
    id: 'xpath-injection',
    name: 'XPath Injection',
    description: 'XPath query with unsanitized user input',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: /xpath\s*\(\s*['"][^'"]*\$_(?:GET|POST|REQUEST)/gi,
    confidence: 'HIGH',
    recommendation: 'Parameterize XPath queries',
  },
];

/**
 * Patterns for detecting obfuscated code
 */
export const OBFUSCATION_PATTERNS: SecurityPattern[] = [
  {
    id: 'hex-encoded-string',
    name: 'Hex Encoded String',
    description: 'Long hex-encoded string that may hide malicious code',
    category: 'OBFUSCATION',
    severity: 'MEDIUM',
    pattern: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){20,}/g,
    confidence: 'MEDIUM',
    recommendation: 'Decode and review the string content',
  },
  {
    id: 'base64-long-string',
    name: 'Long Base64 String',
    description: 'Very long base64-encoded string that may contain hidden code',
    category: 'OBFUSCATION',
    severity: 'MEDIUM',
    pattern: /['"][A-Za-z0-9+\/=]{500,}['"]/g,
    excludePatterns: [/\.json$|\.svg$|\.lock$/i],
    confidence: 'LOW',
    recommendation: 'Decode and review the string content',
  },
  {
    id: 'char-code-obfuscation',
    name: 'Character Code Obfuscation',
    description: 'Code built from character codes - common obfuscation technique',
    category: 'OBFUSCATION',
    severity: 'HIGH',
    pattern: /String\.fromCharCode\s*\(\s*(?:\d+\s*,\s*){10,}/gi,
    filePatterns: [/\.(js|jsx|ts|tsx)$/i],
    confidence: 'HIGH',
    recommendation: 'Deobfuscate and review the code',
  },
  {
    id: 'php-char-array',
    name: 'PHP Character Array Obfuscation',
    description: 'PHP code using chr() array to hide strings',
    category: 'OBFUSCATION',
    severity: 'HIGH',
    pattern: /chr\s*\(\s*\d+\s*\)\s*\.\s*chr\s*\(\s*\d+\s*\)(?:\s*\.\s*chr\s*\(\s*\d+\s*\)){5,}/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Deobfuscate and review the code',
  },
  {
    id: 'variable-function-call',
    name: 'Variable Function Call',
    description: 'Function called via variable - can hide malicious calls',
    category: 'OBFUSCATION',
    severity: 'MEDIUM',
    pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*(?:base64_decode|gzinflate|gzuncompress)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Review what function is being called',
  },
];

/**
 * Patterns for detecting crypto miners
 */
export const CRYPTO_MINER_PATTERNS: SecurityPattern[] = [
  {
    id: 'coinhive',
    name: 'CoinHive Miner',
    description: 'CoinHive cryptocurrency miner detected',
    category: 'CRYPTO_MINER',
    severity: 'CRITICAL',
    pattern: /coinhive|coin-?hive\.(?:min\.)?js|CoinHive\.Anonymous/gi,
    confidence: 'HIGH',
    recommendation: 'Remove cryptocurrency miner immediately',
  },
  {
    id: 'cryptonight',
    name: 'CryptoNight Miner',
    description: 'CryptoNight mining code detected',
    category: 'CRYPTO_MINER',
    severity: 'CRITICAL',
    pattern: /cryptonight|CryptoNight|xmr-?stak|xmrig/gi,
    confidence: 'HIGH',
    recommendation: 'Remove cryptocurrency miner immediately',
  },
  {
    id: 'webminer',
    name: 'Web Miner',
    description: 'Browser-based cryptocurrency miner detected',
    category: 'CRYPTO_MINER',
    severity: 'CRITICAL',
    pattern: /(?:crypto-?loot|minero?\.cc|webmine(?:r|pool)|jsecoin|perfekt\.cc)/gi,
    confidence: 'HIGH',
    recommendation: 'Remove cryptocurrency miner immediately',
  },
];

/**
 * Patterns for detecting general security flaws
 */
export const SECURITY_FLAW_PATTERNS: SecurityPattern[] = [
  {
    id: 'insecure-deserialize-php',
    name: 'Insecure Deserialization (PHP)',
    description: 'PHP unserialize with user input - potential object injection',
    category: 'SECURITY_FLAW',
    severity: 'HIGH',
    pattern: /unserialize\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use json_decode() instead of unserialize() for user input',
  },
  {
    id: 'insecure-deserialize-python',
    name: 'Insecure Deserialization (Python)',
    description: 'Python pickle/yaml with untrusted data',
    category: 'SECURITY_FLAW',
    severity: 'HIGH',
    pattern: /(?:pickle|cPickle|yaml)\.(?:loads?|load)\s*\(\s*(?:request\.|data|input)/gi,
    filePatterns: [/\.py$/i],
    confidence: 'HIGH',
    recommendation: 'Use json.loads() for untrusted data',
  },
  {
    id: 'weak-crypto-md5',
    name: 'Weak Cryptography (MD5)',
    description: 'MD5 used for password hashing - cryptographically broken',
    category: 'SECURITY_FLAW',
    severity: 'HIGH',
    pattern: /md5\s*\(\s*\$(?:password|pwd|pass|secret)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use password_hash() with PASSWORD_BCRYPT or PASSWORD_ARGON2ID',
  },
  {
    id: 'weak-crypto-sha1',
    name: 'Weak Cryptography (SHA1)',
    description: 'SHA1 used for security purposes - deprecated',
    category: 'SECURITY_FLAW',
    severity: 'MEDIUM',
    pattern: /sha1\s*\(\s*\$(?:password|pwd|pass|secret|token)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use SHA-256 or stronger hash functions',
  },
  {
    id: 'debug-enabled',
    name: 'Debug Mode Enabled',
    description: 'Debug mode enabled in production configuration',
    category: 'SECURITY_FLAW',
    severity: 'MEDIUM',
    pattern: /(?:DEBUG|APP_DEBUG|DJANGO_DEBUG)\s*[:=]\s*(?:true|1|['"]true['"])/gi,
    excludePatterns: [/\.example$|\.sample$|\.template$/i],
    confidence: 'MEDIUM',
    recommendation: 'Disable debug mode in production',
  },
  {
    id: 'cors-wildcard',
    name: 'CORS Wildcard',
    description: 'CORS configured to allow all origins',
    category: 'SECURITY_FLAW',
    severity: 'MEDIUM',
    pattern: /(?:Access-Control-Allow-Origin|cors.*origin)\s*[:=]\s*['"]?\*['"]?/gi,
    confidence: 'MEDIUM',
    recommendation: 'Configure specific allowed origins for CORS',
  },
  {
    id: 'file-upload-unrestricted',
    name: 'Unrestricted File Upload',
    description: 'File upload without proper type validation',
    category: 'SECURITY_FLAW',
    severity: 'HIGH',
    pattern: /move_uploaded_file\s*\([^)]+\$_FILES\s*\[[^\]]+\]\s*\[\s*['"]name['"]\s*\]/gi,
    filePatterns: [/\.php$/i],
    confidence: 'MEDIUM',
    recommendation: 'Validate file types and use generated filenames',
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal',
    description: 'File path constructed with user input without sanitization',
    category: 'SECURITY_FLAW',
    severity: 'HIGH',
    pattern: /(?:file_get_contents|fopen|include|require|readfile)\s*\([^)]*\$_(?:GET|POST|REQUEST)/gi,
    filePatterns: [/\.php$/i],
    confidence: 'HIGH',
    recommendation: 'Use basename() and validate paths against a whitelist',
  },
  {
    id: 'insecure-random',
    name: 'Insecure Random Number',
    description: 'Using non-cryptographic random for security purposes',
    category: 'SECURITY_FLAW',
    severity: 'MEDIUM',
    pattern: /(?:Math\.random|rand|mt_rand)\s*\(\s*\).*(?:token|secret|key|password|salt|nonce)/gi,
    confidence: 'MEDIUM',
    recommendation: 'Use cryptographically secure random functions',
  },
];

/**
 * All patterns combined for easy access
 */
export const ALL_PATTERNS: SecurityPattern[] = [
  ...SECRET_PATTERNS,
  ...BACKDOOR_PATTERNS,
  ...EXFILTRATION_PATTERNS,
  ...INJECTION_PATTERNS,
  ...OBFUSCATION_PATTERNS,
  ...CRYPTO_MINER_PATTERNS,
  ...SECURITY_FLAW_PATTERNS,
];

/**
 * Get patterns for a specific file type
 */
export function getPatternsForFile(filename: string): SecurityPattern[] {
  return ALL_PATTERNS.filter(pattern => {
    // Check if pattern should be excluded for this file
    if (pattern.excludePatterns) {
      for (const excludePattern of pattern.excludePatterns) {
        if (excludePattern.test(filename)) {
          return false;
        }
      }
    }

    // Check if pattern has file type restrictions
    if (pattern.filePatterns && pattern.filePatterns.length > 0) {
      return pattern.filePatterns.some(fp => fp.test(filename));
    }

    // No restrictions - apply to all files
    return true;
  });
}
