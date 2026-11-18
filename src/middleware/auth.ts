import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, NexusRole } from '../db/users.ts';

export interface AuthContext {
  uid: string;
  email: string;
  name?: string;
  role: NexusRole;
  tenantId: string;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  authContext?: AuthContext;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || `${decodedToken.uid}@nexus.auth`,
      decodedToken.name
    );
    const role = (
      dbUser.role === 'admin' || dbUser.role === 'operator' || dbUser.role === 'viewer'
        ? dbUser.role
        : 'operator'
    ) as NexusRole;

    req.authContext = {
      uid: decodedToken.uid,
      email: dbUser.email,
      name: dbUser.displayName ?? decodedToken.name,
      role,
      tenantId: dbUser.tenantId,
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (...allowedRoles: NexusRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authContext) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing auth context' });
    }
    if (!allowedRoles.includes(req.authContext.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires role [${allowedRoles.join(' | ')}], current role is "${req.authContext.role}".`,
      });
    }
    next();
  };
};
