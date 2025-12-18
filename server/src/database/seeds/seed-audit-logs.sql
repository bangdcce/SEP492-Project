-- ============================================
-- SEED AUDIT LOGS FOR TESTING
-- Run this AFTER running seed-data.sql
-- ============================================
-- Uses correct UUID actor_id references
-- ============================================

INSERT INTO "audit_logs" ("actor_id", "action", "entity_type", "entity_id", "ip_address", "user_agent", "before_data", "after_data", "created_at") VALUES
-- Admin activities (LOW risk)
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'LOGIN', 'AuthSession', 'session-1', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', NULL, '{"_security_analysis": {"flags": [], "riskLevel": "LOW", "timestamp": "2024-12-18T08:00:00Z"}}', NOW() - INTERVAL '2 hours'),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CREATE', 'User', 'user-new-1', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', NULL, '{"email": "newuser@test.com", "role": "CLIENT", "_security_analysis": {"flags": [], "riskLevel": "NORMAL", "timestamp": "2024-12-18T08:30:00Z"}}', NOW() - INTERVAL '1 hour 30 minutes'),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UPDATE', 'PlatformSettings', 'setting-1', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', '{"commissionRate": 0.05}', '{"commissionRate": 0.08, "_security_analysis": {"flags": ["SENSITIVE_CONFIG_CHANGE"], "riskLevel": "HIGH", "timestamp": "2024-12-18T09:00:00Z"}}', NOW() - INTERVAL '1 hour'),

-- Staff activities
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'LOGIN', 'AuthSession', 'session-2', '10.0.0.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/17.0', NULL, '{"_security_analysis": {"flags": [], "riskLevel": "LOW", "timestamp": "2024-12-18T09:15:00Z"}}', NOW() - INTERVAL '45 minutes'),

('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'UPDATE', 'Project', 'project-5', '10.0.0.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/17.0', '{"status": "PLANNING"}', '{"status": "IN_PROGRESS", "_security_analysis": {"flags": [], "riskLevel": "NORMAL", "timestamp": "2024-12-18T09:30:00Z"}}', NOW() - INTERVAL '30 minutes'),

-- Broker activities
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'LOGIN', 'AuthSession', 'session-3', '172.16.0.25', 'Mozilla/5.0 (Windows NT 10.0) Edge/120.0', NULL, '{"_security_analysis": {"flags": [], "riskLevel": "LOW", "timestamp": "2024-12-18T10:00:00Z"}}', NOW() - INTERVAL '15 minutes'),

('c3d4e5f6-a7b8-9012-cdef-123456789012', 'CREATE', 'ProjectRequest', 'request-10', '172.16.0.25', 'Mozilla/5.0 (Windows NT 10.0) Edge/120.0', NULL, '{"title": "E-commerce Website", "budget": 50000000, "_security_analysis": {"flags": [], "riskLevel": "NORMAL", "timestamp": "2024-12-18T10:15:00Z"}}', NOW() - INTERVAL '10 minutes'),

-- Client activities  
('d4e5f6a7-b8c9-0123-defa-234567890123', 'LOGIN', 'AuthSession', 'session-4', '203.162.45.67', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1', NULL, '{"_security_analysis": {"flags": [], "riskLevel": "LOW", "timestamp": "2024-12-18T10:30:00Z"}}', NOW() - INTERVAL '5 minutes'),

-- Suspicious activity (HIGH risk)
('e5f6a7b8-c9d0-1234-efab-345678901234', 'LOGIN', 'AuthSession', 'session-5', '45.33.32.156', 'curl/7.68.0', NULL, '{"_security_analysis": {"flags": ["Suspicious User Agent", "UNUSUAL_LOCATION_ACTIVITY"], "riskLevel": "HIGH", "timestamp": "2024-12-18T10:45:00Z"}}', NOW() - INTERVAL '2 minutes'),

('f6a7b8c9-d0e1-2345-fabc-456789012345', 'DELETE', 'Document', 'doc-15', '103.7.196.124', 'PostmanRuntime/7.29.0', '{"name": "Contract.pdf", "type": "CONTRACT"}', '{"deleted": true, "_security_analysis": {"flags": ["Suspicious User Agent"], "riskLevel": "HIGH", "timestamp": "2024-12-18T10:50:00Z"}}', NOW() - INTERVAL '1 minute'),

-- More normal activities
('e5f6a7b8-c9d0-1234-efab-345678901234', 'UPDATE', 'Profile', 'profile-3', '192.168.1.200', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0', '{"bio": "Developer"}', '{"bio": "Senior Developer", "_security_analysis": {"flags": [], "riskLevel": "LOW", "timestamp": "2024-12-18T11:00:00Z"}}', NOW()),

('c3d4e5f6-a7b8-9012-cdef-123456789012', 'EXPORT', 'Report', 'report-1', '172.16.0.25', 'Mozilla/5.0 (Windows NT 10.0) Edge/120.0', NULL, '{"reportType": "MonthlyRevenue", "format": "PDF", "_security_analysis": {"flags": [], "riskLevel": "NORMAL", "timestamp": "2024-12-18T11:05:00Z"}}', NOW());

-- ==========================================
-- DONE! 12 audit log entries created
-- ==========================================
-- Risk levels: LOW (5), NORMAL (4), HIGH (3)
-- All actor_id values reference valid users
-- ==========================================
