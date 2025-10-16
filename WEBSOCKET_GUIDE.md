# 🔌 Guia de WebSocket - Sistema em Tempo Real

## 📋 Visão Geral

Sistema WebSocket profissional implementado com Socket.IO para atualizações em tempo real de:
- ✅ Pedidos (Orders)
- ✅ Mesas (Tables)
- ✅ Layouts de Mesas
- ✅ Itens de Menu

## 🔐 Autenticação

O WebSocket requer autenticação JWT. O token deve ser enviado na conexão.

### Exemplo de Conexão (Frontend)

```javascript
import { io } from 'socket.io-client';

const token = localStorage.getItem('token'); // ou onde guardas o token

const socket = io('http://localhost:3001', {
  auth: {
    token: token
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Verificar conexão
socket.on('connect', () => {
  console.log('✅ Conectado ao WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado:', reason);
});
```

## 📡 Eventos Disponíveis

### 🍽️ Pedidos (Orders)

#### Eventos Recebidos:
- `order:created` - Novo pedido criado
- `order:updated` - Pedido atualizado (status, notas)
- `order:deleted` - Pedido eliminado

```javascript
// Ouvir criação de pedidos
socket.on('order:created', (order) => {
  console.log('Novo pedido:', order);
  // Adicionar à lista de pedidos
  setOrders(prev => [...prev, order]);
});

// Ouvir atualizações de pedidos
socket.on('order:updated', (order) => {
  console.log('Pedido atualizado:', order);
  // Atualizar pedido na lista
  setOrders(prev => prev.map(o => o.id === order.id ? order : o));
});

// Ouvir eliminação de pedidos
socket.on('order:deleted', ({ id }) => {
  console.log('Pedido eliminado:', id);
  // Remover da lista
  setOrders(prev => prev.filter(o => o.id !== id));
});
```

### 🪑 Mesas (Tables)

#### Eventos Recebidos:
- `table:created` - Nova mesa criada
- `table:updated` - Mesa atualizada
- `table:deleted` - Mesa eliminada

```javascript
socket.on('table:created', (table) => {
  console.log('Nova mesa:', table);
  setTables(prev => [...prev, table]);
});

socket.on('table:updated', (table) => {
  console.log('Mesa atualizada:', table);
  setTables(prev => prev.map(t => t.id === table.id ? table : t));
});

socket.on('table:deleted', ({ id }) => {
  console.log('Mesa eliminada:', id);
  setTables(prev => prev.filter(t => t.id !== id));
});
```

### 🗺️ Layouts

#### Eventos Recebidos:
- `layout:created` - Novo layout criado (apenas managers)
- `layout:updated` - Layout atualizado
- `layout:deleted` - Layout eliminado

```javascript
socket.on('layout:created', (layout) => {
  console.log('Novo layout:', layout);
  setLayouts(prev => [...prev, layout]);
});

socket.on('layout:updated', (layout) => {
  console.log('Layout atualizado:', layout);
  setLayouts(prev => prev.map(l => l.id === layout.id ? layout : l));
});

socket.on('layout:deleted', ({ id }) => {
  console.log('Layout eliminado:', id);
  setLayouts(prev => prev.filter(l => l.id !== id));
});
```

### 🍕 Menu

#### Eventos Recebidos:
- `menu:created` - Novo item de menu
- `menu:updated` - Item de menu atualizado
- `menu:deleted` - Item de menu eliminado

```javascript
socket.on('menu:created', (item) => {
  console.log('Novo item de menu:', item);
  setMenuItems(prev => [...prev, item]);
});

socket.on('menu:updated', (item) => {
  console.log('Item de menu atualizado:', item);
  setMenuItems(prev => prev.map(i => i.id === item.id ? item : i));
});

socket.on('menu:deleted', ({ id }) => {
  console.log('Item de menu eliminado:', id);
  setMenuItems(prev => prev.filter(i => i.id !== id));
});
```

## 🎯 Subscrição a Recursos Específicos

### Subscrever a Mesa Específica

Útil para páginas de detalhes de mesa:

```javascript
// Subscrever
socket.emit('subscribe:table', tableId);

// Desssubscrever ao sair da página
socket.emit('unsubscribe:table', tableId);
```

### Subscrever a Layout Específico

```javascript
// Subscrever
socket.emit('subscribe:layout', layoutId);

// Desssubscrever
socket.emit('unsubscribe:layout', layoutId);
```

## 🔄 Exemplo Completo - React Hook

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) return;

    const newSocket = io('http://localhost:3001', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, connected };
};

