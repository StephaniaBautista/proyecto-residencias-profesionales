import 'dotenv/config';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { leerEntorno } from './entorno';

async function main() {
  const entorno = leerEntorno();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: entorno.esProduccion ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
  });

  if (entorno.trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: entorno.esProduccion ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );
  app.use(cookieParser());
  app.use(json({ limit: '20kb' }));
  app.use(urlencoded({ extended: false, limit: '20kb' }));

  // Identificador de petición y bitácora básica de acceso, sin datos personales.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const inicio = Date.now();
    const id = randomUUID().slice(0, 8);
    res.setHeader('x-request-id', id);
    res.on('finish', () => {
      if (req.path === '/api/salud') return;
      console.log(
        JSON.stringify({
          nivel: 'info',
          request_id: id,
          metodo: req.method,
          ruta: req.path,
          estado: res.statusCode,
          ms: Date.now() - inicio,
          entorno: entorno.nodeEnv,
        }),
      );
    });
    next();
  });

  // Defensa CSRF adicional a SameSite=Lax: valida el origen de escrituras.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origen = req.header('origin');
    if (!origen) return next();
    if (!entorno.origenes.includes(origen)) {
      res.status(403).json({ mensaje: 'Origen no permitido.' });
      return;
    }
    next();
  });

  app.enableCors({
    origin: entorno.origenes,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(entorno.puerto);
  console.log(
    JSON.stringify({
      nivel: 'info',
      evento: 'arranque',
      puerto: entorno.puerto,
      entorno: entorno.nodeEnv,
      demo: entorno.demoMode,
    }),
  );
}

void main();
