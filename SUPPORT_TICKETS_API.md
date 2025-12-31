# API de Soporte Técnico - Documentación

Sistema simple de tickets de soporte técnico para que los usuarios reporten problemas y los administradores gestionen las solicitudes.

## Tabla de Contenidos

- [Autenticación](#autenticación)
- [Endpoints para Usuarios](#endpoints-para-usuarios)
  - [Crear Ticket](#1-crear-ticket-de-soporte)
  - [Obtener Mis Tickets](#2-obtener-mis-tickets)
- [Endpoints para Administradores](#endpoints-para-administradores)
  - [Obtener Todos los Tickets](#3-obtener-todos-los-tickets-admin)
  - [Obtener Ticket por ID](#4-obtener-ticket-por-id)
  - [Marcar como Resuelto](#5-marcar-ticket-como-resuelto-admin)
  - [Actualizar Estado](#6-actualizar-estado-del-ticket-admin)
  - [Actualizar Notas](#7-actualizar-notas-de-admin)
  - [Obtener Estadísticas](#8-obtener-estadísticas-admin)
  - [Eliminar Ticket](#9-eliminar-ticket-admin)
- [Modelo de Datos](#modelo-de-datos)
- [Estados y Prioridades](#estados-y-prioridades)
- [Ejemplos de Integración](#ejemplos-de-integración)

---

## Autenticación

Todos los endpoints requieren autenticación mediante JWT.

**Header requerido:**
```
Authorization: Bearer <token>
```

**Permisos:**
- **Usuarios:** Pueden crear tickets y ver sus propios tickets
- **Administradores:** Pueden ver todos los tickets, marcarlos como resueltos, actualizar estado y eliminar

---

## Endpoints para Usuarios

Base URL: `/api/support-tickets`

### 1. Crear Ticket de Soporte

Permite a los usuarios crear un nuevo ticket de soporte técnico.

**Endpoint:**
```
POST /support-tickets
```

**Headers:**
```
Authorization: Bearer <token>
```

**Body (JSON):**
```json
{
  "subject": "No puedo acceder al curso",
  "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404. Ya intenté cerrar sesión y volver a entrar pero sigue igual."
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `subject` | string | Sí | Asunto del ticket (max 200 chars) |
| `message` | string | Sí | Descripción del problema (max 2000 chars) |

**Ejemplo de Request:**
```bash
curl -X POST "http://localhost:8082/api/support-tickets" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "No puedo acceder al curso",
    "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404."
  }'
```

**Respuesta Exitosa (201):**
```json
{
  "status": 201,
  "message": "Ticket de soporte creado exitosamente",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f191e810c19729de860ea",
    "userEmail": "juan.perez@example.com",
    "userName": "Juan Pérez",
    "subject": "No puedo acceder al curso",
    "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404.",
    "status": "PENDING",
    "priority": "MEDIUM",
    "createdAt": "2025-12-31T10:30:00.000Z",
    "updatedAt": "2025-12-31T10:30:00.000Z"
  }
}
```

---

### 2. Obtener Mis Tickets

Obtiene los tickets del usuario autenticado.

**Endpoint:**
```
GET /support-tickets/my-tickets
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `page` | number | No | 1 | Número de página |
| `limit` | number | No | 20 | Cantidad por página |
| `status` | string | No | - | Filtrar por estado (PENDING, IN_PROGRESS, RESOLVED) |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:8082/api/support-tickets/my-tickets?page=1&limit=10&status=PENDING" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Tickets obtenidos exitosamente",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f191e810c19729de860ea",
      "userEmail": "juan.perez@example.com",
      "userName": "Juan Pérez",
      "subject": "No puedo acceder al curso",
      "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404.",
      "status": "PENDING",
      "priority": "MEDIUM",
      "createdAt": "2025-12-31T10:30:00.000Z",
      "updatedAt": "2025-12-31T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "userId": "507f191e810c19729de860ea",
      "userEmail": "juan.perez@example.com",
      "userName": "Juan Pérez",
      "subject": "Certificado no descarga",
      "message": "Completé el curso pero el botón de descargar certificado no funciona.",
      "status": "RESOLVED",
      "priority": "LOW",
      "resolvedBy": "507f1f77bcf86cd799439099",
      "resolvedAt": "2025-12-30T15:00:00.000Z",
      "adminNotes": "Se regeneró el certificado. Problema solucionado.",
      "createdAt": "2025-12-30T09:15:00.000Z",
      "updatedAt": "2025-12-30T15:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## Endpoints para Administradores

### 3. Obtener Todos los Tickets (Admin)

Obtiene todos los tickets de soporte de todos los usuarios.

**Endpoint:**
```
GET /support-tickets
```

**Headers:**
```
Authorization: Bearer <token>
```

**Requisitos:**
- Usuario debe tener rol ADMIN

**Query Parameters:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `page` | number | No | 1 | Número de página |
| `limit` | number | No | 20 | Cantidad por página |
| `status` | string | No | - | Filtrar por estado |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:8082/api/support-tickets?page=1&limit=20&status=PENDING" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Tickets obtenidos exitosamente",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": {
        "_id": "507f191e810c19729de860ea",
        "firstName": "Juan",
        "lastName": "Pérez",
        "email": "juan.perez@example.com"
      },
      "userEmail": "juan.perez@example.com",
      "userName": "Juan Pérez",
      "subject": "No puedo acceder al curso",
      "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404.",
      "status": "PENDING",
      "priority": "MEDIUM",
      "createdAt": "2025-12-31T10:30:00.000Z",
      "updatedAt": "2025-12-31T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### 4. Obtener Ticket por ID

Obtiene un ticket específico por su ID.

**Endpoint:**
```
GET /support-tickets/:id
```

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID del ticket (MongoDB ObjectId) |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:8082/api/support-tickets/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Ticket obtenido exitosamente",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": {
      "_id": "507f191e810c19729de860ea",
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan.perez@example.com"
    },
    "userEmail": "juan.perez@example.com",
    "userName": "Juan Pérez",
    "subject": "No puedo acceder al curso",
    "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404.",
    "status": "PENDING",
    "priority": "MEDIUM",
    "createdAt": "2025-12-31T10:30:00.000Z",
    "updatedAt": "2025-12-31T10:30:00.000Z"
  }
}
```

---

### 5. Marcar Ticket como Resuelto (Admin)

Marca un ticket como resuelto y opcionalmente agrega notas del administrador.

**Endpoint:**
```
PATCH /support-tickets/:id/resolve
```

**Headers:**
```
Authorization: Bearer <token>
```

**Requisitos:**
- Usuario debe tener rol ADMIN

**URL Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID del ticket |

**Body (JSON) - Opcional:**
```json
{
  "adminNotes": "Se corrigió el problema de permisos en el servidor. El usuario ya puede acceder normalmente."
}
```

**Ejemplo de Request:**
```bash
curl -X PATCH "http://localhost:8082/api/support-tickets/507f1f77bcf86cd799439011/resolve" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "adminNotes": "Se corrigió el problema de permisos."
  }'
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Ticket marcado como resuelto",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f191e810c19729de860ea",
    "userEmail": "juan.perez@example.com",
    "userName": "Juan Pérez",
    "subject": "No puedo acceder al curso",
    "message": "Cuando intento entrar al curso de JavaScript me aparece un error 404.",
    "status": "RESOLVED",
    "priority": "MEDIUM",
    "resolvedBy": "507f1f77bcf86cd799439099",
    "resolvedAt": "2025-12-31T12:00:00.000Z",
    "adminNotes": "Se corrigió el problema de permisos.",
    "createdAt": "2025-12-31T10:30:00.000Z",
    "updatedAt": "2025-12-31T12:00:00.000Z"
  }
}
```

---

### 6. Actualizar Estado del Ticket (Admin)

Actualiza el estado del ticket sin marcarlo como resuelto.

**Endpoint:**
```
PATCH /support-tickets/:id/status
```

**Headers:**
```
Authorization: Bearer <token>
```

**Requisitos:**
- Usuario debe tener rol ADMIN

**Body (JSON):**
```json
{
  "status": "IN_PROGRESS"
}
```

**Estados válidos:**
- `PENDING` - Pendiente
- `IN_PROGRESS` - En progreso
- `RESOLVED` - Resuelto

**Ejemplo de Request:**
```bash
curl -X PATCH "http://localhost:8082/api/support-tickets/507f1f77bcf86cd799439011/status" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Estado del ticket actualizado",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "IN_PROGRESS",
    "updatedAt": "2025-12-31T11:00:00.000Z"
  }
}
```

---

### 7. Actualizar Notas de Admin

Actualiza las notas del administrador en un ticket.

**Endpoint:**
```
PATCH /support-tickets/:id/notes
```

**Headers:**
```
Authorization: Bearer <token>
```

**Requisitos:**
- Usuario debe tener rol ADMIN

**Body (JSON):**
```json
{
  "adminNotes": "Contactado con el usuario. Esperando respuesta."
}
```

**Ejemplo de Request:**
```bash
curl -X PATCH "http://localhost:8082/api/support-tickets/507f1f77bcf86cd799439011/notes" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "adminNotes": "Contactado con el usuario. Esperando respuesta."
  }'
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Notas actualizadas exitosamente",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "adminNotes": "Contactado con el usuario. Esperando respuesta.",
    "updatedAt": "2025-12-31T11:30:00.000Z"
  }
}
```

---

### 8. Obtener Estadísticas (Admin)

Obtiene estadísticas generales de tickets.

**Endpoint:**
```
GET /support-tickets/stats
```

**Headers:**
```
Authorization: Bearer <token>
```

**Requisitos:**
- Usuario debe tener rol ADMIN

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:8082/api/support-tickets/stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Estadísticas obtenidas exitosamente",
  "data": {
    "total": 150,
    "pending": 23,
    "inProgress": 12,
    "resolved": 115
  }
}
```

---

### 9. Eliminar Ticket (Admin)

Elimina permanentemente un ticket.

**Endpoint:**
```
DELETE /support-tickets/:id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Requisitos:**
- Usuario debe tener rol ADMIN

**Ejemplo de Request:**
```bash
curl -X DELETE "http://localhost:8082/api/support-tickets/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Ticket eliminado exitosamente"
}
```

---

## Modelo de Datos

### Ticket de Soporte

```typescript
interface ISupportTicket {
  _id: ObjectId;                    // ID único
  userId: ObjectId;                 // ID del usuario que creó el ticket
  userEmail: string;                // Email del usuario
  userName: string;                 // Nombre del usuario
  subject: string;                  // Asunto (max 200 chars)
  message: string;                  // Mensaje del problema (max 2000 chars)
  status: TicketStatus;             // Estado del ticket
  priority?: TicketPriority;        // Prioridad (opcional)
  resolvedBy?: ObjectId;            // ID del admin que resolvió
  resolvedAt?: Date;                // Fecha de resolución
  adminNotes?: string;              // Notas del administrador (max 1000 chars)
  createdAt: Date;                  // Fecha de creación
  updatedAt: Date;                  // Fecha de actualización
}
```

---

## Estados y Prioridades

### Estados de Ticket (TicketStatus)

```typescript
enum TicketStatus {
  PENDING = 'PENDING',           // Pendiente - recién creado
  IN_PROGRESS = 'IN_PROGRESS',   // En progreso - siendo atendido
  RESOLVED = 'RESOLVED'          // Resuelto - problema solucionado
}
```

### Prioridades (TicketPriority)

```typescript
enum TicketPriority {
  LOW = 'LOW',           // Baja - consulta general
  MEDIUM = 'MEDIUM',     // Media - problema menor
  HIGH = 'HIGH',         // Alta - problema importante
  URGENT = 'URGENT'      // Urgente - problema crítico
}
```

**Nota:** La prioridad actualmente se asigna automáticamente como MEDIUM, pero puede extenderse para que el usuario o admin la especifique.

---

## Ejemplos de Integración

### Cliente Frontend - Crear Ticket

```javascript
async function createSupportTicket(subject, message) {
  const response = await fetch('http://localhost:8082/api/support-tickets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subject, message })
  });

  const data = await response.json();
  return data;
}

