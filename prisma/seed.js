import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const roles = [
    { name: 'ROLE_ADMIN', description: 'Quản trị viên hệ thống' },
    { name: 'ROLE_STAFF', description: 'Nhân viên hỗ trợ' },
    { name: 'ROLE_USER', description: 'Người dùng thông thường' },
];
const users = [
    {
        email: 'admin@tlusport.com',
        roleName: 'ROLE_ADMIN',
        firstName: 'System',
        lastName: 'Admin',
        phoneNumber: '0901234567',
    },
    {
        email: 'staff@tlusport.com',
        roleName: 'ROLE_STAFF',
        firstName: 'Support',
        lastName: 'Staff',
        phoneNumber: '0907654321',
    },
    {
        email: 'user@tlusport.com',
        roleName: 'ROLE_USER',
        firstName: 'Van A',
        lastName: 'Nguyen',
        phoneNumber: '0988888888',
    },
];
async function main() {
    await client.connect();
    console.log('--- Bắt đầu Seeding Roles & Accounts ---');
    const roleMap = new Map();
    for (const role of roles) {
        const res = await client.query(`INSERT INTO roles (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id, name`, [role.name, role.description]);
        const roleId = res.rows[0].id;
        roleMap.set(role.name, roleId);
        console.log(`✔ Role: "${role.name}" (ID: ${roleId})`);
    }
    const defaultPassword = 'Password123@';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    for (const u of users) {
        const userRes = await client.query(`INSERT INTO users (email, password_hash, first_name, last_name, phone_number, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           phone_number = EXCLUDED.phone_number
       RETURNING id, email`, [u.email, passwordHash, u.firstName, u.lastName, u.phoneNumber]);
        const userId = userRes.rows[0].id;
        const roleId = roleMap.get(u.roleName);
        if (roleId) {
            await client.query(`INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`, [userId, roleId]);
        }
        await client.query(`INSERT INTO wallets (user_id, balance, is_active, created_at, updated_at)
       VALUES ($1, 0, true, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING`, [userId]);
        console.log(`✔ Tài khoản: "${u.email}" | Quyền: "${u.roleName}" | Mật khẩu: "${defaultPassword}"`);
    }
    console.log('--- Hoàn tất Seeding thành công! ---');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => client.end());
//# sourceMappingURL=seed.js.map