# AI Restaurant Analysis - Implementation Plan

## Architecture Overview

**UI Pattern**: Sidebar tab (like Menu, Stock, Presencas) instead of dashboard widget
**Data Flow**: Month selector → Show all analyses for that month → Click to view full analysis
**Multiple Analyses**: Each month can have multiple analyses (auto + manual regenerations)

## 1. Database Schema

### Single Table: `analises_ai`

```sql
CREATE TABLE analises_ai (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Period Information
  mes SMALLINT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano SMALLINT NOT NULL CHECK (ano >= 2020 AND ano <= 2100),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  
  -- Analysis Status
  status VARCHAR(20) NOT NULL DEFAULT 'processando' 
    CHECK (status IN ('processando', 'concluido', 'erro', 'cancelado')),
  
  -- AI Data (JSONB for complex nested structures)
  dados_resposta JSONB,               -- Full AI response with metadata + components
  dados_entrada JSONB,                -- Input data sent to AI (from getMonthlyInsightsData)
  
  -- AI Configuration (snapshot at time of generation)
  modelo_ai VARCHAR(100) NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
  tokens_input INTEGER,               -- Input tokens used
  tokens_output INTEGER,              -- Output tokens used  
  tokens_total INTEGER,               -- Total tokens (for cost tracking)
  tempo_processamento_ms INTEGER,     -- Processing time in milliseconds
  
  -- Error Handling
  erro_mensagem TEXT,                 -- Detailed error if status = 'erro'
  tentativas INTEGER DEFAULT 1,       -- Number of retry attempts
  
  -- Metadata
  titulo VARCHAR(255),                -- Quick access: dados_resposta->metadata->titulo
  resumo_executivo TEXT,              -- Quick access: dados_resposta->metadata->resumo_executivo
  
  -- Audit Fields
  criado_automaticamente BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  atualizado_em TIMESTAMP WITH TIME ZONE,
  
  -- Performance Indexes
  CONSTRAINT unique_analysis_per_generation UNIQUE (mes, ano, criado_em)
);

-- Indexes for fast queries
CREATE INDEX idx_analises_ai_periodo ON analises_ai(ano DESC, mes DESC, criado_em DESC);
CREATE INDEX idx_analises_ai_status ON analises_ai(status) WHERE status = 'processando';
CREATE INDEX idx_analises_ai_criado_em ON analises_ai(criado_em DESC);
CREATE INDEX idx_analises_ai_mes_ano ON analises_ai(mes, ano);

-- GIN index for JSONB searching (optional but useful for filtering components)
CREATE INDEX idx_analises_ai_dados_resposta ON analises_ai USING GIN (dados_resposta);

-- Comments for documentation
COMMENT ON TABLE analises_ai IS 'AI-generated monthly restaurant analysis reports';
COMMENT ON COLUMN analises_ai.dados_resposta IS 'Full JSON response from AI including metadata and components array';
COMMENT ON COLUMN analises_ai.dados_entrada IS 'Complete input data from getMonthlyInsightsData function';
COMMENT ON COLUMN analises_ai.tokens_total IS 'Total tokens used for cost tracking (input + output)';
COMMENT ON COLUMN analises_ai.titulo IS 'Cached title from dados_resposta for list views';
COMMENT ON COLUMN analises_ai.resumo_executivo IS 'Cached executive summary for preview';
```

### Column Sizing Rationale:
- **VARCHAR(20)** for status: Max length "processando" = 12 chars
- **VARCHAR(100)** for modelo_ai: "claude-3-5-sonnet-20241022" = 28 chars, room for future models
- **VARCHAR(255)** for titulo: Typical title length
- **TEXT** for resumo_executivo/erro_mensagem: Unlimited length
- **JSONB** for dados: Binary JSON format, faster queries, supports indexing
- **SMALLINT** for mes/ano: 2 bytes, range -32768 to +32767 (sufficient)
- **INTEGER** for tokens/tempo: 4 bytes, range ±2 billion
- **UUID** standard: 128-bit identifier
- **TIMESTAMP WITH TIME ZONE**: Always use timezone-aware timestamps

### Environment Variables (.env)
```bash
# AI Analysis Configuration
AI_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
AI_AUTO_RUN=true
AI_SCHEDULE_HOUR=2
AI_MAX_TOKENS=16000
AI_TEMPERATURE=0.7
AI_NOTIFY_MANAGERS=true
```

## 2. Backend Implementation

### File Structure
```
api/src/
├── rotas/
│   └── analises-ai.js              -- New route file
├── servicos/
│   ├── analise-ai.js               -- AI analysis service
│   ├── dados-mensais.js            -- Your getMonthlyInsightsData function
│   └── agendador-analises.js       -- Cron scheduler
└── utilitarios/
    └── cliente-ai.js               -- Anthropic client
```

### 2.1. Monthly Data Service (`api/src/servicos/dados-mensais.js`)

```javascript
const pool = require("../configuracao/database");

/**
 * Your existing getMonthlyInsightsData function
 * Copy the entire function you provided
 */
async function getMonthlyInsightsData(year, month) {
  // ... paste your entire function here ...
  // This returns the comprehensive data object
}

module.exports = { getMonthlyInsightsData };
```

### 2.2. API Routes (`api/src/rotas/analises-ai.js`)