// Uso
const ticket = await createSupportTicket(
  'No puedo acceder al curso',
  'Me aparece error 404 cuando intento entrar'
);
```

### Cliente Frontend - Obtener Mis Tickets

```javascript
async function getMyTickets(page = 1, status = null) {
  const params = new URLSearchParams({ page, limit: 10 });
  if (status) params.append('status', status);

  const response = await fetch(
    `http://localhost:8082/api/support-tickets/my-tickets?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    }
  );

  const data = await response.json();
  return data;
}
```

### Panel de Admin - Obtener Todos los Tickets

```javascript
async function getAllTickets(page = 1, status = null) {
  const params = new URLSearchParams({ page, limit: 20 });
  if (status) params.append('status', status);

  const response = await fetch(
    `http://localhost:8082/api/support-tickets?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    }
  );

  const data = await response.json();
  return data;
}
```

### Panel de Admin - Marcar como Resuelto

```javascript
async function resolveTicket(ticketId, adminNotes) {
  const response = await fetch(
    `http://localhost:8082/api/support-tickets/${ticketId}/resolve`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminNotes })
    }
  );

  const data = await response.json();
  return data;
}

// Uso
await resolveTicket(
  '507f1f77bcf86cd799439011',
  'Se solucionó el problema de permisos en el servidor.'
);
```

### Componente React - Formulario de Ticket

```jsx
import { useState } from 'react';

