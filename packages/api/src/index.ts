import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/error-handler';
import {
  correlationId,
  generalRateLimiter,
  securityHeaders,
  securityLogger,
} from './middleware/security';
import { authRouter } from './routes/auth';
import { recordsRouter } from './routes/records';
import { usersRouter } from './routes/users';
import { healthRouter } from './routes/health';
import { superadminRouter } from './routes/superadmin';
import { reviewsRouter } from './routes/reviews';
import { methodConfigRouter } from './routes/method-config';
import { exportRouter } from './routes/export';
import { auditRouter } from './routes/audit';
import { pdfRouter } from './routes/pdf';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP detection behind load balancer
app.set('trust proxy', 1);

// Correlation ID for request tracing (must be first)
app.use(correlationId);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));
app.use(securityHeaders);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Dev-User-Type', 'X-Dev-Cognito-Id'],
}));

// Rate limiting (apply to all routes)
app.use(generalRateLimiter);

// Request parsing
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logging
app.use(morgan('combined'));
app.use(securityLogger);

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/records', recordsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/superadmin', superadminRouter);
app.use('/api/method-config', methodConfigRouter);
app.use('/api/export', exportRouter);
app.use('/api/audit', auditRouter);
app.use('/api/pdf', pdfRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

export default app;
