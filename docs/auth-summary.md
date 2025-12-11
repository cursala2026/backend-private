# Resumen de Autenticación (Auth)

Breve referencia de las funciones y endpoints relacionados con autenticación en el backend.

- **Rutas (archivo)**: `backend/src/routes/auth.route.ts`
  - `POST /login` → `authController.login` (con `authLimiter`)
  - `POST /reset-password/initiate` → `authController.initiateResetPassword` (con `authLimiter`)
  - `POST /reset-password/complete` → `authController.completeResetPassword` (con `authLimiter`)
  - `GET /current-user` → `authorize` + `authController.currentUser`
  - `POST /register` → `authController.registerUser` (con `authLimiter`)

- **Controlador**: `backend/src/controllers/auth.controller.ts`
  - `login(req, res)` — Valida credenciales y retorna `{ token, userInfo }`.
  - `initiateResetPassword(req, res)` — Genera token de reset y envía correo; devuelve `expiresIn`.
  - `completeResetPassword(req, res)` — Verifica token y actualiza la contraseña.
  - `currentUser(req, res)` — Devuelve información del usuario autenticado (usa `req.user`).
  - `registerUser(req, res)` — Registra nuevo usuario y envía email de bienvenida.

- **Servicio**: `backend/src/services/auth.service.ts` (funciones principales)
  - `validateUser(user, plainTextPassword)` — Verifica existencia y contraseña (bcrypt).
  - `login(user, plainTextPassword)` — Llama a `validateUser`, genera JWT, resuelve roles y arma `userInfo`.
  - `generateResetPasswordToken(email)` — Crea token JWT de reset, guarda en `user.resetPasswordToken`, envía email y retorna `{ token, expiresIn }`.
  - `resetPassword(token, newPassword)` — Verifica token, valida y hashea nueva contraseña, guarda el usuario.
  - `getUserInfo(user)` — Recupera usuario completo (sin password) y sus `features`/roles.
  - `register(user)` — Crea usuario (hashea password), asigna rol por defecto y envía email de bienvenida.
  - Métodos auxiliares: `resolveRoleCodes`, `validatePassword`, `hashPassword`.

- **Middleware / Autenticación**: `backend/src/middlewares/auth.middleware.ts`
  - `passport` configurado con `JwtStrategy` y `ExtractJwt.fromAuthHeaderAsBearerToken()`.
  - `authorize(req,res,next)` — Middleware que autentica la petición y setea `req.user`. Maneja token expirado/ inválido.

- **Rate limiter**: `backend/src/middlewares/rateLimit.middleware.ts`
  - `authLimiter` — Límite de intentos aplicados a endpoints sensibles (`/login`, `/register`, `/reset-password/*`).

- **Modelo**: `backend/src/models/user.model.ts`
  - Campos relevantes: `password`, `resetPasswordToken`.

Uso rápido / ejemplos:

- Login (request):

```
POST /login
Content-Type: application/json
{
  "user": "usuario_o_email",
  "password": "contraseña"
}
```

- Login (response exitoso):

```
{
  "status": 200,
  "message": "Successful operation",
  "data": { "token": "<JWT>", "userInfo": { /* ... */ } }
}
```

Archivo generado automáticamente como resumen; pide si quieres que incluya ejemplos curl completos o documentación en OpenAPI/Markdown más detallada.
