import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TLS 1.3 Configuration for HTTPS Server
 * Implements secure data in transit encryption
 */

export interface TLSConfig {
  key: Buffer;
  cert: Buffer;
  ca?: Buffer;
  minVersion: tls.SecureVersion;
  maxVersion: tls.SecureVersion;
  ciphers: string;
  honorCipherOrder: boolean;
  secureOptions: number;
}

/**
 * Get TLS configuration for HTTPS server
 * Enforces TLS 1.3 with secure cipher suites
 */
export function getTLSConfig(): TLSConfig | null {
  // Check if TLS is enabled
  const tlsEnabled = process.env.TLS_ENABLED === 'true';
  
  if (!tlsEnabled) {
    console.warn('TLS is disabled. Set TLS_ENABLED=true to enable HTTPS.');
    return null;
  }

  // Get certificate paths from environment
  const keyPath = process.env.TLS_KEY_PATH;
  const certPath = process.env.TLS_CERT_PATH;
  const caPath = process.env.TLS_CA_PATH;

  if (!keyPath || !certPath) {
    throw new Error('TLS_KEY_PATH and TLS_CERT_PATH must be set when TLS_ENABLED=true');
  }

  // Read certificate files
  const key = fs.readFileSync(path.resolve(keyPath));
  const cert = fs.readFileSync(path.resolve(certPath));
  const ca = caPath ? fs.readFileSync(path.resolve(caPath)) : undefined;

  // TLS 1.3 configuration
  const config: TLSConfig = {
    key,
    cert,
    ca,
    
    // Enforce TLS 1.3 (or minimum TLS 1.2 for compatibility)
    minVersion: 'TLSv1.3',
    maxVersion: 'TLSv1.3',
    
    // Secure cipher suites for TLS 1.3
    // TLS 1.3 uses AEAD ciphers: AES-GCM and ChaCha20-Poly1305
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
    ].join(':'),
    
    // Prefer server cipher order
    honorCipherOrder: true,
    
    // Secure options
    secureOptions: 
      // Disable older TLS versions
      (1 << 2) | // SSL_OP_NO_SSLv2
      (1 << 3) | // SSL_OP_NO_SSLv3
      (1 << 25) | // SSL_OP_NO_TLSv1
      (1 << 26), // SSL_OP_NO_TLSv1_1
  };

  return config;
}

/**
 * Create HTTPS server with TLS 1.3 configuration
 */
export function createHTTPSServer(app: any): https.Server | null {
  const tlsConfig = getTLSConfig();
  
  if (!tlsConfig) {
    return null;
  }

  const server = https.createServer(tlsConfig, app);
  
  console.log('HTTPS server created with TLS 1.3 configuration');
  console.log('- Min TLS Version:', tlsConfig.minVersion);
  console.log('- Max TLS Version:', tlsConfig.maxVersion);
  console.log('- Cipher Suites:', tlsConfig.ciphers);
  
  return server;
}

/**
 * Get recommended TLS configuration for development
 * Uses self-signed certificates (not for production!)
 */
export function getDevelopmentTLSConfig(): TLSConfig | null {
  const tlsEnabled = process.env.TLS_ENABLED === 'true';
  
  if (!tlsEnabled) {
    return null;
  }

  // For development, allow TLS 1.2 as fallback
  const config: TLSConfig = {
    key: Buffer.from(''), // Placeholder - use self-signed cert
    cert: Buffer.from(''), // Placeholder - use self-signed cert
    
    minVersion: 'TLSv1.2', // Allow TLS 1.2 for development tools
    maxVersion: 'TLSv1.3',
    
    ciphers: [
      // TLS 1.3 ciphers
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      // TLS 1.2 fallback ciphers
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
    ].join(':'),
    
    honorCipherOrder: true,
    secureOptions: 
      (1 << 2) | // SSL_OP_NO_SSLv2
      (1 << 3) | // SSL_OP_NO_SSLv3
      (1 << 25), // SSL_OP_NO_TLSv1
  };

  return config;
}

/**
 * Validate TLS configuration
 */
export function validateTLSConfig(config: TLSConfig): boolean {
  // Check that key and cert are present
  if (!config.key || !config.cert) {
    console.error('TLS configuration missing key or certificate');
    return false;
  }

  // Check that TLS version is secure
  if (config.minVersion !== 'TLSv1.3' && config.minVersion !== 'TLSv1.2') {
    console.error('TLS configuration uses insecure minimum version:', config.minVersion);
    return false;
  }

  // Check that cipher suites are configured
  if (!config.ciphers || config.ciphers.length === 0) {
    console.error('TLS configuration missing cipher suites');
    return false;
  }

  return true;
}
