INSERT INTO users (id, email, "passwordHash", "fullName", role, "isVerified", "createdAt", "updatedAt")
VALUES 
(gen_random_uuid(), 'broker.new@test.com', '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW', 'New Broker User', 'BROKER', true, NOW(), NOW());
