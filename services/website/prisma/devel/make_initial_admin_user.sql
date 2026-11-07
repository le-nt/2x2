--    Run this SQL on your PostgreSQL server to create an initial admin user. I made this so you don't have to modify code to create an admin user.
--    The username will be "admin" and the password will be "pizzaparty1".

DO $$
DECLARE
    pluh INTEGER;
BEGIN
INSERT INTO public."User" (
    username,
    "password",
    "createdAt",
    robux,
    tickets,
    "lastLogin",
    about,
    gender,
    birthday,
    "roleSet"
) VALUES (
    'admin',
    '$argon2id$v=19$m=65536,t=2,p=1$Efa9Si8DLXdZgSqGEleuHDnGzWy+d5BWepgWwd5c2UY$c3Rwpb3fovXcqolPs8+3KbnplW0TR3ySfvs0rXYU/YM',
    '2025-07-21 10:05:51.533',
    25,
    100,
    '2025-07-21 10:05:51.533',
    '',
    1,
    '2001-09-11 00:00:00',
    'SuperAdmin'
)
RETURNING id INTO pluh;
END $$;