```javascript
const express = require('express');
const router = express.Router();
const { verificarAutenticacao, verificarGestor } = require('../intermediarios/autenticacao');
const servicoAnaliseAI = require('../servicos/analise-ai');

// Get all analyses for a specific month/year
router.get('/analises-ai/:ano/:mes', verificarAutenticacao, async (req, res) => {
  try {
    const { ano, mes } = req.params;
    const analises = await servicoAnaliseAI.listarAnalisesPorMes(ano, mes);
    res.json(analises);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// Get single analysis by ID
router.get('/analises-ai/detalhes/:id', verificarAutenticacao, async (req, res) => {
  try {
    const analise = await servicoAnaliseAI.obterAnalisePorId(req.params.id);
    if (!analise) {
      return res.status(404).json({ erro: 'Análise não encontrada' });
    }
    res.json(analise);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// Get list of available months (that have at least one analysis)
router.get('/analises-ai/meses-disponiveis', verificarAutenticacao, async (req, res) => {
  try {
    const meses = await servicoAnaliseAI.listarMesesDisponiveis();
    res.json(meses);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// Trigger manual analysis (Manager only)
router.post('/analises-ai/executar', verificarGestor, async (req, res) => {
  try {
    const { mes, ano } = req.body;
    const userId = req.user.id;
    
    if (!mes || !ano) {
      return res.status(400).json({ erro: 'Mês e ano são obrigatórios' });
    }
    
    // Validate month/year
    if (mes < 1 || mes > 12 || ano < 2020 || ano > 2100) {
      return res.status(400).json({ erro: 'Mês ou ano inválido' });
    }
    
    // Start async analysis
    const analiseId = await servicoAnaliseAI.executarAnalise({
      mes: parseInt(mes),
      ano: parseInt(ano),
      criadoPor: userId,
      automatico: false
    });
    
    res.json({ 
      mensagem: 'Análise iniciada',
      analise_id: analiseId,
      estimativa: '30-90 segundos'
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// Check analysis status (for polling during generation)
router.get('/analises-ai/status/:id', verificarAutenticacao, async (req, res) => {
  try {
    const status = await servicoAnaliseAI.verificarStatus(req.params.id);
    res.json(status);
  } catch (erro) {
    res.status(404).json({ erro: 'Análise não encontrada' });
  }
});

// Delete analysis (Manager only)
router.delete('/analises-ai/:id', verificarGestor, async (req, res) => {
  try {
    await servicoAnaliseAI.deletarAnalise(req.params.id);
    res.json({ mensagem: 'Análise deletada' });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// Get latest analysis (for quick access)
router.get('/analises-ai/latest', verificarAutenticacao, async (req, res) => {
  try {
    const analise = await servicoAnaliseAI.obterUltimaAnalise();
    res.json(analise);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

module.exports = router;
```

### 2.3. AI Analysis Service (`api/src/servicos/analise-ai.js`)

```javascript
const pool = require('../configuracao/database');
const clienteAI = require('../utilitarios/cliente-ai');
const { getMonthlyInsightsData } = require('./dados-mensais');

class ServicoAnaliseAI {
  
  async executarAnalise({ mes, ano, criadoPor = null, automatico = false }) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const periodoInicio = new Date(ano, mes - 1, 1);
      const periodoFim = new Date(ano, mes, 0, 23, 59, 59);
      
      // Create pending record
      const { rows: [analise] } = await client.query(`
        INSERT INTO analises_ai 
        (mes, ano, periodo_inicio, periodo_fim, status, criado_por, criado_automaticamente, modelo_ai)
        VALUES ($1, $2, $3, $4, 'processando', $5, $6, $7)
        RETURNING id
      `, [
        mes,
        ano,
        periodoInicio,
        periodoFim,
        criadoPor,
        automatico,
        process.env.AI_MODEL || 'claude-3-5-sonnet-20241022'
      ]);
      
      await client.query('COMMIT');
      
      // Process async (don't wait)
      this.processarAnaliseAsync(analise.id, mes, ano).catch(console.error);
      
      return analise.id;
      
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  }
  
  async processarAnaliseAsync(analiseId, mes, ano) {
    const startTime = Date.now();
    const client = await pool.connect();
    
    try {
      console.log(`[AI Analysis ${analiseId}] Agregando dados para ${mes}/${ano}...`);
      
      // 1. Aggregate data using your function
      const dadosEntrada = await getMonthlyInsightsData(ano, mes);
      
      console.log(`[AI Analysis ${analiseId}] Chamando AI...`);
      
      // 2. Call AI API
      const resposta = await clienteAI.analisarRestaurante({
        dados: dadosEntrada,
        modelo: process.env.AI_MODEL
      });
      
      const tempoProcessamento = Date.now() - startTime;
      
      // 3. Extract title and summary for caching
      const titulo = resposta.data?.metadata?.titulo || `Análise ${mes}/${ano}`;
      const resumo = resposta.data?.metadata?.resumo_executivo || '';
      
      // 4. Save result
      await client.query(`
        UPDATE analises_ai 
        SET 
          status = 'concluido',
          dados_resposta = $1,
          dados_entrada = $2,
          tokens_input = $3,
          tokens_output = $4,
          tokens_total = $5,
          tempo_processamento_ms = $6,
          titulo = $7,
          resumo_executivo = $8,
          atualizado_em = NOW()
        WHERE id = $9
      `, [
        JSON.stringify(resposta.data),
        JSON.stringify(dadosEntrada),
        resposta.tokensInput || 0,
        resposta.tokensOutput || 0,
        resposta.tokensTotal || 0,
        tempoProcessamento,
        titulo,
        resumo,
        analiseId
      ]);
      
      console.log(`[AI Analysis ${analiseId}] ✅ Concluído em ${tempoProcessamento}ms`);
      console.log(`[AI Analysis ${analiseId}] 📊 Tokens: ${resposta.tokensTotal}`);
      
    } catch (erro) {
      console.error(`[AI Analysis ${analiseId}] ❌ Erro:`, erro);
      
      const tentativa = await client.query(
        'SELECT tentativas FROM analises_ai WHERE id = $1',
        [analiseId]
      );
      
      const numTentativas = (tentativa.rows[0]?.tentativas || 0) + 1;
      
      await client.query(`
        UPDATE analises_ai 
        SET status = 'erro', 
            erro_mensagem = $1, 
            tentativas = $2,
            atualizado_em = NOW()
        WHERE id = $3
      `, [erro.message, numTentativas, analiseId]);
      
    } finally {
      client.release();
    }
  }
  
  async listarAnalisesPorMes(ano, mes) {
    const { rows } = await pool.query(`
      SELECT 
        id,
        mes,
        ano,
        status,
        titulo,
        resumo_executivo,
        criado_automaticamente,
        criado_em,
        tempo_processamento_ms,
        tokens_total,
        modelo_ai
      FROM analises_ai 
      WHERE ano = $1 AND mes = $2
      ORDER BY criado_em DESC
    `, [ano, mes]);
    
    return rows;
  }
  
  async obterAnalisePorId(id) {
    const { rows } = await pool.query(
      'SELECT * FROM analises_ai WHERE id = $1',
      [id]
    );
    
    return rows[0] || null;
  }
  
  async listarMesesDisponiveis() {
    const { rows } = await pool.query(`
      SELECT DISTINCT 
        ano, 
        mes,
        COUNT(*) as num_analises,
        MAX(criado_em) as ultima_analise
      FROM analises_ai 
      WHERE status = 'concluido'
      GROUP BY ano, mes
      ORDER BY ano DESC, mes DESC
      LIMIT 24
    `);
    
    return rows;
  }
  
  async obterUltimaAnalise() {
    const { rows } = await pool.query(`
      SELECT * FROM analises_ai 
      WHERE status = 'concluido'
      ORDER BY criado_em DESC 
      LIMIT 1
    `);
    
    return rows[0] || null;
  }
  
  async verificarStatus(id) {
    const { rows } = await pool.query(
      'SELECT id, status, erro_mensagem, tempo_processamento_ms FROM analises_ai WHERE id = $1',
      [id]
    );
    
    if (rows.length === 0) {
      throw new Error('Análise não encontrada');
    }
    
    return rows[0];
  }
  
  async deletarAnalise(id) {
    await pool.query('DELETE FROM analises_ai WHERE id = $1', [id]);
  }
}

module.exports = new ServicoAnaliseAI();
```

