"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { useMediaQuery } from "react-responsive";

import "./dashboard.scss";

export default function Dashboard() {
  const isMobile = useMediaQuery({ maxWidth: 640 });
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router, isMobile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  return (
    <div className="dashboard-container">
      {/* Custom Sidebar */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo">
            <div className="logo-icon"></div>
            <div className="logo-text">
              <div className="main">MESA</div>
              <div className="sub">RESTAURANT OS</div>
            </div>
          </div>
        </div>

        <nav className="nav-section">
          <div className="nav-label">Operations</div>
          <a href="#" className="nav-item active">
            <div className="nav-icon"></div>
            <span>Menu</span>
          </a>
          <a href="#" className="nav-item">
            <div className="nav-icon"></div>
            <span>Pedidos</span>
            <div className="nav-badge">12</div>
          </a>
          <a href="#" className="nav-item">
            <div className="nav-icon"></div>
            <span>Stock</span>
          </a>
          <a href="#" className="nav-item">
            <div className="nav-icon"></div>
            <span>Reservas</span>
            <div className="nav-badge">4</div>
          </a>
        </nav>

        <div className="sidebar-footer">Mesa OS v2.1.0</div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Custom Dashboard Header */}
        <div className="dashboard-header">
          <div className="header-left">
            <span className="header-title">Dashboard</span>
            <span className="header-desc">Visão geral do restaurante</span>
          </div>
          <div className="header-actions">
            <button className="header-btn">Nova Reserva</button>
            <button className="header-btn">Novo Pedido</button>
            <div className="header-avatar">
              <span>JA</span>
            </div>
          </div>
        </div>
        <div className="content-area">
          <div className="page-header">
            <h1>Dashboard</h1>
            <p>Real-time restaurant overview and analytics</p>
          </div>

          {/* Metrics Grid */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon"></div>
                <div className="metric-change">+12%</div>
              </div>
              <div className="metric-label">Orders Today</div>
              <div className="metric-value">128</div>
              <div className="metric-progress">
                <div className="progress-bar" style={{ width: "78%" }}></div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon"></div>
                <div className="metric-change">+8%</div>
              </div>
              <div className="metric-label">Revenue Today</div>
              <div className="metric-value">R$ 2,340</div>
              <div className="metric-progress">
                <div className="progress-bar" style={{ width: "65%" }}></div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon"></div>
                <div className="metric-change">70%</div>
              </div>
              <div className="metric-label">Tables Occupied</div>
              <div className="metric-value">14/20</div>
              <div className="metric-progress">
                <div className="progress-bar" style={{ width: "70%" }}></div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon"></div>
                <div className="metric-change">#1</div>
              </div>
              <div className="metric-label">Top Seller</div>
              <div className="metric-value">Burger</div>
              <div className="metric-progress">
                <div className="progress-bar" style={{ width: "85%" }}></div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon"></div>
                <div className="metric-change">Active</div>
              </div>
              <div className="metric-label">Staff on Duty</div>
              <div className="metric-value">7</div>
              <div className="metric-progress">
                <div className="progress-bar" style={{ width: "60%" }}></div>
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="activity-section">
            <div className="activity-card">
              <div className="activity-header">
                <h3>Recent Activity</h3>
                <div className="activity-icon"></div>
              </div>

              <div className="activity-list">
                <div className="activity-item">
                  <div className="item-icon"></div>
                  <div className="item-content">
                    <div className="item-title">
                      Mesa 5 pediu "Pizza Margherita"
                    </div>
                    <div className="item-subtitle">New order in system</div>
                  </div>
                  <div className="item-time">
                    <div className="time">2 min ago</div>
                    <div className="status-dot active"></div>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="item-icon"></div>
                  <div className="item-content">
                    <div className="item-title">Mesa 2 pagou a conta</div>
                    <div className="item-subtitle">Payment processed</div>
                  </div>
                  <div className="item-time">
                    <div className="time">5 min ago</div>
                    <div className="status-dot"></div>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="item-icon"></div>
                  <div className="item-content">
                    <div className="item-title">Mesa 8 pediu "Coca-Cola"</div>
                    <div className="item-subtitle">Drink added</div>
                  </div>
                  <div className="item-time">
                    <div className="time">7 min ago</div>
                    <div className="status-dot"></div>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="item-icon"></div>
                  <div className="item-content">
                    <div className="item-title">
                      Mesa 1 pediu "Hambúrguer Clássico"
                    </div>
                    <div className="item-subtitle">Main dish ordered</div>
                  </div>
                  <div className="item-time">
                    <div className="time">10 min ago</div>
                    <div className="status-dot"></div>
                  </div>
                </div>
              </div>

              <div className="activity-footer">
                <button className="view-all-btn">VIEW ALL ACTIVITY</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
