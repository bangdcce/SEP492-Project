-- Insert Question
INSERT INTO wizard_questions (id, code, label, is_active)
VALUES (101, 'B1_PRODUCT_TYPE', 'What type of product do you want to build?', true)
ON CONFLICT DO NOTHING;

-- Insert Option
INSERT INTO wizard_options (id, question_id, value, label)
VALUES (1001, 101, 'WEB_APP', 'Web Application')
ON CONFLICT DO NOTHING;

-- Insert Answer for existing request (d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11)
INSERT INTO project_request_answers (id, "requestId", "questionId", "optionId", "valueText")
VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', '101', '1001', NULL)
ON CONFLICT (id) DO NOTHING;
