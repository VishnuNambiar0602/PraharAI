import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mcpPort: parseInt(process.env.MCP_PORT || '3001', 10),

  // Database Configuration
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'your_neo4j_password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Cache TTL Configuration (in seconds)
  cache: {
    ttl: {
      schemes: parseInt(process.env.CACHE_TTL_SCHEMES || '86400', 10),
      recommendations: parseInt(process.env.CACHE_TTL_RECOMMENDATIONS || '86400', 10),
      eligibility: parseInt(process.env.CACHE_TTL_ELIGIBILITY || '86400', 10),
    },
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_change_in_production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Encryption Configuration
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'your_32_byte_encryption_key_change_in_production',
  },

  // External API Configuration
  myScheme: {
    apiUrl: process.env.MYSCHEME_API_URL || 'https://api.myscheme.gov.in',
    apiKey: process.env.MYSCHEME_API_KEY || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
  },

  // ML Service Configuration
  mlService: {
    url: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

export default config;
