# Personalized Scheme Recommendation System

An AI-powered platform that provides citizens with personalized government scheme recommendations through conversational AI. The system uses ReAct (Reasoning + Acting) agents, MCP (Model Context Protocol) integration, and ML-based classification to match users with relevant government schemes from myscheme.gov.in.

## Architecture

This is a monorepo containing three main workspaces:

- **backend**: TypeScript-based API server, MCP Server, and ReAct Agent
- **ml-pipeline**: Python-based ML services for classification, clustering, and eligibility matching
- **frontend_new**: React 19 user interface (Tailwind v4, Vite 6)

## Technology Stack

- **Backend**: Node.js, TypeScript, Express, WebSocket
- **ML Pipeline**: Python, scikit-learn, PyTorch, Transformers
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4
- **Database**: Neo4j (graph database)
- **Cache**: Redis
- **Testing**: Jest, fast-check, Hypothesis, Playwright

## Prerequisites

- Node.js >= 18.0.0
- Python >= 3.10
- Neo4j >= 5.0
- Redis >= 7.0
- npm >= 9.0.0

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd personalized-scheme-recommendation-system
```

### 2. Install dependencies

```bash
# Install Node.js dependencies for all workspaces
npm install

# Set up Python virtual environment and install dependencies
cd ml-pipeline
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 3. Configure environment variables

```bash
# Use a single shared environment file at the repository root
cp .env.example .env  # If .env.example is unavailable, create .env manually

# Edit .env with your configuration. Backend and ML pipeline both load this file.
```

### 4. Set up databases

```bash
# Start Neo4j and Redis using Docker
docker-compose up -d

# Or install and start them locally
```

### 5. Run the development servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: ML Pipeline
cd ml-pipeline
source venv/bin/activate
python src/main.py

# Terminal 3: Frontend
cd frontend_new
npm run dev
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm test --workspace=backend
npm test --workspace=frontend_new

# Run Python tests
cd ml-pipeline
pytest
```

### Linting and Formatting

```bash
# Lint all workspaces
npm run lint

# Format all code
npm run format
```

### Building for Production

```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build --workspace=backend
```

## Project Structure

```
.
├── backend/                 # Backend API and MCP Server
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── api/            # REST API endpoints
│   │   ├── mcp/            # MCP Server implementation
│   │   ├── agent/          # ReAct Agent
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── package.json
│   └── tsconfig.json
│
├── ml-pipeline/            # ML services
│   ├── src/
│   │   ├── main.py         # Entry point
│   │   ├── classification/ # User classification
│   │   ├── eligibility/    # Eligibility engine
│   │   ├── intent/         # Intent classifier
│   │   └── recommendation/ # Recommendation engine
│   ├── requirements.txt
│   └── setup.py
│
├── frontend_new/            # React 19 frontend (Tailwind v4)
│   ├── src/
│   │   ├── main.tsx        # Entry point
│   │   ├── App.tsx         # Root component + navigation
│   │   ├── api.ts          # Backend API service layer
│   │   ├── AuthContext.tsx  # Auth context provider
│   │   └── components/     # React components
│   ├── package.json
│   └── vite.config.ts
│
└── package.json            # Root package.json
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

[License information]
