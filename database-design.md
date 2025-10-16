# Base de Dados - Sistema de Gestão de Pessoal Mesa+

## Visão Geral

Estrutura de base de dados para gerir funcionários, horários, faltas, pontos e desempenho do restaurante.

---

## 📊 **TABELAS PRINCIPAIS**

### **1. Funcionários (staff)**

```sql
CREATE TABLE staff (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role ENUM('chef', 'sous_chef', 'cook', 'kitchen_helper', 'waiter', 'hostess', 'barista', 'barman', 'cleaner') NOT NULL,
    hire_date DATE NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    hourly_rate DECIMAL(10,2),
    weekly_hours INT DEFAULT 40,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **2. Horários de Trabalho (work_schedules)**

```sql
CREATE TABLE work_schedules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    staff_id BIGINT NOT NULL,
    day_of_week TINYINT NOT NULL, -- 1=Segunda, 7=Domingo
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE KEY unique_staff_day (staff_id, day_of_week, is_active)
);
```

### **3. Presenças/Faltas (attendance)**

```sql
CREATE TABLE attendance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    staff_id BIGINT NOT NULL,
    date DATE NOT NULL,
    scheduled_start TIME,
    scheduled_end TIME,
    actual_start TIME,
    actual_end TIME,
    status ENUM('present', 'absent', 'late', 'early_leave', 'sick', 'vacation', 'unpaid_leave') NOT NULL,
    minutes_late INT DEFAULT 0,
    minutes_early_leave INT DEFAULT 0,
    total_hours_worked DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    approved_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES staff(id),
    UNIQUE KEY unique_staff_date (staff_id, date)
);
```

### **4. Tipos de Falta (absence_types)**

```sql
CREATE TABLE absence_types (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    requires_medical_cert BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE,
    max_consecutive_days INT,
    point_penalty INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dados iniciais
INSERT INTO absence_types (code, name, description, requires_approval, requires_medical_cert, is_paid, point_penalty) VALUES
('SICK', 'Doença', 'Falta por motivo de doença', FALSE, TRUE, TRUE, 0),
('VACATION', 'Férias', 'Férias programadas', TRUE, FALSE, TRUE, 0),
('PERSONAL', 'Assunto Pessoal', 'Falta por assunto pessoal', TRUE, FALSE, FALSE, -5),
('EMERGENCY', 'Emergência', 'Emergência familiar', FALSE, FALSE, FALSE, 0),
('UNJUSTIFIED', 'Falta Injustificada', 'Falta sem justificação', FALSE, FALSE, FALSE, -20),
('MATERNITY', 'Licença Maternidade', 'Licença de maternidade', TRUE, TRUE, TRUE, 0),
('TRAINING', 'Formação', 'Formação profissional', TRUE, FALSE, TRUE, 5);
```

### **5. Pedidos de Falta (absence_requests)**

```sql
CREATE TABLE absence_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    staff_id BIGINT NOT NULL,
    absence_type_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL,
    reason TEXT,
    medical_certificate VARCHAR(255),
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (absence_type_id) REFERENCES absence_types(id),
    FOREIGN KEY (reviewed_by) REFERENCES staff(id)
);
```

### **6. Sistema de Pontos (points_system)**

```sql
CREATE TABLE points_system (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    staff_id BIGINT NOT NULL,
    date DATE NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_description TEXT NOT NULL,
    points_earned INT NOT NULL,
    source_table VARCHAR(50), -- 'attendance', 'orders', 'tasks', etc
    source_id BIGINT,
    auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    INDEX idx_staff_date (staff_id, date),
    INDEX idx_action_type (action_type)
);
```

### **7. Pedidos da Cozinha (kitchen_orders)**

```sql
CREATE TABLE kitchen_orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(20) NOT NULL,
    table_number INT,
    assigned_cook BIGINT NOT NULL,
    items JSON NOT NULL,
    estimated_time INT NOT NULL, -- minutos
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'returned') DEFAULT 'pending',
    quality_rating TINYINT, -- 1-5
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_cook) REFERENCES staff(id)
);
```

### **8. Serviço de Mesas (table_service)**

```sql
CREATE TABLE table_service (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_number INT NOT NULL,
    waiter_id BIGINT NOT NULL,
    customer_count INT,
    seated_at TIMESTAMP,
    first_service_at TIMESTAMP,
    bill_total DECIMAL(10,2),
    tip_amount DECIMAL(10,2) DEFAULT 0,
    payment_method ENUM('cash', 'card', 'digital'),
    customer_satisfaction TINYINT, -- 1-5
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (waiter_id) REFERENCES staff(id)
);
```

### **9. Tarefas de Limpeza (cleaning_tasks)**

```sql
CREATE TABLE cleaning_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_name VARCHAR(100) NOT NULL,
    area ENUM('kitchen', 'dining', 'bathroom', 'storage', 'bar') NOT NULL,
    assigned_staff BIGINT NOT NULL,
    scheduled_time TIME,
    estimated_duration INT, -- minutos
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status ENUM('pending', 'in_progress', 'completed', 'skipped') DEFAULT 'pending',
    quality_check BOOLEAN DEFAULT FALSE,
    qr_code VARCHAR(100),
    notes TEXT,
    date DATE NOT NULL,
    FOREIGN KEY (assigned_staff) REFERENCES staff(id)
);
```

---

## 🎯 **SISTEMA DE FALTAS**

### **Tipos de Falta e Penalizações**

```sql
-- View para resumo de faltas
CREATE VIEW staff_absence_summary AS
SELECT
    s.id,
    s.name,
    s.role,
    COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as total_absences_month,
    COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_arrivals_month,
    SUM(CASE WHEN a.status = 'absent' THEN at.point_penalty ELSE 0 END) as penalty_points_month,
    AVG(a.minutes_late) as avg_minutes_late