### 2.3. Data Aggregation (`api/src/servicos/agregacao-dados.js`)

```javascript
const pool = require('../configuracao/database');

async function agregarDadosRestaurante(mes, ano) {
  const client = await pool.connect();
  
  try {
    const periodoInicio = new Date(ano, mes - 1, 1);
    const periodoFim = new Date(ano, mes, 0, 23, 59, 59);
    
    // 1. Orders data
    const { rows: pedidos } = await client.query(`
      SELECT 
        p.id,
        p.items,
        p.total,
        p.status,
        p.created_at,
        p.mesa_ids
      FROM pedidos p
      WHERE p.created_at >= $1 AND p.created_at <= $2
      ORDER BY p.created_at
    `, [periodoInicio, periodoFim]);
    
    // 2. Menu items with sales
    const { rows: menuItems } = await client.query(`
      SELECT 
        m.*,
        COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= $1 AND p.created_at <= $2) as vendas_periodo
      FROM menu m
      LEFT JOIN pedidos p ON p.items::jsonb @> jsonb_build_array(jsonb_build_object('id', m.id))
      GROUP BY m.id
    `, [periodoInicio, periodoFim]);
    
    // 3. Stock data
    const { rows: stock } = await client.query('SELECT * FROM stock');
    
    // 4. Calculate statistics
    const stats = calcularEstatisticas(pedidos, menuItems);
    
    return {
      periodo: {
        mes,
        ano,
        inicio: periodoInicio.toISOString(),
        fim: periodoFim.toISOString(),
        dias_operacionais: calcularDiasOperacionais(pedidos)
      },
      pedidos: {
        total: pedidos.length,
        receita_total: pedidos.reduce((sum, p) => sum + parseFloat(p.total || 0), 0),
        ticket_medio: stats.ticketMedio,
        items_vendidos: stats.totalItemsVendidos
      },
      menu: menuItems.map(item => ({
        id: item.id,
        nome: item.nome,
        preco: parseFloat(item.preco),
        category: item.category,
        tags: item.tags,
        ingredientes: item.ingredientes,
        vendas: parseInt(item.vendas_periodo) || 0,
        receita: parseFloat(item.preco) * (parseInt(item.vendas_periodo) || 0)
      })),
      stock: stock.map(s => ({
        nome: s.nome,
        quantidade: parseFloat(s.quantidade),
        unidade: s.unidade,
        valor_unitario: parseFloat(s.valor_unitario || 0),
        valor_total: parseFloat(s.quantidade) * parseFloat(s.valor_unitario || 0),
        categoria: s.categoria
      })),
      categorias: [...new Set(menuItems.map(m => m.category))],
      estatisticas: stats
    };
    
  } finally {
    client.release();
  }
}

function calcularEstatisticas(pedidos, menuItems) {
  const receitaTotal = pedidos.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
  const totalItemsVendidos = pedidos.reduce((sum, p) => {
    return sum + (p.items?.length || 0);
  }, 0);
  
  return {
    ticketMedio: pedidos.length > 0 ? receitaTotal / pedidos.length : 0,
    totalItemsVendidos,
    receitaPorDia: receitaTotal / calcularDiasOperacionais(pedidos)
  };
}

function calcularDiasOperacionais(pedidos) {
  const dias = new Set(pedidos.map(p => 
    new Date(p.created_at).toISOString().split('T')[0]
  ));
  return dias.size || 1;
}

### 2.4. Cron Scheduler (`api/src/utilitarios/agendador-analises.js`)

```javascript
const cron = require('node-cron');
const servicoAnaliseAI = require('../servicos/analise-ai');

// Run on the 1st day of each month at 2 AM
const CRON_EXPRESSION = '0 2 1 * *'; // minute hour day month dayOfWeek

function iniciarAgendador() {
  
  // Only run if enabled in environment
  if (process.env.AI_AUTO_ANALYSIS !== 'true') {
    console.log('[Scheduler] Auto-analysis disabled');
    return;
  }
  
  console.log('[Scheduler] Starting AI analysis scheduler...');
  console.log('[Scheduler] Schedule: 1st of each month at 2:00 AM');
  
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      const now = new Date();
      
      // Analyze previous month
      const mes = now.getMonth() === 0 ? 12 : now.getMonth();
      const ano = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      
      console.log(`[Scheduler] 🤖 Executando análise automática para ${mes}/${ano}...`);
      
      const jobId = await servicoAnaliseAI.executarAnalise({
        mes,
        ano,
        criadoPor: null, // System generated
        automatico: true
      });
      
      console.log(`[Scheduler] ✅ Análise iniciada com ID: ${jobId}`);
      
    } catch (erro) {
      console.error('[Scheduler] ❌ Erro ao executar análise automática:', erro);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Lisbon'
  });
  
  console.log('[Scheduler] ✅ Scheduler ativo');
}

// Manual trigger for testing
async function executarAnaliseManual(mes, ano) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Manual execution only allowed in development');
  }
  
  console.log(`[Manual] Executando análise para ${mes}/${ano}...`);
  
  const jobId = await servicoAnaliseAI.executarAnalise({
    mes,
    ano,
    criadoPor: null,
    automatico: false
  });
  
  return jobId;
}

