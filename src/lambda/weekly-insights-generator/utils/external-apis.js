"use strict";
// External API utilities for weekly insights generator
// Simplified version with only what we need
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlags = void 0;
// Feature flags for this Lambda
exports.featureFlags = {
    USE_CACHED_APIS: process.env.USE_CACHED_APIS === 'true' || true,
    DEMO_MODE: process.env.DEMO_MODE === 'true' || true,
    ENABLE_PLAID: process.env.ENABLE_PLAID === 'true' || false
};
