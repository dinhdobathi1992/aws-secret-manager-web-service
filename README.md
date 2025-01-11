# AWS Secrets Manager Web Service

A web application for managing AWS Secrets Manager across multiple AWS accounts with Azure AD authentication.

## Running with Docker

### Prerequisites

- Docker installed
- Docker Compose installed
- Valid Azure AD configuration
- AWS credentials for your accounts

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update the `.env` file with your credentials:

- Azure AD settings
- AWS account configurations
- Flask settings

### Running the Application

1. Build and start the container:

```bash
docker-compose up --build
```

2. For running in background:

```bash
docker-compose up -d
```

3. View logs:

```bash
docker-compose logs -f
```

4. Stop the application:

```bash
docker-compose down
```

### Development with Docker

The application is configured for live reload during development:

- Source code changes will reflect immediately
- Environment variables can be modified in `.env`
- Logs are available in real-time

### Troubleshooting

1. If Azure AD login fails:

   - Verify AZURE_TENANT_ID is correctly set
   - Check AZURE_REDIRECT_URI matches Azure AD configuration
   - Ensure all Azure environment variables are passed to container

2. If AWS operations fail:

   - Verify AWS credentials in AWS_ACCOUNTS configuration
   - Check AWS region settings
   - Ensure proper IAM permissions

3. Common Docker issues:
   - Port 5001 already in use: Change port mapping in docker-compose.yml
   - Environment variables not loading: Check .env file location
   - Container not starting: Check docker-compose logs

## Local Development

For running without Docker, see the [Local Development Guide](docs/local-development.md).

## Features

### Current Features

#### Authentication & Authorization

- Azure AD Single Sign-On integration
- Role-based access control with Azure AD groups:
  - `secrets-readers`: Can view secrets
  - `secrets-writers`: Can create/edit secrets
- Secure session management
- Automatic redirection to login for unauthenticated users

#### AWS Secrets Management

- View all secrets in AWS Secrets Manager
- Create new secrets with predefined templates:
  - RDS Database credentials
  - DocumentDB credentials
  - Redshift credentials
  - Generic key-value pairs
- Edit existing secrets
- Copy secret values with one click
- Support for JSON-formatted secrets
- Multi-account AWS support with easy switching

#### User Interface

- Clean, modern interface with responsive design
- Intuitive navigation with logo and user info
- Modal-based interactions for creating/editing secrets
- JSON formatting and validation
- User-friendly notifications
- Dark mode JSON editor
- One-click copy functionality
- Footer with version and attribution

### Upcoming Features

- [ ] Secret versioning and history
- [ ] Secret rotation scheduling
- [ ] Advanced search and filtering
- [ ] Audit logging
- [ ] Batch operations (delete, move, copy)
- [ ] Tag management
- [ ] Custom secret templates
- [ ] API integration

## Environment Setup

### Prerequisites

- Python 3.8+
- Azure AD tenant with configured application
- AWS account(s) with Secrets Manager access
- Required Azure AD groups configured:
  - secrets-readers
  - secrets-writers

### Environment Variables

Create a `.env` file in the root directory with the following configuration:

```env
# Azure AD Configuration
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_REDIRECT_PATH=/auth/callback

# AWS Configuration
AWS_ACCOUNTS={
    "dev-1": {
        "name": "Development 1",
        "aws_access_key_id": "AKIA...",
        "aws_secret_access_key": "...",
        "aws_region": "ap-southeast-1",
        "description": "Development environment for Team 1"
    },
    "dev-2": {
        "name": "Development 2",
        "aws_access_key_id": "AKIA...",
        "aws_secret_access_key": "...",
        "aws_region": "ap-southeast-1",
        "description": "Development environment for Team 2"
    },
    "staging": {
        "name": "Staging",
        "aws_access_key_id": "AKIA...",
        "aws_secret_access_key": "...",
        "aws_region": "ap-southeast-1",
        "description": "Staging environment"
    },
    "prod-sg": {
        "name": "Production SG",
        "aws_access_key_id": "AKIA...",
        "aws_secret_access_key": "...",
        "aws_region": "ap-southeast-1",
        "description": "Production environment in Singapore"
    }
}

# Flask Configuration
FLASK_SECRET_KEY=generate_a_secure_secret_key
FLASK_ENV=development
```

### Configuration Details

#### Azure AD Settings

- `AZURE_CLIENT_ID`: Your Azure AD application client ID
- `AZURE_CLIENT_SECRET`: Your Azure AD application client secret
- `AZURE_TENANT_ID`: Your Azure AD tenant ID
- `AZURE_REDIRECT_PATH`: OAuth callback path (default: /auth/callback)

#### AWS Settings

- Multiple AWS accounts can be configured
- Each account requires:
  - `name`: Display name for the account
  - `aws_access_key_id`: AWS access key with Secrets Manager permissions
  - `aws_secret_access_key`: Corresponding AWS secret key
  - `aws_region`: AWS region where secrets are stored
  - `description`: Optional description of the account's purpose

> **Note**: New accounts added to the AWS_ACCOUNTS configuration will automatically appear in the UI's account selector without requiring application changes.

#### Flask Settings

- `FLASK_SECRET_KEY`: Secret key for session encryption
- `FLASK_ENV`: Application environment (development/production)

## Project Structure

```
app/
├── auth/                   # Authentication related code
│   ├── azure_ad.py         # Azure AD OAuth implementation
│   └── decorators.py       # Auth decorators for routes
│
├── aws/                    # AWS integration
│   └── secrets_manager.py  # AWS Secrets Manager operations
│
├── routes/                 # Application routes
│   └── secrets_routes.py   # Secret management endpoints
│
├── templates/              # HTML templates
│   ├── components/         # Reusable UI components
│   │   ├── footer.html     # Page footer
│   │   └── logo.html       # Site logo
│   │
│   ├── secrets/           # Secret management pages
│   │   ├── list.html      # Secrets list view
│   │   └── view.html      # Secret detail view
│   │
│   └── index.html         # Home page
│
└── static/                # Static assets
    ├── images/           # Image assets
    └── favicon.svg       # Site favicon
```

### Key Components

#### Authentication (`app/auth/`)

- `azure_ad.py`: Handles Azure AD OAuth flow and token validation
- `decorators.py`: Provides @login_required and @require_group decorators

#### AWS Integration (`app/aws/`)

- `secrets_manager.py`: Manages all AWS Secrets Manager operations

#### Routes (`app/routes/`)

- `secrets_routes.py`: Implements all secret management endpoints

#### Templates (`app/templates/`)

- Components: Reusable UI elements
- Secrets: Secret management interface
- Index: Main application page

#### Static Assets (`app/static/`)

- Images and favicon for the application
