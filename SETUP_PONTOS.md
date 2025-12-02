# CONFIGURAÇÃO RÁPIDA - Sistema de Pontos

## ⚠️ ERRO: "Erro ao carregar configurações"

Se você está vendo este erro, significa que as tabelas de pontos ainda não foram criadas no banco de dados.

## 🔧 SOLUÇÃO RÁPIDA

### Opção 1: Executar SQL via Terminal

```bash
# Conectar ao PostgreSQL
psql -U seu_usuario -d nome_do_banco

# Copiar e colar TODO o conteúdo do arquivo:
# api/database/setup_points_simple.sql
```

### Opção 2: Executar SQL via pgAdmin ou DBeaver

1. Abrir pgAdmin ou DBeaver
2. Conectar ao banco de dados
3. Abrir o arquivo `api/database/setup_points_simple.sql`
4. Executar todo o script

### Opção 3: Comando Direto

```bash
psql -U seu_usuario -d nome_do_banco -f api/database/setup_points_simple.sql
```

## ✅ Verificar se Funcionou

Depois de executar o SQL, execute esta query:

```sql
SELECT COUNT(*) FROM points_config;
```

Deve retornar **14 registros**.

## 🎯 Acessar a Página

1. Fazer login como **Gestor**
2. Ir para a página de **Leaderboard/Pontos**
3. Clicar em **"Configurar Sistema de Pontos"**

## 📋 O que foi Criado

### Tabelas

- `points_config` - Configurações de pontos
- `user_points_history` - Histórico de pontos dos utilizadores

### Dados Iniciais (14 ações)

**Ações Positivas:**

- order_accepted: +5 pts
- order_prepared: +8 pts
- order_delivered: +10 pts
- order_completed_fast: +15 pts
- order_created: +3 pts
- table_cleaned: +5 pts
- shift_completed: +10 pts
- perfect_day: +50 pts

**Penalizações:**

- order_cancelled: -10 pts
- order_delayed: -5 pts
- customer_complaint: -15 pts
- late_arrival: -8 pts
- missed_shift: -30 pts
- order_error: -12 pts

## 🔐 Permissões

Apenas utilizadores com cargo **"Gestor"** ou label **"manager"** podem:

- Ver o botão de configuração
- Editar valores de pontos
- Ativar/desativar ações

## 🆘 Ainda com Problemas?

1. **Verificar se o servidor da API está rodando**

   ```bash
   cd api
   npm start
   ```

2. **Verificar variáveis de ambiente** (arquivo `.env`)

   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/database
   JWT_SECRET=sua_chave_secreta
   ```

3. **Verificar console do navegador** (F12)

   - Procurar por erros na aba Console
   - Verificar chamadas de API na aba Network

4. **Verificar logs do servidor**
   - Console onde o servidor está rodando
   - Procurar por erros de conexão com banco de dados

## 📞 Comandos Úteis

```bash
# Ver tabelas existentes
psql -U seu_usuario -d nome_do_banco -c "\dt"

# Ver dados da tabela points_config
psql -U seu_usuario -d nome_do_banco -c "SELECT * FROM points_config;"

# Deletar e recriar (use com cuidado!)
psql -U seu_usuario -d nome_do_banco -c "DROP TABLE IF EXISTS user_points_history CASCADE; DROP TABLE IF EXISTS points_config CASCADE;"
```
