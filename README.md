DataCaliper Training Platform

AI-powered, role-based training platform for course authoring, multimedia learning, instructor-reviewed assessments, learner progress tracking, and verifiable certificates.

1. Project Overview

DataCaliper is a full-stack learning management and assessment platform built around the following curriculum hierarchy:

Domain → Subdomain → Course → Module → Lesson

The platform supports three roles:

ADMIN — platform and user administration

INSTRUCTOR — course, lesson, and assessment authoring

USER / LEARNER — learning, assessments, progress, and certificates

The system combines conventional application logic with an AI-assisted assessment workflow using NVIDIA AI.

2. Key Features

Course Management

Domain and subdomain organization

Course creation and editing

Module and lesson management

Course publishing and unpublishing

Instructor ownership

Learning

Video lessons

PDF and document materials

Lesson completion tracking

Module completion tracking

Course progress

Learner notes

Continue-learning experience

Assessments

Module quizzes

Final course assessment

Instructor-created questions

AI-generated quiz drafts

Instructor review and editing

Instructor approval before publishing

Two-attempt module quiz rule

AI

NVIDIA AI integration

Structured quiz generation

Content-grounded generation

Schema validation

Draft → Review → Publish lifecycle

Certificates

Automatic certificate after successful completion

Persistent certificate record

Unique certificate number

Professional certificate view

Print / Save as PDF

Public verification

3. High-Level Architecture

flowchart TB

    USER[User]

    subgraph FRONTEND[Frontend]
        REACT[React Application]
        LEARNER[Learner UI]
        INSTRUCTOR[Instructor UI]
        ADMIN[Admin UI]
    end

    subgraph BACKEND[Backend]
        FASTAPI[FastAPI REST API]
        AUTH[Authentication and RBAC]
        COURSE[Course Service]
        LESSON[Lesson Service]
        PROGRESS[Progress Service]
        ASSESSMENT[Assessment Service]
        AI[AI Service]
        CERT[Certificate Service]
        FILES[Storage Service]
    end

    subgraph SUPABASE[Supabase]
        SUPA_AUTH[Supabase Auth]
        POSTGRES[(PostgreSQL)]
        STORAGE[Supabase Storage]
    end

    subgraph NVIDIA[NVIDIA AI]
        LLM[Llama Instruct Model]
    end

    USER --> REACT

    REACT --> LEARNER
    REACT --> INSTRUCTOR
    REACT --> ADMIN

    REACT --> FASTAPI

    FASTAPI --> AUTH
    AUTH --> SUPA_AUTH

    FASTAPI --> COURSE
    FASTAPI --> LESSON
    FASTAPI --> PROGRESS
    FASTAPI --> ASSESSMENT
    FASTAPI --> AI
    FASTAPI --> CERT
    FASTAPI --> FILES

    COURSE --> POSTGRES
    LESSON --> POSTGRES
    PROGRESS --> POSTGRES
    ASSESSMENT --> POSTGRES
    CERT --> POSTGRES

    FILES --> STORAGE

    AI --> LLM
    AI --> POSTGRES

Architecture Summary

Browser
   |
   v
React Frontend
   |
   v
FastAPI REST API
   |
   +---- Authentication / RBAC
   |
   +---- Course Services
   |
   +---- Lesson Services
   |
   +---- Progress Services
   |
   +---- Assessment Services ---- NVIDIA AI
   |
   +---- Certificate Services
   |
   +---- Storage Services
   |
   v
Supabase
   +---- PostgreSQL
   +---- Auth
   +---- Storage

4. Layered Architecture

flowchart TB

    UI[Presentation Layer]
    API[API Layer]
    SECURITY[Security Layer]
    SERVICE[Application Service Layer]
    DATA[Data Access Layer]
    DB[(PostgreSQL)]
    STORAGE[Object Storage]
    EXTERNAL[External Services]

    UI --> API
    API --> SECURITY
    SECURITY --> SERVICE
    SERVICE --> DATA
    DATA --> DB

    SERVICE --> STORAGE
    SERVICE --> EXTERNAL

