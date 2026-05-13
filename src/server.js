import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import api from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'zoho-dialer-backend' });
});

app.use('/api/v1', api);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number(err.status) || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message || 'Error';
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Listening on :${config.port} (${config.nodeEnv})`);
});
