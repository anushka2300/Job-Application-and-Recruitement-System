CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('CANDIDATE', 'RECRUITER', 'ADMIN', 'SUPER_ADMIN')
        NOT NULL DEFAULT 'CANDIDATE',
    company_id INT NULL,
    status ENUM('PENDING', 'ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    location VARCHAR(255),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);

ALTER TABLE users
    ADD CONSTRAINT users_company_id_fk
    FOREIGN KEY (company_id)
    REFERENCES companies(id);

CREATE TABLE company_invitations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('ADMIN', 'RECRUITER') NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    status ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')
        NOT NULL DEFAULT 'PENDING',
    expires_at DATETIME NOT NULL,
    invited_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id)
        REFERENCES companies(id),
    FOREIGN KEY (invited_by)
        REFERENCES users(id)
);

CREATE TABLE jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    created_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    employment_type ENUM('FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT') DEFAULT 'FULL_TIME',
    experience_min INT,
    experience_max INT,
    salary_min DECIMAL(12,2),
    salary_max DECIMAL(12,2),
    skills JSON,
    status ENUM('DRAFT', 'PUBLISHED', 'CLOSED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    candidate_id INT NOT NULL,

    resume_url VARCHAR(500),
    cover_letter TEXT,

    status ENUM(
        'APPLIED',
        'SHORTLISTED',
        'INTERVIEW',
        'SELECTED',
        'REJECTED',
        'WITHDRAWN'
    ) NOT NULL DEFAULT 'APPLIED',

    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_candidate_job (candidate_id, job_id),

    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (candidate_id) REFERENCES users(id)
);
