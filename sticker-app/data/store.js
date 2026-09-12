// Simple in-memory data store.
// NOTE: This is a demo/pentest-target app. Swap for a real database (Postgres/SQLite)
// before ever using this in production.

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const users = [];      // { id, name, email, passwordHash, role, createdAt }
const designs = [];    // { id, userId, filename, originalName, isPublic, createdAt }
const orders = [];     // { id, userId, designId, shape, material, size, finish, quantity, status, shippingAddress, createdAt }

function seed() {
  const adminPasswordHash = bcrypt.hashSync('ChangeMe123!', 10);
  users.push({
    id: uuidv4(),
    name: 'Shop Admin',
    email: 'admin@stickershop.test',
    passwordHash: adminPasswordHash,
    role: 'admin',
    createdAt: new Date().toISOString()
  });
}
seed();

module.exports = { users, designs, orders };
