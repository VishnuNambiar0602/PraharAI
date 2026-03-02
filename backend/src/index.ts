import dotenv from 'dotenv';
import app from './api/server';
import { schemeSyncAgent } from './agents/scheme-sync-agent';
import { initializeNeo4j } from './db/neo4j.config';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`👤 Users API: http://localhost:${PORT}/api/users`);
  
  // Initialize Neo4j
  console.log('\n🔌 Connecting to Neo4j...');
  try {
    const neo4jConnection = initializeNeo4j({
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password123',
      database: process.env.NEO4J_DATABASE || 'neo4j',
    });
    
    await neo4jConnection.connect();
    console.log('✅ Neo4j connected successfully\n');
  } catch (error) {
    console.error('❌ Failed to connect to Neo4j:', error);
    console.log('⚠️  Server will continue without Neo4j\n');
  }
  
  // Start scheme sync agent
  console.log('🤖 Starting Scheme Sync Agent...');
  try {
    await schemeSyncAgent.start();
    console.log('✅ Scheme Sync Agent started successfully\n');
  } catch (error) {
    console.error('❌ Failed to start Scheme Sync Agent:', error);
    console.log('⚠️  Server will continue without scheme sync\n');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  schemeSyncAgent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  schemeSyncAgent.stop();
  process.exit(0);
});