Layer responsibilities

Layer

Responsibility

Presentation

React UI, routing, forms, user interaction

API

FastAPI REST endpoints

Security

Authentication, RBAC, ownership checks

Services

Business rules and workflows

Data Access

SQLAlchemy / database operations

Database

Persistent application data

Storage

Videos and learning materials

External Services

NVIDIA AI and Supabase Auth

5. RBAC Architecture

flowchart LR

    USER[Authenticated User]
    AUTH[Authentication]
    RBAC[RBAC Authorization]

    ADMIN[ADMIN]
    INSTRUCTOR[INSTRUCTOR]
    LEARNER[USER]

    ADMIN_ACTIONS[User Management and Governance]
    INSTRUCTOR_ACTIONS[Course and Assessment Authoring]
    LEARNER_ACTIONS[Learning and Assessments]

    USER --> AUTH
    AUTH --> RBAC

    RBAC --> ADMIN
    RBAC --> INSTRUCTOR
    RBAC --> LEARNER

    ADMIN --> ADMIN_ACTIONS
    INSTRUCTOR --> INSTRUCTOR_ACTIONS
    LEARNER --> LEARNER_ACTIONS

Permission Matrix

Capability

ADMIN

INSTRUCTOR

USER

Manage users

Yes

No

No

Create courses

No

Yes

No

Edit owned courses

No

Yes

No

Manage lessons

No

Yes

No

Generate AI assessments

No

Yes

No

Review assessments

No

Yes

No

Publish assessments

No

Yes

No

Browse published courses

Yes

Yes

Yes

Learn courses

Yes

Yes

Yes

Attempt assessments

No

No

Yes

Earn certificates

No

No

Yes

Verify certificates

Yes

Yes

Yes

Important: the frontend may hide or show UI based on role, but the backend remains the authoritative authorization layer.

6. Authentication Flow

sequenceDiagram

    participant User
    participant Frontend
    participant Auth
    participant API
    participant Database

    User->>Frontend: Sign in
    Frontend->>Auth: Authenticate
    Auth-->>Frontend: Session
    Frontend->>API: Authenticated request
    API->>Auth: Validate identity
    Auth-->>API: Valid identity
    API->>Database: Load user and role
    Database-->>API: User role
    API-->>Frontend: Authorized response
    Frontend-->>User: Protected application

The user does not choose an arbitrary role during normal authentication. The backend resolves authorization from trusted identity and role information.

7. Course Architecture

flowchart TD

    DOMAIN[Domain]
    SUBDOMAIN[Subdomain]
    COURSE[Course]

    MODULE1[Module 1]
    MODULE2[Module 2]
    MODULEN[Module N]

    LESSON1[Lesson]
    LESSON2[Lesson]
    LESSONN[Lesson]

    QUIZ1[Module Quiz]
    QUIZ2[Module Quiz]

    FINAL[Final Assessment]

    DOMAIN --> SUBDOMAIN
    SUBDOMAIN --> COURSE

    COURSE --> MODULE1
    COURSE --> MODULE2
    COURSE --> MODULEN

    MODULE1 --> LESSON1
    MODULE1 --> LESSON2
    MODULE1 --> QUIZ1

    MODULE2 --> LESSONN
    MODULE2 --> QUIZ2

    COURSE --> FINAL

Curriculum hierarchy

Domain
└── Subdomain
    └── Course
        ├── Module
        │   ├── Lesson
        │   ├── Lesson
        │   └── Module Quiz
        │
        ├── Module
        │   ├── Lesson
        │   └── Module Quiz
        │
        └── Final Assessment

There are no lesson-level quizzes.

8. Learner Learning Flow

