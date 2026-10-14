import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErrores.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const cuerpo = exception.getResponse();
      respuesta.status(exception.getStatus()).json(aMensaje(cuerpo));
      return;
    }
    this.logger.error(exception instanceof Error ? exception.message : 'Error no controlado');
    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      mensaje: 'No se pudo completar la operación.',
    });
  }
}

function aMensaje(cuerpo: string | object): { mensaje: string } | object {
  if (typeof cuerpo === 'string') return { mensaje: cuerpo };
  if ('mensaje' in cuerpo) return cuerpo;
  const message = 'message' in cuerpo ? cuerpo.message : undefined;
  if (typeof message === 'string') return { mensaje: message };
  if (Array.isArray(message)) return { mensaje: message.join(' ') };
  return { mensaje: 'No se pudo completar la operación.' };
}
