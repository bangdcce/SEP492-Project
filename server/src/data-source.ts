// src/data-source.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 1. Phải tự load .env vì không có ConfigModule ở đây
dotenv.config(); 

// 2. Tạo biến DataSource
const AppDataSource = new DataSource({
  type: 'postgres',
  // 3. Đọc trực tiếp process.env
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  
  // 4. Đường dẫn file dùng path.join và __dirname để an toàn
  entities: [path.join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'database/migrations/*{.ts,.js}')],
  migrationsRun: false,
});

// 5. QUAN TRỌNG: Phải export default để CLI nhận diện
export default AppDataSource;