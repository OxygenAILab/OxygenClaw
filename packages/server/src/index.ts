import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDB } from './services/db';
import authRoutes from './routes/auth';
import llmRoutes from './routes/llm';
import agentRoutes from './routes/agent';
import marketplaceRoutes from './routes/marketplace';
import dashboardRoutes from './routes/dashboard';
import artifactsRoutes from './routes/artifacts';
import settingsRoutes from './routes/settings';
import multimodalRoutes from './routes/multimodal';
import mcpRoutes from './routes/mcp';
import proxyRoutes from './routes/proxy';
import cliRoutes from './routes/cli';
import conversationsRoutes from './routes/conversations';
import { runtimeWorkerManager } from './services/runtimeWorkerManager';
import { registerRuntimeAdapters } from './runtime/adapters';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const PACKAGE_VERSION = '26.0.0-alpha.1';
const DISPLAY_VERSION = 'v26.0 Alpha 1';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: PACKAGE_VERSION,
      displayVersion: DISPLAY_VERSION
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/artifacts', artifactsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/multimodal', multimodalRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/cli', cliRoutes);
app.use('/api/conversations', conversationsRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

async function startServer() {
  try {
    await initDB();
    registerRuntimeAdapters(runtimeWorkerManager);
    runtimeWorkerManager.start();
    app.listen(PORT, () => {
      console.log(`\n🚀 OxygenClaw Server running on http://localhost:${PORT}`);
      console.log(`📊 API base: http://localhost:${PORT}/api\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
