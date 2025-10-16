# Sistema de Pontos Automático - Mesa+ Restaurant Management

## Visão Geral

Sistema de pontuação automática baseado em ações rastreáveis pelo sistema de gestão do restaurante.

---

## 🍳 **COZINHA**

### **Chefe de Cozinha / Sous Chef / Cozinheiro**

#### Pontos Automáticos (+)

- **Pedido marcado como "Pronto" no tempo estimado**: +5 pontos
- **Pedido marcado como "Pronto" antes do tempo**: +8 pontos
- **Pedido aceite pelo empregado de mesa (sem devolução)**: +3 pontos
- **Login no sistema no horário correto**: +2 pontos
- **Checkout no sistema no horário correto**: +2 pontos

#### Pontos Automáticos (-)

- **Pedido marcado como "Devolvido/Problema"**: -10 pontos
- **Pedido ultrapassou 150% do tempo estimado**: -8 pontos
- **Login com atraso (sistema detecta)**: -3 pontos
- **Logout antecipado sem autorização**: -5 pontos
- **Pedido cancelado após início de preparação**: -6 pontos

### **Ajudante de Cozinha**

#### Pontos Automáticos (+)

- **Login/Logout no horário**: +2 pontos cada
- **Tarefas de limpeza marcadas como concluídas**: +1 ponto cada

#### Pontos Automáticos (-)

- **Atrasos no sistema**: -2 pontos
- **Tarefas não marcadas como concluídas**: -1 ponto cada

---

## 🍽️ **SERVIÇO DE MESA**

### **Empregado de Mesa**

#### Pontos Automáticos (+)

- **Mesa marcada como "servida" rapidamente**: +4 pontos
- **Pedido inserido no sistema corretamente**: +3 pontos
- **Mesa marcada como "limpa e pronta"**: +2 pontos
- **Bebida adicional vendida**: +4 pontos
- **Sobremesa vendida**: +6 pontos

#### Pontos Automáticos (-)

- **Pedido alterado/cancelado após confirmação**: -5 pontos
- **Erro na conta (sistema detecta discrepância)**: -8 pontos
- **Atraso no checkout de mesa**: -3 pontos

## ☕ **BAR/BEBIDAS**

### **Barista / Barman**

#### Pontos Automáticos (+)

- **Bebida marcada como "pronta" no tempo**: +3 pontos
- **Bebida entregue antes do tempo estimado**: +5 pontos
- **Login/Logout pontuais**: +2 pontos cada

#### Pontos Automáticos (-)

- **Bebida atrasada (mais de 150% do tempo)**: -4 pontos
- **Bebida devolvida/reclamação**: -6 pontos
- **Atrasos no sistema**: -2 pontos

---

## 🧹 **LIMPEZA E MANUTENÇÃO**

### **Equipa de Limpeza**

#### Pontos Automáticos (+)

- **Tarefa de limpeza marcada como concluída**: +2 pontos
- **Mesa limpa e liberada rapidamente**: +3 pontos
- **Check-in/out pontuais**: +2 pontos cada
- **Casa de banho verificada (QR code scan)**: +1 ponto

#### Pontos Automáticos (-)

- **Tarefa não concluída no prazo**: -3 pontos
- **Mesa não foi limpa (sistema detecta ocupação)**: -4 pontos
- **Atrasos no sistema**: -2 pontos

---

## 🎯 **BONIFICAÇÕES AUTOMÁTICAS**

### **Para Todos os Funcionários**

- **Pontualidade perfeita (semana completa)**: +15 pontos
- **Zero ocorrências negativas no dia**: +5 pontos
- **Horas extra registadas no sistema**: +3 pontos/hora
- **Trabalho em feriado/fim de semana**: +10 pontos
- **Turno completo sem saídas antecipadas**: +5 pontos

### **Penalizações Automáticas**

- **Sistema detecta atraso**: -3 pontos (até 15 min), -6 pontos (mais de 15 min)
- **Falta não justificada**: -20 pontos
- **Saída antecipada sem autorização**: -8 pontos
- **Esquecimento de checkout**: -2 pontos

---

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
