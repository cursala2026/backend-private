# API de Notificaciones - Documentación

Sistema de notificaciones en tiempo real con persistencia en MongoDB y Server-Sent Events (SSE).

## Tabla de Contenidos

- [Autenticación](#autenticación)
- [Endpoints REST](#endpoints-rest)
  - [Obtener Notificaciones](#1-obtener-notificaciones)
  - [Contar No Leídas](#2-contar-notificaciones-no-leídas)
  - [Marcar como Leída](#3-marcar-notificación-como-leída)
  - [Marcar Todas como Leídas](#4-marcar-todas-como-leídas)
  - [Eliminar Notificación](#5-eliminar-notificación)
  - [Stream SSE](#6-stream-sse-tiempo-real)
- [Modelo de Datos](#modelo-de-datos)
- [Códigos de Estado](#códigos-de-estado)
- [Ejemplos de Integración](#ejemplos-de-integración)

---

## Autenticación

Todos los endpoints requieren autenticación mediante JWT.

**Header requerido:**
```
Authorization: Bearer <token>
```

**Para SSE (alternativa):**
```
GET /notifications/stream?token=<token>
```

---

## Endpoints REST

Base URL: `/api/notifications`

### 1. Obtener Notificaciones

Obtiene las notificaciones del usuario actual con paginación.

**Endpoint:**
```
GET /notifications
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `page` | number | No | 1 | Número de página |
| `limit` | number | No | 20 | Cantidad por página (máx: 100) |
| `includeRead` | boolean | No | true | Incluir notificaciones leídas |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:8082/api/notifications?page=1&limit=20&includeRead=false" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Notificaciones obtenidas exitosamente",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f191e810c19729de860ea",
      "title": "Pago Aprobado",
      "message": "Tu pago para el curso 'JavaScript Avanzado' ha sido aprobado.",
      "type": "success",
      "isRead": false,
      "metadata": {
        "paymentId": "pay_123456",
        "courseId": "507f1f77bcf86cd799439012",
        "action": "payment-approved"
      },
      "createdAt": "2025-12-31T10:30:00.000Z",
      "updatedAt": "2025-12-31T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "userId": "507f191e810c19729de860ea",
      "title": "Curso Completado",
      "message": "¡Felicidades! Has completado el curso 'React Fundamentals'.",
      "type": "success",
      "isRead": false,
      "metadata": {
        "courseId": "507f1f77bcf86cd799439014",
        "action": "course-completed",
        "certificateAvailable": true
      },
      "createdAt": "2025-12-30T15:20:00.000Z",
      "updatedAt": "2025-12-30T15:20:00.000Z"
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

### 2. Contar Notificaciones No Leídas

Obtiene el contador de notificaciones no leídas del usuario actual.

**Endpoint:**
```
GET /notifications/unread-count
```

**Headers:**
```
Authorization: Bearer <token>
```

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:8082/api/notifications/unread-count" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Contador obtenido exitosamente",
  "data": {
    "unreadCount": 12
  }
}
```

---

### 3. Marcar Notificación como Leída

Marca una notificación específica como leída.

**Endpoint:**
```
PATCH /notifications/:id/read
```

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de la notificación (MongoDB ObjectId) |

**Ejemplo de Request:**
```bash
curl -X PATCH "http://localhost:8082/api/notifications/507f1f77bcf86cd799439011/read" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Notificación marcada como leída",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f191e810c19729de860ea",
    "title": "Pago Aprobado",
    "message": "Tu pago para el curso 'JavaScript Avanzado' ha sido aprobado.",
    "type": "success",
    "isRead": true,
    "metadata": {
      "paymentId": "pay_123456",
      "courseId": "507f1f77bcf86cd799439012"
    },
    "createdAt": "2025-12-31T10:30:00.000Z",
    "updatedAt": "2025-12-31T12:45:00.000Z"
  }
}
```

**Errores Posibles:**
- `404` - Notificación no encontrada o no tienes permiso para modificarla

---

### 4. Marcar Todas como Leídas

Marca todas las notificaciones del usuario actual como leídas.

**Endpoint:**
```
PATCH /notifications/read-all
```

**Headers:**
```
Authorization: Bearer <token>
```

**Ejemplo de Request:**
```bash
curl -X PATCH "http://localhost:8082/api/notifications/read-all" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "12 notificaciones marcadas como leídas",
  "data": {
    "count": 12
  }
}
```

---

### 5. Eliminar Notificación

Elimina una notificación específica del usuario actual.

**Endpoint:**
```
DELETE /notifications/:id
```

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | ID de la notificación (MongoDB ObjectId) |

**Ejemplo de Request:**
```bash
curl -X DELETE "http://localhost:8082/api/notifications/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta Exitosa (200):**
```json
{
  "status": 200,
  "message": "Notificación eliminada exitosamente"
}
```

**Errores Posibles:**
- `404` - Notificación no encontrada o no tienes permiso para eliminarla

---

### 6. Stream SSE (Tiempo Real)

Establece una conexión Server-Sent Events para recibir notificaciones en tiempo real.

**Endpoint:**
```
GET /notifications/stream
```

**Headers (opción 1):**
```
Authorization: Bearer <token>
```

**Query Parameters (opción 2):**
```
?token=<jwt-token>
```

**Tipo de Respuesta:**
```
Content-Type: text/event-stream
```

**Eventos SSE:**

#### Evento: `notification`
Nueva notificación recibida.

```
event: notification
data: {"id":"507f1f77bcf86cd799439011","title":"Pago Aprobado","message":"Tu pago ha sido aprobado","type":"success","metadata":{"paymentId":"pay_123"},"createdAt":"2025-12-31T10:30:00.000Z","isRead":false}
```

#### Evento: `read`
Notificación marcada como leída.

```
event: read
data: {"notificationId":"507f1f77bcf86cd799439011"}
```

#### Evento: `all-read`
Todas las notificaciones marcadas como leídas.

```
event: all-read
data: {"count":12}
```

#### Heartbeat
Mantiene la conexión viva (cada 30 segundos).

```
:heartbeat
```

**Ejemplo de Cliente JavaScript:**

```javascript
const token = localStorage.getItem('authToken');
const eventSource = new EventSource(
  `http://localhost:8082/api/notifications/stream?token=${token}`
);

// Escuchar nuevas notificaciones
eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  console.log('Nueva notificación:', notification);

  // Mostrar toast/banner
  showNotificationToast(notification);

  // Actualizar contador de no leídas
  updateUnreadBadge();
});

// Escuchar evento de notificación leída
eventSource.addEventListener('read', (event) => {
  const { notificationId } = JSON.parse(event.data);
  markNotificationAsReadInUI(notificationId);
});

// Escuchar evento de "marcar todas como leídas"
eventSource.addEventListener('all-read', (event) => {
  const { count } = JSON.parse(event.data);
  markAllNotificationsAsReadInUI();
});

// Manejo de errores
eventSource.onerror = (error) => {
  console.error('Error en SSE:', error);
  // EventSource se reconecta automáticamente
};

// Cerrar conexión cuando sea necesario
function cleanup() {
  eventSource.close();
}
```

**Ejemplo con React:**

```jsx
import { useEffect, useState } from 'react';

function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const eventSource = new EventSource(
      `http://localhost:8082/api/notifications/stream?token=${token}`
    );

    eventSource.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data);

      // Agregar a la lista
      setNotifications(prev => [notification, ...prev]);

      // Incrementar contador
      setUnreadCount(prev => prev + 1);

      // Mostrar notificación toast
      toast.success(notification.title, {
        description: notification.message
      });
    });

    eventSource.addEventListener('read', (event) => {
      const { notificationId } = JSON.parse(event.data);

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    eventSource.addEventListener('all-read', () => {
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return { notifications, unreadCount };
}
```

---

## Modelo de Datos

### Notificación

```typescript
interface INotification {
  _id: ObjectId;                    // ID único
  userId: ObjectId;                 // ID del usuario destinatario
  title: string;                    // Título (max 200 chars)
  message: string;                  // Mensaje (max 1000 chars)
  type: NotificationType;           // Tipo de notificación
  isRead: boolean;                  // Estado de lectura
  metadata?: Record<string, any>;   // Datos adicionales opcionales
  createdAt: Date;                  // Fecha de creación
  updatedAt: Date;                  // Fecha de actualización
}
```

### Tipos de Notificación

```typescript
enum NotificationType {
  INFO = 'info',        // Información general
  SUCCESS = 'success',  // Acción exitosa
  WARNING = 'warning',  // Advertencia
  ERROR = 'error'       // Error
}
```

### Ejemplos de Metadata

**Pago aprobado:**
```json
{
  "paymentId": "pay_123456",
  "courseId": "507f1f77bcf86cd799439012",
  "courseName": "JavaScript Avanzado",
  "action": "payment-approved"
}
```

**Curso completado:**
```json
{
  "courseId": "507f1f77bcf86cd799439014",
  "courseName": "React Fundamentals",
  "action": "course-completed",
  "certificateAvailable": true
}
```

**Examen calificado:**
```json
{
  "submissionId": "sub_789012",
  "questionnaireId": "quest_345678",
  "score": 85,
  "passed": true,
  "action": "exam-graded"
}
```

---

## Códigos de Estado

| Código | Descripción |
|--------|-------------|
| `200` | Operación exitosa |
| `400` | Datos inválidos o parámetros faltantes |
| `401` | No autenticado (token inválido o expirado) |
| `404` | Notificación no encontrada o sin permisos |
| `500` | Error interno del servidor |

---

## Ejemplos de Integración

### Enviar Notificación desde Backend

```typescript
import { notificationService } from '@/services';
import { NotificationType } from '@/models/mongo/notification.model';

// Ejemplo 1: Notificar cuando se aprueba un pago
async function approvePayment(paymentId: string, userId: string) {
  // ... lógica de aprobación ...

  await notificationService.sendNotification(userId, {
    title: 'Pago Aprobado',
    message: `Tu pago para el curso "${courseName}" ha sido aprobado. Ya puedes acceder al contenido.`,
    type: NotificationType.SUCCESS,
    metadata: {
      paymentId,
      courseId,
      courseName,
      action: 'payment-approved'
    }
  });
}

// Ejemplo 2: Notificar curso completado
async function checkCourseCompletion(userId: string, courseId: string, progress: number) {
  if (progress >= 100) {
    await notificationService.sendNotification(userId, {
      title: 'Curso Completado',
      message: `¡Felicidades! Has completado el curso "${courseName}". Tu certificado está listo.`,
      type: NotificationType.SUCCESS,
      metadata: {
        courseId,
        courseName,
        action: 'course-completed',
        certificateAvailable: true
      }
    });
  }
}

// Ejemplo 3: Notificar examen calificado
async function gradeSubmission(submissionId: string, score: number, passed: boolean) {
  await notificationService.sendNotification(userId, {
    title: passed ? 'Examen Aprobado' : 'Examen Calificado',
    message: passed
      ? `Has aprobado el examen con ${score}%. ¡Continúa con el siguiente contenido!`
      : `Tu examen ha sido calificado: ${score}%. Puedes volver a intentarlo.`,
    type: passed ? NotificationType.SUCCESS : NotificationType.WARNING,
    metadata: {
      submissionId,
      score,
      passed,
      action: 'exam-graded'
    }
  });
}

// Ejemplo 4: Notificar curso asignado
async function assignCourseToUser(userId: string, courseId: string) {
  await notificationService.sendNotification(userId, {
    title: 'Nuevo Curso Asignado',
    message: `Se te ha asignado el curso "${courseName}". Ya puedes comenzar a estudiar.`,
    type: NotificationType.INFO,
    metadata: {
      courseId,
      courseName,
      action: 'course-assigned'
    }
  });
}
```

### Cliente HTTP (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8082/api',
  headers: {
    Authorization: `Bearer ${localStorage.getItem('authToken')}`
  }
});

// Obtener notificaciones
async function getNotifications(page = 1, limit = 20, includeRead = false) {
  const response = await api.get('/notifications', {
    params: { page, limit, includeRead }
  });
  return response.data;
}

// Contar no leídas
async function getUnreadCount() {
  const response = await api.get('/notifications/unread-count');
  return response.data.data.unreadCount;
}

// Marcar como leída
async function markAsRead(notificationId) {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
}

// Marcar todas como leídas
async function markAllAsRead() {
  const response = await api.patch('/notifications/read-all');
  return response.data;
}

// Eliminar notificación
async function deleteNotification(notificationId) {
  const response = await api.delete(`/notifications/${notificationId}`);
  return response.data;
}
```

### Componente React Completo

```jsx
import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Cargar notificaciones iniciales
    fetchNotifications();
    fetchUnreadCount();

    // Conectar a SSE
    const token = localStorage.getItem('authToken');
    const eventSource = new EventSource(
      `http://localhost:8082/api/notifications/stream?token=${token}`
    );

    eventSource.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Mostrar toast
      showToast(notification);
    });

    eventSource.addEventListener('read', (event) => {
      const { notificationId } = JSON.parse(event.data);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    eventSource.addEventListener('all-read', () => {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });

    return () => eventSource.close();
  }, []);

  async function fetchNotifications() {
    const response = await fetch('http://localhost:8082/api/notifications', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    const data = await response.json();
    setNotifications(data.data);
  }

  async function fetchUnreadCount() {
    const response = await fetch('http://localhost:8082/api/notifications/unread-count', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    const data = await response.json();
    setUnreadCount(data.data.unreadCount);
  }

  async function handleMarkAsRead(id) {
    await fetch(`http://localhost:8082/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
  }

  async function handleMarkAllAsRead() {
    await fetch('http://localhost:8082/api/notifications/read-all', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
  }

  async function handleDelete(id) {
    await fetch(`http://localhost:8082/api/notifications/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button onClick={() => setIsOpen(!isOpen)} className="relative">
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white shadow-lg rounded-lg">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Notificaciones</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="text-sm text-blue-600">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b hover:bg-gray-50 ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{notification.title}</h4>
                      <p className="text-sm text-gray-600">{notification.message}</p>
                      <span className="text-xs text-gray-400">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Notas Adicionales

### Seguridad
- Todas las operaciones verifican que el usuario autenticado sea el propietario de la notificación
- El token JWT debe ser válido y no estar expirado
- Las notificaciones son privadas para cada usuario

### Performance
- Las consultas están optimizadas con índices en MongoDB
- Se usa `.lean()` en queries de solo lectura para mejor performance
- El SSE mantiene heartbeat cada 30s para prevenir timeouts

### Escalabilidad
- Para múltiples servidores, considerar migrar a Redis Pub/Sub
- El sistema actual funciona en un solo servidor con EventEmitter

### Límites
- Título: máximo 200 caracteres
- Mensaje: máximo 1000 caracteres
- Paginación: máximo 100 notificaciones por página (recomendado: 20)

---

**Versión:** 1.0.0
**Última actualización:** 31 de diciembre de 2025



# ==============================================
# CONFIGURACIÓN DE ENTORNO - DESARROLLO
# ==============================================
NODE_ENV=development
PORT=8081

# ===============================================
# BASE DE DATOSS Y AUTENTICACIÓN
# ===============================================
# MongoDB - Base de datos local para desarrollo
DATABASE_URL=mongodb+srv://cursala:cursala@cursaladb.cg6qkei.mongodb.net/cursala?appName=cursaladb

# JWT
JWT_SECRET=MQFY4BldHnQjmfmGIHZkJIXVuOvJ656j+Q59VIGe4QE=
# Certificados
USE_HTML_CERTIFICATE=false
CERTIFICATE_ENCRYPTION_KEY=YBchBDc7NqFw0ThRE8UXigUwobXaLU3aBTs24rhAsVs=

# ===============================================
# MERCADOPAGO CONFIGURATION - DEVELOPMENT
# ===============================================
MERCADOPAGO_MODE=sandbox
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1080990237451846-010215-b27c721901569b394f5b56c579080d55-3107446232
MERCADOPAGO_PUBLIC_KEY=APP_USR-b832ef0b-1cee-499d-ae8e-1aa998bd9819

# URLs - DIFERENTES A LATEST
FRONTEND_URL=https://6nkkh2rc-4200.brs.devtunnels.ms
BACKEND_URL=http://b-cursala-preview:8080
WEBHOOK_URL=https://6nkkh2rc-8081.brs.devtunnels.ms

# ========================================
# SERVICIO DE EMAILS
# ========================================
# ethereal
EMAIL_USE_ETHEREAL=true

# Notificaciones
ADMIN_NOTIFICATION_EMAIL=luis.varela@cursala.com.ar

# SMTP
EMAIL_FROM=info@cursala.com.ar
EMAIL_PASSWORD=cursala.lucho2025
EMAIL_HOST=mail.cursala.com.ar
EMAIL_PORT=587

FRONTEND_DOMAIN=http://localhost:4200,https://6nkkh2rc-4200.brs.devtunnels.ms
FRONTEND_DOMAIN_PUBLIC=http://localhost:3000
RESET_PASSWORD_FRONTEND_PATH=/reset-password
EXPIRE_TIME_TOKEN_RESET_PASSWORD=30m
EXPIRE_TIME_TOKEN_USER_LOGGED=1d
USER_VALIDATION_PATHNAME=/reset-password

## correos
SUPPORT_EMAIL=support@cursala.com.ar
NO_REPLY_EMAIL=noreply@cursala.com.ar
INFO_EMAIL=info@cursala.com.ar
ADMINISTRATION_EMAIL=administracion@cursala.com.ar

# ========================================
# BUNNY.NET CONFIGURATION - CURSALA
# ========================================
# ✅ Configuración lista para usar

# --- Storage Zone (para imágenes estáticas) ---
BUNNY_STORAGE_API_KEY=d2b4a8ff-f7c6-454c-bb31d8a11dbb-c812-4eb7
BUNNY_STORAGE_ZONE_NAME=cursala
BUNNY_STORAGE_REGION=br
BUNNY_STORAGE_CDN_HOSTNAME=https://cursala.b-cdn.net

# --- Stream Library (para videos con streaming adaptativo) ---
BUNNY_STREAM_API_KEY=8a4a1acf-4632-4738-a89717344b1b-351f-402a
BUNNY_STREAM_LIBRARY_ID=549984
BUNNY_STREAM_CDN_HOSTNAME=https://vz-19135c35-e7f.b-cdn.net
BUNNY_STREAM_API_URL=https://video.bunnycdn.com/library/549984/videos