FROM staff s
LEFT JOIN attendance a ON s.id = a.staff_id
    AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
LEFT JOIN absence_requests ar ON a.staff_id = ar.staff_id
    AND a.date BETWEEN ar.start_date AND ar.end_date
LEFT JOIN absence_types at ON ar.absence_type_id = at.id
WHERE s.status = 'active'
GROUP BY s.id, s.name, s.role;
```

### **Políticas Automáticas**

```sql
-- Trigger para aplicar penalizações automáticas
DELIMITER //
CREATE TRIGGER apply_attendance_points
AFTER INSERT ON attendance
FOR EACH ROW
BEGIN
    DECLARE point_value INT DEFAULT 0;

    -- Pontualidade perfeita
    IF NEW.status = 'present' AND NEW.minutes_late = 0 AND NEW.minutes_early_leave = 0 THEN
        SET point_value = 2;
        INSERT INTO points_system (staff_id, date, action_type, action_description, points_earned, source_table, source_id)
        VALUES (NEW.staff_id, NEW.date, 'punctuality', 'Pontualidade perfeita', point_value, 'attendance', NEW.id);
    END IF;

    -- Atraso
    IF NEW.status = 'late' THEN
        IF NEW.minutes_late <= 15 THEN
            SET point_value = -3;
        ELSE
            SET point_value = -6;
        END IF;
        INSERT INTO points_system (staff_id, date, action_type, action_description, points_earned, source_table, source_id)
        VALUES (NEW.staff_id, NEW.date, 'late_arrival', CONCAT('Atraso de ', NEW.minutes_late, ' minutos'), point_value, 'attendance', NEW.id);
    END IF;

    -- Falta injustificada
    IF NEW.status = 'absent' THEN
        SET point_value = -20;
        INSERT INTO points_system (staff_id, date, action_type, action_description, points_earned, source_table, source_id)
        VALUES (NEW.staff_id, NEW.date, 'absence', 'Falta injustificada', point_value, 'attendance', NEW.id);
    END IF;

END//
DELIMITER ;
```

---

## 📱 **APIS NECESSÁRIAS**

### **1. Gestão de Presenças**

```javascript
// POST /api/attendance/checkin
{
    "staff_id": 123,
    "timestamp": "2025-10-08T08:00:00Z",
    "location": "main_entrance"
}

// POST /api/attendance/checkout
{
    "staff_id": 123,
    "timestamp": "2025-10-08T17:00:00Z"
}

// GET /api/attendance/staff/{id}/today
// GET /api/attendance/staff/{id}/week
// GET /api/attendance/staff/{id}/month
```

### **2. Pedidos de Falta**

```javascript
// POST /api/absence-requests
{
    "staff_id": 123,
    "absence_type": "SICK",
    "start_date": "2025-10-10",
    "end_date": "2025-10-12",
    "reason": "Gripe forte",
    "medical_certificate": "cert_123.pdf"
}

