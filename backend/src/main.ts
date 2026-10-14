import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { leerEntorno } from './entorno';

async function main() {
  const entorno = leerEntorno();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: false,
}));
  app.use(cookieParser());
  app.use(json({ limit: '20kb' }));
  app.use(urlencoded({ extended: false, limit: '20kb' }));
  app.enableCors({
    origin: entorno.origen,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('api');
  await app.listen(entorno.puerto);
}

void main();
