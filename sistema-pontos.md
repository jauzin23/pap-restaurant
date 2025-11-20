# Sistema de Pontos Automático - Mesa+ Restaurant Management

## Visão Geral

Sistema de pontuação automática baseado em ações rastreáveis pelo sistema de gestão do restaurante.

---

## 🍳 **COZINHA**

### **Chefe de Cozinha / Sous Chef / Cozinheiro**

#### Pontos Automáticos (+)

- **Pedido marcado como "Pronto"**: +5 pontos

#### Pontos Automáticos (-)

## 🍽️ **SERVIÇO DE MESA**

### **Empregado de Mesa**

#### Pontos Automáticos (+)

- **Mesa marcada como "servida" ou equivalente rapidamente**: +4 pontos
- **Pedido inserido no sistema**: +3 pontos

#### Pontos Automáticos (-)

## ☕ **BAR/BEBIDAS**

### **Barista / Barman**

#### Pontos Automáticos (+)

- **Bebida marcada como "pronta" no tempo**: +3 pontos
- **Bebida entregue antes do tempo estimado**: +5 pontos

#### Pontos Automáticos (-)

## � **SISTEMA BASEADO EM AÇÕES RASTREÁVEIS**

### **O que o Sistema Consegue Rastrear:**

- **Timestamps**: Login, logout, ações no sistema
- **Pedidos**: Criação, modificação, conclusão, tempo
- **Mesas**: Atribuição, limpeza, ocupação
- **Vendas**: Itens vendidos, valores, gorjetas
- **Tarefas**: Marcação de conclusão, tempos
- **Chamadas**: Atendimento, duração
- **Movimentação**: Check-ins em diferentes áreas (QR codes)

### **Integração com Hardware:**

- **Tablets/POS**: Registo de todas as ações
- **QR Codes**: Para verificar limpezas e tarefas
- **Sistema de Chamadas**: Para hostess/receção
- **Sensores de Mesa**: Para detectar ocupação
- **Caixas Registadoras**: Para vendas e gorjetas

---

## 🏆 **SISTEMA DE NÍVEIS AUTOMÁTICO**

### **Cálculo Diário Automático**

- **Pontuação é calculada automaticamente**
- **Níveis são atualizados em tempo real**
- **Ranking é gerado automaticamente**

### **Classificação Semanal**

- **0-50 pontos**: Principiante 🥉
- **51-150 pontos**: Competente 🥈
- **151-250 pontos**: Profissional 🥇
- **251-350 pontos**: Especialista ⭐
- **351+ pontos**: Mestre ⭐⭐

---

## � **DASHBOARD AUTOMÁTICO**

### **Informação em Tempo Real**

- **Pontos do dia atual**
- **Progresso para próximo nível**
- **Comparação com ontem/semana passada**
- **Ranking da equipa (anónimo)**
- **Metas diárias sugeridas**

### **Notificações Automáticas**

- **Quando ganhas pontos importantes**
- **Quando sobes de nível**
- **Alertas de desempenho baixo**
- **Conquistas desbloqueadas**

---

## � **IMPLEMENTAÇÃO TÉCNICA**

### **Registo Automático**

```
Ação no Sistema → Pontos Calculados → Base de Dados Atualizada → Dashboard Atualizado
```

### **APIs Necessárias**

- **POS Integration**: Para vendas e gorjetas
- **Timer System**: Para controlo de tempos
- **Task Management**: Para tarefas de limpeza
- **Staff Management**: Para horários e presenças

### **Dados Necessários**

- **Staff Login/Logout times**
- **Order creation/completion times**
- **Table assignment/cleaning**
- **Sales data with staff attribution**
- **Task completion timestamps**

---

## � **RELATÓRIOS AUTOMÁTICOS**

### **Gerados Automaticamente**

- **Relatório diário de pontos**
- **Ranking semanal da equipa**
- **Análise de tendências**
- **Identificação de padrões**
- **Sugestões de melhoria**

---

_Sistema 100% automático baseado em dados reais do restaurante_
