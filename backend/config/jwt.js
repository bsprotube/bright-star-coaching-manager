// Fails the app at startup if JWT_SECRET isn't configured, instead of silently
// falling back to a default. A hardcoded fallback secret sitting in source control
// is a secret that isn't a secret — anyone who reads the repo can forge a token for
// any user. Better to crash loudly in a broken deploy than serve requests signed
// with a secret the whole internet can read.
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is not set. Refusing to start — set it before running the server.'
  );
}

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
};
