#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el dataset sintético canónico del prototipo ITTLA (contrato
``dataset-sintetico-ittla-v1``) a partir del libro de casos del proyecto.

Uso (desde cualquier directorio)::

    python3 backend/datos/extraer.py

Lee ``docs/materiales_hilda_2026-10-13/Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx``
y escribe ``backend/datos/dataset.json``. Es determinista: la misma entrada
produce exactamente el mismo archivo (mismos bytes, mismo sha256).

Antes de escribir valida el libro de origen y, tras construir el dataset, valida
todos sus invariantes (30 estudiantes, 540 asignaturas, 90 trayectorias, 360
parciales, 3 periodos, 6 asignaturas por estudiante-periodo y los casos
deliberados). Si algo no cuadra, aborta con código 1 y un mensaje explícito;
nunca escribe un JSON parcial.

Los datos del libro son ficticios. Ver ``backend/datos/CONTRATO.md`` para
procedencia, reglas de derivación, campos generados, supuestos y límites.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover - solo si falta la dependencia
    print(
        "ERROR: falta openpyxl. Instala la dependencia o usa el python del runtime "
        "de DSH (ver CONTRATO.md, sección «Cómo regenerar»).",
        file=sys.stderr,
    )
    raise SystemExit(1)

# ---------------------------------------------------------------------------
# Rutas y constantes del contrato
# ---------------------------------------------------------------------------

RAIZ_REPO = Path(__file__).resolve().parents[2]
RUTA_FUENTE = (
    RAIZ_REPO
    / "docs"
    / "materiales_hilda_2026-10-13"
    / "Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx"
)
RUTA_SALIDA = Path(__file__).resolve().parent / "dataset.json"

CONTRATO = "dataset-sintetico-ittla-v1"
VERSION_DATASET = "1.0"

# El umbral 70 del libro es explícitamente simulado ("solo para ejemplo,
# validar norma"); se usa únicamente para mapear Acreditada/No acreditada.
UMBRAL_APROBATORIO = 70
# Supuesto documentado: créditos del plan de estudios de referencia (ver
# CONTRATO.md). Coincide con `creditos_plan_estudios` de configuracion.json.
CREDITOS_PLAN = 210

PERIODOS = [
    {
        "clave": "2025-2",
        "nombre": "Agosto–Diciembre 2025",
        "fecha_inicio": "2025-08-25",
        "fecha_fin": "2025-12-19",
        "activo": False,
    },
    {
        "clave": "2026-1",
        "nombre": "Enero–Junio 2026",
        "fecha_inicio": "2026-01-26",
        "fecha_fin": "2026-06-19",
        "activo": False,
    },
    {
        "clave": "2026-2",
        "nombre": "Agosto–Diciembre 2026",
        "fecha_inicio": "2026-08-24",
        "fecha_fin": "2026-12-18",
        "activo": True,
    },
]
CLAVES_PERIODO = [p["clave"] for p in PERIODOS]
PERIODO_ACTIVO = "2026-2"

INSTITUCION = {
    "clave": "ITTLA",
    "nombre": "Instituto Tecnológico de Tlalnepantla",
    "nombre_corto": "IT Tlalnepantla",
}

GRUPOS = [
    {"clave": "GRP-A", "nombre": "Grupo A"},
    {"clave": "GRP-B", "nombre": "Grupo B"},
    {"clave": "GRP-C", "nombre": "Grupo C"},
]

USUARIOS = [
    {"correo": "tutor@ittla.demo", "nombre": "Tutor de GRP-A y GRP-B", "rol": "tutor"},
    {"correo": "tutor.c@ittla.demo", "nombre": "Tutor de GRP-C", "rol": "tutor"},
    {
        "correo": "coordinacion@ittla.demo",
        "nombre": "Coordinación de tutoría",
        "rol": "coordinacion",
    },
    {
        "correo": "asesoria@ittla.demo",
        "nombre": "Asesoría de desarrollo académico",
        "rol": "asesoria",
    },
    {
        "correo": "admin@ittla.demo",
        "nombre": "Administración técnica",
        "rol": "admin_tecnico",
    },
]
TUTOR_AB = "tutor@ittla.demo"
TUTOR_C = "tutor.c@ittla.demo"

# Mapeo de programas del libro a claves cortas. Solo se exportan los programas
# que aparecen en la hoja Estudiantes (se valida que no haya programas sin
# mapeo para no inventar carreras).
CARRERAS_POR_PROGRAMA = {
    "Ingeniería en Tecnologías de la Información y Comunicaciones": (
        "ITIC",
        "Ingeniería en Tecnologías de la Información y Comunicaciones",
    ),
    "Ingeniería Industrial": ("IND", "Ingeniería Industrial"),
    "Ingeniería en Sistemas Computacionales": (
        "ISC",
        "Ingeniería en Sistemas Computacionales",
    ),
    "Ingeniería Mecatrónica": ("MEC", "Ingeniería Mecatrónica"),
}

RESULTADO_POR_SIMULADO = {"Acreditada": "aprobado", "No acreditada": "reprobado"}
OPORTUNIDAD_POR_TEXTO = {
    "Primera inscripción": 1,
    "Segunda inscripción": 2,
    "Tercera inscripción": 3,
    "Cuarta inscripción": 4,
}

# Casos deliberados (ver CONTRATO.md, «Casos deliberados»).
# El semáforo del periodo activo (2026-2) se calcula con el corte del periodo de
# referencia (2026-1), así que los casos de calidad de datos se ubican en 2026-1
# para que el tablero activo pueda reflejarlos.
# 1) Datos faltantes: una asignatura de 2026-1 sin registro para cada uno.
ASIGNATURAS_SIN_REGISTRO = {
    ("EST-0029", "2026-1", "ASG-02"),
    ("EST-0030", "2026-1", "ASG-01"),
}
# 2) Contradicción interna deliberada en 2026-1: calificación >= 70 con resultado
#    reprobado.
CONTRADICCION = ("EST-0028", "2026-1", "ASG-01")
# 3) Casos RA-05: dos parciales exigibles no acreditados en una asignatura cuyo
#    resultado final del periodo es aprobado.
ASIGNATURAS_RA05 = {
    ("EST-0019", "2026-2", "ASG-01"): (58, 61),
    ("EST-0026", "2026-2", "ASG-06"): (55, 60),
}
# 4) Curso especial registrado oficialmente.
CURSO_ESPECIAL = ("EST-0027", "2026-2", "ASG-06")

