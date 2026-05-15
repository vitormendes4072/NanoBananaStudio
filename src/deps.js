/**
 * Central dependency registry to avoid circular imports.
 * Each module registers its functions here at import time.
 * Other modules call them via `deps.functionName()`.
 */
const deps = {};

export default deps;