module.exports = {
  iniciarAgendador,
  executarAnaliseManual
};
```

### 2.5. AI Client Utility (`api/src/utilitarios/cliente-ai.js`)

```javascript
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `Você é um consultor especializado em gestão de restaurantes com expertise em:
- Análise financeira e pricing strategy
- Menu engineering e otimização de cardápio
- Gestão de stock e redução de desperdício
- Análise de performance de pratos
- Identificação de tendências de vendas
- Recomendações estratégicas baseadas em dados

Sua tarefa é analisar os dados mensais fornecidos e retornar APENAS um objeto JSON válido (sem markdown, sem comentários, sem texto adicional) com insights acionáveis e recomendações específicas para o restaurante.

ESTRUTURA OBRIGATÓRIA DO JSON DE RESPOSTA:
{
  "metadata": {
    "titulo": "Análise de [Mês/Ano]",
    "resumo_executivo": "Breve resumo dos principais insights (2-3 frases)",
    "gerado_em": "ISO timestamp"
  },
  "sections": [
    {
      "component": "Hero",
      "props": {
        "title": "Título da Seção",
        "subtitle": "Subtítulo descritivo",
        "icon": "TrendingUp",
        "variant": "success"
      }
    },
    {
      "component": "Matrix",
      "props": {
        "title": "Matriz BCG - Análise de Pratos",
        "items": [
          {
            "title": "Nome do Prato",
            "category": "Stars|CashCows|QuestionMarks|Dogs",
            "icon": "Star",
            "metrics": {
              "vendas": 150,
              "receita": 2250,
              "margem": 65
            },
            "description": "Análise do prato"
          }
        ]
      }
    },
    {
      "component": "Card",
      "props": {
        "title": "Título do Card",
        "icon": "DollarSign",
        "variant": "info|success|warning|danger",
        "content": "Conteúdo do card",
        "metrics": [
          {"label": "Métrica 1", "value": "1234", "change": "+12%"},
          {"label": "Métrica 2", "value": "5678", "change": "-5%"}
        ]
      }
    },
    {
      "component": "Table",
      "props": {
        "title": "Título da Tabela",
        "headers": ["Coluna 1", "Coluna 2", "Coluna 3"],
        "rows": [
          ["Valor 1", "Valor 2", "Valor 3"],
          ["Valor 4", "Valor 5", "Valor 6"]
        ]
      }
    },
    {
      "component": "Chart",
      "props": {
        "title": "Título do Gráfico",
        "type": "bar|line|pie",
        "data": {
          "labels": ["Label 1", "Label 2"],
          "datasets": [{
            "label": "Dataset Label",
            "data": [10, 20]
          }]
        }
      }
    }
  ],
  "recommendations": [
    {
      "title": "Título da Recomendação",
      "priority": "high|medium|low",
      "category": "pricing|menu|stock|operations",
      "description": "Descrição detalhada",
      "expected_impact": "Impacto esperado",
      "action_items": ["Ação 1", "Ação 2"]
    }
  ]
}

CATEGORIAS DA MATRIZ BCG:
- Stars: Alta margem + Altas vendas (ícone Star, ChessKnight, Crown, Trophy)
- CashCows: Alta margem + Baixas vendas (ícone TrendingUp, DollarSign, PiggyBank)
- QuestionMarks: Baixa margem + Altas vendas (ícone HelpCircle, AlertCircle)
- Dogs: Baixa margem + Baixas vendas (ícone AlertTriangle, TrendingDown)

ÍCONES DISPONÍVEIS (lucide-react):
TrendingUp, TrendingDown, DollarSign, Star, AlertCircle, AlertTriangle, 
CheckCircle, XCircle, HelpCircle, Trophy, Target, ChessKnight, Crown, 
Sparkles, Zap, ThumbsUp, ThumbsDown, ArrowUp, ArrowDown, Calendar, 
Package, ShoppingCart, Users, Coffee, UtensilsCrossed, ChefHat, Percent, 
BarChart3, PieChart, LineChart, Activity, TrendingUp`;

async function analisarRestaurante({ dados, modelo }) {
  try {
    const mensagemUsuario = `Analise os seguintes dados do restaurante e retorne insights estratégicos:

${JSON.stringify(dados, null, 2)}

IMPORTANTE: Retorne APENAS o objeto JSON, sem markdown nem explicações.`;

    const response = await anthropic.messages.create({
      model: modelo || process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: parseInt(process.env.AI_MAX_TOKENS) || 8000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: mensagemUsuario
        }
      ]
    });

    // Extract JSON from response
    let jsonText = response.content[0].text;
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse JSON
    const data = JSON.parse(jsonText);

    return {
      data,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      tokensTotal: response.usage.input_tokens + response.usage.output_tokens,
      model: response.model
    };

  } catch (erro) {
    console.error('[AI Client] Erro na chamada API:', erro);
    
    // Provide more specific error information
    if (erro.response) {
      throw new Error(`Anthropic API Error: ${erro.response.status} - ${erro.response.data?.error?.message || 'Unknown error'}`);
    }
    
    if (erro instanceof SyntaxError) {
      throw new Error(`JSON Parse Error: AI response was not valid JSON. Response: ${erro.message}`);
    }
    
    throw erro;
  }
}

module.exports = {
  analisarRestaurante
};
```

## 3. Frontend Implementation

### 3.1. New Sidebar Tab Component

Create a new tab in the sidebar navigation (like Menu, Stock, etc.) for AI Analysis.

**File: `src/app/page.jsx`** (Update sidebar)

```jsx
// Add to sidebar tabs array
const sidebarTabs = [
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed /> },
  { id: 'stock', label: 'Stock', icon: <Package /> },
  { id: 'orders', label: 'Pedidos', icon: <ShoppingCart /> },
  { id: 'analysis', label: 'Análise AI', icon: <Brain /> }, // NEW
  // ... other tabs
];
```

### 3.2. Analysis Tab Component

**File: `src/app/components/AnalysisTab.jsx`**

```jsx
'use client';

import { useState, useEffect } from 'react';
import MonthSelector from './analysis/MonthSelector';
import AnalysisList from './analysis/AnalysisList';
import AnalysisDetail from './analysis/AnalysisDetail';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus } from 'lucide-react';

