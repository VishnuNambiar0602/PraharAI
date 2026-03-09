import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'panchayat';
  // panchayat-specific claims (present when role === 'panchayat')
  panchayatName?: string;
  district?: string;
  state?: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class JWTService {
  private privateKey!: string;
  private publicKey!: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly ALGORITHM = 'RS256';

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    const keysDir = path.join(process.cwd(), 'keys');
    const privateKeyPath = path.join(keysDir, 'private.pem');
    const publicKeyPath = path.join(keysDir, 'public.pem');

    // Check if keys exist, if not generate them
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      this.generateKeyPair(privateKeyPath, publicKeyPath);
    }

    this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');
  }

  private generateKeyPair(privateKeyPath: string, publicKeyPath: string): void {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
  }

  generateAccessToken(
    userId: string,
    email: string,
    role: 'user' | 'admin' | 'panchayat' = 'user',
    extra?: Record<string, string>,
    expiresIn?: string
  ): string {
    const payload = {
      userId,
      email,
      role,
      ...extra,
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: this.ALGORITHM as jwt.Algorithm,
      expiresIn: (expiresIn ?? this.ACCESS_TOKEN_EXPIRY) as any,
    });
  }

  generateRefreshToken(
    userId: string,
    email: string,
    role: 'user' | 'admin' | 'panchayat' = 'user'
  ): string {
    const payload = {
      userId,
      email,
      role,
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: this.ALGORITHM as jwt.Algorithm,
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });
  }

  generateTokenPair(
    userId: string,
    email: string,
    role: 'user' | 'admin' | 'panchayat' = 'user'
  ): TokenPair {
    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.generateRefreshToken(userId, email, role);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: [this.ALGORITHM as jwt.Algorithm],
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: [this.ALGORITHM as jwt.Algorithm],
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}
