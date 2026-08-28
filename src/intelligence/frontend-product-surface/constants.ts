export const FRONTEND_PRODUCT_SURFACE_SKILL_ID = "intelligence.frontend-product-surface.s13k";
export const FRONTEND_PRODUCT_SURFACE_QUALITY_CONTRACT_REF = "S13K_FRONTEND_PRODUCT_SURFACE_DEEP";
export const FRONTEND_PRODUCT_SURFACE_INPUT_MARKER = "[[FRONTEND_PRODUCT_SURFACE_INPUT]]";
export const FRONTEND_PRODUCT_SURFACE_SKILL_MARKER = "[[FRONTEND_PRODUCT_SURFACE_SKILL]]";
export const VIEWPORT_CLASSES = ["NARROW", "MEDIUM", "WIDE"] as const;
export const FORBIDDEN_BINDING_PATTERN = /\b(?:react|vue|svelte|angular|playwright|puppeteer|webdriver|browser\s*automation|auth0|okta|datadog|retry\s*loop|backoff|capability\s*registry)\b|(?:document|window)\./i;
export const UNSAFE_COPY_PATTERN = /(?:stack\s*trace|select\s+.+\s+from|sqlstate|bearer\s+[a-z0-9._-]+|token\s*[:=]|\/usr\/|\\\\src\\|internal\s+path)/i;
export const FABRICATED_COPY_PATTERN = /\b(?:official brand voice|legally required|certified translation|localized in \d+ languages)\b/i;
