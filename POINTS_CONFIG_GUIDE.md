# Sistema de Pontos - Configuração para Gestores

## Visão Geral

Sistema completo de gestão de pontos que permite aos gestores configurar valores de pontos para diferentes ações dos funcionários.

## Funcionalidades

### Para Gestores

1. **Visualizar Configurações**

   - Ver todas as ações e seus valores de pontos
   - Configurações agrupadas por categoria (Ações Básicas, Penalizações)
   - Ver descrição de cada ação

2. **Editar Pontos**

   - Modificar o valor de pontos de qualquer ação
   - Intervalo permitido: -1000 a +1000 pontos
   - Ativar/desativar ações específicas

3. **Gestão em Tempo Real**
   - Todas as alterações são aplicadas imediatamente
   - Feedback visual de sucesso/erro
   - Atualizações refletidas instantaneamente no sistema

## Como Usar

### Acesso

1. Fazer login como gestor
2. Navegar para a área de gestão
3. Clicar no botão **"Configurar Sistema de Pontos"**

### Editar uma Configuração

1. Localizar a ação que deseja editar
2. Clicar no botão **"Editar"** na linha correspondente
3. Modificar:
   - **Valor de pontos** (campo numérico)
   - **Estado** (ativo/inativo via toggle)
4. Clicar em **"Guardar"** para aplicar as alterações
5. Ou clicar em **"X"** para cancelar

### Ações Disponíveis

#### Ações Básicas (Pontos Positivos)

- `order_accepted` - Pedido aceite (padrão: +5)
- `order_prepared` - Pedido preparado (padrão: +8)
- `order_delivered` - Pedido entregue (padrão: +10)
- `order_completed_fast` - Pedido rápido (padrão: +15)
- `order_created` - Pedido criado (padrão: +3)
- `table_cleaned` - Mesa limpa (padrão: +5)
- `shift_completed` - Turno completado (padrão: +10)
- `perfect_day` - Dia perfeito (padrão: +50)

#### Penalizações (Pontos Negativos)

- `order_cancelled` - Pedido cancelado (padrão: -10)
- `order_delayed` - Pedido atrasado (padrão: -5)
- `customer_complaint` - Reclamação (padrão: -15)
- `late_arrival` - Atraso (padrão: -8)
- `missed_shift` - Falta (padrão: -30)
- `order_error` - Erro no pedido (padrão: -12)

## Estrutura Técnica

### Backend

#### Endpoints da API

1. **GET /api/points/config**
   - Listar todas as configurações
   - Requer autenticação de gestor
2. **PUT /api/points/config/:action_type**

   - Atualizar configuração específica
   - Requer autenticação de gestor
   - Body: `{ points_value: number, is_active: boolean }`

3. **GET /api/points/leaderboard**

   - Ranking de utilizadores
   - Parâmetros: `period` (day/week/month/all), `limit`, `month`

4. **GET /api/points/user/:user_id**

   - Pontos e histórico de um utilizador
   - Parâmetros: `limit`, `month`

5. **GET /api/points/stats**
   - Estatísticas gerais do sistema

#### Tabelas do Banco de Dados

1. **points_config**

   ```sql
   - action_type (PK)
   - points_value
   - description
   - category
   - is_active
   - created_at
   - updated_at
   ```

2. **user_points_history**
   ```sql
   - id (PK)
   - user_id (FK)
   - action_type (FK)
   - points_earned
   - description
   - related_order_id (FK)
   - created_at
   ```

#### Funções SQL Úteis

- `award_points(user_id, action_type, description, order_id)` - Atribuir pontos
- `get_user_rank(user_id, period)` - Obter ranking

### Frontend

#### Componente Principal

- **PointsConfigManager.jsx** - Interface de configuração
- **PointsConfigManager.scss** - Estilos do componente

#### Integração

- Botão na área do gestor (ManagerView)
- Toggle entre estatísticas e configuração de pontos
- Usa token JWT para autenticação

## Instalação

### 1. Executar SQL de Criação

```bash
# Conectar ao PostgreSQL
psql -U seu_usuario -d pap_restaurant

# Executar script
\i api/database/points_system.sql
```

### 2. Verificar Variáveis de Ambiente

Certifique-se de que o `.env` tem:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pap_restaurant
JWT_SECRET=sua_chave_secreta
```

### 3. Reiniciar o Servidor

```bash
cd api
npm install
npm start
```

## Segurança

- ✅ Apenas gestores podem editar configurações
- ✅ Validação de valores (-1000 a +1000)
- ✅ Autenticação JWT obrigatória
- ✅ Logs de todas as alterações
- ✅ Proteção contra SQL injection

## Fluxo de Trabalho

```
1. Utilizador realiza ação (ex: aceita pedido)
   ↓
2. Sistema detecta ação
   ↓
3. Consulta points_config para valor de pontos
   ↓
4. Verifica se ação está ativa (is_active = true)
   ↓
5. Insere registro em user_points_history
   ↓
6. Atualiza total de pontos do utilizador
   ↓
7. Emite evento WebSocket (opcional)
   ↓
8. Frontend atualiza em tempo real
```

## Exemplos de Uso

### Aumentar pontos para pedidos rápidos

```javascript
// PUT /api/points/config/order_completed_fast
{
  "points_value": 20  // aumentar de 15 para 20
}
```

### Desativar penalização por atraso

```javascript
// PUT /api/points/config/late_arrival
{
  "is_active": false
}
```

### Ajustar múltiplos valores

Edite cada ação individualmente através da interface

## Troubleshooting

### Erro: "Configuração não encontrada"

- Verificar se `action_type` existe na tabela `points_config`
- Executar novamente o SQL inicial

### Erro: "Não autorizado"

- Verificar se utilizador é gestor
- Verificar token JWT válido
- Verificar permissões no banco de dados

### Alterações não aparecem

- Verificar conexão com banco de dados
- Verificar console do navegador para erros
- Atualizar a página

## Roadmap Futuro

- [ ] Histórico de alterações de configuração
- [ ] Importar/exportar configurações
- [ ] Templates de configuração predefinidos
- [ ] Notificações aos funcionários quando pontos mudam
- [ ] Gráficos de distribuição de pontos
- [ ] Simulador de impacto de alterações

## Suporte

Para questões ou problemas:

1. Verificar logs do servidor: `api/logs/`
2. Verificar console do navegador (F12)
3. Consultar documentação da API: `api/STATISTICS_API_SPEC.md`
