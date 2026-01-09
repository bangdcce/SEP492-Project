import { DataSource } from "typeorm";
import { ProjectRequestEntity } from "./src/database/entities/project-request.entity";
import { registerAs } from '@nestjs/config';

// Recreate config locally to avoid import issues with NestJS modules in standalone script
const dbConfig = {
    type: 'postgres',
    host:  'localhost',
    port: 5432,
    username: 'postgres',
    password: '',
    database: 'postgres',
    entities: [ProjectRequestEntity],
    synchronize: false,
};

const AppDataSource = new DataSource({
    ...dbConfig,
    type: "postgres",
} as any);

async function checkData() {
    try {
        await AppDataSource.initialize();
        console.log("Database connected.");
        
        const requestRepo = AppDataSource.getRepository(ProjectRequestEntity);
        const requests = await requestRepo.find();
        
        console.log(`Found ${requests.length} requests in the database.`);
        requests.forEach(r => {
            console.log(`- Request ID: ${r.id}, Status: ${r.status}, Title: ${r.title}, ClientID: ${r.clientId}`);
        });
        
    } catch (error) {
        console.error("Error accessing database:", error);
    } finally {
        await AppDataSource.destroy();
    }
}

checkData();