# Cabeceras esperadas: si el libro cambia de estructura, el script aborta en vez
# de generar datos silenciosamente distintos.
CABECERAS = {
    "Estudiantes": [
        "id_estudiante",
        "instituto",
        "programa",
        "semestre",
        "origen",
        "periodo_actual",
    ],
    "Historial": [
        "id_estudiante",
        "periodo",
        "id_asignatura",
        "asignatura",
        "calificacion",
        "resultado_simulado",
        "nota_umbral",
        "creditos_ejemplo",
        "oportunidad",
    ],
    "Inscripciones": [
        "id_estudiante",
        "periodo",
        "inscritas",
        "aprobadas_ejemplo",
        "no_acreditadas_ejemplo",
        "origen",
    ],
    "Tutorias": [
        "id_sesion",
        "id_estudiante",
        "periodo",
        "tipo",
        "tema",
        "acuerdo",
        "estado",
        "responsable",
    ],
    "Situaciones": [
        "id_situacion",
        "id_estudiante",
        "categoria",
        "necesidad_de_apoyo",
        "origen",
        "documento_presentado",
        "canalizacion",
        "estado",
    ],
    "Canalizaciones": [
        "folio",
        "id_estudiante",
        "categoria",
        "area_sugerida",
        "institucion",
        "estatus",
        "fecha_confirmacion",
        "nota",
    ],
    "Servicios_Asesoria": [
        "id_servicio",
        "instituto",
        "area",
        "asignatura",
        "modalidad",
        "dia",
        "horario",
        "vigencia",
        "estado",
        "responsable",
    ],
    "Solicitudes": [
        "id_solicitud",
        "id_estudiante",
        "tipo",
        "estado",
        "area",
        "nota",
    ],
    "Fuentes_RAG": [
        "id_fuente",
        "documento",
        "año",
        "alcance",
        "uso",
        "vigencia_ITTLA",
        "ubicacion",
    ],
    "Consultas_RAG": [
        "pregunta",
        "respuesta_esperada",
        "fuente",
        "resultado_obtenido",
        "aprobacion",
    ],
}

# Conteos esperados del libro de origen. Si cambian, se aborta.
CONTEOS_FUENTE = {
    "Estudiantes": 30,
    "Historial": 540,
    "Inscripciones": 90,
    "Tutorias": 30,
    "Situaciones": 18,
    "Canalizaciones": 6,
    "Servicios_Asesoria": 3,
    "Solicitudes": 4,
    "Fuentes_RAG": 10,
    "Consultas_RAG": 10,
}
ASIGNATURAS_POR_ESTUDIANTE_PERIODO = 6

# Normalización de estados a claves snake_case (solo estados/canalización; los
# catálogos y textos del libro se conservan tal cual).
MAPA_ESTADOS = {
    "pendiente": "pendiente",
    "sin atender": "sin_atender",
    "pendiente de validacion": "pendiente_validacion",
    "no confirmado": "no_confirmado",
    "pendiente de confirmacion": "pendiente_confirmacion",
    "cumplido": "cumplido",
    "vencido": "vencido",
    "cancelado": "cancelado",
    "sin registro": "sin_registro",
}


class ErrorDataset(Exception):
    """Error controlado: se reporta y el script aborta con código 1."""

    codigo = 1


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def redondear(valor: float, decimales: int = 2) -> float:
    """Redondea evitando ``-0.0``; el resultado siempre es JSON seguro."""
    numero = round(float(valor), decimales)
    if numero == 0.0:
        return 0.0
    return numero


def limitar(valor: float, minimo: float, maximo: float) -> float:
    return max(minimo, min(maximo, valor))


def sin_acentos(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in normalizado if not unicodedata.combining(c))


def clave_estado(texto: str) -> str:
    """Convierte un estado del libro a clave snake_case estable."""
    limpio = re.sub(r"\s+", " ", sin_acentos(str(texto)).strip().lower())
    if limpio in MAPA_ESTADOS:
        return MAPA_ESTADOS[limpio]
    generico = re.sub(r"[^a-z0-9]+", "_", limpio).strip("_")
    return generico or "sin_estado"


def semilla(*partes: str) -> int:
    """Entero determinista (sha256) para generar valores sintéticos estables.

    No se usa ``random``: el resultado no depende de la versión de Python ni del
    orden de ejecución.
    """
    digest = hashlib.sha256("|".join(partes).encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def promedio(valores: list[int | float]) -> float:
    return redondear(sum(valores) / len(valores), 2)


def texto_o_none(valor):
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def entero(valor, campo: str) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError) as exc:
        raise ErrorDataset(
            f"El campo «{campo}» debería ser entero y llegó {valor!r}."
        ) from exc


# ---------------------------------------------------------------------------
# Lectura y validación del libro de casos
# ---------------------------------------------------------------------------


def leer_hojas() -> dict[str, list[dict]]:
    """Lee las hojas del libro y valida cabeceras y conteos esperados."""
    if not RUTA_FUENTE.is_file():
        raise ErrorDataset(
            f"No se encontró el libro de casos en {RUTA_FUENTE}. "
            "Verifica la ruta o la ubicación del repositorio."
        )

    try:
        libro = openpyxl.load_workbook(RUTA_FUENTE, data_only=True)
    except Exception as exc:  # pragma: no cover - archivo corrupto o bloqueado
        raise ErrorDataset(f"No se pudo abrir {RUTA_FUENTE.name}: {exc}") from exc

    datos: dict[str, list[dict]] = {}
    try:
        for hoja, cabecera_esperada in CABECERAS.items():
            if hoja not in libro.sheetnames:
                raise ErrorDataset(
                    f"Falta la hoja «{hoja}» en el libro. Hojas disponibles: "
                    f"{', '.join(libro.sheetnames)}."
                )
            filas = list(libro[hoja].iter_rows(values_only=True))
            if not filas:
                raise ErrorDataset(f"La hoja «{hoja}» está vacía.")
            cabecera = tuple(
                str(celda).strip() if celda is not None else "" for celda in filas[0]
            )
            if cabecera != tuple(cabecera_esperada):
                raise ErrorDataset(
                    f"La hoja «{hoja}» tiene cabecera inesperada.\n"
                    f"  Esperada: {tuple(cabecera_esperada)}\n"
                    f"  Recibida: {cabecera}"
                )
            registros: list[dict] = []
            for numero_fila, fila in enumerate(filas[1:], start=2):
                if all(valor is None for valor in fila):
                    continue
                if len(fila) != len(cabecera_esperada):
                    raise ErrorDataset(
                        f"La fila {numero_fila} de «{hoja}» tiene {len(fila)} "
                        f"columnas y se esperaban {len(cabecera_esperada)}."
                    )
                registros.append(dict(zip(cabecera_esperada, fila)))
            esperado = CONTEOS_FUENTE[hoja]
            if len(registros) != esperado:
                raise ErrorDataset(
                    f"Conteo inesperado en «{hoja}»: {len(registros)} filas "
                    f"(se esperaban {esperado})."
                )
            datos[hoja] = registros
    finally:
        libro.close()

    validar_fuente(datos)
    return datos


