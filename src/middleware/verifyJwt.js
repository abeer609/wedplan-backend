import mongoose from "mongoose";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.js";

let cachedJWKS = null;
function remoteJWKS() {
  if (!cachedJWKS) {
    const url =
      env.BETTER_AUTH_JWKS_URL ||
      `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/api/auth/jwks`;
    cachedJWKS = createRemoteJWKSet(new URL(url));
  }
  return cachedJWKS;
}

const hsKey = () => new TextEncoder().encode(env.BETTER_AUTH_SECRET);

function extractUserId(payload) {
  return (
    payload.sub ||
    payload.id ||
    payload.userId ||
    payload.user?.id ||
    payload.user?.userId
  );
}

export const verifyJwt = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
      throw new ApiError(
        401,
        "Missing or invalid Authorization header",
        "UNAUTHORIZED"
      );
    }
    let payload = null;
    const issuer = [env.BETTER_AUTH_URL, env.CLIENT_URL];
    try {
      ({ payload } = await jwtVerify(token, remoteJWKS(), {
        issuer,
        audience: issuer,
      }));
    } catch {
      try {
        ({ payload } = await jwtVerify(token, remoteJWKS()));
      } catch {
        ({ payload } = await jwtVerify(token, hsKey(), {
          algorithms: ["HS256"],
        }));
      }
    }
    const userId = extractUserId(payload);
    if (!userId) throw new ApiError(401, "Invalid token payload", "UNAUTHORIZED");
    req.auth = { userId: String(userId), payload };
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(new ApiError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
};

export const attachUser = async (req, res, next) => {
  try {
    const id = req.auth?.userId;
    let doc = null;
    if (id && mongoose.isValidObjectId(id)) {
      doc = await User.findOne({ _id: new mongoose.Types.ObjectId(id) });
    }
    if (!doc && id) {
      const raw = await User.collection.findOne({ _id: id });
      if (raw) doc = User.hydrate(raw);
    }
    if (!doc && req.auth?.payload?.email) {
      doc = await User.findOne({ email: req.auth.payload.email });
    }
    if (!doc) throw new ApiError(401, "User not found", "UNAUTHORIZED");
    req.user = doc;
    next();
  } catch (err) {
    next(err);
  }
};

export const authenticate = [verifyJwt, attachUser];