flowchart TD

    LOGIN[Login]
    DISCOVER[Discover Published Course]
    START[Start Course]
    LESSON[Open Lesson]
    CONTENT[Watch Video or Read Material]
    COMPLETE[Complete Lesson]
    CHECK{Module Complete}
    QUIZ[Module Quiz]
    PASS{Quiz Passed}
    MODULE[Module Completed]
    RELEARN[Relearning]
    MORE{More Modules}
    FINAL[Final Assessment]
    FINALPASS{Final Passed}
    COURSECOMPLETE[Course Completed]
    CERTIFICATE[Certificate]

    LOGIN --> DISCOVER
    DISCOVER --> START
    START --> LESSON
    LESSON --> CONTENT
    CONTENT --> COMPLETE
    COMPLETE --> CHECK

    CHECK -->|No| LESSON
    CHECK -->|Yes| QUIZ

    QUIZ --> PASS
    PASS -->|Yes| MODULE
    PASS -->|No| RELEARN

    RELEARN --> LESSON
    MODULE --> MORE

    MORE -->|Yes| LESSON
    MORE -->|No| FINAL

    FINAL --> FINALPASS
    FINALPASS -->|No| FINAL
    FINALPASS -->|Yes| COURSECOMPLETE

    COURSECOMPLETE --> CERTIFICATE

9. Assessment Architecture

flowchart TD

    LESSONS[Complete Module Lessons]
    QUIZ[Module Quiz]
    ATTEMPT1[Attempt 1]
    RESULT1{Passed}
    ATTEMPT2[Attempt 2]
    RESULT2{Passed}
    COMPLETE[Module Completed]
    RELEARN[Module Relearning]

    LESSONS --> QUIZ
    QUIZ --> ATTEMPT1
    ATTEMPT1 --> RESULT1

    RESULT1 -->|Yes| COMPLETE
    RESULT1 -->|No| ATTEMPT2

    ATTEMPT2 --> RESULT2
    RESULT2 -->|Yes| COMPLETE
    RESULT2 -->|No| RELEARN

    RELEARN --> LESSONS

Module Quiz Rule

Each module quiz allows a maximum of two attempts per completion cycle.

If both attempts fail:

The affected module returns to relearning.

The learner revisits that module.

Other completed modules are not reset.

The backend controls the attempt count and state transition.

10. AI Quiz Generation Architecture

The AI workflow is one of the core features of DataCaliper.

flowchart TD

    INSTRUCTOR[Instructor]
    LESSON[Selected Lesson]
    SOURCE[Lesson Source]
    EXTRACT[Extract Text]
    PROMPT[Build AI Prompt]
    NVIDIA[NVIDIA AI API]
    MODEL[Llama Instruct Model]
    JSON[Structured Quiz Output]
    VALIDATE[Validate Output]
    SAVE[Save Questions and Options]
    DRAFT[Quiz Draft]
    REVIEW[Instructor Review]
    EDIT[Edit Questions]
    APPROVE[Approve]
    PUBLISH[Publish Quiz]
    LEARNER[Learner]

    INSTRUCTOR --> LESSON
    LESSON --> SOURCE
    SOURCE --> EXTRACT
    EXTRACT --> PROMPT

    PROMPT --> NVIDIA
    NVIDIA --> MODEL
    MODEL --> JSON

    JSON --> VALIDATE

    VALIDATE -->|Valid| SAVE
    VALIDATE -->|Invalid| PROMPT

    SAVE --> DRAFT
    DRAFT --> REVIEW
    REVIEW --> EDIT
    EDIT --> REVIEW

    REVIEW --> APPROVE
    APPROVE --> PUBLISH
    PUBLISH --> LEARNER

AI lifecycle

Lesson Content
      |
      v
Content Extraction
      |
      v
Prompt Construction
      |
      v
NVIDIA AI
      |
      v
Structured JSON
      |
      v
Schema Validation
      |
      v
Database
      |
      v
PENDING_REVIEW
      |
      v
Instructor Review
      |
      v
Approval
      |
      v
Published Quiz

AI reliability principles

AI credentials are backend-only.

AI output is untrusted input.

Structured output is validated before persistence.

