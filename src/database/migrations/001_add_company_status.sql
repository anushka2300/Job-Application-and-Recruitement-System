ALTER TABLE companies
    ADD COLUMN status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE'
        AFTER location;
