-- Use existing Client ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO project_requests (id, "clientId", title, description, status)
VALUES 
('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mobile App Landing Page', 'Need a responsive landing page for our new fitness app.', 'PENDING'),
('d2eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'E-commerce Redesign', 'Current Shopify store needs a fresh UI/UX.', 'PENDING'),
('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380d33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'AI Chatbot Integration', 'Integrate Gemini API into our customer support dashboard.', 'PENDING'),
('d4eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Real-time Analytics Dashboard', 'Build a dashboard to track IoT sensor data in real-time.', 'PENDING')
ON CONFLICT (id) DO NOTHING;
