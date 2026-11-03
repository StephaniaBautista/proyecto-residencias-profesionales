import 'dotenv/config';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { crearSql } from '../src/base-datos/conexion';
import { leerEntorno } from '../src/entorno';
import { validarManifiestoFuentes } from '../src/rag/fuentes';
import { fragmentarPaginas } from '../src/rag/fragmentar';
import { embeberTextos } from '../src/rag/openrouter';

type DocumentoProcesado = {
  archivo: string;
  titulo: string;
  emisor: string;
  version: string | null;
  fecha: string | null;
  institucion_aplicable: string | null;
  vigencia_verificada: boolean;
  permisos: string;
  paginas: number;
  url: string | null;
  aprobada_por: string | null;
  aprobada_en: string | null;
  fragmentos: Array<{ pagina: number; texto: string }>;
  vectores: number[][];
};

async function main() {
  const corpus = path.resolve(process.cwd(), 'corpus');
  const manifiestoRaw = JSON.parse(await readFile(path.join(corpus, 'fuentes-rag.json'), 'utf8')) as unknown;
  const fuentes = validarManifiestoFuentes(manifiestoRaw).filter((fuente) => fuente.habilitada);
  const documentos = await extraerDocumentos(fuentes, corpus);
  const dryRun = process.argv.includes('--dry-run');

  for (const documento of documentos) {
    console.log(resumenDocumento(documento));
  }
  if (dryRun) {
    console.log('Simulación terminada: no se llamaron servicios externos ni se escribió en la base.');
    return;
  }

  const entorno = leerEntorno();
  if (!entorno.openRouterKey) {
    throw new Error('Falta OPENROUTER_API_KEY. La ingesta llama a OpenRouter y tiene costo.');
  }

  for (const documento of documentos) {
    const lote = 12;
    for (let inicio = 0; inicio < documento.fragmentos.length; inicio += lote) {
      const parte = documento.fragmentos.slice(inicio, inicio + lote).map((fragmento) => fragmento.texto);
      const vectores = await embeberTextos(parte, entorno);
      for (const vector of vectores) {
        if (vector.length !== entorno.embeddingDimensiones) {
          throw new Error(
            `El modelo devolvió ${vector.length} dimensiones y EMBEDDING_DIMENSIONES es ${entorno.embeddingDimensiones}.`,
          );
        }
        documento.vectores.push(vector);
      }
      console.log(`${documento.archivo}: embeddings ${Math.min(inicio + lote, documento.fragmentos.length)}/${documento.fragmentos.length}`);
    }
  }

  const sql = crearSql();
  try {
    await sql.begin(async (tx) => {
      for (const documento of documentos) {
        await tx`delete from documento_rag where nombre_archivo = ${documento.archivo}`;
        const docs = await tx<{ id: number }[]>`
          insert into documento_rag (
            titulo,
            emisor,
            nombre_archivo,
            vigente,
            fragmentos,
            ingestado_en,
            version,
            fecha_documento,
            institucion_aplicable,
            vigencia_verificada,
            permisos,
            paginas,
            url,
            aprobada_por,
            aprobada_en
          )
          values (
            ${documento.titulo},
            ${documento.emisor},
            ${documento.archivo},
            true,
            ${documento.fragmentos.length},
            now(),
            ${documento.version},
            ${documento.fecha},
            ${documento.institucion_aplicable},
            ${documento.vigencia_verificada},
            ${documento.permisos},
            ${documento.paginas},
            ${documento.url},
            ${documento.aprobada_por},
            ${documento.aprobada_en}
          )
          returning id
        `;
        const documentoId = docs[0]?.id;
        if (!documentoId) throw new Error(`No se pudo registrar ${documento.archivo}.`);

        for (let i = 0; i < documento.fragmentos.length; i += 1) {
          const fragmento = documento.fragmentos[i];
          const vector = documento.vectores[i];
          if (!fragmento || !vector) throw new Error(`Falta un embedding para ${documento.archivo}, fragmento ${i + 1}.`);
          const literal = `[${vector.join(',')}]`;
          await tx`
            insert into fragmento_rag (documento_id, numero, pagina, texto, embedding)
            values (
              ${documentoId},
              ${i + 1},
              ${fragmento.pagina},
              ${fragmento.texto},
              ${literal}::extensions.vector
            )
          `;
        }
        console.log(`${documento.archivo}: ${documento.fragmentos.length} fragmentos indexados (${documento.paginas} páginas).`);
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
  console.log(`Corpus listo: ${documentos.length} fuentes habilitadas.`);
}

function resumenDocumento(documento: DocumentoProcesado): string {
  const vigencia = documento.vigencia_verificada ? 'verificada' : 'no verificada para ITTLA';
  const fecha = documento.fecha ?? 'sin fecha';
  const version = documento.version ?? 'sin versión';
  return `${documento.archivo}: ${documento.fragmentos.length} fragmentos · ${documento.paginas} páginas · versión ${version} · fecha ${fecha} · vigencia ${vigencia} · permisos: ${documento.permisos}`;
}

async function extraerDocumentos(
  fuentes: ReturnType<typeof validarManifiestoFuentes>,
  corpus: string,
): Promise<DocumentoProcesado[]> {
  const unpdf = await import('unpdf');
  const documentos: DocumentoProcesado[] = [];
  for (const fuente of fuentes) {
    const archivo = path.resolve(corpus, fuente.archivo);
    if (path.dirname(archivo) !== corpus) throw new Error(`La fuente sale de backend/corpus: ${fuente.archivo}`);
    const stat = await lstat(archivo);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`La fuente no es un PDF regular: ${fuente.archivo}`);
    const pdf = await readFile(archivo);
    const documento = await unpdf.getDocumentProxy(new Uint8Array(pdf));
    const extraido = await unpdf.extractText(documento, { mergePages: false });
    const paginas = Array.isArray(extraido.text) ? extraido.text : [String(extraido.text ?? '')];
    const fragmentos = fragmentarPaginas(paginas);
    if (!fragmentos.length) throw new Error(`No se pudo extraer texto suficiente de ${fuente.archivo}.`);
    documentos.push({
      archivo: fuente.archivo,
      titulo: fuente.titulo,
      emisor: fuente.emisor,
      version: fuente.version,
      fecha: fuente.fecha,
      institucion_aplicable: fuente.institucion_aplicable,
      vigencia_verificada: fuente.vigencia_verificada,
      permisos: fuente.permisos,
      paginas: fragmentos.reduce((maximo, fragmento) => Math.max(maximo, fragmento.pagina), 0),
      url: fuente.url,
      aprobada_por: fuente.aprobada_por,
      aprobada_en: fuente.aprobada_en,
      fragmentos,
      vectores: [],
    });
    console.log(
      `${fuente.archivo}: ${paginas.length} páginas extraídas, ${fragmentos.length} fragmentos preparados.`,
    );
  }
  return documentos;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