function CreateTicketForm() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8082/api/support-tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject, message })
      });

      const data = await response.json();

      if (data.status === 201) {
        alert('Ticket creado exitosamente. Te contactaremos pronto.');
        setSubject('');
        setMessage('');
      }
    } catch (error) {
      alert('Error al crear el ticket');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Asunto
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
          className="w-full border rounded px-3 py-2"
          placeholder="Describe brevemente el problema"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Mensaje
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          required
          rows={5}
          className="w-full border rounded px-3 py-2"
          placeholder="Describe el problema en detalle"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Crear Ticket'}
      </button>
    </form>
  );
}
```

### Panel de Admin - Lista de Tickets

```jsx
import { useState, useEffect } from 'react';

function AdminTicketList() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    loadTickets();
  }, [filter]);

  async function loadTickets() {
    const response = await fetch(
      `http://localhost:8082/api/support-tickets?status=${filter}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      }
    );
    const data = await response.json();
    setTickets(data.data);
  }

  async function handleResolve(ticketId) {
    const notes = prompt('Notas de resolución (opcional):');

    await fetch(
      `http://localhost:8082/api/support-tickets/${ticketId}/resolve`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ adminNotes: notes })
      }
    );

    loadTickets();
  }

  return (
    <div>
      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="IN_PROGRESS">En Progreso</option>
          <option value="RESOLVED">Resueltos</option>
        </select>
      </div>

      <div className="space-y-4">
        {tickets.map(ticket => (
          <div key={ticket._id} className="border rounded p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold">{ticket.subject}</h3>
                <p className="text-sm text-gray-600">
                  {ticket.userName} ({ticket.userEmail})
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                ticket.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {ticket.status}
              </span>
            </div>

            <p className="text-sm mb-2">{ticket.message}</p>

            <div className="text-xs text-gray-500">
              {new Date(ticket.createdAt).toLocaleString()}
            </div>

            {ticket.status !== 'RESOLVED' && (
              <button
                onClick={() => handleResolve(ticket._id)}
                className="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Marcar como Resuelto
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| `200` | Operación exitosa |
| `201` | Ticket creado exitosamente |
| `400` | Datos inválidos o faltantes |
| `401` | No autenticado |
| `403` | Sin permisos (no es admin) |
| `404` | Ticket no encontrado |
| `500` | Error interno del servidor |

---

## Flujo de Trabajo Típico

### Usuario:
1. Usuario encuentra un problema técnico
2. Crea un ticket con descripción del problema (POST /support-tickets)
3. Recibe confirmación con ID del ticket
4. Puede consultar el estado de sus tickets (GET /support-tickets/my-tickets)
5. Recibe notificación cuando el ticket es resuelto

### Administrador:
1. Ve tickets pendientes en el panel (GET /support-tickets?status=PENDING)
2. Puede cambiar estado a "En Progreso" (PATCH /:id/status)
3. Investiga y soluciona el problema
4. Marca el ticket como resuelto con notas (PATCH /:id/resolve)
5. Usuario puede ver la resolución en su lista de tickets

---

## Notas Adicionales

### Seguridad
- Los usuarios solo pueden ver sus propios tickets
- Solo los administradores pueden ver todos los tickets
- Solo los administradores pueden cambiar estados y marcar como resuelto

### Performance
- Consultas optimizadas con índices en MongoDB
- Paginación para grandes volúmenes de tickets
- Populate automático de información del usuario en vistas de admin

### Límites
- Asunto: máximo 200 caracteres
- Mensaje: máximo 2000 caracteres
- Notas de admin: máximo 1000 caracteres

### Futuras Mejoras Posibles
- Sistema de comentarios/conversación en el ticket
- Adjuntar archivos/capturas de pantalla
- Notificaciones automáticas por email
- Asignación de tickets a administradores específicos
- Sistema de categorías de problemas
- Métricas de tiempo de resolución

---

**Versión:** 1.0.0
**Última actualización:** 31 de diciembre de 2025
