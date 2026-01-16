import AppDataSource from "./src/data-source";
import { ProjectRequestEntity } from "./src/database/entities/project-request.entity";

async function checkData() {
    try {
        await AppDataSource.initialize();
        console.log("Database connected successfully using AppDataSource.");
        console.log("DB Host:", AppDataSource.options.type === 'postgres' ? (AppDataSource.options as any).host : 'unknown');

        // Check Enum
        const enumResult = await AppDataSource.query(`
            SELECT enum_range(NULL::project_requests_status_enum);
        `);
        console.log("Current Enum Values:", enumResult[0].enum_range);
        
        const requestRepo = AppDataSource.getRepository(ProjectRequestEntity);
        // Find last 5 requests
        const requests = await requestRepo.find({ order: { createdAt: 'DESC' }, take: 5 });
        
        console.log(`Found ${requests.length} recent requests in the database.`);
        requests.forEach(r => {
            console.log(`- Request ID: ${r.id}, Status: ${r.status}, ClientID: ${r.clientId}`);
        });
        
    } catch (error) {
        console.error("Error accessing database:", error);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

checkData();

