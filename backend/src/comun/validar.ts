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

export const POLITICA_PASSWORD =
  'La contraseña debe tener al menos 10 caracteres e incluir una letra y un número.';

const contrasenaNueva = z
  .string()
  .min(10, POLITICA_PASSWORD)
  .max(80, 'La contraseña no puede exceder 80 caracteres.')
  .regex(/[A-Za-z]/, POLITICA_PASSWORD)
  .regex(/[0-9]/, POLITICA_PASSWORD);

export const esquemaRegistro = z
  .object({
    nombre: z.string().trim().min(3, 'Escribe tu nombre completo.').max(120),
    correo: z.string().trim().email('Escribe un correo válido.').max(120),
    password: contrasenaNueva,
    password_confirmacion: z.string(),
  })
  .refine((datos) => datos.password === datos.password_confirmacion, {
    message: 'Las contraseñas no coinciden.',
    path: ['password_confirmacion'],
  });

export const esquemaRecuperacion = z.object({
  correo: z.string().trim().email('Escribe un correo válido.').max(120),
});

export const esquemaRestablecer = z
  .object({
    token: z.string().trim().min(20, 'El enlace no es válido.').max(200, 'El enlace no es válido.'),
    password: contrasenaNueva,
    password_confirmacion: z.string(),
  })
  .refine((datos) => datos.password === datos.password_confirmacion, {
    message: 'Las contraseñas no coinciden.',
    path: ['password_confirmacion'],
  });

export const esquemaIngresoDemo = z.object({
  correo: z.string().trim().email().max(120),
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

export const esquemaCierreAccion = z.object({
  estatus: z.enum(['cumplida', 'vencida', 'cancelada']),
  observacion: z.string().trim().max(500).default(''),
});

export const esquemaConsulta = z.object({
  pregunta: z.string().trim().min(8).max(1000),
  id_anonimo: z.string().regex(/^EST[-_]\d{3,4}$/).optional(),
});

export const esquemaPeriodo = z.string().regex(/^\d{4}-[12]$/);
/** El catálogo real vive en la base; aquí sólo se valida la forma. */
export const esquemaGrupo = z.string().trim().min(1).max(20);
export const esquemaCarrera = z.string().trim().min(1).max(40);
export const esquemaNivel = z.enum([
  'verde',
  'amarillo',
  'rojo',
  'informacion_insuficiente',
  'inconsistencia',
]);
export const esquemaAnonimo = z.string().regex(/^EST[-_]\d{3,4}$/);

export function textoOpcional(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpio = valor.trim();
  return limpio.length ? limpio : undefined;
}

export function enteroPositivo(valor: unknown, porDefecto: number, minimo = 1, maximo = 200): number {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) return porDefecto;
  return numero;
}
