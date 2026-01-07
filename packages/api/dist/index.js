"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const error_handler_1 = require("./middleware/error-handler");
const security_1 = require("./middleware/security");
const auth_1 = require("./routes/auth");
const records_1 = require("./routes/records");
const users_1 = require("./routes/users");
const health_1 = require("./routes/health");
const superadmin_1 = require("./routes/superadmin");
const reviews_1 = require("./routes/reviews");
const method_config_1 = require("./routes/method-config");
const export_1 = require("./routes/export");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Trust proxy for accurate IP detection behind load balancer
app.set('trust proxy', 1);
// Correlation ID for request tracing (must be first)
app.use(security_1.correlationId);
// Security middleware
app.use((0, helmet_1.default)({
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
app.use(security_1.securityHeaders);
// CORS
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Dev-User-Type', 'X-Dev-Cognito-Id'],
}));
// Rate limiting (apply to all routes)
app.use(security_1.generalRateLimiter);
// Request parsing
app.use(express_1.default.json({ limit: '10kb' })); // Limit body size
app.use(express_1.default.urlencoded({ extended: true, limit: '10kb' }));
// Logging
app.use((0, morgan_1.default)('combined'));
app.use(security_1.securityLogger);
// Routes
app.use('/health', health_1.healthRouter);
app.use('/api/auth', auth_1.authRouter);
app.use('/api/records', records_1.recordsRouter);
app.use('/api/users', users_1.usersRouter);
app.use('/api/reviews', reviews_1.reviewsRouter);
app.use('/api/superadmin', superadmin_1.superadminRouter);
app.use('/api/method-config', method_config_1.methodConfigRouter);
app.use('/api/export', export_1.exportRouter);
// Error handling
app.use(error_handler_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});
exports.default = app;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzREFBOEI7QUFDOUIsZ0RBQXdCO0FBQ3hCLG9EQUE0QjtBQUM1QixvREFBNEI7QUFDNUIsOERBQTBEO0FBQzFELG9EQUsrQjtBQUMvQix3Q0FBMkM7QUFDM0MsOENBQWlEO0FBQ2pELDBDQUE2QztBQUM3Qyw0Q0FBK0M7QUFDL0Msb0RBQXVEO0FBQ3ZELDhDQUFpRDtBQUNqRCwwREFBNEQ7QUFDNUQsNENBQStDO0FBRS9DLE1BQU0sR0FBRyxHQUFHLElBQUEsaUJBQU8sR0FBRSxDQUFDO0FBQ3RCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztBQUV0Qyw2REFBNkQ7QUFDN0QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFMUIscURBQXFEO0FBQ3JELEdBQUcsQ0FBQyxHQUFHLENBQUMsd0JBQWEsQ0FBQyxDQUFDO0FBRXZCLHNCQUFzQjtBQUN0QixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUEsZ0JBQU0sRUFBQztJQUNiLHFCQUFxQixFQUFFO1FBQ3JCLFVBQVUsRUFBRTtZQUNWLFVBQVUsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUN0QixTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUM7WUFDckIsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFLGlCQUFpQixDQUFDO1lBQ3ZDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDO1lBQ3JDLFVBQVUsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUN0QixPQUFPLEVBQUUsQ0FBQyxRQUFRLENBQUM7WUFDbkIsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDO1lBQ3JCLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUNwQixRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDckI7S0FDRjtJQUNELElBQUksRUFBRTtRQUNKLE1BQU0sRUFBRSxRQUFRLEVBQUUsU0FBUztRQUMzQixpQkFBaUIsRUFBRSxJQUFJO1FBQ3ZCLE9BQU8sRUFBRSxJQUFJO0tBQ2Q7Q0FDRixDQUFDLENBQUMsQ0FBQztBQUNKLEdBQUcsQ0FBQyxHQUFHLENBQUMsMEJBQWUsQ0FBQyxDQUFDO0FBRXpCLE9BQU87QUFDUCxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUEsY0FBSSxFQUFDO0lBQ1gsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLHVCQUF1QjtJQUMxRCxXQUFXLEVBQUUsSUFBSTtJQUNqQixPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQztJQUM3RCxjQUFjLEVBQUUsQ0FBQyxjQUFjLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDO0NBQzdHLENBQUMsQ0FBQyxDQUFDO0FBRUosc0NBQXNDO0FBQ3RDLEdBQUcsQ0FBQyxHQUFHLENBQUMsNkJBQWtCLENBQUMsQ0FBQztBQUU1QixrQkFBa0I7QUFDbEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxpQkFBTyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0I7QUFDNUQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxpQkFBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUUvRCxVQUFVO0FBQ1YsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFBLGdCQUFNLEVBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUM1QixHQUFHLENBQUMsR0FBRyxDQUFDLHlCQUFjLENBQUMsQ0FBQztBQUV4QixTQUFTO0FBQ1QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUscUJBQVksQ0FBQyxDQUFDO0FBQ2pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLGlCQUFVLENBQUMsQ0FBQztBQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSx1QkFBYSxDQUFDLENBQUM7QUFDdkMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsbUJBQVcsQ0FBQyxDQUFDO0FBQ25DLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLHVCQUFhLENBQUMsQ0FBQztBQUN2QyxHQUFHLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLDZCQUFnQixDQUFDLENBQUM7QUFDN0MsR0FBRyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxrQ0FBa0IsQ0FBQyxDQUFDO0FBQ2xELEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLHFCQUFZLENBQUMsQ0FBQztBQUVyQyxpQkFBaUI7QUFDakIsR0FBRyxDQUFDLEdBQUcsQ0FBQyw0QkFBWSxDQUFDLENBQUM7QUFFdEIsZUFBZTtBQUNmLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtJQUNwQixPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLGFBQWEsRUFBRSxDQUFDLENBQUM7SUFDckUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksdUJBQXVCLEVBQUUsQ0FBQyxDQUFDO0FBQ3BGLENBQUMsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsR0FBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgY29ycyBmcm9tICdjb3JzJztcbmltcG9ydCBoZWxtZXQgZnJvbSAnaGVsbWV0JztcbmltcG9ydCBtb3JnYW4gZnJvbSAnbW9yZ2FuJztcbmltcG9ydCB7IGVycm9ySGFuZGxlciB9IGZyb20gJy4vbWlkZGxld2FyZS9lcnJvci1oYW5kbGVyJztcbmltcG9ydCB7XG4gIGNvcnJlbGF0aW9uSWQsXG4gIGdlbmVyYWxSYXRlTGltaXRlcixcbiAgc2VjdXJpdHlIZWFkZXJzLFxuICBzZWN1cml0eUxvZ2dlcixcbn0gZnJvbSAnLi9taWRkbGV3YXJlL3NlY3VyaXR5JztcbmltcG9ydCB7IGF1dGhSb3V0ZXIgfSBmcm9tICcuL3JvdXRlcy9hdXRoJztcbmltcG9ydCB7IHJlY29yZHNSb3V0ZXIgfSBmcm9tICcuL3JvdXRlcy9yZWNvcmRzJztcbmltcG9ydCB7IHVzZXJzUm91dGVyIH0gZnJvbSAnLi9yb3V0ZXMvdXNlcnMnO1xuaW1wb3J0IHsgaGVhbHRoUm91dGVyIH0gZnJvbSAnLi9yb3V0ZXMvaGVhbHRoJztcbmltcG9ydCB7IHN1cGVyYWRtaW5Sb3V0ZXIgfSBmcm9tICcuL3JvdXRlcy9zdXBlcmFkbWluJztcbmltcG9ydCB7IHJldmlld3NSb3V0ZXIgfSBmcm9tICcuL3JvdXRlcy9yZXZpZXdzJztcbmltcG9ydCB7IG1ldGhvZENvbmZpZ1JvdXRlciB9IGZyb20gJy4vcm91dGVzL21ldGhvZC1jb25maWcnO1xuaW1wb3J0IHsgZXhwb3J0Um91dGVyIH0gZnJvbSAnLi9yb3V0ZXMvZXhwb3J0JztcblxuY29uc3QgYXBwID0gZXhwcmVzcygpO1xuY29uc3QgUE9SVCA9IHByb2Nlc3MuZW52LlBPUlQgfHwgMzAwMTtcblxuLy8gVHJ1c3QgcHJveHkgZm9yIGFjY3VyYXRlIElQIGRldGVjdGlvbiBiZWhpbmQgbG9hZCBiYWxhbmNlclxuYXBwLnNldCgndHJ1c3QgcHJveHknLCAxKTtcblxuLy8gQ29ycmVsYXRpb24gSUQgZm9yIHJlcXVlc3QgdHJhY2luZyAobXVzdCBiZSBmaXJzdClcbmFwcC51c2UoY29ycmVsYXRpb25JZCk7XG5cbi8vIFNlY3VyaXR5IG1pZGRsZXdhcmVcbmFwcC51c2UoaGVsbWV0KHtcbiAgY29udGVudFNlY3VyaXR5UG9saWN5OiB7XG4gICAgZGlyZWN0aXZlczoge1xuICAgICAgZGVmYXVsdFNyYzogW1wiJ3NlbGYnXCJdLFxuICAgICAgc2NyaXB0U3JjOiBbXCInc2VsZidcIl0sXG4gICAgICBzdHlsZVNyYzogW1wiJ3NlbGYnXCIsIFwiJ3Vuc2FmZS1pbmxpbmUnXCJdLFxuICAgICAgaW1nU3JjOiBbXCInc2VsZidcIiwgJ2RhdGE6JywgJ2h0dHBzOiddLFxuICAgICAgY29ubmVjdFNyYzogW1wiJ3NlbGYnXCJdLFxuICAgICAgZm9udFNyYzogW1wiJ3NlbGYnXCJdLFxuICAgICAgb2JqZWN0U3JjOiBbXCInbm9uZSdcIl0sXG4gICAgICBtZWRpYVNyYzogW1wiJ3NlbGYnXCJdLFxuICAgICAgZnJhbWVTcmM6IFtcIidub25lJ1wiXSxcbiAgICB9LFxuICB9LFxuICBoc3RzOiB7XG4gICAgbWF4QWdlOiAzMTUzNjAwMCwgLy8gMSB5ZWFyXG4gICAgaW5jbHVkZVN1YkRvbWFpbnM6IHRydWUsXG4gICAgcHJlbG9hZDogdHJ1ZSxcbiAgfSxcbn0pKTtcbmFwcC51c2Uoc2VjdXJpdHlIZWFkZXJzKTtcblxuLy8gQ09SU1xuYXBwLnVzZShjb3JzKHtcbiAgb3JpZ2luOiBwcm9jZXNzLmVudi5DT1JTX09SSUdJTiB8fCAnaHR0cDovL2xvY2FsaG9zdDo1MTczJyxcbiAgY3JlZGVudGlhbHM6IHRydWUsXG4gIG1ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ1BBVENIJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gIGFsbG93ZWRIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJywgJ1gtQ29ycmVsYXRpb24tSUQnLCAnWC1EZXYtVXNlci1UeXBlJywgJ1gtRGV2LUNvZ25pdG8tSWQnXSxcbn0pKTtcblxuLy8gUmF0ZSBsaW1pdGluZyAoYXBwbHkgdG8gYWxsIHJvdXRlcylcbmFwcC51c2UoZ2VuZXJhbFJhdGVMaW1pdGVyKTtcblxuLy8gUmVxdWVzdCBwYXJzaW5nXG5hcHAudXNlKGV4cHJlc3MuanNvbih7IGxpbWl0OiAnMTBrYicgfSkpOyAvLyBMaW1pdCBib2R5IHNpemVcbmFwcC51c2UoZXhwcmVzcy51cmxlbmNvZGVkKHsgZXh0ZW5kZWQ6IHRydWUsIGxpbWl0OiAnMTBrYicgfSkpO1xuXG4vLyBMb2dnaW5nXG5hcHAudXNlKG1vcmdhbignY29tYmluZWQnKSk7XG5hcHAudXNlKHNlY3VyaXR5TG9nZ2VyKTtcblxuLy8gUm91dGVzXG5hcHAudXNlKCcvaGVhbHRoJywgaGVhbHRoUm91dGVyKTtcbmFwcC51c2UoJy9hcGkvYXV0aCcsIGF1dGhSb3V0ZXIpO1xuYXBwLnVzZSgnL2FwaS9yZWNvcmRzJywgcmVjb3Jkc1JvdXRlcik7XG5hcHAudXNlKCcvYXBpL3VzZXJzJywgdXNlcnNSb3V0ZXIpO1xuYXBwLnVzZSgnL2FwaS9yZXZpZXdzJywgcmV2aWV3c1JvdXRlcik7XG5hcHAudXNlKCcvYXBpL3N1cGVyYWRtaW4nLCBzdXBlcmFkbWluUm91dGVyKTtcbmFwcC51c2UoJy9hcGkvbWV0aG9kLWNvbmZpZycsIG1ldGhvZENvbmZpZ1JvdXRlcik7XG5hcHAudXNlKCcvYXBpL2V4cG9ydCcsIGV4cG9ydFJvdXRlcik7XG5cbi8vIEVycm9yIGhhbmRsaW5nXG5hcHAudXNlKGVycm9ySGFuZGxlcik7XG5cbi8vIFN0YXJ0IHNlcnZlclxuYXBwLmxpc3RlbihQT1JULCAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKGBBUEkgc2VydmVyIHJ1bm5pbmcgb24gcG9ydCAke1BPUlR9YCk7XG4gIGNvbnNvbGUubG9nKGBFbnZpcm9ubWVudDogJHtwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAnZGV2ZWxvcG1lbnQnfWApO1xuICBjb25zb2xlLmxvZyhgQ09SUyBvcmlnaW46ICR7cHJvY2Vzcy5lbnYuQ09SU19PUklHSU4gfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE3Myd9YCk7XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgYXBwO1xuIl19