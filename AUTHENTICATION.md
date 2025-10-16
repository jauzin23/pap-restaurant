# Sistema de Renovação Automática de Tokens

## 🔐 Funcionalidades Implementadas

### 1. **Renovação Automática de Tokens**

- ✅ Intercepta automaticamente respostas 401/403
- ✅ Tenta renovar o token usando refresh token
- ✅ Repete a requisição original após renovação
- ✅ Previne múltiplas tentativas simultâneas de renovação

### 2. **Gestão Inteligente de Estados**

- ✅ Tokens de acesso e refresh armazenados separadamente
- ✅ Limpeza automática em caso de falha
- ✅ Redirecionamento automático para login quando necessário

### 3. **Hooks e Contextos React**

- ✅ `useAuth()` - Hook principal de autenticação
- ✅ `AuthProvider` - Contexto global de autenticação
- ✅ `ProtectedRoute` - Componente para proteger rotas
- ✅ `useTokenRefreshNotification()` - Notificações visuais

### 4. **Notificações de Estado**

- ✅ Indicadores visuais de renovação em progresso
- ✅ Feedback de sucesso/erro
- ✅ Auto-dismiss para mensagens de sucesso

## 🚀 Como Usar

### Configuração Básica

```jsx
// 1. Wrap sua aplicação com AuthProvider
import { AuthProvider } from "@/contexts/AuthContext";

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}

// 2. Use o hook de autenticação
import { useAuthContext } from "@/contexts/AuthContext";

function MyComponent() {
  const { isAuthenticated, user, login, logout } = useAuthContext();

  // Seu código aqui...
}

// 3. Proteja rotas sensíveis
import { ProtectedRoute } from "@/contexts/AuthContext";

function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
```

### Uso Avançado

```jsx
// Verificação manual de expiração
import { isTokenLikelyExpired, refreshTokenIfNeeded } from "@/lib/auth";

async function beforeImportantAction() {
  const refreshed = await refreshTokenIfNeeded();
  if (refreshed) {
    // Continuar com a ação
  }
}

// HOC para proteção de componentes
import { withAuth } from "@/hooks/useAuth";

const ProtectedComponent = withAuth(MyComponent);
```

## 🔧 API de Backend Necessária

O sistema espera os seguintes endpoints:

```javascript
// POST /auth/login
// Body: { email, password }
// Response: {
//   access_token: "jwt_token",
//   refresh_token: "refresh_token",
//   user: { ... }
// }

// POST /auth/refresh
// Headers: Authorization: Bearer <refresh_token>
// Response: {
//   access_token: "new_jwt_token",
//   refresh_token: "new_refresh_token" // opcional
// }

// GET /auth/me
// Headers: Authorization: Bearer <access_token>
// Response: { user: { ... } }

// POST /auth/logout
// Headers: Authorization: Bearer <access_token>
// Response: { success: true }
```

## 🎯 Fluxo de Renovação

1. **Requisição Normal**: API call com token atual
2. **Token Expirado**: Servidor retorna 401/403
3. **Interceptação**: Sistema detecta erro de autenticação
4. **Renovação**: Chama `/auth/refresh` com refresh token
5. **Retry**: Repete requisição original com novo token
6. **Fallback**: Se renovação falha, logout automático

## ⚡ Performance e UX

- **Zero Interrupção**: Usuário não percebe a renovação
- **Notificações Discretas**: Feedback visual opcional
- **Prevenção de Conflitos**: Evita múltiplas renovações simultâneas
- **Fallback Gracioso**: Redirecionamento suave em caso de falha

## 🛠️ Personalização

### Intervalo de Verificação

```javascript
// No useAuth hook, altere o intervalo (padrão: 5 minutos)
const interval = setInterval(async () => {
  // Verificação periódica
}, 5 * 60 * 1000); // Altere aqui
```

### Estilo das Notificações

```jsx
// Personalize em TokenRefreshNotification.jsx
const getBackgroundColor = () => {
  switch (type) {
    case "loading":
      return "bg-blue-500";
    case "success":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    // Adicione seus estilos aqui
  }
};
```

## 🔍 Debug e Logs

O sistema inclui logs detalhados:

- `API Request:` - Detalhes da requisição
- `Token appears to be expired` - Detecção de expiração
- `Token refreshed successfully` - Renovação bem-sucedida
- `Token refresh failed:` - Erros de renovação

## 📝 Notas Importantes

1. **Compatibilidade**: Funciona com tokens JWT e refresh tokens
2. **Storage**: Usa localStorage (pode ser adaptado para cookies)
3. **SSR**: Handles server-side rendering gracefully
4. **Mobile**: Funciona em PWAs e aplicações mobile

## 🎉 Benefícios

- ✅ **Experiência Seamless**: Usuário nunca vê erros de token
- ✅ **Segurança**: Tokens renovados automaticamente
- ✅ **Desenvolvimento**: Menos código de tratamento de erro
- ✅ **Manutenção**: Sistema centralizado e reutilizável
