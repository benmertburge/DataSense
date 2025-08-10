# replit.md

## Overview

TransitPro is a smart transit management application built with a modern full-stack architecture. The app allows users to plan journeys, receive real-time delay alerts, and automatically claim compensation when transportation delays occur. It features real-time WebSocket connections for live updates, a sophisticated delay detection system, and automated compensation claim generation with PDF outputs.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite for fast development and optimized builds
- **UI Framework**: Tailwind CSS with shadcn/ui component library for consistent, accessible design
- **State Management**: TanStack Query for server state management with intelligent caching and background refetching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Real-time Communication**: WebSocket client for live transit updates and notifications

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **API Design**: RESTful endpoints with real-time WebSocket server for push notifications
- **Session Management**: Express sessions with PostgreSQL storage for reliable user state
- **File Generation**: PDFKit for compensation claim document generation
- **Error Handling**: Centralized error middleware with structured logging

### Database Layer
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database queries and migrations
- **Schema Design**: Normalized tables for users, transit data (stops, lines, journeys), compensation cases, and service deviations
- **Connection Management**: Connection pooling with automatic reconnection handling

### Authentication System
- **Provider**: Replit's OpenID Connect authentication
- **Session Storage**: PostgreSQL-backed sessions with automatic cleanup
- **Authorization**: Route-level protection with middleware-based access control
- **User Management**: Automatic user provisioning on first login with profile synchronization

### Real-time Features
- **WebSocket Server**: Per-user connections for personalized notifications
- **Event Types**: Journey updates, delay alerts, compensation eligibility notifications
- **Connection Management**: Automatic reconnection with exponential backoff
- **Message Broadcasting**: Targeted messaging based on user context

### Compensation System
- **Delay Detection**: Automatic monitoring of journey delays against configurable thresholds
- **Eligibility Calculation**: Dynamic compensation amount calculation based on delay duration and ticket type
- **Claim Generation**: Automated PDF generation with encrypted personal data and journey evidence
- **Data Encryption**: AES-256-GCM encryption for sensitive personal information

### Transit Data Management
- **Data Structure**: SL (Stockholm Public Transport) compatible schema supporting multiple transit modes
- **Stop Hierarchy**: StopAreas (sites) and StopPoints (platforms/bays) for precise location handling
- **Journey Planning**: Coordinate-based route optimization using Haversine distance calculation for optimal hub selection
- **Smart Routing**: Algorithm automatically selects fastest hub (Odenplan vs Stockholm City) based on geographical positioning
- **Service Monitoring**: Real-time deviation tracking and passenger notifications

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database with automatic scaling
- **Authentication**: Replit OpenID Connect for secure user authentication
- **WebSocket**: Native Node.js WebSocket implementation for real-time features

### Transit Integration
- **SL Journey Planner 2 API**: Native Stockholm Public Transport routing with multi-strategy searches
- **Real-time Data**: Live SL transit data including delays and disruptions
- **Multi-route Strategy**: Attempts direct, via-Odenplan, and least-interchange routing options
- **Compensation Rules**: Swedish transport compensation regulations (förseningsersättning)

### UI and Design
- **Component Library**: Radix UI primitives with shadcn/ui styling
- **Icons**: Lucide React for consistent iconography
- **Fonts**: Google Fonts (Inter) for modern typography
- **Styling**: Tailwind CSS with CSS custom properties for theming

### Development Tools
- **Build System**: Vite with React plugin and runtime error overlay
- **Type Checking**: TypeScript with strict configuration
- **Code Quality**: ESLint and automatic formatting
- **Development**: Hot module replacement and error boundaries

### Production Services
- **File Storage**: Prepared for integration with cloud storage for compensation documents
- **Email Service**: Ready for email notification integration
- **Monitoring**: Structured logging with request/response tracking
- **Deployment**: Optimized build output with static asset serving