Questions and options are stored relationally.

Generated quizzes remain drafts until instructor approval.

AI is grounded in available lesson text/materials.

A video is not treated as AI-readable unless usable transcript/text content exists.

AI generation does not directly publish content.

11. Lesson Content Delivery

flowchart LR

    INSTRUCTOR[Instructor]
    UPLOAD[Upload Content]
    API[FastAPI]
    VIDEO[Video Storage]
    MATERIAL[Material Storage]
    DB[(Lesson Metadata)]
    LEARNER[Learner]
    WORKSPACE[Lesson Workspace]
    PLAYER[Video Player]
    PDF[PDF Viewer]

    INSTRUCTOR --> UPLOAD
    UPLOAD --> API

    API --> VIDEO
    API --> MATERIAL
    API --> DB

    LEARNER --> WORKSPACE
    DB --> WORKSPACE

    VIDEO --> PLAYER
    MATERIAL --> PDF

    WORKSPACE --> PLAYER
    WORKSPACE --> PDF

Recommended private storage buckets:

lesson-videos
lesson-materials

The database stores lesson metadata and storage references; the actual video and document files are stored in Supabase Storage.

12. Certificate Architecture

flowchart TD

    MODULES[All Modules Completed]
    FINAL[Final Assessment]
    RESULT{Passed}
    COMPLETE[Course Completed]
    SERVICE[Certificate Service]
    DB[(Certificates)]
    ID[Certificate Number]
    VIEW[Certificate View]
    PRINT[Print or Save PDF]
    VERIFY[Public Verification]
    DETAILS[Verified Certificate Details]

    MODULES --> FINAL
    FINAL --> RESULT

    RESULT -->|No| FINAL
    RESULT -->|Yes| COMPLETE

    COMPLETE --> SERVICE
    SERVICE --> DB
    DB --> ID

    ID --> VIEW
    VIEW --> PRINT

    ID --> VERIFY
    VERIFY --> DETAILS

Certificate integrity

The certificate number maps to one authoritative certificate record.

That record contains the information used by both:

Certificate view

Verification page

Therefore:

Certificate Number
        |
        v
Certificate Record
        |
        +---- Learner Name
        +---- Course Name
        +---- Completion Date
        +---- Status
        |
        +---- Certificate View
        |
        +---- Public Verification

This avoids mismatches between the certificate and its verification result.

13. Database Architecture

The following is the conceptual relational model:

