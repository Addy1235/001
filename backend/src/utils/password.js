const argon2 = require('argon2');

// Hash password with Argon2id
const hashPassword = async (password) => {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });
};

// Verify password
const verifyPassword = async (hash, password) => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

module.exports = { hashPassword, verifyPassword };
