# Questionnaire API — Campos nuevos para prompts (texto, imagen, video)

Resumen corto:

- Se añadieron en el modelo los campos para que el enunciado (prompt) pueda ser de tipo `TEXT`, `IMAGE` o `VIDEO`.
- Los media (imagen/video) deben alojarse en un proveedor (p. ej. Bunny) y enviarse al backend como `promptMediaUrl`.

Campos relevantes (questions[].*):

- `type`: 'MULTIPLE_CHOICE' | 'TEXT'  — tipo de pregunta (como antes).
- `questionText`: string — enunciado en texto (mantiene compatibilidad).
- `promptType`?: 'TEXT' | 'IMAGE' | 'VIDEO' — indica cómo se presenta el enunciado.
- `promptMediaUrl`?: string — URL del media cuando `promptType` es `IMAGE` o `VIDEO` (requerido en ese caso).
- `promptMediaProvider`?: 'BUNNY' — proveedor opcional del media.
- `options`?: [...] — para `MULTIPLE_CHOICE`.
- `correctOptionId`?: ObjectId — para `MULTIPLE_CHOICE`.

Notas de validación (backend):

- Si `promptType` es `IMAGE` o `VIDEO`, el backend exige que `promptMediaUrl` esté presente.
- El controller sanitiza/whitelistea los campos entrantes y solo acepta los campos documentados.

Ejemplo mínimo de payload para crear un cuestionario con una pregunta en imagen:

```
{
  "courseId": "60ab...",
  "title": "Cuestionario ejemplo",
  "questions": [
    {
      "type": "TEXT",
      "questionText": "Ignorado si se usa promptType",
      "promptType": "IMAGE",
      "promptMediaUrl": "https://bunny.cdn/mi-bucket/path/to/image.jpg",
      "promptMediaProvider": "BUNNY",
      "order": 0,
      "points": 10,
      "required": true
    }
  ]
}
```

Siguientes recomendaciones:

- Implementar en frontend el flujo de subida a Bunny (signed upload o backend proxy) y devolver `promptMediaUrl` al guardar la pregunta.  
- Considerar un helper en backend (`services/bunny.service.ts`) para validar/normalizar URLs y borrar assets cuando se borre/actualice un cuestionario.

Archivo de referencia en código:

- Modelo: `src/models/mongo/questionnaire.model.ts`  
- Servicio: `src/services/questionnaire.service.ts`  
- Controller: `src/controllers/questionnaire.controller.ts`
