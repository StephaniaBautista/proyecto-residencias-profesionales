import { BadRequestException } from '@nestjs/common';
import { z, type ZodTypeAny } from 'zod';

export function leerCuerpo<S extends ZodTypeAny>(esquema: S, valor: unknown): z.output<S> {
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) {
    throw new BadRequestException({
      mensaje: 'Revisa los datos enviados.',
      campos: resultado.error.issues.map((issue) => ({
        campo: issue.path.join('.') || 'cuerpo',
        detalle: issue.message,
      })),
    });
  }
  return resultado.data;
}

export const esquemaIngreso = z.object({
  correo: z.string().trim().email().max(120),
  password: z.string().min(8).max(80),
});

export const esquemaAccion = z.object({
  tipo: z.enum(['entrevista_tutorial', 'asesoria_disciplinar', 'taller', 'canalizacion_academica', 'seguimiento']),
  fecha_compromiso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.'),
  observacion: z.string().trim().max(500).default(''),
});

export const esquemaRevision = z.object({
  estatus: z.enum(['aprobada', 'requiere_ajuste', 'informacion_insuficiente']),
  comentario: z.string().trim().max(500).default(''),
});

export const esquemaConsulta = z.object({
  pregunta: z.string().trim().min(8).max(1000),
  id_anonimo: z.string().regex(/^EST_\d{3}$/).optional(),
});

export const esquemaPeriodo = z.string().regex(/^\d{4}-[12]$/);
export const esquemaGrupo = z.enum(['GRP-A', 'GRP-B', 'GRP-C']);
export const esquemaNivel = z.enum(['verde', 'amarillo', 'rojo']);
export const esquemaAnonimo = z.string().regex(/^EST_\d{3}$/);

export function textoOpcional(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpio = valor.trim();
  return limpio.length ? limpio : undefined;
}