erDiagram

    USERS ||--o{ COURSES : authors
    DOMAINS ||--o{ SUBDOMAINS : contains
    SUBDOMAINS ||--o{ COURSES : contains

    COURSES ||--o{ MODULES : contains
    MODULES ||--o{ LESSONS : contains

    USERS ||--o{ LESSON_PROGRESS : tracks
    LESSONS ||--o{ LESSON_PROGRESS : has

    MODULES ||--o{ QUIZZES : has
    COURSES ||--o{ QUIZZES : has

    QUIZZES ||--o{ QUESTIONS : contains
    QUESTIONS ||--o{ QUESTION_OPTIONS : contains

    USERS ||--o{ QUIZ_ATTEMPTS : makes
    QUIZZES ||--o{ QUIZ_ATTEMPTS : receives

    USERS ||--o{ MODULE_PROGRESS : tracks
    MODULES ||--o{ MODULE_PROGRESS : has

    USERS ||--o{ COURSE_PROGRESS : tracks
    COURSES ||--o{ COURSE_PROGRESS : has

    USERS ||--o{ CERTIFICATES : earns
    COURSES ||--o{ CERTIFICATES : awards

Main entities

Entity

Purpose

Users

Identity, role, ownership

Domains

Top-level curriculum grouping

Subdomains

Domain subdivisions

Courses

Main learning product

Modules

Course sections

Lessons

Individual learning units

Lesson Progress

Learner lesson completion

Module Progress

Learner module state

Course Progress

Overall course state

Quizzes

Module/final assessments

Questions

Assessment questions

Question Options

Answer choices

Quiz Attempts

Learner assessment attempts

Certificates

Issued completion credentials

The ER diagram is conceptual. The repository migrations and SQLAlchemy models are the source of truth for exact implementation details.

14. API Architecture

flowchart TB

    CLIENT[React Client]
    API[FastAPI REST API]
    AUTH[Auth and RBAC]

    COURSE[Course APIs]
    LESSON[Lesson APIs]
    PROGRESS[Progress APIs]
    ASSESSMENT[Assessment APIs]
    AI[AI APIs]
    CERT[Certificate APIs]
    STORAGE[Storage APIs]
    ADMIN[Admin APIs]

    SERVICE[Application Services]

    DB[(PostgreSQL)]
    FILES[Supabase Storage]
    NVIDIA[NVIDIA AI]

    CLIENT --> API
    API --> AUTH

    API --> COURSE
    API --> LESSON
    API --> PROGRESS
    API --> ASSESSMENT
    API --> AI
    API --> CERT
    API --> STORAGE
    API --> ADMIN

    COURSE --> SERVICE
    LESSON --> SERVICE
    PROGRESS --> SERVICE
    ASSESSMENT --> SERVICE
    AI --> SERVICE
    CERT --> SERVICE
    STORAGE --> SERVICE
    ADMIN --> SERVICE

    SERVICE --> DB
    SERVICE --> FILES
    SERVICE --> NVIDIA

15. Request Lifecycle

sequenceDiagram

    participant Browser
    participant API
    participant Auth
    participant Service
    participant DB
    participant External

    Browser->>API: HTTP Request
    API->>Auth: Authenticate
    Auth-->>API: Identity and Role

    API->>Service: Execute Business Operation
    Service->>DB: Read or Write

    DB-->>Service: Data

    Service->>External: Optional External Call
    External-->>Service: External Result

    Service-->>API: Result
    API-->>Browser: HTTP Response

16. Error Handling

flowchart TD

    REQUEST[Incoming Request]
    AUTH[Authenticate]
    AUTHOK{Authenticated}
    RBAC[Authorize]
    RBACOK{Authorized}
    VALIDATE[Validate Request]
    VALIDOK{Valid}
    SERVICE[Business Logic]
    SUCCESS[Success Response]
    ERROR[Error Response]

    REQUEST --> AUTH
    AUTH --> AUTHOK

    AUTHOK -->|No| ERROR
    AUTHOK -->|Yes| RBAC

    RBAC --> RBACOK
    RBACOK -->|No| ERROR
    RBACOK -->|Yes| VALIDATE

    VALIDATE --> VALIDOK
    VALIDOK -->|No| ERROR
    VALIDOK -->|Yes| SERVICE

    SERVICE --> SUCCESS

For long-running AI operations, the frontend should explicitly handle:

loading

success

validation failure

network failure

timeout

backend-created result after client timeout

recovery without blind duplicate generation

17. Frontend Architecture

flowchart TD

    APP[React Application]
    ROUTER[Application Router]
    AUTHSTATE[Authentication State]
    SERVICES[API Service Layer]
    COMPONENTS[Reusable Components]

    LEARNER[Learner Features]
    INSTRUCTOR[Instructor Features]
    ADMIN[Admin Features]

    APP --> ROUTER
    APP --> AUTHSTATE
    APP --> SERVICES
    APP --> COMPONENTS

    ROUTER --> LEARNER
    ROUTER --> INSTRUCTOR
    ROUTER --> ADMIN

    LEARNER --> SERVICES
    INSTRUCTOR --> SERVICES
    ADMIN --> SERVICES

    SERVICES --> API[FastAPI API]

Frontend responsibilities

UI rendering

Routing

Forms

API communication

Client-side state

User feedback

Role-specific presentation

Backend responsibilities

Authentication

Authorization

Business rules

Progress calculation

Assessment attempts

Completion eligibility

Certificate issuance

Persistent state

18. Role-Based Workflows

Learner

flowchart LR

    LOGIN[Login]
    DISCOVER[Browse Courses]
    LEARN[Learn Lessons]
    QUIZ[Module Quiz]
    MODULE[Complete Module]
    FINAL[Final Assessment]
    CERT[Certificate]

    LOGIN --> DISCOVER
    DISCOVER --> LEARN
    LEARN --> QUIZ
    QUIZ --> MODULE
    MODULE --> LEARN
    MODULE --> FINAL
    FINAL --> CERT

Instructor

flowchart LR

    LOGIN[Login]
    COURSE[Create Course]
    STRUCTURE[Create Modules and Lessons]
    CONTENT[Upload Content]
    AI[Generate AI Quiz]
    REVIEW[Review and Edit]
    APPROVE[Approve]
    PUBLISH[Publish]

    LOGIN --> COURSE
    COURSE --> STRUCTURE
    STRUCTURE --> CONTENT
    CONTENT --> AI
    AI --> REVIEW
    REVIEW --> APPROVE
    APPROVE --> PUBLISH

Admin

flowchart LR

    LOGIN[Login]
    USERS[Manage Users]
    GOVERN[Platform Governance]

    LOGIN --> USERS
    LOGIN --> GOVERN

19. Technology Stack

Category

Technology

Frontend

React

Language

TypeScript / JavaScript

Build Tool

Vite

Backend

Python

API Framework

FastAPI

ASGI Server

Uvicorn

ORM

SQLAlchemy

Validation

Pydantic

Database

Supabase PostgreSQL

Authentication

Supabase Auth

Object Storage

Supabase Storage

AI Provider

NVIDIA AI API

AI Model

Configurable NVIDIA-hosted instruct model

API Style

REST

Version Control

Git / GitHub

20. Security Architecture

flowchart TD

    BROWSER[Browser]
    AUTH[Authentication]
    RBAC[Role Authorization]
    OWNERSHIP[Resource Ownership]
    VALIDATION[Input Validation]
    BUSINESS[Business Rules]
    DB[(Database)]
    STORAGE[Private Storage]
    SECRETS[Backend Secrets]

    BROWSER --> AUTH
    AUTH --> RBAC
    RBAC --> OWNERSHIP
    OWNERSHIP --> VALIDATION
    VALIDATION --> BUSINESS

    BUSINESS --> DB
    BUSINESS --> STORAGE
    BUSINESS --> SECRETS

Security principles

Authentication through Supabase Auth

Backend-enforced RBAC

Resource ownership checks

Input validation

Backend-only AI credentials

No service-role secrets in frontend code

Controlled storage access

Server-side assessment attempt enforcement

Persistent certificate verification

21. Configuration

Backend environment variables:

NVIDIA_API_KEY=your_server_side_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-8b-instruct

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_server_side_key

Frontend-safe configuration:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_key

Never commit real credentials.

22. Project Structure

DataCaliper/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── core/
│   │   └── main.py
│   │
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── ...
│   │
│   ├── package.json
│   └── vite.config.*
│
├── supabase/
│   └── migrations/
│
├── .env.example
├── README.md
└── ...

23. Testing Strategy

Backend

cd backend
python -m pytest

Frontend

cd frontend
npm run build

Critical workflows

Authentication

Login

Protected routes

Role authorization

Course

Course creation

Module creation

Lesson creation

Publish / unpublish

Learning

Video playback

PDF/material viewing

Lesson completion

Progress persistence

Assessment

Module quiz visibility

Two-attempt rule

Relearning state

Final assessment eligibility

AI

AI request

Structured response

Validation

Draft persistence

Instructor review

Approval

Publishing

Certificate

Successful final assessment

Certificate generation

Correct learner name

Correct course

Stable certificate number

Public verification

Invalid certificate rejection

24. End-to-End System Flow

flowchart TD

    ADMIN[Admin]
    INSTRUCTOR[Instructor]
    LEARNER[Learner]

    PLATFORM[DataCaliper]

    COURSE[Course]
    CONTENT[Lessons and Materials]
    AI[AI Quiz Draft]
    REVIEW[Instructor Review]
    QUIZ[Published Module Quiz]
    FINAL[Final Assessment]
    CERT[Certificate]
    VERIFY[Certificate Verification]

    ADMIN --> PLATFORM

    INSTRUCTOR --> PLATFORM
    PLATFORM --> COURSE
    COURSE --> CONTENT
    CONTENT --> AI
    AI --> REVIEW
    REVIEW --> QUIZ

    QUIZ --> LEARNER
    LEARNER --> CONTENT
    LEARNER --> QUIZ
    LEARNER --> FINAL
    FINAL --> CERT
    CERT --> VERIFY

25. Complete Architecture

flowchart TB

    USER[Users]

    FRONTEND[React Frontend]
    API[FastAPI API]
    AUTH[Supabase Auth]
    RBAC[RBAC]

    COURSE[Course Management]
    LEARNING[Learning and Progress]
    ASSESSMENT[Assessment]
    AI[AI Generation]
    CERT[Certificates]
    STORAGE[Storage]

    DB[(Supabase PostgreSQL)]
    FILES[Supabase Storage]
    NVIDIA[NVIDIA AI]

    USER --> FRONTEND
    FRONTEND --> API

    API --> AUTH
    API --> RBAC

    RBAC --> COURSE
    RBAC --> LEARNING
    RBAC --> ASSESSMENT
    RBAC --> CERT

    COURSE --> DB
    LEARNING --> DB
    ASSESSMENT --> DB
    CERT --> DB

    COURSE --> STORAGE
    LEARNING --> STORAGE

    STORAGE --> FILES

    ASSESSMENT --> AI
    AI --> NVIDIA
    AI --> DB

26. Core Design Principles

Backend authoritative

The backend is the source of truth for security, progress, attempts, completion, and certificates.

Instructor-controlled AI

AI assists instructors rather than automatically publishing learner-facing content.

Relational data

Core entities are stored as structured database records instead of relying on frontend-only state or opaque JSON blobs.

Traceable certificates

A certificate number resolves to one authoritative certificate record.

Separation of concerns

Frontend, API, authorization, services, database, storage, and AI integrations have separate responsibilities.

Secure credentials

Private credentials remain on the backend.

Explicit learning lifecycle

Discover
   ↓
Learn
   ↓
Complete Lessons
   ↓
Pass Module Assessments
   ↓
Complete All Modules
   ↓
Pass Final Assessment
   ↓
Course Completion
   ↓
Certificate
   ↓
Verification

27. Final Architecture Summary

DataCaliper follows a layered full-stack architecture:

                        ┌──────────────────────┐
                        │        USERS         │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   REACT FRONTEND     │
                        │  Learner / Instructor │
                        │       / Admin        │
                        └──────────┬───────────┘
                                   │ REST
                                   ▼
                        ┌──────────────────────┐
                        │    FASTAPI BACKEND   │
                        │                      │
                        │ Auth + RBAC           │
                        │ Course Services       │
                        │ Learning Services     │
                        │ Assessment Services   │
                        │ AI Services           │
                        │ Certificate Services │
                        └───────┬───────┬──────┘
                                │       │
                    ┌───────────┘       └─────────────┐
                    ▼                                 ▼
          ┌──────────────────┐              ┌──────────────────┐
          │ SUPABASE         │              │   NVIDIA AI      │
          │                  │              │                  │
          │ PostgreSQL       │              │ Llama Instruct   │
          │ Auth             │              │ Model            │
          │ Storage          │              └──────────────────┘
          └──────────────────┘

In one sentence

DataCaliper is a React + FastAPI + Supabase training platform with backend-enforced RBAC, structured course and progress management, instructor-controlled NVIDIA AI assessment generation, server-authoritative assessment rules, and persistent verifiable certificates.