export default function AnalysisTab() {
  const [selectedMonth, setSelectedMonth] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear()
  });
  
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  useEffect(() => {
    loadAnalyses();
  }, [selectedMonth]);
  
  async function loadAnalyses() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analises-ai/${selectedMonth.ano}/${selectedMonth.mes}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAnalyses(data);
        
        // Auto-select most recent if none selected
        if (!selectedAnalysis && data.length > 0) {
          setSelectedAnalysis(data[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleGenerateNew() {
    setGenerating(true);
    
    try {
      const response = await fetch('/api/analises-ai/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes: selectedMonth.mes,
          ano: selectedMonth.ano
        })
      });
      
      if (response.ok) {
        const { jobId } = await response.json();
        
        // Poll status
        await pollAnalysisStatus(jobId);
        
        // Reload list
        await loadAnalyses();
        setSelectedAnalysis(jobId);
      }
    } catch (error) {
      console.error('Erro ao gerar análise:', error);
      alert('Erro ao gerar análise');
    } finally {
      setGenerating(false);
    }
  }
  
  async function pollAnalysisStatus(jobId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s interval
      
      const response = await fetch(`/api/analises-ai/status/${jobId}`);
      const { status, erro_mensagem } = await response.json();
      
      if (status === 'concluido') {
        return true;
      } else if (status === 'erro') {
        throw new Error(erro_mensagem || 'Erro ao processar análise');
      }
      
      // Update progress indicator
      console.log(`Aguardando análise... (${i + 1}/${maxAttempts})`);
    }
    
    throw new Error('Timeout: Análise demorou muito tempo');
  }
  
  return (
    <div className="analysis-tab">
      <div className="analysis-header">
        <h1>Análise de Restaurante com AI</h1>
        
        <div className="analysis-controls">
          <MonthSelector 
            selected={selectedMonth}
            onChange={setSelectedMonth}
          />
          
          <Button 
            onClick={handleGenerateNew}
            disabled={generating}
          >
            {generating ? (
              <>
                <RefreshCw className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Plus />
                Nova Análise
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="analysis-content">
        <div className="analysis-sidebar">
          <AnalysisList 
            analyses={analyses}
            selected={selectedAnalysis}
            onSelect={setSelectedAnalysis}
            loading={loading}
          />
        </div>
        
        <div className="analysis-main">
          {selectedAnalysis ? (
            <AnalysisDetail analysisId={selectedAnalysis} />
          ) : (
            <div className="analysis-empty">
              <p>Selecione uma análise ou gere uma nova</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3.3. Month Selector Component

**File: `src/app/components/analysis/MonthSelector.jsx`**

```jsx
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MonthSelector({ selected, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  return (
    <div className="month-selector">
      <Select 
        value={selected.mes.toString()}
        onValueChange={(mes) => onChange({ ...selected, mes: parseInt(mes) })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((nome, index) => (
            <SelectItem key={index} value={(index + 1).toString()}>
              {nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select 
        value={selected.ano.toString()}
        onValueChange={(ano) => onChange({ ...selected, ano: parseInt(ano) })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(year => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

### 3.4. Analysis List Component

**File: `src/app/components/analysis/AnalysisList.jsx`**

## 4. Database Migration

Create migration SQL file to set up the database table.

**File: `migrations/003_analises_ai.sql`**

```sql
-- Create AI Analysis table
CREATE TABLE IF NOT EXISTS analises_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Period information
  mes SMALLINT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano SMALLINT NOT NULL CHECK (ano >= 2020 AND ano <= 2100),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  
  -- Processing status
  status VARCHAR(20) NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro')),
  
  -- Data (JSONB for flexibility and performance)
  dados_resposta JSONB,
  dados_entrada JSONB,
  
  -- AI metadata
  modelo_ai VARCHAR(100) NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  tempo_processamento_ms INTEGER,
  
  -- Error tracking
  erro_mensagem TEXT,
  tentativas INTEGER DEFAULT 0,
  
  -- Cached metadata (for faster list views without parsing JSONB)
  titulo VARCHAR(255),
  resumo_executivo TEXT,
  
  -- Audit fields
  criado_automaticamente BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  criado_por UUID REFERENCES utilizadores(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_analises_ai_periodo ON analises_ai(periodo_inicio, periodo_fim);
CREATE INDEX idx_analises_ai_status ON analises_ai(status);
CREATE INDEX idx_analises_ai_criado_em ON analises_ai(criado_em DESC);
CREATE INDEX idx_analises_ai_mes_ano ON analises_ai(ano DESC, mes DESC);

-- GIN index for JSONB queries (if needed for complex queries on dados_resposta)
CREATE INDEX idx_analises_ai_dados_resposta ON analises_ai USING GIN (dados_resposta);

-- Allow multiple analyses per month (identified by creation timestamp)
CREATE UNIQUE INDEX idx_analises_ai_unique_month_timestamp 
  ON analises_ai(mes, ano, criado_em);

-- Auto-update atualizado_em timestamp
CREATE OR REPLACE FUNCTION update_atualizado_em_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.atualizado_em = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analises_ai_atualizado_em 
  BEFORE UPDATE ON analises_ai
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em_column();

-- Comments for documentation
COMMENT ON TABLE analises_ai IS 'Stores AI-generated monthly restaurant analysis with historical tracking';
COMMENT ON COLUMN analises_ai.mes IS 'Month (1-12) of the analysis period';
COMMENT ON COLUMN analises_ai.ano IS 'Year of the analysis period';
COMMENT ON COLUMN analises_ai.dados_resposta IS 'Complete AI response with sections, recommendations, and metadata';
COMMENT ON COLUMN analises_ai.dados_entrada IS 'Input data used for AI analysis (for reproducibility)';
COMMENT ON COLUMN analises_ai.titulo IS 'Cached title from AI response for faster list rendering';
COMMENT ON COLUMN analises_ai.resumo_executivo IS 'Cached executive summary for faster list rendering';
COMMENT ON COLUMN analises_ai.criado_automaticamente IS 'TRUE if generated by cron scheduler, FALSE if triggered manually';
```

## 5. API Integration

Update `api/api.js` to register the new routes and start the scheduler.

```javascript
// ... existing imports
const rotasAnalisesAI = require('./src/rotas/analises-ai');
const agendadorAnalises = require('./src/utilitarios/agendador-analises');

// ... existing middleware setup

// Routes
app.use('/api/analises-ai', rotasAnalisesAI);

// ... existing routes

// Start cron scheduler for automatic monthly analysis
if (process.env.AI_AUTO_ANALYSIS === 'true') {
  agendadorAnalises.iniciarAgendador();
}

// ... rest of server setup
```

## 6. Environment Variables

Add to `.env` file:

```bash
# AI Analysis Configuration
ANTHROPIC_API_KEY=sk-ant-api03-...
AI_MODEL=claude-3-5-sonnet-20241022
AI_MAX_TOKENS=8000
AI_AUTO_ANALYSIS=true  # Enable automatic monthly analysis
TZ=Europe/Lisbon       # Timezone for cron scheduler
```

## 7. Package Dependencies

Install required npm packages:

```bash
cd api
npm install @anthropic-ai/sdk node-cron

cd ..
npm install date-fns lucide-react
```

## 8. Testing Strategy

### 8.1. Backend Testing

```javascript
// Test data aggregation
const { getMonthlyInsightsData } = require('./api/src/servicos/dados-mensais');
const data = await getMonthlyInsightsData(2024, 12);
console.log(data);

// Test manual analysis trigger (development only)
const { executarAnaliseManual } = require('./api/src/utilitarios/agendador-analises');
const jobId = await executarAnaliseManual(12, 2024);
console.log('Job ID:', jobId);

// Test status polling
const servicoAnaliseAI = require('./api/src/servicos/analise-ai');
const status = await servicoAnaliseAI.verificarStatus(jobId);
console.log(status);
```

### 8.2. Frontend Testing

1. Navigate to Analysis tab in sidebar
2. Select a month (should show empty state if no analyses)
3. Click "Nova Análise" button
4. Watch status polling (should show "Processando..." state)
5. Once complete, verify analysis renders correctly with ComponentRenderer
6. Test month selector to switch between months
7. Verify multiple analyses per month are listed chronologically
8. Test analysis deletion
9. Test export functionality

### 8.3. Cron Testing

Set up a test cron schedule (every minute for testing):

```javascript
// Temporarily change CRON_EXPRESSION to '* * * * *' for testing
// Then watch logs to verify execution
```

## 9. Architecture Decisions Summary

### Key Design Choices:

1. **Single Table Design**: Simplified from 2 tables to 1 table (`analises_ai`). Configuration moved to environment variables.

2. **JSONB for Flexibility**: Used PostgreSQL JSONB columns for `dados_resposta` and `dados_entrada` to store complex nested data without rigid schema constraints.

3. **Cached Metadata**: Added `titulo` and `resumo_executivo` columns to avoid parsing JSONB for list views, improving performance.

4. **Multiple Analyses Per Month**: Removed UNIQUE constraint on (mes, ano), allowing unlimited analyses per month. Each identified by `criado_em` timestamp.

5. **Tab-based UI**: Integrated as sidebar tab (like Menu, Stock) instead of dashboard widget for better UX and consistency.

6. **Async Processing**: Analysis runs asynchronously with status polling to avoid blocking the UI during AI processing.

7. **Component Renderer Integration**: Reuses existing restaurant-analysis ComponentRenderer system for displaying AI responses.

8. **Environment-based Config**: AI model, API key, max tokens, and scheduler settings stored in .env for easier deployment and configuration.

9. **Automatic + Manual**: Supports both cron-scheduled automatic monthly analyses and manager-triggered manual analyses.

10. **Comprehensive Error Handling**: Retry logic, error messages, and proper status tracking throughout the pipeline.

## 10. Implementation Checklist

### Backend
- [ ] Create database migration `003_analises_ai.sql`
- [ ] Run migration to create `analises_ai` table
- [ ] Create route file `api/src/rotas/analises-ai.js`
- [ ] Create service file `api/src/servicos/analise-ai.js`
- [ ] Create data service `api/src/servicos/dados-mensais.js` (use existing getMonthlyInsightsData)
- [ ] Create AI client `api/src/utilitarios/cliente-ai.js`
- [ ] Create scheduler `api/src/utilitarios/agendador-analises.js`
- [ ] Update `api/api.js` to register routes and start scheduler
- [ ] Add environment variables to `.env`
- [ ] Install npm packages (`@anthropic-ai/sdk`, `node-cron`)
- [ ] Test API endpoints with Postman/Insomnia
- [ ] Test manual analysis execution
- [ ] Test status polling
- [ ] Test cron scheduler

### Frontend
- [ ] Add "Análise AI" tab to sidebar in `src/app/page.jsx`
- [ ] Create `src/app/components/AnalysisTab.jsx`
- [ ] Create `src/app/components/analysis/MonthSelector.jsx`
- [ ] Create `src/app/components/analysis/AnalysisList.jsx`
- [ ] Create `src/app/components/analysis/AnalysisDetail.jsx`
- [ ] Install npm packages (`date-fns`)
- [ ] Add styling for analysis components
- [ ] Test month selection
- [ ] Test analysis list rendering
- [ ] Test analysis detail view with ComponentRenderer
- [ ] Test "Nova Análise" button and status polling
- [ ] Test analysis deletion
- [ ] Test export functionality

### Integration
- [ ] End-to-end test: Generate analysis and view in UI
- [ ] Test automatic monthly analysis (cron)
- [ ] Verify multiple analyses per month work correctly
- [ ] Performance test with large datasets
- [ ] Error handling verification
- [ ] Token usage monitoring
- [ ] Documentation review
- [ ] Deploy to production

---

**Implementation Timeline Estimate**: 2-3 days for a single developer

**Priority**: HIGH - This feature provides significant value for restaurant management decision-making
              
              {analise.tempo_processamento_ms && (
                <div className="analysis-list-item-time">
                  {(analise.tempo_processamento_ms / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 3.5. Analysis Detail Component

**File: `src/app/components/analysis/AnalysisDetail.jsx`**

```jsx
'use client';

import { useState, useEffect } from 'react';
import ComponentRenderer from '@/app/restaurant-analysis/components/ComponentRenderer';
import { Loader2, AlertCircle, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnalysisDetail({ analysisId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadAnalysis();
  }, [analysisId]);
  
  async function loadAnalysis() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/analises-ai/detalhes/${analysisId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar análise');
      }
      
      const data = await response.json();
      setAnalysis(data);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleDelete() {
    if (!confirm('Tem certeza que deseja deletar esta análise?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/analises-ai/${analysisId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        window.location.reload(); // Reload to update list
      }
    } catch (error) {
      alert('Erro ao deletar análise');
    }
  }
  
  async function handleExport() {
    // TODO: Implement PDF/Excel export
    const dataStr = JSON.stringify(analysis.dados_resposta, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analise-${analysis.mes}-${analysis.ano}.json`;
    link.click();
  }
  
  if (loading) {
    return (
      <div className="analysis-detail-loading">
        <Loader2 className="animate-spin" size={48} />
        <p>Carregando análise...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="analysis-detail-error">
        <AlertCircle size={48} />
        <p>{error}</p>
      </div>
    );
  }
  
  if (!analysis) {
    return null;
  }
  
  if (analysis.status === 'processando') {
    return (
      <div className="analysis-detail-processing">
        <Loader2 className="animate-spin" size={48} />
        <h2>Análise em Processamento</h2>
        <p>Por favor, aguarde enquanto a AI analisa os dados...</p>
      </div>
    );
  }
  
  if (analysis.status === 'erro') {
    return (
      <div className="analysis-detail-error">
        <AlertCircle size={48} />
        <h2>Erro ao Processar Análise</h2>
        <p>{analysis.erro_mensagem}</p>
        <Button onClick={handleDelete} variant="destructive">
          <Trash2 /> Deletar Análise
        </Button>
      </div>
    );
  }
  
  return (
    <div className="analysis-detail">
      <div className="analysis-detail-header">
        <div className="analysis-detail-info">
          <h2>{analysis.titulo}</h2>
          <p className="analysis-detail-meta">
            Gerado em {new Date(analysis.criado_em).toLocaleString('pt-BR')} • 
            {analysis.criado_automaticamente ? ' Automático' : ' Manual'} • 
            {(analysis.tempo_processamento_ms / 1000).toFixed(1)}s • 
            {analysis.tokens_total} tokens
          </p>
        </div>
        
        <div className="analysis-detail-actions">
          <Button onClick={handleExport} variant="outline">
            <Download /> Exportar
          </Button>
          <Button onClick={handleDelete} variant="destructive">
            <Trash2 /> Deletar
          </Button>
        </div>
      </div>
      
      <div className="analysis-detail-content">
        {analysis.dados_resposta?.sections?.map((section, index) => (
          <ComponentRenderer key={index} {...section} />
        ))}
      </div>
      
      {analysis.dados_resposta?.recommendations && (
        <div className="analysis-detail-recommendations">
          <h3>Recomendações</h3>
          {analysis.dados_resposta.recommendations.map((rec, index) => (
            <div key={index} className={`recommendation priority-${rec.priority}`}>
              <h4>{rec.title}</h4>
              <p>{rec.description}</p>
              <div className="recommendation-impact">{rec.expected_impact}</div>
              <ul>
                {rec.action_items?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```javascript
const cron = require('node-cron');
const servicoAnaliseAI = require('./analise-ai');

class AgendadorAnalises {
  
  iniciar() {
    // Run on 1st of every month at 2 AM
    // '0 2 1 * *' = minute=0, hour=2, day=1, any month, any day of week
    cron.schedule('0 2 1 * *', async () => {
      console.log('[Agendador] Executando análise mensal automática...');
      
      try {
        const agora = new Date();
        const mesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1);
        
        await servicoAnaliseAI.executarAnalise({
          mes: mesAnterior.getMonth() + 1,
          ano: mesAnterior.getFullYear(),
          automatico: true
        });
        
        console.log('[Agendador] Análise agendada com sucesso');
      } catch (erro) {
        console.error('[Agendador] Erro ao executar análise:', erro);
      }
    });
    
    console.log('[Agendador] Análises automáticas ativadas (1º dia do mês às 2h)');
  }
  
  // For testing - run analysis for current month minus 1
  async executarTeste() {
    const agora = new Date();
    const mesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1);
    
    return servicoAnaliseAI.executarAnalise({
      mes: mesAnterior.getMonth() + 1,
      ano: mesAnterior.getFullYear(),
      automatico: false
    });
  }
}

module.exports = new AgendadorAnalises();
```

### 2.5. AI Client (`api/src/utilitarios/cliente-ai.js`)

```javascript
const Anthropic = require('@anthropic-ai/sdk');

class ClienteAI {
  
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  
  async analisarRestaurante({ dados, modelo = 'claude-3-5-sonnet-20241022', promptSistema }) {
    
    const systemPrompt = promptSistema || this.getDefaultSystemPrompt();
    
    const userMessage = this.construirMensagemAnalise(dados);
    
    const startTime = Date.now();
    
    const resposta = await this.anthropic.messages.create({
      model: modelo,
      max_tokens: 16000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userMessage
      }]
    });
    
    const tempoProcessamento = Date.now() - startTime;
    
    // Parse JSON from AI response
    const conteudo = resposta.content[0].text;
    let dadosJSON;
    
    try {
      dadosJSON = JSON.parse(conteudo);
    } catch (e) {
      // If AI didn't return pure JSON, try to extract it
      const jsonMatch = conteudo.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        dadosJSON = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI não retornou JSON válido');
      }
    }
    
    return {
      data: dadosJSON,
      tokensUsados: resposta.usage.input_tokens + resposta.usage.output_tokens,
      modelo: modelo,
      tempoProcessamento
    };
  }
  
  getDefaultSystemPrompt() {
    return `Você é um consultor especializado em análise de restaurantes e otimização de menu.

Sua tarefa é analisar dados de um restaurante português e gerar insights acionáveis seguindo EXATAMENTE este formato JSON.

IMPORTANTE: 
- Retorne APENAS JSON válido, sem markdown ou explicações
- Use os componentes disponíveis: hero, section, grid, card, metric-card, alert, badge, table, chart, matrix, tabs, accordion, action-card, divider, progress-bar
- Para ícones, use nomes válidos do lucide-react (Star, TrendingUp, AlertTriangle, etc)
- Valores monetários sempre com 2 casas decimais
- Datas no formato ISO 8601

Estrutura obrigatória:
{
  "metadata": {
    "titulo": string,
    "subtitulo": string,
    "periodo": string,
    "data_geracao": string (ISO),
    "resumo_executivo": string
  },
  "components": [...]
}

Foque em:
1. Análise de preços e margem
2. Menu Engineering Matrix (Stars, Plowhorses, Puzzles, Dogs)
3. Otimização de stock vs menu
4. Sugestões de combos
5. TOP 3 ações prioritárias com impacto financeiro estimado`;
  }
  
  construirMensagemAnalise(dados) {
    return `Analise estes dados do restaurante e retorne insights em JSON:

PERÍODO: ${dados.periodo.mes}/${dados.periodo.ano} (${dados.periodo.dias_operacionais} dias operacionais)

RECEITA:
- Total: €${dados.pedidos.receita_total.toFixed(2)}
- Ticket Médio: €${dados.pedidos.ticket_medio.toFixed(2)}
- Total de Pedidos: ${dados.pedidos.total}
- Items Vendidos: ${dados.pedidos.items_vendidos}

MENU (${dados.menu.length} items):
${dados.menu.map(m => 
  `- ${m.nome}: €${m.preco.toFixed(2)} | ${m.vendas} vendas | €${m.receita.toFixed(2)} receita | ${m.category}`
).join('\n')}

STOCK (${dados.stock.length} items):
${dados.stock.map(s => 
  `- ${s.nome}: ${s.quantidade}${s.unidade} | €${s.valor_total.toFixed(2)}`
).join('\n')}

CATEGORIAS: ${dados.categorias.join(', ')}

Gere uma análise completa com:
1. Hero section com métricas principais
2. Alertas críticos
3. Otimização de preços (tabs com aumentos, reduções, preços dinâmicos)
4. Menu Engineering Matrix
5. Gestão de inventário
6. Combos sugeridos
7. TOP 3 ações prioritárias com impacto financeiro`;
  }
}

module.exports = new ClienteAI();
```

## 3. Frontend Implementation

### 3.1. Dashboard Widget (`src/app/components/AnalysisWidget.jsx`)

```jsx
"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import './AnalysisWidget.scss';

export default function AnalysisWidget() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLatestAnalysis();
  }, []);

  const fetchLatestAnalysis = async () => {
    try {
      const response = await fetch('/api/analises-ai/latest', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewFullAnalysis = () => {
    if (analysis) {
      router.push(`/restaurant-analysis/${analysis.ano}/${analysis.mes}`);
    }
  };

  if (loading) {
    return (
      <div className="analysis-widget loading">
        <Loader2 className="spinner" />
        <p>A carregar análise...</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="analysis-widget empty">
        <AlertCircle size={32} />
        <h3>Nenhuma Análise Disponível</h3>
        <p>Análises são geradas automaticamente no início de cada mês</p>
      </div>
    );
  }

  const metadata = analysis.dados_resposta?.metadata || {};
  const topAction = analysis.dados_resposta?.components?.find(
    c => c.id === 'top-actions'
  )?.children?.[0];

  return (
    <div className="analysis-widget">
      <div className="widget-header">
        <div className="header-left">
          <TrendingUp size={24} />
          <div>
            <h3>Insights de IA</h3>
            <p className="period">
              <Calendar size={14} />
              {analysis.mes}/{analysis.ano}
            </p>
          </div>
        </div>
        <button className="view-full" onClick={viewFullAnalysis}>
          Ver Completo
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="widget-content">
        <p className="executive-summary">{metadata.resumo_executivo}</p>

        {topAction && (
          <div className="top-action">
            <div className="action-badge">#{topAction.props.ranking}</div>
            <div className="action-info">
              <h4>{topAction.props.title}</h4>
              <p className="action-impact">
                Impacto: +€{topAction.props.impact.revenue}/mês
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3.2. Full Analysis Page (`src/app/restaurant-analysis/[ano]/[mes]/page.jsx`)

```jsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import ComponentRenderer from '../../ComponentRenderer';
import '../../restaurant-analysis.scss';

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalysis();
  }, [params.ano, params.mes]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analises-ai/${params.ano}/${params.mes}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Análise não encontrada');
      
      const data = await response.json();
      setAnalysis(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!window.confirm('Regenerar análise? Isto irá substituir a análise atual.')) {
      return;
    }

    try {
      setRefreshing(true);
      const response = await fetch('/api/analises-ai/executar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mes: parseInt(params.mes),
          ano: parseInt(params.ano)
        })
      });

      if (!response.ok) throw new Error('Erro ao iniciar análise');

      // Poll for completion
      const { jobId } = await response.json();
      pollStatus(jobId);
    } catch (err) {
      alert(`Erro: ${err.message}`);
      setRefreshing(false);
    }
  };

  const pollStatus = async (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/analises-ai/status/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        const { status, erro_mensagem } = await response.json();

        if (status === 'concluido') {
          clearInterval(interval);
          setRefreshing(false);
          fetchAnalysis();
        } else if (status === 'erro') {
          clearInterval(interval);
          setRefreshing(false);
          alert(`Erro: ${erro_mensagem}`);
        }
      } catch (err) {
        clearInterval(interval);
        setRefreshing(false);
      }
    }, 3000);
  };

  if (loading) {
    return (
      <div className="restaurant-analysis-page loading-state">
        <Loader2 size={48} className="spinner" />
        <p>A carregar análise...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="restaurant-analysis-page error-state">
        <AlertCircle size={48} />
        <h2>Erro ao Carregar Análise</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/')}>Voltar ao Dashboard</button>
      </div>
    );
  }

  const parsedData = analysis?.dados_resposta;

  return (
    <div className="restaurant-analysis-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={20} />
          Voltar
        </button>
        
        <button 
          className="refresh-btn" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} className={refreshing ? 'spinning' : ''} />
          {refreshing ? 'A Regenerar...' : 'Regenerar Análise'}
        </button>
      </div>

      <div className="rendered-section">
        <div className="metadata-header">
          <h2>{parsedData.metadata?.titulo || "Análise de Restaurante"}</h2>
          {parsedData.metadata?.subtitulo && (
            <p className="subtitle">{parsedData.metadata.subtitulo}</p>
          )}
          {parsedData.metadata?.periodo && (
            <span className="periodo-badge">
              {parsedData.metadata.periodo}
            </span>
          )}
          {parsedData.metadata?.resumo_executivo && (
            <p className="resumo">{parsedData.metadata.resumo_executivo}</p>
          )}
        </div>

        <div className="components-container">
          {parsedData.components?.map((component, index) => (
            <ComponentRenderer
              key={component.id || index}
              component={component}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 3.3. Analysis History Modal/Page

```jsx
// Could be added to ManagerView or as separate route
// Shows list of all monthly analyses
// Allows comparison between months
```

## 4. Integration Steps

### Step 1: Database Setup
```bash
# Run migration
psql -U postgres -d pap_restaurant -f migrations/003_analises_ai.sql
```

### Step 2: Backend Setup
```bash
cd api
npm install @anthropic-ai/sdk node-cron
```

Add to `api/src/api.js`:
```javascript
const analisesAIRoutes = require('./rotas/analises-ai');
const agendadorAnalises = require('./servicos/agendador-analises');

// Routes
app.use('/api', analisesAIRoutes);

// Start scheduler
agendadorAnalises.iniciar();
```

Add to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Step 3: Frontend Integration

Add to `src/app/page.jsx` (main dashboard):
```jsx
import AnalysisWidget from './components/AnalysisWidget';

// In dashboard grid:
<AnalysisWidget />
```

## 5. Deployment Checklist

- [ ] Create database tables
- [ ] Add API routes
- [ ] Set up cron scheduler
- [ ] Configure AI API keys (encrypted)
- [ ] Test manual trigger
- [ ] Test automatic scheduling
- [ ] Add loading states
- [ ] Add error handling
- [ ] Set up notifications
- [ ] Monitor API costs (tokens)
- [ ] Add rate limiting

## 6. Future Enhancements

- **Comparative Analysis**: Compare month-over-month trends
- **Email Reports**: Send PDF summaries to managers
- **Custom Prompts**: Let managers customize AI focus areas
- **Cost Tracking**: Dashboard showing AI API costs
- **Historical Trends**: Charts showing improvements over time
- **Action Tracking**: Mark actions as "completed" and track impact
- **A/B Testing**: Test different AI models/prompts
- **Multi-language**: Support for English reports