def validar_fuente(datos: dict[str, list[dict]]) -> None:
    """Valida coherencia del libro antes de derivar el dataset."""
    estudiantes = datos["Estudiantes"]
    historial = datos["Historial"]
    inscripciones = datos["Inscripciones"]

    ids = [texto_o_none(fila["id_estudiante"]) for fila in estudiantes]
    if any(ident is None for ident in ids):
        raise ErrorDataset("Hay estudiantes sin id_estudiante en la hoja Estudiantes.")
    esperados = [f"EST-{numero:04d}" for numero in range(1, len(ids) + 1)]
    if sorted(ids) != esperados:
        raise ErrorDataset(
            "Los identificadores de Estudiantes no son EST-0001…EST-0030 únicos y "
            f"consecutivos. Recibidos: {sorted(ids)}"
        )

    for fila in estudiantes:
        programa = texto_o_none(fila["programa"])
        if programa not in CARRERAS_POR_PROGRAMA:
            raise ErrorDataset(
                f"El programa «{programa}» no tiene clave corta de carrera asignada. "
                "Añade el mapeo en CARRERAS_POR_PROGRAMA y documenta el cambio."
            )
        semestre = entero(fila["semestre"], "semestre")
        if not 1 <= semestre <= 12:
            raise ErrorDataset(f"Semestre fuera de rango para {fila['id_estudiante']}: {semestre}.")
        if texto_o_none(fila["periodo_actual"]) != PERIODO_ACTIVO:
            raise ErrorDataset(
                f"{fila['id_estudiante']} tiene periodo_actual "
                f"{fila['periodo_actual']!r}; se esperaba {PERIODO_ACTIVO!r}."
            )

    conteo_por_par: dict[tuple[str, str], list[dict]] = {}
    vistos: set[tuple[str, str, str]] = set()
    for fila in historial:
        estudiante = texto_o_none(fila["id_estudiante"])
        periodo = texto_o_none(fila["periodo"])
        asignatura = texto_o_none(fila["id_asignatura"])
        if estudiante not in ids:
            raise ErrorDataset(f"Historial menciona a un estudiante inexistente: {estudiante!r}.")
        if periodo not in CLAVES_PERIODO:
            raise ErrorDataset(f"Historial tiene un periodo no previsto: {periodo!r}.")
        if asignatura is None:
            raise ErrorDataset("Historial tiene una fila sin id_asignatura.")
        llave = (estudiante, periodo, asignatura)
        if llave in vistos:
            raise ErrorDataset(f"Fila duplicada en Historial: {llave}.")
        vistos.add(llave)
        conteo_por_par.setdefault((estudiante, periodo), []).append(fila)

        calificacion = entero(fila["calificacion"], "calificacion")
        if not 0 <= calificacion <= 100:
            raise ErrorDataset(f"Calificación fuera de rango en Historial: {llave} = {calificacion}.")
        if texto_o_none(fila["resultado_simulado"]) not in RESULTADO_POR_SIMULADO:
            raise ErrorDataset(
                f"resultado_simulado no reconocido en {llave}: {fila['resultado_simulado']!r}."
            )
        if entero(fila["creditos_ejemplo"], "creditos_ejemplo") <= 0:
            raise ErrorDataset(f"creditos_ejemplo inválido en {llave}.")
        if texto_o_none(fila["oportunidad"]) not in OPORTUNIDAD_POR_TEXTO:
            raise ErrorDataset(f"oportunidad no reconocida en {llave}: {fila['oportunidad']!r}.")

    if set(conteo_por_par) != {(estudiante, periodo) for estudiante in ids for periodo in CLAVES_PERIODO}:
        raise ErrorDataset(
            "Historial no cubre las 90 combinaciones estudiante-periodo "
            f"(encontradas {len(conteo_por_par)})."
        )
    for llave, filas in conteo_por_par.items():
        if len(filas) != ASIGNATURAS_POR_ESTUDIANTE_PERIODO:
            raise ErrorDataset(
                f"Historial: {llave} tiene {len(filas)} asignaturas "
                f"(se esperaban {ASIGNATURAS_POR_ESTUDIANTE_PERIODO})."
            )

    # La hoja Inscripciones debe cuadrar con Historial: es la validación de
    # consistencia del libro que exige el encargo.
    indice_inscripciones = {
        (texto_o_none(fila["id_estudiante"]), texto_o_none(fila["periodo"])): fila
        for fila in inscripciones
    }
    if len(indice_inscripciones) != len(conteo_por_par):
        raise ErrorDataset(
            f"Inscripciones tiene {len(indice_inscripciones)} pares estudiante-periodo "
            f"y Historial {len(conteo_por_par)}."
        )
    for llave, filas in conteo_por_par.items():
        fila_inscripcion = indice_inscripciones.get(llave)
        if fila_inscripcion is None:
            raise ErrorDataset(f"Inscripciones no tiene el par {llave}.")
        aprobadas = sum(
            1 for fila in filas if texto_o_none(fila["resultado_simulado"]) == "Acreditada"
        )
        reprobadas = len(filas) - aprobadas
        esperado = (
            entero(fila_inscripcion["inscritas"], "inscritas"),
            entero(fila_inscripcion["aprobadas_ejemplo"], "aprobadas_ejemplo"),
            entero(fila_inscripcion["no_acreditadas_ejemplo"], "no_acreditadas_ejemplo"),
        )
        if esperado != (len(filas), aprobadas, reprobadas):
            raise ErrorDataset(
                f"Inscripciones no cuadra con Historial en {llave}: "
                f"inscritas/aprobadas/no acreditadas = {esperado}, "
                f"Historial = {(len(filas), aprobadas, reprobadas)}."
            )

    # Integridad referencial de las hojas de acompañamiento.
    for hoja in (
        "Tutorias",
        "Situaciones",
        "Canalizaciones",
        "Solicitudes",
    ):
        campo = "id_estudiante"
        for fila in datos[hoja]:
            estudiante = texto_o_none(fila[campo])
            if estudiante not in ids:
                raise ErrorDataset(
                    f"La hoja «{hoja}» menciona a un estudiante inexistente: {estudiante!r}."
                )
    for fila in datos["Tutorias"]:
        if texto_o_none(fila["periodo"]) not in CLAVES_PERIODO:
            raise ErrorDataset(
                f"Tutorias tiene un periodo no previsto: {fila['periodo']!r}."
            )


# ---------------------------------------------------------------------------
# Construcción del dataset
# ---------------------------------------------------------------------------


def construir_carreras(estudiantes: list[dict]) -> list[dict]:
    carreras: list[dict] = []
    vistas: set[str] = set()
    for fila in estudiantes:
        programa = texto_o_none(fila["programa"])
        clave, nombre = CARRERAS_POR_PROGRAMA[programa]
        if clave in vistas:
            continue
        vistas.add(clave)
        carreras.append({"clave": clave, "nombre": nombre})
    return carreras


def grupo_y_tutor(numero_estudiante: int) -> tuple[str, str]:
    """Asigna grupo por orden (1–10 A, 11–20 B, 21–30 C) y tutor por grupo."""
    if 1 <= numero_estudiante <= 10:
        return "GRP-A", TUTOR_AB
    if 11 <= numero_estudiante <= 20:
        return "GRP-B", TUTOR_AB
    if 21 <= numero_estudiante <= 30:
        return "GRP-C", TUTOR_C
    raise ErrorDataset(f"Estudiante fuera de los 30 previstos: {numero_estudiante}.")


