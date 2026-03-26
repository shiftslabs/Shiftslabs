-- Seed: Default Apps
-- Database: shiftslabs_auth_db

-- Account App (SSO Hub)
INSERT INTO apps (name, client_id, redirect_uri, is_whitelisted) 
VALUES 
    ('Shiftslabs Account', 'account', 'https://account.shiftslabs.pages.dev', true),
    ('Chatbot', 'chatbot', 'https://chatbot.shiftslabs.pages.dev', false),
    ('LearnX', 'learnx', 'https://learnx.shiftslabs.pages.dev', false),
    ('Classroom', 'classroom', 'https://classroom.shiftslabs.pages.dev', false)
ON CONFLICT (client_id) DO NOTHING;