// Usar no componente:
function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const { socket, connected } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    // Ouvir eventos
    socket.on('order:created', (order) => {
      setOrders(prev => [...prev, order]);
    });

    socket.on('order:updated', (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });

    socket.on('order:deleted', ({ id }) => {
      setOrders(prev => prev.filter(o => o.id !== id));
    });

    // Cleanup
    return () => {
      socket.off('order:created');
      socket.off('order:updated');
      socket.off('order:deleted');
    };
  }, [socket]);

  return (
    <div>
      {connected && <div>🟢 Ligado em tempo real</div>}
      {/* ... resto do componente */}
    </div>
  );
}
```

## 🏢 Rooms (Salas)

O sistema usa rooms automáticas:

### Rooms Globais (todos os utilizadores):
- `orders` - Recebe todos os eventos de pedidos
- `tables` - Recebe todos os eventos de mesas
- `menu` - Recebe todos os eventos de menu

### Rooms Especiais:
- `managers` - Apenas gestores (recebe eventos de criação de layouts)
- `table:{tableId}` - Eventos específicos de uma mesa
- `layout:{layoutId}` - Eventos específicos de um layout

## 🚀 Otimizações

### 1. Desconectar ao sair
```javascript
useEffect(() => {
  return () => {
    if (socket) socket.close();
  };
}, [socket]);
```

### 2. Throttling de Updates
```javascript
import { throttle } from 'lodash';

const handleOrderUpdate = throttle((order) => {
  setOrders(prev => prev.map(o => o.id === order.id ? order : o));
}, 100); // Max 1 update a cada 100ms

socket.on('order:updated', handleOrderUpdate);
```

### 3. Apenas Subscrever ao Necessário
```javascript
// Subscrever apenas quando necessário
useEffect(() => {
  if (currentTableId) {
    socket.emit('subscribe:table', currentTableId);
  }

  return () => {
    if (currentTableId) {
      socket.emit('unsubscribe:table', currentTableId);
    }
  };
}, [currentTableId, socket]);
```

## 🔧 Ping/Pong (Keep-Alive)

O servidor mantém conexões ativas com ping/pong automático (configurado para 25s).

Se quiseres implementar ping manual:

```javascript
// Cliente envia ping
socket.emit('ping');

// Servidor responde com pong
socket.on('pong', () => {
  console.log('Pong recebido');
});
```

## 📊 Estrutura de Dados dos Eventos

### Order
```typescript
{
  $id: string;
  id: string;
  table_id: string[];
  menu_item_id: string;
  status: 'pendente' | 'aceite' | 'pronto' | 'a ser entregue' | 'entregue' | 'completo' | 'cancelado';
  notas: string | null;
  created_at: string;
}
```

### Table
```typescript
{
  id: string;
  layout_id: string;
  table_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  chairs_top: boolean;
  chairs_bottom: boolean;
  chairs_left: boolean;
  chairs_right: boolean;
  chairs_count: number;
  created_at: string;
  updated_at: string;
}
```

### Layout
```typescript
{
  id: string;
  name: string;
  width: number;
  height: number;
  tables: Table[];
  created_at: string;
  updated_at: string;
}
```

### Menu Item
```typescript
{
  $id: string;
  id: string;
  nome: string;
  preco: number;
  description: string | null;
  category: string | null;
  tags: string[];
  ingredientes: string[];
  image_id: string | null;
  created_at: string;
}
```

## 🐛 Debugging

### Logs do Servidor
O servidor faz log de:
- ✅ Conexões: `Cliente conectado: username (socket_id)`
- ❌ Desconexões: `Cliente desconectado: username - Razão: ...`
- 📍 Subscrições: `username subscreveu à mesa table_id`
- 🗺️ Subscrições: `username subscreveu ao layout layout_id`

### Logs do Cliente
```javascript
// Ativar logs de debug do Socket.IO
const socket = io('http://localhost:3001', {
  auth: { token },
  transports: ['websocket', 'polling'],
  debug: true // Logs detalhados
});

// Log de todos os eventos
socket.onAny((eventName, ...args) => {
  console.log(`📨 Evento recebido: ${eventName}`, args);
});
```

## ⚡ Performance

- **Ping Interval**: 25 segundos
- **Ping Timeout**: 60 segundos
- **Reconnection**: Automática (5 tentativas com delay de 1s)
- **Transport**: WebSocket com fallback para polling

## 🔒 Segurança

- ✅ Autenticação JWT obrigatória
- ✅ Verificação de token em cada conexão
- ✅ Rooms baseadas em permissões (managers)
- ✅ Validação de UUIDs nas subscrições
- ✅ Isolamento de eventos por utilizador

---

**Desenvolvido com ❤️ para sistema PAP**
