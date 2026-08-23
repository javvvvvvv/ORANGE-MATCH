import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from '../src/models/db.js';

const username = 'admin';
const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (!user) {
  console.error('NO_EXISTE_ADMIN');
  process.exit(2);
}

const password = randomBytes(18).toString('base64url') + '!Aa9';
const hash = bcrypt.hashSync(password, 12);

db.prepare('UPDATE users SET password = ?, active = 1, role = ? WHERE username = ?')
  .run(hash, 'admin', username);

console.log(password);
