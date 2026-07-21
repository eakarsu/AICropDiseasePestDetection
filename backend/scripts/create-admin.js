'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
    throw new Error('Explicit bootstrap acknowledgement is required');
  }
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  const fullName = (process.env.PROVISION_ADMIN_NAME || '').trim();
  const farmName = (process.env.PROVISION_COMPANY_NAME || '').trim() || null;
  if (!email || !fullName || password.length < 12) {
    throw new Error('Operator email, name, and a 12+ character password are required');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password, full_name, farm_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       password = EXCLUDED.password,
       full_name = EXCLUDED.full_name,
       farm_name = EXCLUDED.farm_name`,
    [email, passwordHash, fullName, farmName]
  );
  console.log('Operator provisioned.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