def generacion_de_semestre(semestre: int) -> str:
    """Año de ingreso implícito según el semestre en el periodo activo 2026-2.

    Con ciclos 2026-1 (ene–jun) y 2026-2 (ago–dic): semestre 1 y 2 corresponden
    a ingreso en 2026; 3 y 4 a 2025; 5 y 6 a 2024; 7 y 8 a 2023. Es una
    derivación, no un dato del libro (ver CONTRATO.md).
    """
    return str(2026 - (semestre - 1) // 2)


def plan_de_estudios(clave_carrera: str) -> str:
    """Plan de referencia de ejemplo (el libro no lo trae; ver CONTRATO.md)."""
    return f"Plan {clave_carrera} 2010"


def aplicar_casos_deliberados(
    filas_historial: list[dict],
) -> list[dict]:
    """Convierte las filas del Historial al modelo del dataset y aplica los casos
    deliberados (faltantes y contradicción en 2026-1; curso especial aparte)
    documentados en CONTRATO.md."""
    resultado: list[dict] = []
    for fila in filas_historial:
        estudiante = texto_o_none(fila["id_estudiante"])
        periodo = texto_o_none(fila["periodo"])
        clave = texto_o_none(fila["id_asignatura"])
        llave = (estudiante, periodo, clave)
        calificacion = entero(fila["calificacion"], "calificacion")
        resultado_final = RESULTADO_POR_SIMULADO[texto_o_none(fila["resultado_simulado"])]
        origen = "excel"

        if llave in ASIGNATURAS_SIN_REGISTRO:
            calificacion = None
            resultado_final = "sin_registro"
        elif llave == CONTRADICCION:
            # Deliberado: calificación >= 70 con resultado reprobado para
            # provocar la detección de inconsistencia en el corte 2026-1.
            resultado_final = "reprobado"

        resultado.append(
            {
                "periodo": periodo,
                "clave": clave,
                "nombre": texto_o_none(fila["asignatura"]),
                "creditos": entero(fila["creditos_ejemplo"], "creditos_ejemplo"),
                "calificacion": calificacion,
                "resultado": resultado_final,
                "oportunidad": OPORTUNIDAD_POR_TEXTO[texto_o_none(fila["oportunidad"])],
                "fuente": origen,
            }
        )
    return resultado


def derivar_trayectoria(
    id_anonimo: str, asignaturas: list[dict]
) -> list[dict]:
    """Deriva la trayectoria por periodo a partir de las asignaturas."""
    trayectoria: list[dict] = []
    creditos_acumulados = 0.0
    for periodo in CLAVES_PERIODO:
        filas = [fila for fila in asignaturas if fila["periodo"] == periodo]
        aprobadas = [fila for fila in filas if fila["resultado"] == "aprobado"]
        validas = [fila["calificacion"] for fila in filas if fila["calificacion"] is not None]
        reprobadas = sum(1 for fila in filas if fila["resultado"] == "reprobado")

        creditos_aprobados = redondear(sum(fila["creditos"] for fila in aprobadas), 2)
        creditos_inscritos = sum(fila["creditos"] for fila in filas)
        creditos_pendientes = redondear(creditos_inscritos - creditos_aprobados, 2)
        creditos_acumulados += creditos_aprobados
        promedio_periodo = promedio(validas) if validas else 0.0

        # Fórmulas generadas (documentadas en CONTRATO.md): correlacionadas con
        # el desempeño del periodo, deterministas y acotadas.
        asistencia = limitar(
            100.0 - max(0.0, 95.0 - promedio_periodo) * 1.2 - 2.5 * reprobadas,
            55.0,
            100.0,
        )
        puntaje_acuerdos = promedio_periodo - 5.0 * reprobadas
        if puntaje_acuerdos < 70:
            acuerdos_vencidos = 2
        elif puntaje_acuerdos < 85:
            acuerdos_vencidos = 1
        else:
            acuerdos_vencidos = 0

        trayectoria.append(
            {
                "periodo": periodo,
                "creditos_aprobados": creditos_aprobados,
                "creditos_pendientes": creditos_pendientes,
                "promedio_periodo": promedio_periodo,
                "materias_reprobadas": reprobadas,
                "porcentaje_asistencia": redondear(asistencia, 1),
                "avance_curricular": redondear(
                    creditos_acumulados / CREDITOS_PLAN * 100.0, 2
                ),
                "acuerdos_vencidos": acuerdos_vencidos,
                "origen": "derivado",
            }
        )
    return trayectoria


def generar_parciales(estudiantes: list[dict]) -> None:
    """Genera 2 parciales deterministas por asignatura del periodo activo.

    Reglas (ver CONTRATO.md):
    - Mayoría de casos: el parcial 1 promedia (exigible=true) y el parcial 2 aún
      no (exigible=false).
    - Casos RA-05 deliberados: ambos parciales ya promedian y están por debajo
      de 70, con resultado final del periodo aprobado.
    - Resultado final aprobado: el parcial 1 siempre acredita; el parcial 2 puede
      no acreditar (no constituye RA-05).
    - Resultado final reprobado: ambos parciales por debajo de 70, correlacionados
      con la calificación final.
    - Salvaguarda: si alguna asignatura del periodo activo quedara con
      `sin_registro` (hoy los faltantes deliberados están en el corte 2026-1),
      sus parciales se generan pero no son exigibles: no se presume nada con
      datos incompletos.
    """
    for estudiante in estudiantes:
        parciales: list[dict] = []
        for asignatura in estudiante["asignaturas"]:
            if asignatura["periodo"] != PERIODO_ACTIVO:
                continue
            llave = (estudiante["id_anonimo"], PERIODO_ACTIVO, asignatura["clave"])
            calificacion_final = asignatura["calificacion"]
            resultado_final = asignatura["resultado"]
            exigible_por_numero = {1: True, 2: False}

            if llave in ASIGNATURAS_RA05:
                primera, segunda = ASIGNATURAS_RA05[llave]
                exigible_por_numero = {1: True, 2: True}
                calificaciones = {1: primera, 2: segunda}
            elif resultado_final == "sin_registro":
                exigible_por_numero = {1: False, 2: False}
                calificaciones = {
                    1: 60 + semilla(*llave, "parcial", "1") % 21,
                    2: 60 + semilla(*llave, "parcial", "2") % 21,
                }
            elif resultado_final == "aprobado":
                calificaciones = {
                    1: int(
                        limitar(
                            calificacion_final
                            + (semilla(*llave, "parcial", "1") % 13) - 7,
                            UMBRAL_APROBATORIO,
                            100,
                        )
                    ),
                    2: int(
                        limitar(
                            calificacion_final
                            + (semilla(*llave, "parcial", "2") % 21) - 11,
                            45,
                            100,
                        )
                    ),
                }
            else:  # resultado final reprobado
                calificaciones = {
                    1: int(
                        limitar(
                            calificacion_final
                            + (semilla(*llave, "parcial", "1") % 11)
                            - 5
                            - 8,
                            20,
                            UMBRAL_APROBATORIO - 1,
                        )
                    ),
                    2: int(
                        limitar(
                            calificacion_final
                            + (semilla(*llave, "parcial", "2") % 13)
                            - 6
                            - 4,
                            20,
                            UMBRAL_APROBATORIO - 1,
                        )
                    ),
                }

            for numero in (1, 2):
                calificacion = calificaciones[numero]
                parciales.append(
                    {
                        "periodo": PERIODO_ACTIVO,
                        "clave_asignatura": asignatura["clave"],
                        "numero": numero,
                        "calificacion": calificacion,
                        "acreditada": calificacion >= UMBRAL_APROBATORIO,
                        "exigible": exigible_por_numero[numero],
                        "fuente": "generado_sintetico",
                    }
                )
        estudiante["parciales"] = parciales


def construir_estudiantes(datos_fuente: dict[str, list[dict]]) -> list[dict]:
    estudiantes_fuente = sorted(
        datos_fuente["Estudiantes"],
        key=lambda fila: texto_o_none(fila["id_estudiante"]),
    )
    historial = datos_fuente["Historial"]
    por_estudiante: dict[str, list[dict]] = {}
    for fila in historial:
        por_estudiante.setdefault(texto_o_none(fila["id_estudiante"]), []).append(fila)

    estudiantes: list[dict] = []
    for fila in estudiantes_fuente:
        id_fuente = texto_o_none(fila["id_estudiante"])
        numero = int(id_fuente.split("-")[1])
        semestre = entero(fila["semestre"], "semestre")
        grupo, tutor = grupo_y_tutor(numero)
        programa = texto_o_none(fila["programa"])
        clave_carrera, _ = CARRERAS_POR_PROGRAMA[programa]

        filas_historial = sorted(
            por_estudiante[id_fuente],
            key=lambda registro: (
                CLAVES_PERIODO.index(texto_o_none(registro["periodo"])),
                texto_o_none(registro["id_asignatura"]),
            ),
        )
        asignaturas = aplicar_casos_deliberados(filas_historial)
        estudiante = {
            "id_anonimo": id_fuente,
            "id_fuente": id_fuente,
            "carrera": clave_carrera,
            "semestre": semestre,
            "generacion": generacion_de_semestre(semestre),
            "plan_estudios": plan_de_estudios(clave_carrera),
            "modalidad": "Escolarizada",
            "grupo": grupo,
            "estatus_academico": "inscrito",
            "tutor_correo": tutor,
            "trayectoria": derivar_trayectoria(id_fuente, asignaturas),
            "asignaturas": asignaturas,
            "parciales": [],
            "curso_especial": (
                [
                    {
                        "periodo": PERIODO_ACTIVO,
                        "clave_asignatura": CURSO_ESPECIAL[2],
                        "registrado": True,
                        "fuente": "generado_sintetico",
                    }
                ]
                if id_fuente == CURSO_ESPECIAL[0]
                else []
            ),
        }
        estudiantes.append(estudiante)

    generar_parciales(estudiantes)
    return estudiantes


def construir_sesiones(datos_fuente: dict[str, list[dict]]) -> list[dict]:
    sesiones = []
    for fila in datos_fuente["Tutorias"]:
        sesiones.append(
            {
                "id_fuente": texto_o_none(fila["id_sesion"]),
                "id_anonimo": texto_o_none(fila["id_estudiante"]),
                "periodo": texto_o_none(fila["periodo"]),
                "tipo": texto_o_none(fila["tipo"]),
                "tema": texto_o_none(fila["tema"]),
                "acuerdo": texto_o_none(fila["acuerdo"]),
                "estado": clave_estado(fila["estado"]),
                "responsable": texto_o_none(fila["responsable"]),
            }
        )
    return sesiones


def construir_situaciones(datos_fuente: dict[str, list[dict]]) -> list[dict]:
    situaciones = []
    for fila in datos_fuente["Situaciones"]:
        situaciones.append(
            {
                "id_fuente": texto_o_none(fila["id_situacion"]),
                "id_anonimo": texto_o_none(fila["id_estudiante"]),
                "categoria": texto_o_none(fila["categoria"]),
                "necesidad": texto_o_none(fila["necesidad_de_apoyo"]),
                "origen": texto_o_none(fila["origen"]),
                "documento": texto_o_none(fila["documento_presentado"]),
                "canalizacion": clave_estado(fila["canalizacion"]),
                "estado": clave_estado(fila["estado"]),
            }
        )
    return situaciones


def construir_canalizaciones(datos_fuente: dict[str, list[dict]]) -> list[dict]:
    canalizaciones = []
    for fila in datos_fuente["Canalizaciones"]:
        canalizaciones.append(
            {
                "id_fuente": texto_o_none(fila["folio"]),
                "id_anonimo": texto_o_none(fila["id_estudiante"]),
                "categoria": texto_o_none(fila["categoria"]),
                "area_sugerida": texto_o_none(fila["area_sugerida"]),
                "institucion": texto_o_none(fila["institucion"]),
                "estatus": clave_estado(fila["estatus"]),
                "fecha_confirmacion": texto_o_none(fila["fecha_confirmacion"]),
                "nota": texto_o_none(fila["nota"]),
            }
        )
    return canalizaciones


def construir_asesorias(datos_fuente: dict[str, list[dict]]) -> list[dict]:
    asesorias = []
    for fila in datos_fuente["Servicios_Asesoria"]:
        asesorias.append(
            {
                "id_fuente": texto_o_none(fila["id_servicio"]),
                "instituto": texto_o_none(fila["instituto"]),
                "area": texto_o_none(fila["area"]),
                "asignatura": texto_o_none(fila["asignatura"]),
                "modalidad": texto_o_none(fila["modalidad"]),
                "dia": texto_o_none(fila["dia"]),
                "horario": texto_o_none(fila["horario"]),
                "vigencia": texto_o_none(fila["vigencia"]),
                "estado": clave_estado(fila["estado"]),
                "responsable": texto_o_none(fila["responsable"]),
            }
        )
    return asesorias


def construir_solicitudes(datos_fuente: dict[str, list[dict]]) -> list[dict]:
    solicitudes = []
    for fila in datos_fuente["Solicitudes"]:
        solicitudes.append(
            {
                "id_fuente": texto_o_none(fila["id_solicitud"]),
                "id_anonimo": texto_o_none(fila["id_estudiante"]),
                "tipo": texto_o_none(fila["tipo"]),
                "estado": clave_estado(fila["estado"]),
                "area": texto_o_none(fila["area"]),
                "nota": texto_o_none(fila["nota"]),
            }
        )
    return solicitudes


def construir_advertencias() -> list[str]:
    return [
        "Datos exclusivamente ficticios del libro de casos del prototipo; no "
        "corresponden a personas, expedientes ni servicios reales.",
        "porcentaje_asistencia y acuerdos_vencidos no existen en el libro: se generan "
        "de forma determinista y correlacionada con el desempeño del periodo "
        "(fórmulas en CONTRATO.md). El campo origen de cada trayectoria se marca "
        "como «derivado» porque el resto de sus cifras se deriva del Historial.",
        "Los parciales de 2026-2 se generan de forma sintética y determinista: 2 por "
        "asignatura (360 filas). Por defecto el parcial 1 es exigible y el parcial 2 "
        "no promedia aún; en los casos RA-05 deliberados ambos son exigibles.",
        "El curso especial de EST-0027 (2026-2, ASG-06) es generado sintético: el "
        "libro no lo incluye como fila.",
        "Los casos deliberados de calidad de datos (faltantes y contradicción) se "
        "ubican en 2026-1, que es el corte de referencia con el que se calcula el "
        "semáforo del periodo activo 2026-2; así el tablero activo puede mostrar "
        "«información insuficiente» e «inconsistencia» sin romper el periodo en curso.",
        "Faltantes deliberados en 2026-1: EST-0029/2026-1/ASG-02 y "
        "EST-0030/2026-1/ASG-01 quedan con resultado «sin_registro» y calificacion "
        "null (la fila cuenta dentro de las 540; 2026-2 queda completo para ambos). "
        "No deben interpretarse como reprobadas; buscan provocar el estado "
        "«información insuficiente».",
        "Contradicción deliberada en 2026-1: EST-0028/2026-1/ASG-01 conserva "
        "calificación 74 (>= 70) pero con resultado «reprobado» (2025-2 queda "
        "coherente). Busca provocar el estado «inconsistencia» en el corte del "
        "periodo activo; además hace que el agregado de Inscripciones de 2026-1 "
        "(5 aprobadas) ya no cuadre con esa fila.",
        "Caso RA-05 deliberado: EST-0019/2026-2/ASG-01 y EST-0026/2026-2/ASG-06 "
        "tienen dos parciales exigibles no acreditados y, aun así, resultado final "
        "del periodo aprobado en el Historial.",
        "avance_curricular supone 210 créditos de plan de estudios y solo acumula "
        "los 3 periodos del dataset; es una cota inferior del avance real de un "
        "alumno de semestres superiores (ver CONTRATO.md).",
        "El umbral 70 se toma del campo nota_umbral del libro, que lo marca como "
        "«Simulado: 70 solo para ejemplo, validar norma»: no es una norma "
        "institucional.",
        "Las fechas de los periodos provienen del contrato del encargo, no del "
        "libro de casos.",
        "Las hojas Fuentes_RAG y Consultas_RAG se leyeron y validaron, pero el "
        "contrato dataset-sintetico-ittla-v1 no las serializa; el corpus RAG tiene "
        "su propio manifiesto.",
    ]


def construir_dataset(datos_fuente: dict[str, list[dict]]) -> dict:
    carreras = construir_carreras(datos_fuente["Estudiantes"])
    estudiantes = construir_estudiantes(datos_fuente)

    dataset = {
        "contrato": CONTRATO,
        "version": VERSION_DATASET,
        "procedencia": {
            "fuente": "Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx",
            "caracter": "datos ficticios",
            "generado_por": "backend/datos/extraer.py",
            "nota": (
                "Dataset sintético derivado del libro de casos del prototipo ITTLA. "
                "Las cifras de trayectoria y los parciales se calculan con reglas "
                "documentadas en backend/datos/CONTRATO.md; los casos deliberados "
                "están registrados en resumen.advertencias."
            ),
        },
        "institucion": INSTITUCION,
        "periodos": PERIODOS,
        "carreras": carreras,
        "grupos": GRUPOS,
        "usuarios": USUARIOS,
        "estudiantes": estudiantes,
        "sesiones_tutoriales": construir_sesiones(datos_fuente),
        "situaciones": construir_situaciones(datos_fuente),
        "canalizaciones": construir_canalizaciones(datos_fuente),
        "asesorias": construir_asesorias(datos_fuente),
        "solicitudes": construir_solicitudes(datos_fuente),
        "resumen": {
            "estudiantes": len(estudiantes),
            "asignaturas": sum(len(estudiante["asignaturas"]) for estudiante in estudiantes),
            "periodos": len(PERIODOS),
            "parciales": sum(len(estudiante["parciales"]) for estudiante in estudiantes),
            "advertencias": construir_advertencias(),
        },
    }
    return dataset


# ---------------------------------------------------------------------------
# Validación del dataset generado
# ---------------------------------------------------------------------------


def validar_dataset(datos: dict) -> None:
    """Verifica todos los invariantes del contrato antes de escribir el archivo."""
    errores: list[str] = []

    def exigir(condicion: bool, mensaje: str) -> None:
        if not condicion:
            errores.append(mensaje)

    exigir(datos.get("contrato") == CONTRATO, "El contrato no es el esperado.")
    exigir(datos.get("version") == VERSION_DATASET, "La versión no es la esperada.")
    exigir(
        datos.get("procedencia", {}).get("fuente")
        == "Casos_Prueba_Prototipo_ITTLA_TecNM.xlsx",
        "procedencia.fuente no es el libro de casos.",
    )

    # --- Periodos ---------------------------------------------------------
    periodos = datos.get("periodos", [])
    exigir(len(periodos) == 3, f"Se esperaban 3 periodos y hay {len(periodos)}.")
    exigir(
        [periodo.get("clave") for periodo in periodos] == CLAVES_PERIODO,
        "Las claves de periodo no coinciden con el contrato.",
    )
    exigir(
        sum(1 for periodo in periodos if periodo.get("activo")) == 1
        and any(
            periodo.get("clave") == PERIODO_ACTIVO and periodo.get("activo")
            for periodo in periodos
        ),
        f"Debe haber exactamente un periodo activo: {PERIODO_ACTIVO}.",
    )

    # --- Catálogos --------------------------------------------------------
    carreras = datos.get("carreras", [])
    claves_carrera = [carrera.get("clave") for carrera in carreras]
    exigir(len(carreras) >= 1, "No hay carreras en el catálogo.")
    exigir(len(set(claves_carrera)) == len(claves_carrera), "Carreras duplicadas en el catálogo.")
    exigir(
        [grupo.get("clave") for grupo in datos.get("grupos", [])]
        == [grupo["clave"] for grupo in GRUPOS],
        "Los grupos no coinciden con el contrato.",
    )
    correos_usuarios = {usuario.get("correo") for usuario in datos.get("usuarios", [])}
    exigir(
        correos_usuarios == {usuario["correo"] for usuario in USUARIOS},
        "Los usuarios no coinciden con el contrato.",
    )

    # --- Estudiantes y asignaturas ---------------------------------------
    estudiantes = datos.get("estudiantes", [])
    exigir(len(estudiantes) == 30, f"Se esperaban 30 estudiantes y hay {len(estudiantes)}.")
    ids_esperados = [f"EST-{numero:04d}" for numero in range(1, 31)]
    exigir(
        [estudiante.get("id_anonimo") for estudiante in estudiantes] == ids_esperados,
        "Los ids de estudiante no son EST-0001…EST-0030 en orden.",
    )
    exigir(
        len({estudiante.get("id_anonimo") for estudiante in estudiantes}) == len(estudiantes),
        "Hay ids de estudiante duplicados.",
    )

    conteo_asignaturas = 0
    conteo_trayectorias = 0
    conteo_parciales = 0
    pares_asignatura: dict[tuple[str, str], int] = {}
    sin_registro: list[tuple[str, str, str]] = []
    contradicciones: list[tuple[str, str, str]] = []
    reprobados_con_parciales: int = 0
    ra05_por_estudiante: set[str] = set()

    for estudiante in estudiantes:
        id_anonimo = estudiante.get("id_anonimo")
        exigir(estudiante.get("id_fuente") == id_anonimo, f"{id_anonimo}: id_fuente distinto.")
        exigir(
            estudiante.get("carrera") in claves_carrera,
            f"{id_anonimo}: carrera {estudiante.get('carrera')!r} fuera del catálogo.",
        )
        if id_anonimo is not None:
            numero = int(id_anonimo.split("-")[1])
            grupo_esperado, tutor_esperado = grupo_y_tutor(numero)
            exigir(
                estudiante.get("grupo") == grupo_esperado,
                f"{id_anonimo}: grupo {estudiante.get('grupo')!r}, esperado {grupo_esperado!r}.",
            )
            exigir(
                estudiante.get("tutor_correo") == tutor_esperado,
                f"{id_anonimo}: tutor incorrecto.",
            )
        exigir(
            isinstance(estudiante.get("generacion"), str)
            and re.fullmatch(r"\d{4}", estudiante.get("generacion", "")) is not None,
            f"{id_anonimo}: generación inválida.",
        )
        exigir(
            estudiante.get("estatus_academico") == "inscrito",
            f"{id_anonimo}: estatus académico inesperado.",
        )

        asignaturas = estudiante.get("asignaturas", [])
        conteo_asignaturas += len(asignaturas)
        for asignatura in asignaturas:
            periodo = asignatura.get("periodo")
            llave = (id_anonimo, periodo)
            pares_asignatura[llave] = pares_asignatura.get(llave, 0) + 1
            exigir(
                isinstance(asignatura.get("calificacion"), (int, float))
                or asignatura.get("calificacion") is None,
                f"{id_anonimo}/{periodo}/{asignatura.get('clave')}: calificación inválida.",
            )
            calificacion = asignatura.get("calificacion")
            resultado = asignatura.get("resultado")
            exigir(
                resultado in ("aprobado", "reprobado", "sin_registro"),
                f"{id_anonimo}/{periodo}/{asignatura.get('clave')}: resultado {resultado!r} inválido.",
            )
            if resultado == "sin_registro":
                sin_registro.append((id_anonimo, periodo, asignatura.get("clave")))
                exigir(
                    calificacion is None,
                    f"{id_anonimo}/{periodo}/{asignatura.get('clave')}: sin_registro con calificación.",
                )
            else:
                exigir(
                    isinstance(calificacion, (int, float)) and 0 <= calificacion <= 100,
                    f"{id_anonimo}/{periodo}/{asignatura.get('clave')}: calificación fuera de rango.",
                )
                if calificacion is not None and calificacion >= UMBRAL_APROBATORIO:
                    if resultado != "aprobado":
                        contradicciones.append((id_anonimo, periodo, asignatura.get("clave")))
                if calificacion is not None and calificacion < UMBRAL_APROBATORIO:
                    exigir(
                        resultado == "reprobado",
                        f"{id_anonimo}/{periodo}/{asignatura.get('clave')}: "
                        "calificación < 70 con resultado aprobado.",
                    )
            exigir(
                isinstance(asignatura.get("creditos"), int) and asignatura.get("creditos", 0) > 0,
                f"{id_anonimo}/{periodo}/{asignatura.get('clave')}: créditos inválidos.",
            )

        # --- Trayectoria --------------------------------------------------
        trayectoria = estudiante.get("trayectoria", [])
        conteo_trayectorias += len(trayectoria)
        exigir(
            [fila.get("periodo") for fila in trayectoria] == CLAVES_PERIODO,
            f"{id_anonimo}: trayectoria no cubre los 3 periodos en orden.",
        )
        creditos_acumulados = 0.0
        for fila in trayectoria:
            periodo = fila.get("periodo")
            asignaturas_periodo = [
                asignatura for asignatura in asignaturas if asignatura.get("periodo") == periodo
            ]
            aprobadas = [
                asignatura
                for asignatura in asignaturas_periodo
                if asignatura.get("resultado") == "aprobado"
            ]
            validas = [
                asignatura["calificacion"]
                for asignatura in asignaturas_periodo
                if asignatura.get("calificacion") is not None
            ]
            creditos_aprobados = redondear(sum(a["creditos"] for a in aprobadas), 2)
            creditos_inscritos = sum(a["creditos"] for a in asignaturas_periodo)
            creditos_acumulados += creditos_aprobados
            esperado = {
                "creditos_aprobados": creditos_aprobados,
                "creditos_pendientes": redondear(creditos_inscritos - creditos_aprobados, 2),
                "promedio_periodo": promedio(validas) if validas else 0.0,
                "materias_reprobadas": sum(
                    1
                    for asignatura in asignaturas_periodo
                    if asignatura.get("resultado") == "reprobado"
                ),
                "avance_curricular": redondear(
                    creditos_acumulados / CREDITOS_PLAN * 100.0, 2
                ),
                "origen": "derivado",
            }
            for campo, valor in esperado.items():
                exigir(
                    fila.get(campo) == valor,
                    f"{id_anonimo}/{periodo}: {campo}={fila.get(campo)!r}, esperado {valor!r}.",
                )
            exigir(
                isinstance(fila.get("porcentaje_asistencia"), (int, float))
                and 55 <= fila.get("porcentaje_asistencia", 0) <= 100,
                f"{id_anonimo}/{periodo}: porcentaje_asistencia fuera de 55–100.",
            )
            exigir(
                fila.get("acuerdos_vencidos") in (0, 1, 2),
                f"{id_anonimo}/{periodo}: acuerdos_vencidos fuera de 0–2.",
            )

        # --- Parciales ----------------------------------------------------
        parciales = estudiante.get("parciales", [])
        conteo_parciales += len(parciales)
        por_asignatura: dict[str, list[dict]] = {}
        for parcial in parciales:
            exigir(
                parcial.get("periodo") == PERIODO_ACTIVO,
                f"{id_anonimo}: parcial fuera de {PERIODO_ACTIVO}.",
            )
            por_asignatura.setdefault(parcial.get("clave_asignatura"), []).append(parcial)
            calificacion = parcial.get("calificacion")
            exigir(
                isinstance(calificacion, int) and 0 <= calificacion <= 100,
                f"{id_anonimo}: parcial con calificación inválida.",
            )
            exigir(
                parcial.get("acreditada") == (calificacion >= UMBRAL_APROBATORIO),
                f"{id_anonimo}: acreditada incoherente con la calificación del parcial.",
            )
            exigir(
                isinstance(parcial.get("exigible"), bool),
                f"{id_anonimo}: exigible no booleano.",
            )
            exigir(
                parcial.get("fuente") == "generado_sintetico",
                f"{id_anonimo}: fuente de parcial inesperada.",
            )
        claves_activas = {
            asignatura["clave"]
            for asignatura in asignaturas
            if asignatura.get("periodo") == PERIODO_ACTIVO
        }
        exigir(
            set(por_asignatura) == claves_activas,
            f"{id_anonimo}: los parciales no cubren las asignaturas de {PERIODO_ACTIVO}.",
        )
        for clave, lista in por_asignatura.items():
            exigir(
                [parcial.get("numero") for parcial in lista] == [1, 2],
                f"{id_anonimo}/{clave}: se esperaban 2 parciales (números 1 y 2).",
            )
            no_acreditados_exigibles = [
                parcial
                for parcial in lista
                if parcial.get("exigible") and not parcial.get("acreditada")
            ]
            if len(no_acreditados_exigibles) >= 2:
                ra05_por_estudiante.add(id_anonimo)

        # --- Curso especial ----------------------------------------------
        curso_especial = estudiante.get("curso_especial", [])
        if id_anonimo == CURSO_ESPECIAL[0]:
            exigir(
                len(curso_especial) == 1
                and curso_especial[0].get("periodo") == PERIODO_ACTIVO
                and curso_especial[0].get("clave_asignatura") == CURSO_ESPECIAL[2]
                and curso_especial[0].get("registrado") is True
                and curso_especial[0].get("fuente") == "generado_sintetico",
                f"{id_anonimo}: curso especial esperado no encontrado.",
            )
        else:
            exigir(
                curso_especial == [],
                f"{id_anonimo}: curso especial inesperado.",
            )

    exigir(conteo_asignaturas == 540, f"Se esperaban 540 asignaturas y hay {conteo_asignaturas}.")
    exigir(conteo_trayectorias == 90, f"Se esperaban 90 trayectorias y hay {conteo_trayectorias}.")
    exigir(conteo_parciales == 360, f"Se esperaban 360 parciales y hay {conteo_parciales}.")
    exigir(
        len(pares_asignatura) == 90
        and all(conteo == ASIGNATURAS_POR_ESTUDIANTE_PERIODO for conteo in pares_asignatura.values()),
        "No hay exactamente 6 asignaturas por cada una de las 90 combinaciones "
        "estudiante-periodo.",
    )
    exigir(
        sorted(sin_registro) == sorted(ASIGNATURAS_SIN_REGISTRO),
        f"Los datos faltantes deliberados no son los esperados: {sorted(sin_registro)}.",
    )
    exigir(
        contradicciones == [CONTRADICCION],
        f"Se esperaba exactamente la contradicción deliberada {CONTRADICCION}; "
        f"encontradas: {contradicciones}.",
    )
    exigir(
        len(ra05_por_estudiante) >= 2,
        "Se esperaban al menos 2 estudiantes con caso RA-05 (dos parciales "
        "exigibles no acreditados en una asignatura).",
    )
    exigir(
        {estudiante["id_anonimo"] for estudiante in estudiantes if estudiante["id_anonimo"] in ra05_por_estudiante}
        >= {clave[0] for clave in ASIGNATURAS_RA05},
        "Los casos RA-05 deliberados no están presentes.",
    )

    # Al menos un estudiante con parciales no acreditados y resultado final reprobado.
    for estudiante in estudiantes:
        if any(
            asignatura.get("resultado") == "reprobado"
            for asignatura in estudiante["asignaturas"]
            if asignatura.get("periodo") == PERIODO_ACTIVO
        ):
            asignaturas_reprobadas = {
                asignatura["clave"]
                for asignatura in estudiante["asignaturas"]
                if asignatura.get("periodo") == PERIODO_ACTIVO
                and asignatura.get("resultado") == "reprobado"
            }
            if any(
                all(
                    not parcial["acreditada"]
                    for parcial in estudiante["parciales"]
                    if parcial["clave_asignatura"] == clave
                )
                for clave in asignaturas_reprobadas
            ):
                reprobados_con_parciales += 1
    exigir(
        reprobados_con_parciales >= 1,
        "Se esperaba al menos un estudiante con parciales no acreditados que "
        "también reprueba el periodo.",
    )

    # --- Hojas de acompañamiento ----------------------------------------
    conteos_acompanamiento = {
        "sesiones_tutoriales": (datos.get("sesiones_tutoriales", []), 30),
        "situaciones": (datos.get("situaciones", []), 18),
        "canalizaciones": (datos.get("canalizaciones", []), 6),
        "asesorias": (datos.get("asesorias", []), 3),
        "solicitudes": (datos.get("solicitudes", []), 4),
    }
    ids_validos = set(ids_esperados)
    for nombre, (lista, esperado) in conteos_acompanamiento.items():
        exigir(
            len(lista) == esperado,
            f"{nombre}: {len(lista)} registros, se esperaban {esperado}.",
        )
        for registro in lista:
            if "id_anonimo" in registro:
                exigir(
                    registro["id_anonimo"] in ids_validos,
                    f"{nombre}: id_anonimo inexistente {registro['id_anonimo']!r}.",
                )

    # --- Resumen ---------------------------------------------------------
    resumen = datos.get("resumen", {})
    exigir(resumen.get("estudiantes") == 30, "resumen.estudiantes no es 30.")
    exigir(resumen.get("asignaturas") == 540, "resumen.asignaturas no es 540.")
    exigir(resumen.get("periodos") == 3, "resumen.periodos no es 3.")
    exigir(resumen.get("parciales") == 360, "resumen.parciales no es 360.")
    exigir(
        isinstance(resumen.get("advertencias"), list) and len(resumen["advertencias"]) > 0,
        "resumen.advertencias está vacío.",
    )

    # --- JSON seguro: sin NaN ni Infinity -------------------------------
    def revisar_finitos(valor, ruta: str) -> None:
        if isinstance(valor, float) and not math.isfinite(valor):
            errores.append(f"Valor no finito en {ruta}: {valor!r}.")
        elif isinstance(valor, dict):
            for llave, contenido in valor.items():
                revisar_finitos(contenido, f"{ruta}.{llave}")
        elif isinstance(valor, list):
            for posicion, contenido in enumerate(valor):
                revisar_finitos(contenido, f"{ruta}[{posicion}]")

    revisar_finitos(datos, "$")

    if errores:
        raise ErrorDataset(
            "Falló la validación del dataset generado:\n  - " + "\n  - ".join(errores)
        )


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------


def serializar(datos: dict) -> bytes:
    """Serializa a JSON UTF-8 legible, determinista y sin NaN/Infinity."""
    try:
        texto = json.dumps(datos, ensure_ascii=False, indent=2, allow_nan=False)
    except ValueError as exc:
        raise ErrorDataset(f"El dataset contiene valores no serializables: {exc}") from exc
    return (texto + "\n").encode("utf-8")


def escribir_salida(contenido: bytes) -> None:
    try:
        RUTA_SALIDA.write_bytes(contenido)
    except OSError as exc:
        raise ErrorDataset(f"No se pudo escribir {RUTA_SALIDA}: {exc}") from exc


def imprimir_resumen(datos: dict, contenido: bytes) -> None:
    resumen = datos["resumen"]
    estudiantes = len(datos["estudiantes"])
    sesiones = len(datos["sesiones_tutoriales"])
    situaciones = len(datos["situaciones"])
    canalizaciones = len(datos["canalizaciones"])
    asesorias = len(datos["asesorias"])
    solicitudes = len(datos["solicitudes"])
    sin_registro = sum(
        1
        for estudiante in datos["estudiantes"]
        for asignatura in estudiante["asignaturas"]
        if asignatura["resultado"] == "sin_registro"
    )
    contradicciones = sum(
        1
        for estudiante in datos["estudiantes"]
        for asignatura in estudiante["asignaturas"]
        if asignatura["resultado"] != "aprobado"
        and isinstance(asignatura["calificacion"], (int, float))
        and asignatura["calificacion"] >= UMBRAL_APROBATORIO
    )
    cursos_especiales = sum(
        1 for estudiante in datos["estudiantes"] for _ in estudiante["curso_especial"]
    )
    sha256 = hashlib.sha256(contenido).hexdigest()
    ancho = 62

    def linea(etiqueta: str, valor) -> None:
        print(f"  {etiqueta:<32}{(str(valor)):>28}")

    print("=" * ancho)
    print("Dataset sintético ITTLA generado")
    print("=" * ancho)
    linea("contrato", f"{datos['contrato']} v{datos['version']}")
    linea("estudiantes", estudiantes)
    linea("asignaturas", f"{resumen['asignaturas']} (6 por estudiante-periodo)")
    linea("trayectorias", estudiantes * len(datos["periodos"]))
    linea("periodos", f"{len(datos['periodos'])} (activo {PERIODO_ACTIVO})")
    linea("parciales", f"{resumen['parciales']} (2 por asignatura 2026-2)")
    linea("cursos especiales", cursos_especiales)
    linea("casos sin_registro", sin_registro)
    linea("contradicciones internas", contradicciones)
    print("-" * ancho)
    linea("sesiones_tutoriales", sesiones)
    linea("situaciones", situaciones)
    linea("canalizaciones", canalizaciones)
    linea("asesorias", asesorias)
    linea("solicitudes", solicitudes)
    print("-" * ancho)
    linea("archivo", RUTA_SALIDA)
    linea("bytes", len(contenido))
    print(f"  sha256: {sha256}")
    print("=" * ancho)
    print("Validaciones: OK (conteos, invariantes y casos deliberados).")


def main() -> int:
    try:
        datos_fuente = leer_hojas()
        dataset = construir_dataset(datos_fuente)
        validar_dataset(dataset)
        contenido = serializar(dataset)
        escribir_salida(contenido)
    except ErrorDataset as error:
        print(f"ERROR: {error}", file=sys.stderr)
        print("No se escribió ningún archivo. Dataset abortado.", file=sys.stderr)
        return error.codigo
    except Exception as error:  # pragma: no cover - salvaguarda
        print(f"ERROR inesperado: {error}", file=sys.stderr)
        return 1

    imprimir_resumen(dataset, contenido)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