// GET /api/absence-requests/pending
// PUT /api/absence-requests/{id}/approve
// PUT /api/absence-requests/{id}/reject
```

### **3. Sistema de Pontos**

```javascript
// GET /api/points/staff/{id}/today
// GET /api/points/staff/{id}/week
// GET /api/points/leaderboard
// POST /api/points/manual-adjustment
```

---

## 🔄 **AUTOMAÇÃO DE PONTOS**

### **Triggers Automáticos**

```sql
-- Pontos por completar pedidos
DELIMITER //
CREATE TRIGGER kitchen_order_points
AFTER UPDATE ON kitchen_orders
FOR EACH ROW
BEGIN
    DECLARE time_diff INT;
    DECLARE point_value INT;

    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SET time_diff = TIMESTAMPDIFF(MINUTE, NEW.started_at, NEW.completed_at);

        IF time_diff <= NEW.estimated_time THEN
            SET point_value = 5;
            IF time_diff <= (NEW.estimated_time * 0.8) THEN
                SET point_value = 8;
            END IF;
        ELSE
            SET point_value = -3;
        END IF;

        INSERT INTO points_system (staff_id, date, action_type, action_description, points_earned, source_table, source_id)
        VALUES (NEW.assigned_cook, CURDATE(), 'order_completion',
                CONCAT('Pedido completado em ', time_diff, ' minutos'),
                point_value, 'kitchen_orders', NEW.id);
    END IF;
END//
DELIMITER ;
```

### **Jobs Automáticos**

```sql
-- Evento para calcular bónus semanais
CREATE EVENT weekly_bonus_calculation
ON SCHEDULE EVERY 1 WEEK STARTS '2025-01-01 23:59:00'
DO
BEGIN
    -- Bónus por semana perfeita (sem faltas nem atrasos)
    INSERT INTO points_system (staff_id, date, action_type, action_description, points_earned, auto_generated)
    SELECT
        s.id,
        CURDATE(),
        'weekly_perfect',
        'Semana perfeita - sem faltas nem atrasos',
        15,
        TRUE
    FROM staff s
    WHERE s.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.staff_id = s.id
        AND a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND (a.status IN ('absent', 'late') OR a.minutes_late > 0)
    );
END;
```

---

## 📊 **RELATÓRIOS E DASHBOARDS**

### **Views para Relatórios**

```sql
-- Resumo mensal por funcionário
CREATE VIEW monthly_staff_summary AS
SELECT
    s.id,
    s.name,
    s.role,
    DATE_FORMAT(CURDATE(), '%Y-%m') as month,
    COUNT(a.id) as days_worked,
    SUM(a.total_hours_worked) as total_hours,
    SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
    SUM(ps.points_earned) as total_points,
    AVG(ps.points_earned) as avg_daily_points
FROM staff s
LEFT JOIN attendance a ON s.id = a.staff_id
    AND a.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
LEFT JOIN points_system ps ON s.id = ps.staff_id
    AND ps.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
WHERE s.status = 'active'
GROUP BY s.id, s.name, s.role;

-- Top performers
CREATE VIEW top_performers AS
SELECT
    s.name,
    s.role,
    SUM(ps.points_earned) as total_points,
    COUNT(ps.id) as total_actions,
    RANK() OVER (ORDER BY SUM(ps.points_earned) DESC) as ranking
FROM staff s
JOIN points_system ps ON s.id = ps.staff_id
WHERE ps.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY s.id, s.name, s.role
ORDER BY total_points DESC
LIMIT 10;
```

---

## 🛡️ **SEGURANÇA E AUDITORIA**

### **Logs de Auditoria**

```sql
CREATE TABLE audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL,
    record_id BIGINT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON,
    new_values JSON,
    changed_by BIGINT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (changed_by) REFERENCES staff(id)
);
```

### **Permissões por Função**

```sql
CREATE TABLE role_permissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role ENUM('chef', 'sous_chef', 'cook', 'kitchen_helper', 'waiter', 'hostess', 'barista', 'barman', 'cleaner', 'manager', 'admin') NOT NULL,
    permission VARCHAR(50) NOT NULL,
    can_read BOOLEAN DEFAULT FALSE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE
);
```

---

## 📈 **ÍNDICES PARA PERFORMANCE**

```sql
-- Índices essenciais
CREATE INDEX idx_attendance_staff_date ON attendance(staff_id, date);
CREATE INDEX idx_points_staff_date ON points_system(staff_id, date);
CREATE INDEX idx_orders_cook_status ON kitchen_orders(assigned_cook, status);
CREATE INDEX idx_absence_requests_status ON absence_requests(status, start_date);
CREATE INDEX idx_table_service_waiter_date ON table_service(waiter_id, created_at);

-- Índices compostos para queries complexas
CREATE INDEX idx_attendance_month_status ON attendance(date, status, staff_id);
CREATE INDEX idx_points_action_date ON points_system(action_type, date, staff_id);
```

---

_Base de dados otimizada para Mesa+ Restaurant Management System_
