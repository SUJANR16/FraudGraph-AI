import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Database,
  Eye,
  GitBranch,
  LayoutDashboard,
  MapPin,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Store,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [activePage, setActivePage] =
    useState("Dashboard");

  const [dashboard, setDashboard] =
    useState(null);

  const [transactions, setTransactions] =
    useState([]);

  const [rings, setRings] =
    useState([]);

  const [accounts, setAccounts] =
    useState([]);

  const [selectedTransaction, setSelectedTransaction] =
    useState(null);

  const [selectedRing, setSelectedRing] =
    useState(null);

  const [ringActivityFilter, setRingActivityFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [apiOnline, setApiOnline] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [transactionFilter, setTransactionFilter] =
    useState("all");

  const [graphData, setGraphData] =
    useState({
      nodes: [],
      links: [],
    });

  /* =====================================================
     LOAD BACKEND DATA
  ===================================================== */

  const loadData = async () => {
    setLoading(true);
    console.log("Connecting to FraudGraph backend:", API_URL);

    // 1. Health check
    try {
      const healthResponse = await fetch(`${API_URL}/api/health`, {
        method: "GET",
        cache: "no-store",
      });

      if (!healthResponse.ok) {
        throw new Error(`Health endpoint returned ${healthResponse.status}`);
      }

      const health = await healthResponse.json();
      console.log("FraudGraph Health:", health);
      setApiOnline(true);
    } catch (error) {
      console.error("Backend health check failed:", error);
      setApiOnline(false);
      setLoading(false);
      return;
    }

    // 2. Load dashboard FIRST and update the cards immediately.
    // This endpoint is small and should never be blocked by the graph.
    try {
      const response = await fetch(`${API_URL}/api/dashboard`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Dashboard endpoint returned ${response.status}`);
      }

      const data = await response.json();
      console.log("Dashboard:", data);
      setDashboard(data);
    } catch (error) {
      console.error("Dashboard endpoint error:", error);
    }

    // The dashboard is already usable now.
    setLoading(false);

    // 3. Load larger/secondary resources independently.
    // A slow graph/accounts request must not prevent dashboard cards from showing.
    const loadSecondary = async (name, url, handler) => {
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`${name} endpoint returned ${response.status}`);
        }

        const data = await response.json();
        console.log(`${name}:`, data);
        handler(data);
      } catch (error) {
        console.error(`${name} endpoint error:`, error);
      }
    };

    loadSecondary(
      "Transactions",
      `${API_URL}/api/transactions?limit=10000`,
      (data) => {
        setTransactions(
          Array.isArray(data) ? data : data?.transactions || []
        );
      }
    );

    loadSecondary(
      "Fraud Rings",
      `${API_URL}/api/fraud-rings`,
      (data) => {
        setRings(
          Array.isArray(data) ? data : data?.rings || []
        );
      }
    );

    loadSecondary(
      "Accounts",
      `${API_URL}/api/accounts`,
      (data) => {
        setAccounts(
          Array.isArray(data) ? data : data?.accounts || []
        );
      }
    );

    loadSecondary(
      "Fraud Graph",
      `${API_URL}/api/graph`,
      (data) => {
        const nodes = Array.isArray(data?.nodes)
          ? data.nodes
          : [];

        const links = Array.isArray(data?.edges)
          ? data.edges.map((edge) => ({
              source: edge.source,
              target: edge.target,
            }))
          : Array.isArray(data?.links)
          ? data.links
          : [];

        setGraphData({ nodes, links });
        console.log(`Graph loaded: ${nodes.length} nodes, ${links.length} links`);
      }
    );

    setApiOnline(true);
  };

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    loadData();
  }, []);

  /* =====================================================
     TRANSACTION DETAILS
  ===================================================== */

  const openTransaction =
    async (transaction) => {
      const id =
        transaction.transaction_id ||
        transaction.id ||
        transaction.TransactionID;

      if (!id) {
        setSelectedTransaction(
          transaction
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/transaction/${id}`
          );

        if (response.ok) {
          const data =
            await response.json();

          setSelectedTransaction(
            data
          );

          return;
        }
      } catch (error) {
        console.log(
          "Transaction details API unavailable."
        );
      }

      setSelectedTransaction({
        ...transaction,

        risk_score:
          transaction.risk_score ||
          transaction.risk ||
          (transaction.is_fraud
            ? 94
            : 18),

        risk_level:
          transaction.is_fraud
            ? "CRITICAL"
            : "LOW",

        explanation:
          transaction.explanation ||
          [
            transaction.is_fraud
              ? "Transaction is connected to a detected fraud pattern."
              : "Transaction behaviour appears normal.",

            transaction.is_fraud
              ? "Related entities show suspicious connections."
              : "No strong fraud-ring connections detected.",

            transaction.is_fraud
              ? "Account behaviour requires investigation."
              : "Account behaviour remains within expected limits.",
          ],

        recommended_action:
          transaction.recommended_action ||
          (transaction.is_fraud
            ? "BLOCK / MANUAL REVIEW"
            : "ALLOW"),
      });
    };

  /* =====================================================
     SEARCH
  ===================================================== */

  const filteredTransactions =
    transactions.filter(
      (transaction) => {
        const matchesSearch =
          JSON.stringify(transaction)
            .toLowerCase()
            .includes(search.toLowerCase());

        const isSuspicious =
          transaction.is_fraud === true ||
          transaction.is_fraud === 1 ||
          Number(transaction.risk_score || transaction.risk || 0) >= 70;

        const matchesFilter =
          transactionFilter === "suspicious"
            ? isSuspicious
            : true;

        return matchesSearch && matchesFilter;
      }
    );

  const navigateFromDashboard = (page, filter = "all") => {
    setTransactionFilter(filter);
    setActivePage(page);
  };

  return (
    <div className="app">

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        apiOnline={apiOnline}
      />

      <main className="main">

        <TopBar
          activePage={activePage}
          search={search}
          setSearch={setSearch}
          onRefresh={loadData}
          loading={loading}
          transactions={transactions}
          rings={rings}
          dashboard={dashboard}
          onTransaction={openTransaction}
        />

        {activePage ===
          "Dashboard" && (
          <DashboardPage
            dashboard={dashboard}
            transactions={
              transactions
            }
            rings={rings}
            accounts={accounts}
            graphData={graphData}
            onTransaction={
              openTransaction
            }
            onNavigate={navigateFromDashboard}
          />
        )}

        {activePage ===
          "Transactions" && (
          <TransactionsPage
            transactions={
              filteredTransactions
            }
            onTransaction={
              openTransaction
            }
            transactionFilter={transactionFilter}
          />
        )}

        {activePage ===
          "Fraud Rings" && (
          <FraudRingsPage
            rings={rings}
            transactions={transactions}
            onTransaction={openTransaction}
            selectedRing={selectedRing}
            setSelectedRing={setSelectedRing}
            onActivity={() => setActivePage("Ring Activity")}
          />
        )}

        {activePage ===
          "Ring Activity" && (
          <RingActivityPage
            transactions={transactions}
            rings={rings}
            onTransaction={openTransaction}
            filter={ringActivityFilter}
            setFilter={setRingActivityFilter}
          />
        )}

        {activePage ===
          "Accounts" && (
          <AccountsPage
            accounts={accounts}
          />
        )}

        <footer className="footer">
          <span>
            FraudGraph AI
          </span>

          <span>
            Real-Time Financial Fraud Intelligence
          </span>

          <span>
            HNX26PSI04
          </span>
        </footer>

      </main>

      {selectedTransaction && (
        <TransactionModal
          transaction={
            selectedTransaction
          }
          onClose={() =>
            setSelectedTransaction(
              null
            )
          }
        />
      )}
    </div>
  );
}

/* =====================================================
   SIDEBAR
===================================================== */

function Sidebar({
  activePage,
  setActivePage,
  apiOnline,
}) {
  const menu = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Transactions",
      icon: Activity,
    },
    {
      name: "Fraud Rings",
      icon: Network,
    },
    {
      name: "Ring Activity",
      icon: Activity,
    },
    {
      name: "Accounts",
      icon: Users,
    },
  ];

  return (
    <aside className="sidebar">

      <div className="brand">

        <div className="brand-icon">
          <ShieldAlert
            size={23}
          />
        </div>

        <div>
          <h2>
            FraudGraph
          </h2>

          <span>
            AI INTELLIGENCE
          </span>
        </div>

      </div>

      <div className="nav-title">
        MONITORING
      </div>

      <nav>
        {menu.map((item) => {
          const Icon =
            item.icon;

          return (
            <button
              key={item.name}
              className={`nav-item ${
                activePage ===
                item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActivePage(
                  item.name
                )
              }
            >

              <Icon size={17} />

              <span>
                {item.name}
              </span>

              {activePage ===
                item.name && (
                <ChevronRight
                  size={14}
                  className="nav-arrow"
                />
              )}

            </button>
          );
        })}
      </nav>

      <div className="sidebar-divider" />

      <div className="nav-title">
        SYSTEM
      </div>

      <div className="system-card">

        <div
          className={`status-dot ${
            apiOnline
              ? ""
              : "demo"
          }`}
        />

        <div>

          <strong>
            {apiOnline
              ? "System Online"
              : "Backend Offline"}
          </strong>

          <small>
            {apiOnline
              ? "FastAPI connected"
              : "Waiting for API"}
          </small>

        </div>

      </div>

      <div className="sidebar-bottom">

        <div className="security-score">

          <ShieldCheck
            size={17}
          />

          <div>

            <strong>
              Protected
            </strong>

            <small>
              AI monitoring active
            </small>

          </div>

        </div>

      </div>

    </aside>
  );
}

/* =====================================================
   TOP BAR
===================================================== */

function TopBar({
  activePage,
  search,
  setSearch,
  onRefresh,
  loading,
  transactions,
  rings,
  dashboard,
  onTransaction,
}) {
  const [notificationOpen, setNotificationOpen] =
    useState(false);

  const suspiciousTransactions =
    (transactions || [])
      .filter(
        (transaction) =>
          transaction.is_fraud === true ||
          transaction.is_fraud === 1 ||
          Number(
            transaction.risk_score ||
              transaction.risk ||
              0
          ) >= 70
      )
      .slice(0, 5);

  const notificationCount = Number(
    dashboard?.suspicious_transactions || 0
  );

  const hasNotifications =
    notificationCount > 0 ||
    suspiciousTransactions.length > 0 ||
    (rings || []).length > 0;

  return (
    <header className="topbar">

      <div>

        <div className="eyebrow">
          FINANCIAL SECURITY /
          REAL-TIME INTELLIGENCE
        </div>

        <h1>
          {activePage}
        </h1>

      </div>

      <div className="top-actions">

        <div className="search-box">

          <Search size={15} />

          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

        <div
          style={{
            position: "relative",
          }}
        >
          <button
            className="icon-button"
            type="button"
            onClick={() =>
              setNotificationOpen((open) => !open)
            }
            aria-label="Notifications"
            aria-expanded={notificationOpen}
          >

            <Bell size={17} />

            {hasNotifications && (
              <span className="notification-dot" />
            )}

          </button>

          {notificationOpen && (
            <div
              style={{
                position: "absolute",
                top: "48px",
                right: 0,
                width: "360px",
                maxWidth: "calc(100vw - 40px)",
                background: "#0f172a",
                border: "1px solid #243047",
                borderRadius: "12px",
                boxShadow: "0 18px 45px rgba(0,0,0,0.45)",
                zIndex: 1000,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid #243047",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong
                    style={{
                      display: "block",
                      color: "#f8fafc",
                      fontSize: "14px",
                    }}
                  >
                    Security Notifications
                  </strong>
                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: "11px",
                    }}
                  >
                    Real-time fraud intelligence
                  </span>
                </div>

                <span
                  style={{
                    color: "#fb7185",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {notificationCount} alerts
                </span>
              </div>

              <div
                style={{
                  maxHeight: "360px",
                  overflowY: "auto",
                }}
              >
                {suspiciousTransactions.length > 0 ? (
                  suspiciousTransactions.map((transaction, index) => {
                    const id =
                      transaction.transaction_id ||
                      transaction.id ||
                      `TXN-${String(index + 1).padStart(5, "0")}`;
                    const risk = Number(
                      transaction.risk_score ||
                        transaction.risk ||
                        94
                    );
                    const amount = Number(
                      transaction.amount || 0
                    );

                    return (
                      <button
                        key={`${id}-${index}`}
                        type="button"
                        onClick={() => {
                          setNotificationOpen(false);
                          onTransaction(transaction);
                        }}
                        style={{
                          width: "100%",
                          border: 0,
                          borderBottom: "1px solid #1e293b",
                          background: "transparent",
                          color: "inherit",
                          padding: "13px 18px",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          gap: "12px",
                          alignItems: "flex-start",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#172033";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            minWidth: "30px",
                            borderRadius: "8px",
                            background: "rgba(244,63,94,0.12)",
                            color: "#fb7185",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <AlertTriangle size={15} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <strong
                            style={{
                              display: "block",
                              color: "#e2e8f0",
                              fontSize: "12px",
                              marginBottom: "4px",
                            }}
                          >
                            High-risk transaction detected
                          </strong>
                          <span
                            style={{
                              display: "block",
                              color: "#94a3b8",
                              fontSize: "11px",
                            }}
                          >
                            {id} • ₹{amount.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <span
                          style={{
                            color: risk >= 85 ? "#fb7185" : "#fbbf24",
                            fontWeight: 800,
                            fontSize: "12px",
                          }}
                        >
                          {risk}
                        </span>
                      </button>
                    );
                  })
                ) : hasNotifications ? (
                  <div
                    style={{
                      padding: "20px 18px",
                      color: "#cbd5e1",
                      fontSize: "12px",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: "6px" }}>
                      {notificationCount} suspicious transactions detected
                    </strong>
                    <span style={{ color: "#94a3b8" }}>
                      {rings?.length || 0} coordinated fraud rings are currently under monitoring.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "28px 18px",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: "12px",
                    }}
                  >
                    <ShieldCheck size={22} style={{ marginBottom: "8px" }} />
                    <div>All clear. No active alerts.</div>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "10px 18px",
                  borderTop: "1px solid #243047",
                  color: "#64748b",
                  fontSize: "10px",
                }}
              >
                Click an alert to open its investigation.
              </div>
            </div>
          )}
        </div>

        <button
          className="refresh-button"
          onClick={onRefresh}
          disabled={loading}
        >

          <RefreshCw
            size={14}
            className={
              loading
                ? "spin"
                : ""
            }
          />

          Refresh

        </button>

      </div>

    </header>
  );
}

/* =====================================================
   DASHBOARD
===================================================== */

function DashboardPage({
  dashboard,
  transactions,
  rings,
  accounts,
  graphData,
  onTransaction,
  onNavigate,
}) {
  const stats =
    dashboard || {
      total_transactions: 0,
      total_accounts: 0,
      suspicious_transactions: 0,
      fraud_rings: 0,
    };

  const suspicious =
    transactions
      .filter(
        (transaction) =>
          transaction.is_fraud ===
            true ||
          transaction.is_fraud ===
            1 ||
          Number(
            transaction.risk_score ||
              0
          ) >= 70
      )
      .slice(0, 7);

  const topAccounts =
    [...accounts]
      .sort(
        (a, b) =>
          Number(
            b.risk_score ||
              b.risk ||
              0
          ) -
          Number(
            a.risk_score ||
              a.risk ||
              0
          )
      )
      .slice(0, 5);

  return (
    <>
      <section className="stats-grid">

        <StatCard
          icon={
            <Database
              size={19}
            />
          }
          label="TOTAL TRANSACTIONS"
          value={formatNumber(
            stats.total_transactions
          )}
          detail="Live transaction stream"
          onClick={() => onNavigate("Transactions", "all")}
        />

        <StatCard
          icon={
            <UserRound
              size={19}
            />
          }
          label="MONITORED ACCOUNTS"
          value={formatNumber(
            stats.total_accounts
          )}
          detail="Across all channels"
          onClick={() => onNavigate("Accounts", "all")}
        />

        <StatCard
          icon={
            <AlertTriangle
              size={19}
            />
          }
          label="SUSPICIOUS TRANSACTIONS"
          value={formatNumber(
            stats.suspicious_transactions
          )}
          detail="Requires investigation"
          danger
          onClick={() => onNavigate("Transactions", "suspicious")}
        />

        <StatCard
          icon={
            <GitBranch
              size={19}
            />
          }
          label="FRAUD RINGS DETECTED"
          value={formatNumber(
            stats.fraud_rings
          )}
          detail="Coordinated groups"
          warning
          onClick={() => onNavigate("Fraud Rings", "all")}
        />

      </section>

      <section className="hero-grid">

        <NetworkPanel
          rings={rings}
          graphData={
            graphData
          }
        />

        <RiskOverview
          suspiciousCount={
            stats.suspicious_transactions
          }
          total={
            stats.total_transactions
          }
        />

      </section>

      <section className="content-grid">

        <Panel
          title="HIGH-RISK TRANSACTIONS"
          subtitle="Transactions requiring immediate attention"
          icon={
            <ShieldAlert
              size={16}
            />
          }
          wide
        >

          <TransactionTable
            transactions={
              suspicious
            }
            onTransaction={
              onTransaction
            }
          />

        </Panel>

        <Panel
          title="FRAUD RINGS"
          subtitle="Detected coordinated activity"
          icon={
            <Network size={16} />
          }
        >

          <RingList
            rings={rings}
          />

        </Panel>

      </section>

      <section className="content-grid">

        <Panel
          title="HIGHEST-RISK ACCOUNTS"
          subtitle="Accounts ranked by AI risk score"
          icon={
            <Users size={16} />
          }
        >

          <AccountList
            accounts={topAccounts}
          />

        </Panel>

        <Panel
          title="DETECTION PIPELINE"
          subtitle="Current intelligence processing"
          icon={
            <Cpu size={16} />
          }
        >

          <Pipeline />

        </Panel>

      </section>
    </>
  );
}

/* =====================================================
   STAT CARD
===================================================== */

function StatCard({
  icon,
  label,
  value,
  detail,
  danger,
  warning,
  onClick,
}) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={onClick ? { cursor: "pointer" } : undefined}
      title={onClick ? "Click to open details" : undefined}
    >

      <div className="stat-top">

        <div
          className={`stat-icon ${
            danger
              ? "danger"
              : warning
              ? "warning"
              : ""
          }`}
        >
          {icon}
        </div>

        <ArrowUpRight
          size={15}
          className="muted-icon"
        />

      </div>

      <div className="stat-label">
        {label}
      </div>

      <div className="stat-value">
        {value}
      </div>

      <div
        className={`stat-detail ${
          danger
            ? "danger-text"
            : ""
        }`}
      >
        {detail}
      </div>

    </div>
  );
}

/* =====================================================
   INTERACTIVE NETWORK GRAPH
===================================================== */

function NetworkPanel({
  rings,
  graphData,
}) {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodeFilter, setNodeFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  /* -----------------------------------------------------
     COUNTS
  ----------------------------------------------------- */

  const accountCount = nodes.filter(
    (node) =>
      String(node.type || "").toLowerCase() === "account"
  ).length;

  const deviceCount = nodes.filter(
    (node) =>
      String(node.type || "").toLowerCase() === "device"
  ).length;

  const merchantCount = nodes.filter(
    (node) =>
      String(node.type || "").toLowerCase() === "merchant"
  ).length;

  /* -----------------------------------------------------
     FILTER NODES
  ----------------------------------------------------- */

  const filteredNodes = nodes.filter((node) => {
    const type = String(
      node.type || "other"
    ).toLowerCase();

    if (nodeFilter === "all") {
      return true;
    }

    return type === nodeFilter;
  });

  /*
    Keep the graph lightweight.
    FraudGraph currently has a small suspicious graph,
    but this protects the browser if the dataset grows.
  */
  const visibleNodes = filteredNodes.slice(0, 80);

  /* -----------------------------------------------------
     NODE COLORS
  ----------------------------------------------------- */

  const getNodeColor = (node) => {
    const type = String(
      node.type || "other"
    ).toLowerCase();

    if (type === "account") {
      return Number(node.risk_score || 0) >= 85
        ? "#ef4444"
        : "#38bdf8";
    }

    if (type === "device") {
      return "#a78bfa";
    }

    if (type === "merchant") {
      return "#22c55e";
    }

    return "#64748b";
  };

  /* -----------------------------------------------------
     NODE POSITIONS
  ----------------------------------------------------- */

  const getNodePosition = (node, index) => {
    const type = String(
      node.type || "other"
    ).toLowerCase();

    const typeNodes = visibleNodes.filter(
      (item) =>
        String(
          item.type || "other"
        ).toLowerCase() === type
    );

    const typeIndex = typeNodes.findIndex(
      (item) =>
        String(item.id) === String(node.id)
    );

    const columns = {
      account: 150,
      device: 380,
      merchant: 610,
    };

    const x =
      columns[type] ||
      380;

    const row =
      typeIndex >= 0
        ? typeIndex
        : index;

    const maxRows = Math.max(
      1,
      typeNodes.length
    );

    const y =
      45 +
      (row * 320) /
        maxRows;

    return {
      x,
      y: Math.max(
        30,
        Math.min(375, y)
      ),
    };
  };

  const positions = new Map(
    visibleNodes.map(
      (node, index) => [
        String(node.id),
        getNodePosition(
          node,
          index
        ),
      ]
    )
  );

  /* -----------------------------------------------------
     VISIBLE LINKS
  ----------------------------------------------------- */

  const visibleLinks = links
    .filter((link) => {
      const source = String(
        link.source?.id ??
          link.source
      );

      const target = String(
        link.target?.id ??
          link.target
      );

      return (
        positions.has(source) &&
        positions.has(target)
      );
    })
    .slice(0, 120);

  /* -----------------------------------------------------
     CONNECTION CHECK
  ----------------------------------------------------- */

  const isConnectedToSelected = (
    nodeId
  ) => {
    if (!selectedNode) {
      return false;
    }

    const selectedId = String(
      selectedNode.id
    );

    const currentId = String(
      nodeId
    );

    if (
      selectedId === currentId
    ) {
      return true;
    }

    return visibleLinks.some(
      (link) => {
        const source = String(
          link.source?.id ??
            link.source
        );

        const target = String(
          link.target?.id ??
            link.target
        );

        return (
          (source === selectedId &&
            target === currentId) ||
          (target === selectedId &&
            source === currentId)
        );
      }
    );
  };

  /* -----------------------------------------------------
     SELECT NODE
  ----------------------------------------------------- */

  const handleNodeClick = (
    node
  ) => {
    if (
      selectedNode &&
      String(selectedNode.id) ===
        String(node.id)
    ) {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  /* -----------------------------------------------------
     RESET GRAPH
  ----------------------------------------------------- */

  const resetGraph = () => {
    setSelectedNode(null);
    setHoveredNode(null);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setNodeFilter("all");
  };

  /* -----------------------------------------------------
     ZOOM
  ----------------------------------------------------- */

  const zoomIn = () => {
    setZoom((value) =>
      Math.min(
        2.2,
        Number(
          (value + 0.2).toFixed(2)
        )
      )
    );
  };

  const zoomOut = () => {
    setZoom((value) =>
      Math.max(
        0.65,
        Number(
          (value - 0.2).toFixed(2)
        )
      )
    );
  };

  /* -----------------------------------------------------
     SELECTED NODE CONNECTIONS
  ----------------------------------------------------- */

  const connectedNodes = selectedNode
    ? visibleNodes.filter(
        (node) =>
          isConnectedToSelected(
            node.id
          )
      )
    : [];

  /* -----------------------------------------------------
     RENDER
  ----------------------------------------------------- */

  return (
    <div className="panel network-panel">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="panel-heading">

        <div>

          <div className="panel-label">
            NETWORK ANALYSIS
          </div>

          <h3>
            Suspicious Network
          </h3>

          <p>
            Live relationship graph of connected
            accounts, devices and merchants
          </p>

        </div>

        <div className="live-badge">
          <span />
          LIVE
        </div>

      </div>

      {/* =================================================
          GRAPH CONTROLS
      ================================================= */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >

        {/* FILTERS */}

        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >

          {[
            ["all", "ALL"],
            ["account", "ACCOUNTS"],
            ["device", "DEVICES"],
            ["merchant", "MERCHANTS"],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setNodeFilter(value);
                  setSelectedNode(null);
                }}
                style={{
                  border:
                    nodeFilter === value
                      ? "1px solid #3b82f6"
                      : "1px solid #26344d",

                  background:
                    nodeFilter === value
                      ? "rgba(37,99,235,0.18)"
                      : "#0b1220",

                  color:
                    nodeFilter === value
                      ? "#60a5fa"
                      : "#94a3b8",

                  borderRadius: "7px",
                  padding:
                    "6px 10px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.7px",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            )
          )}

        </div>

        {/* ZOOM CONTROLS */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >

          <button
            type="button"
            onClick={zoomOut}
            title="Zoom out"
            style={{
              width: "30px",
              height: "30px",
              border:
                "1px solid #26344d",
              background: "#0b1220",
              color: "#cbd5e1",
              borderRadius: "7px",
              cursor: "pointer",
              fontSize: "17px",
            }}
          >
            −
          </button>

          <span
            style={{
              minWidth: "48px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            {Math.round(
              zoom * 100
            )}
            %
          </span>

          <button
            type="button"
            onClick={zoomIn}
            title="Zoom in"
            style={{
              width: "30px",
              height: "30px",
              border:
                "1px solid #26344d",
              background: "#0b1220",
              color: "#cbd5e1",
              borderRadius: "7px",
              cursor: "pointer",
              fontSize: "17px",
            }}
          >
            +
          </button>

          <button
            type="button"
            onClick={resetGraph}
            title="Reset graph"
            style={{
              height: "30px",
              border:
                "1px solid #26344d",
              background: "#0b1220",
              color: "#94a3b8",
              borderRadius: "7px",
              padding:
                "0 10px",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            RESET
          </button>

        </div>

      </div>

      {/* =================================================
          GRAPH AREA
      ================================================= */}

      <div
        className="graph-area"
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: "420px",
          background:
            "radial-gradient(circle at center, #111a30 0%, #080d18 75%)",
          borderRadius: "12px",
          border:
            "1px solid #18243a",
        }}
      >

        {visibleNodes.length > 0 ? (

          <svg
            viewBox="0 0 760 420"
            width="100%"
            height="420"
            style={{
              display: "block",
              userSelect: "none",
            }}
            onClick={() => {
              setSelectedNode(null);
            }}
          >

            {/* =========================================
                GRID
            ========================================= */}

            <defs>

              <pattern
                id="fraudGrid"
                width="35"
                height="35"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 35 0 L 0 0 0 35"
                  fill="none"
                  stroke="rgba(148,163,184,0.055)"
                  strokeWidth="1"
                />
              </pattern>

            </defs>

            <rect
              x="0"
              y="0"
              width="760"
              height="420"
              fill="url(#fraudGrid)"
            />

            {/* =========================================
                COLUMN LABELS
            ========================================= */}

            <text
              x="150"
              y="18"
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              letterSpacing="1.5"
            >
              ACCOUNTS
            </text>

            <text
              x="380"
              y="18"
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              letterSpacing="1.5"
            >
              DEVICES
            </text>

            <text
              x="610"
              y="18"
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              letterSpacing="1.5"
            >
              MERCHANTS
            </text>

            {/* =========================================
                GRAPH CONTENT
            ========================================= */}

            <g
              transform={`
                translate(${panX} ${panY})
                translate(380 210)
                scale(${zoom})
                translate(-380 -210)
              `}
            >

              {/* -----------------------------------------
                  LINKS
              ----------------------------------------- */}

              {visibleLinks.map(
                (link, index) => {

                  const sourceId =
                    String(
                      link.source?.id ??
                        link.source
                    );

                  const targetId =
                    String(
                      link.target?.id ??
                        link.target
                    );

                  const source =
                    positions.get(
                      sourceId
                    );

                  const target =
                    positions.get(
                      targetId
                    );

                  if (
                    !source ||
                    !target
                  ) {
                    return null;
                  }

                  const active =
                    selectedNode &&
                    isConnectedToSelected(
                      sourceId
                    ) &&
                    isConnectedToSelected(
                      targetId
                    );

                  return (
                    <line
                      key={`link-${index}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={
                        active
                          ? "#60a5fa"
                          : "rgba(100,116,139,0.28)"
                      }
                      strokeWidth={
                        active
                          ? 2.5
                          : 1
                      }
                      opacity={
                        selectedNode
                          ? active
                            ? 1
                            : 0.18
                          : 0.75
                      }
                    />
                  );
                }
              )}

              {/* -----------------------------------------
                  NODES
              ----------------------------------------- */}

              {visibleNodes.map(
                (node, index) => {

                  const position =
                    positions.get(
                      String(node.id)
                    );

                  if (!position) {
                    return null;
                  }

                  const color =
                    getNodeColor(node);

                  const isSelected =
                    selectedNode &&
                    String(
                      selectedNode.id
                    ) ===
                      String(
                        node.id
                      );

                  const isConnected =
                    selectedNode
                      ? isConnectedToSelected(
                          node.id
                        )
                      : false;

                  const isHovered =
                    hoveredNode &&
                    String(
                      hoveredNode.id
                    ) ===
                      String(node.id);

                  const isHighRisk =
                    node.type ===
                      "account" &&
                    Number(
                      node.risk_score ||
                        0
                    ) >= 85;

                  const radius =
                    node.type ===
                    "account"
                      ? 8
                      : 6;

                  return (
                    <g
                      key={`node-${String(
                        node.id
                      )}-${index}`}
                      style={{
                        cursor:
                          "pointer",
                      }}
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        handleNodeClick(
                          node
                        );
                      }}
                      onMouseEnter={() =>
                        setHoveredNode(
                          node
                        )
                      }
                      onMouseLeave={() =>
                        setHoveredNode(
                          null
                        )
                      }
                    >

                      {/* HIGH RISK GLOW */}

                      {isHighRisk && (
                        <circle
                          cx={
                            position.x
                          }
                          cy={
                            position.y
                          }
                          r={
                            radius +
                            7
                          }
                          fill="none"
                          stroke="rgba(239,68,68,0.35)"
                          strokeWidth="2"
                        />
                      )}

                      {/* SELECTED GLOW */}

                      {isSelected && (
                        <circle
                          cx={
                            position.x
                          }
                          cy={
                            position.y
                          }
                          r={
                            radius +
                            9
                          }
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="2"
                        />
                      )}

                      {/* CONNECTION GLOW */}

                      {selectedNode &&
                        isConnected &&
                        !isSelected && (
                          <circle
                            cx={
                              position.x
                            }
                            cy={
                              position.y
                            }
                            r={
                              radius +
                              4
                            }
                            fill="none"
                            stroke="rgba(96,165,250,0.45)"
                            strokeWidth="1.5"
                          />
                        )}

                      {/* MAIN NODE */}

                      <circle
                        cx={
                          position.x
                        }
                        cy={
                          position.y
                        }
                        r={
                          isHovered
                            ? radius +
                              2
                            : radius
                        }
                        fill={color}
                        stroke={
                          isSelected
                            ? "#ffffff"
                            : "rgba(255,255,255,0.12)"
                        }
                        strokeWidth={
                          isSelected
                            ? 2
                            : 1
                        }
                        opacity={
                          selectedNode &&
                          !isConnected &&
                          !isSelected
                            ? 0.25
                            : 1
                        }
                      />

                      {/* NODE LABEL */}

                      <text
                        x={
                          position.x
                        }
                        y={
                          position.y +
                          20
                        }
                        textAnchor="middle"
                        fill={
                          selectedNode &&
                          !isConnected &&
                          !isSelected
                            ? "#475569"
                            : "#cbd5e1"
                        }
                        fontSize="9"
                        fontWeight={
                          isSelected
                            ? "700"
                            : "400"
                        }
                      >
                        {String(
                          node.id
                        ).slice(
                          0,
                          13
                        )}
                      </text>

                    </g>
                  );
                }
              )}

            </g>

            {/* =========================================
                FOOTER INFO
            ========================================= */}

            <text
              x="15"
              y="405"
              fill="#475569"
              fontSize="9"
            >
              Showing{" "}
              {visibleNodes.length}{" "}
              of{" "}
              {nodes.length}{" "}
              network entities
            </text>

          </svg>

        ) : (

          <div
            style={{
              height: "420px",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              flexDirection:
                "column",
              gap: "10px",
              color: "#94a3b8",
            }}
          >

            <Network
              size={32}
            />

            <strong>
              No network data available
            </strong>

            <span>
              Start the FastAPI backend
              to load the fraud network.
            </span>

          </div>

        )}

        {/* =================================================
            HOVER TOOLTIP
        ================================================= */}

        {hoveredNode && (

          <div
            style={{
              position:
                "absolute",
              top: "15px",
              right: "15px",
              minWidth:
                "190px",
              padding:
                "12px",
              border:
                "1px solid #26344d",
              background:
                "rgba(7,13,25,0.96)",
              borderRadius:
                "9px",
              boxShadow:
                "0 12px 35px rgba(0,0,0,0.35)",
              pointerEvents:
                "none",
              zIndex: 5,
            }}
          >

            <div
              style={{
                color:
                  "#60a5fa",
                fontSize:
                  "9px",
                fontWeight:
                  700,
                letterSpacing:
                  "1px",
                marginBottom:
                  "6px",
              }}
            >
              SELECT ENTITY
            </div>

            <div
              style={{
                color:
                  "#f8fafc",
                fontSize:
                  "14px",
                fontWeight:
                  700,
                marginBottom:
                  "5px",
              }}
            >
              {String(
                hoveredNode.id
              )}
            </div>

            <div
              style={{
                color:
                  "#94a3b8",
                fontSize:
                  "11px",
                marginBottom:
                  "4px",
              }}
            >
              Type:{" "}
              {String(
                hoveredNode.type ||
                  "unknown"
              ).toUpperCase()}
            </div>

            {hoveredNode.risk_score !==
              undefined && (
              <div
                style={{
                  color:
                    Number(
                      hoveredNode.risk_score
                    ) >= 85
                      ? "#f87171"
                      : "#94a3b8",
                  fontSize:
                    "11px",
                }}
              >
                Risk Score:{" "}
                {hoveredNode.risk_score}
              </div>
            )}

          </div>

        )}

        {/* =================================================
            LEGEND
        ================================================= */}

        <div
          className="graph-legend"
          style={{
            position:
              "absolute",
            bottom: "12px",
            left: "15px",
          }}
        >

          <span>
            <i className="legend-account" />
            Account
          </span>

          <span>
            <i className="legend-device" />
            Device
          </span>

          <span>
            <i className="legend-merchant" />
            Merchant
          </span>

        </div>

      </div>

      {/* =================================================
          SELECTED NODE INFORMATION
      ================================================= */}

      {selectedNode && (

        <div
          style={{
            marginTop: "12px",
            padding: "14px",
            border:
              "1px solid rgba(59,130,246,0.25)",
            background:
              "rgba(15,23,42,0.65)",
            borderRadius: "10px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >

          <div>

            <div
              style={{
                color:
                  "#64748b",
                fontSize:
                  "9px",
                letterSpacing:
                  "1px",
                marginBottom:
                  "4px",
              }}
            >
              SELECTED ENTITY
            </div>

            <div
              style={{
                color:
                  "#f8fafc",
                fontSize:
                  "15px",
                fontWeight:
                  700,
              }}
            >
              {String(
                selectedNode.id
              )}
            </div>

            <div
              style={{
                color:
                  "#94a3b8",
                fontSize:
                  "10px",
                marginTop:
                  "4px",
              }}
            >
              {String(
                selectedNode.type ||
                  "unknown"
              ).toUpperCase()}
            </div>

          </div>

          <div
            style={{
              display:
                "flex",
              gap: "24px",
              alignItems:
                "center",
            }}
          >

            {selectedNode.risk_score !==
              undefined && (

              <div>

                <div
                  style={{
                    color:
                      "#64748b",
                    fontSize:
                      "9px",
                  }}
                >
                  RISK
                </div>

                <strong
                  style={{
                    color:
                      Number(
                        selectedNode.risk_score
                      ) >= 85
                        ? "#ef4444"
                        : "#60a5fa",
                    fontSize:
                      "18px",
                  }}
                >
                  {selectedNode.risk_score}
                </strong>

              </div>

            )}

            <div>

              <div
                style={{
                  color:
                    "#64748b",
                  fontSize:
                    "9px",
                }}
              >
                CONNECTIONS
              </div>

              <strong
                style={{
                  color:
                    "#f8fafc",
                  fontSize:
                    "18px",
                }}
              >
                {Math.max(
                  0,
                  connectedNodes.length -
                    1
                )}
              </strong>

            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedNode(
                  null
                )
              }
              style={{
                border:
                  "1px solid #26344d",
                background:
                  "#0b1220",
                color:
                  "#94a3b8",
                borderRadius:
                  "7px",
                padding:
                  "7px 11px",
                cursor:
                  "pointer",
                fontSize:
                  "10px",
              }}
            >
              CLEAR
            </button>

          </div>

        </div>

      )}

      {/* =================================================
          NETWORK FOOTER
      ================================================= */}

      <div className="network-footer">

        <div>
          <strong>
            {rings.length}
          </strong>
          <span>
            detected rings
          </span>
        </div>

        <div>
          <strong>
            {accountCount}
          </strong>
          <span>
            accounts
          </span>
        </div>

        <div>
          <strong>
            {deviceCount}
          </strong>
          <span>
            devices
          </span>
        </div>

        <div>
          <strong>
            {merchantCount}
          </strong>
          <span>
            merchants
          </span>
        </div>

      </div>

    </div>
  );
}



/* =====================================================
   RISK OVERVIEW
===================================================== */

function RiskOverview({
  suspiciousCount,
  total,
}) {
  const suspiciousRate =
    total > 0
      ? (
          (suspiciousCount /
            total) *
          100
        ).toFixed(2)
      : "0.00";

  return (
    <div className="panel risk-panel">

      <div className="panel-heading">

        <div>

          <div className="panel-label">
            AI RISK ENGINE
          </div>

          <h3>
            Risk Overview
          </h3>

          <p>
            Current threat intelligence level
          </p>

        </div>

        <Zap size={18} />

      </div>

      <div className="risk-score-wrapper">

        <div className="risk-circle">

          <div>

            <strong>
              94
            </strong>

            <span>
              /100
            </span>

          </div>

        </div>

        <div className="risk-status">

          <span className="critical-dot" />

          <strong>
            HIGH THREAT
          </strong>

          <small>
            Fraud activity detected
          </small>

        </div>

      </div>

      <div className="risk-bars">

        <RiskBar
          label="Transaction Risk"
          value={92}
        />

        <RiskBar
          label="Account Risk"
          value={87}
        />

        <RiskBar
          label="Network Risk"
          value={95}
        />

        <RiskBar
          label="Anomaly Score"
          value={89}
        />

      </div>

      <div className="risk-summary">

        <span>
          Suspicious rate
        </span>

        <strong>
          {suspiciousRate}%
        </strong>

      </div>

    </div>
  );
}

function RiskBar({
  label,
  value,
}) {
  return (
    <div className="risk-bar-row">

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>
      </div>

      <div className="risk-bar">

        <div
          style={{
            width: `${value}%`,
          }}
        />

      </div>

    </div>
  );
}

/* =====================================================
   TRANSACTIONS PAGE
===================================================== */

function TransactionsPage({
  transactions,
  onTransaction,
  transactionFilter = "all",
}) {
  return (
    <Panel
      title="TRANSACTION INTELLIGENCE"
      subtitle="Real-time transaction monitoring and risk ranking"
      icon={
        <Activity size={16} />
      }
      full
    >

      <TransactionTable
        transactions={
          transactions
        }
        onTransaction={
          onTransaction
        }
        showAll
        transactionFilter={transactionFilter}
      />

    </Panel>
  );
}

/* =====================================================
   TRANSACTION TABLE
===================================================== */

function TransactionTable({
  transactions,
  onTransaction,
  showAll = false,
  transactionFilter = "all",
}) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = showAll ? 50 : 7;
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [transactions.length, transactionFilter, showAll]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const displayed = transactions.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  if (
    displayed.length ===
    0
  ) {
    return (
      <div className="empty-state">

        <ShieldCheck
          size={25}
        />

        <strong>
          No transactions available
        </strong>

        <span>
          Waiting for backend data.
        </span>

      </div>
    );
  }

  return (
    <div className="table-wrapper">

      <table>

        <thead>

          <tr>

            <th>
              TRANSACTION
            </th>

            <th>
              ACCOUNT
            </th>

            <th>
              MERCHANT
            </th>

            <th>
              AMOUNT
            </th>

            <th>
              RISK
            </th>

            <th>
              STATUS
            </th>

            <th />

          </tr>

        </thead>

        <tbody>

          {displayed.map(
            (
              transaction,
              index
            ) => {
              const id =
                transaction.transaction_id ||
                transaction.id ||
                transaction.TransactionID ||
                `TXN-${String(
                  index + 1
                ).padStart(
                  5,
                  "0"
                )}`;

              const account =
                transaction.account_id ||
                transaction.account ||
                "A0001";

              const merchant =
                transaction.merchant_id ||
                transaction.merchant ||
                "M0001";

              const amount =
                Number(
                  transaction.amount ||
                    transaction.Amount ||
                    0
                );

              const isFraud =
                transaction.is_fraud ===
                  true ||
                transaction.is_fraud ===
                  1;

              const risk =
                Number(
                  transaction.risk_score ||
                    transaction.risk ||
                    (isFraud
                      ? 94
                      : 18)
                );

              return (
                <tr
                  key={`${id}-${index}`}
                >

                  <td>

                    <div className="transaction-id">

                      <span className="txn-icon">

                        <CircleDollarSign
                          size={14}
                        />

                      </span>

                      <strong>
                        {id}
                      </strong>

                    </div>

                  </td>

                  <td>

                    <span className="mono">
                      {account}
                    </span>

                  </td>

                  <td>

                    <span className="merchant-cell">

                      <Store
                        size={13}
                      />

                      {merchant}

                    </span>

                  </td>

                  <td>

                    <strong>
                      ₹
                      {amount.toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                  </td>

                  <td>

                    <RiskBadge
                      score={
                        risk
                      }
                    />

                  </td>

                  <td>

                    <StatusBadge
                      fraud={
                        isFraud ||
                        risk >= 70
                      }
                    />

                  </td>

                  <td>

                    <button
                      className="view-button"
                      onClick={() =>
                        onTransaction(
                          transaction
                        )
                      }
                    >

                      <Eye
                        size={14}
                      />

                    </button>

                  </td>

                </tr>
              );
            }
          )}

        </tbody>

      </table>

      {showAll && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "14px 4px 2px",
            color: "#94a3b8",
            fontSize: "12px",
          }}
        >
          <span>
            Showing {transactions.length ? startIndex + 1 : 0}
            -{Math.min(startIndex + PAGE_SIZE, transactions.length)}
            {" "}of {transactions.length.toLocaleString("en-IN")} transactions
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              className="view-button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ opacity: safePage <= 1 ? 0.4 : 1 }}
            >
              Previous
            </button>

            <span style={{ minWidth: "80px", textAlign: "center" }}>
              Page {safePage} / {totalPages}
            </span>

            <button
              className="view-button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ opacity: safePage >= totalPages ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* =====================================================
   RISK BADGE
===================================================== */

function RiskBadge({
  score,
}) {
  let level =
    "LOW";

  if (score >= 85)
    level = "CRITICAL";
  else if (score >= 70)
    level = "HIGH";
  else if (score >= 40)
    level = "MEDIUM";

  return (
    <span
      className={`risk-badge ${level.toLowerCase()}`}
    >
      {score}
    </span>
  );
}

function StatusBadge({
  fraud,
}) {
  return (
    <span
      className={`status-badge ${
        fraud
          ? "blocked"
          : "normal"
      }`}
    >
      {fraud
        ? "FLAGGED"
        : "NORMAL"}
    </span>
  );
}

/* =====================================================
   FRAUD RINGS PAGE
===================================================== */

function FraudRingsPage({
  rings,
  transactions,
  onTransaction,
  selectedRing,
  setSelectedRing,
  onActivity,
}) {
  const [ringSearch, setRingSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const data = Array.isArray(rings) ? rings : [];

  const filteredRings = data.filter((ring, index) => {
    const id =
      ring.ring_id ||
      ring.id ||
      `RING_${String(index + 1).padStart(3, "0")}`;

    const pattern =
      ring.pattern ||
      ring.type ||
      "COMMON_DESTINATION";

    const confidence = Number(ring.confidence || (91 - index * 4));
    const query = ringSearch.trim().toLowerCase();

    const matchesSearch =
      !query ||
      `${id} ${pattern}`.toLowerCase().includes(query);

    const matchesRisk =
      riskFilter === "all" ||
      (riskFilter === "critical" && confidence >= 85) ||
      (riskFilter === "high" && confidence >= 70 && confidence < 85);

    return matchesSearch && matchesRisk;
  });

  const getRingId = (ring, index) =>
    ring?.ring_id ||
    ring?.id ||
    `RING_${String(index + 1).padStart(3, "0")}`;

  const getRingTransactions = (ring, index) => {
    const ringId = getRingId(ring, index);
    const ringAccounts = Array.isArray(ring?.accounts)
      ? ring.accounts.map(String)
      : [];

    return (transactions || []).filter((transaction) => {
      const transactionRing = String(
        transaction.ring_id || transaction.ring || ""
      );
      const account = String(
        transaction.account_id || transaction.account || ""
      );

      return (
        transactionRing === String(ringId) ||
        ringAccounts.includes(account)
      );
    });
  };

  const selectedIndex = selectedRing
    ? data.findIndex(
        (ring, index) =>
          getRingId(ring, index) === getRingId(selectedRing.ring, selectedRing.index)
      )
    : -1;

  const selectedTransactions = selectedRing
    ? getRingTransactions(selectedRing.ring, selectedRing.index)
    : [];

  return (
    <div className="rings-page">

      <div className="page-intro">
        <div>
          <div className="panel-label">GRAPH ML DETECTION</div>
          <h2>Detected Fraud Rings</h2>
          <p>
            Investigate coordinated groups identified through shared
            accounts, devices, merchants and transaction behaviour.
          </p>
        </div>

        <div className="ring-count">
          <GitBranch size={18} />
          <strong>{data.length}</strong>
          <span>rings detected</span>
        </div>
      </div>

      <div
        className="ring-controls"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        <div className="search-box" style={{ flex: "1 1 260px" }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Search ring ID or pattern..."
            value={ringSearch}
            onChange={(e) => setRingSearch(e.target.value)}
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{
            minHeight: "40px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid #243047",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <option value="all">All confidence</option>
          <option value="critical">Critical (85+)</option>
          <option value="high">High (70–84)</option>
        </select>
      </div>

      <div className="ring-grid">
        {filteredRings.length > 0 ? (
          filteredRings.map((ring) => {
            const index = data.indexOf(ring);
            return (
              <RingCard
                key={getRingId(ring, index)}
                ring={ring}
                index={index}
                onClick={() =>
                  setSelectedRing({ ring, index })
                }
              />
            );
          })
        ) : (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            <ShieldCheck size={25} />
            <strong>No matching fraud rings</strong>
            <span>Try another search or confidence filter.</span>
          </div>
        )}
      </div>

      {selectedRing && (
        <RingInvestigationModal
          ring={selectedRing.ring}
          index={selectedRing.index}
          transactions={selectedTransactions}
          onClose={() => setSelectedRing(null)}
          onTransaction={onTransaction}
          selectedIndex={selectedIndex}
          onActivity={onActivity}
        />
      )}
    </div>
  );
}

/* =====================================================
   INTERACTIVE RING CARD
===================================================== */

function RingCard({
  ring,
  index,
  onClick,
}) {
  const id =
    ring.ring_id ||
    ring.id ||
    `RING_${String(index + 1).padStart(3, "0")}`;

  const pattern =
    ring.pattern ||
    ring.type ||
    "COMMON_DESTINATION";

  const members =
    Array.isArray(ring.accounts)
      ? ring.accounts.length
      : Number(ring.members || 5);

  const confidence =
    Number(ring.confidence || (90 - index * 3));

  const severity =
    confidence >= 85
      ? "CRITICAL"
      : confidence >= 70
      ? "HIGH"
      : "MEDIUM";

  return (
    <button
      type="button"
      className="ring-card"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        color: "inherit",
      }}
      aria-label={`Open investigation for ${id}`}
    >
      <div className="ring-card-top">
        <div className="ring-id">
          <GitBranch size={15} />
          {id}
        </div>

        <span className="confidence">
          {confidence}% confidence
        </span>
      </div>

      <h3>{formatPattern(pattern)}</h3>

      <p>
        Coordinated activity detected across multiple entities.
        Open the investigation to inspect members, transactions,
        risk and recommended action.
      </p>

      <div className="ring-stats">
        <div>
          <strong>{members}</strong>
          <span>Accounts</span>
        </div>

        <div>
          <strong>{Number(ring.devices?.length || index + 2)}</strong>
          <span>Devices</span>
        </div>

        <div>
          <strong>{Number(ring.merchants?.length || index + 1)}</strong>
          <span>Merchants</span>
        </div>
      </div>

      <div className="ring-action">
        <span>
          <AlertTriangle size={13} />
          {severity} RISK · Open investigation
        </span>
        <ChevronRight size={15} />
      </div>
    </button>
  );
}

/* =====================================================
   RING INVESTIGATION MODAL
===================================================== */

function RingInvestigationModal({
  ring,
  index,
  transactions,
  onClose,
  onTransaction,
  onActivity,
}) {
  const id =
    ring.ring_id ||
    ring.id ||
    `RING_${String(index + 1).padStart(3, "0")}`;

  const pattern =
    ring.pattern ||
    ring.type ||
    "COMMON_DESTINATION";

  const confidence = Number(
    ring.confidence || (90 - index * 3)
  );

  const accounts = Array.isArray(ring.accounts)
    ? ring.accounts
    : [];

  const devices = Array.isArray(ring.devices)
    ? ring.devices
    : [];

  const merchants = Array.isArray(ring.merchants)
    ? ring.merchants
    : [];

  const amount = transactions.reduce(
    (sum, transaction) =>
      sum + Number(transaction.amount || 0),
    0
  );

  const risk = Math.min(
    99,
    Math.max(
      confidence,
      transactions.some(
        (transaction) =>
          transaction.is_fraud === true ||
          transaction.is_fraud === 1
      )
        ? 85
        : 0
    )
  );

  const action =
    risk >= 85
      ? "BLOCK / MANUAL REVIEW"
      : "ENHANCED MONITORING";

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="investigation-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "980px" }}
      >
        <div className="modal-header">
          <div>
            <div className="panel-label">FRAUD RING INVESTIGATION</div>
            <h2>{id}</h2>
          </div>

          <button
            className="close-button"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <RingMetric label="CONFIDENCE" value={`${confidence}%`} />
          <RingMetric label="RISK SCORE" value={`${risk}/100`} />
          <RingMetric label="TRANSACTIONS" value={transactions.length} />
          <RingMetric label="AMOUNT" value={`₹${amount.toLocaleString("en-IN")}`} />
        </div>

        <div className="detail-grid">
          <Detail
            icon={<GitBranch size={15} />}
            label="PATTERN"
            value={formatPattern(pattern)}
          />
          <Detail
            icon={<Users size={15} />}
            label="ACCOUNTS"
            value={accounts.length || ring.members || "Detected"}
          />
          <Detail
            icon={<Smartphone size={15} />}
            label="DEVICES"
            value={devices.length || "Detected"}
          />
          <Detail
            icon={<Store size={15} />}
            label="MERCHANTS"
            value={merchants.length || "Detected"}
          />
        </div>

        <div className="explanation-section">
          <div className="panel-label">WHY WAS THIS RING FLAGGED?</div>
          <div className="explanation-list">
            <div className="explanation">
              <div>1</div>
              <span>
                {formatPattern(pattern)} activity was identified across related entities.
              </span>
            </div>
            <div className="explanation">
              <div>2</div>
              <span>
                {transactions.length} related transaction{transactions.length === 1 ? "" : "s"} are available for investigation.
              </span>
            </div>
            <div className="explanation">
              <div>3</div>
              <span>
                Graph relationships indicate coordinated behaviour requiring review.
              </span>
            </div>
          </div>
        </div>

        <div
          className="panel"
          style={{
            marginTop: "18px",
            padding: "16px",
          }}
        >
          <div className="panel-heading">
            <div>
              <div className="panel-label">RELATED TRANSACTIONS</div>
              <h3>Ring Activity</h3>
            </div>
            <Activity size={17} />
          </div>

          {transactions.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>TRANSACTION</th>
                    <th>ACCOUNT</th>
                    <th>AMOUNT</th>
                    <th>RISK</th>
                    <th>STATUS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 8).map((transaction, transactionIndex) => {
                    const transactionId =
                      transaction.transaction_id ||
                      transaction.id ||
                      `TXN-${transactionIndex + 1}`;
                    const isFraud =
                      transaction.is_fraud === true ||
                      transaction.is_fraud === 1;
                    const transactionRisk = Number(
                      transaction.risk_score ||
                        transaction.risk ||
                        (isFraud ? 94 : 70)
                    );

                    return (
                      <tr key={`${transactionId}-${transactionIndex}`}>
                        <td>
                          <strong>{transactionId}</strong>
                        </td>
                        <td>
                          <span className="mono">
                            {transaction.account_id || transaction.account || "Unknown"}
                          </span>
                        </td>
                        <td>
                          <strong>
                            ₹{Number(transaction.amount || 0).toLocaleString("en-IN")}
                          </strong>
                        </td>
                        <td>
                          <RiskBadge score={transactionRisk} />
                        </td>
                        <td>
                          <StatusBadge fraud={isFraud || transactionRisk >= 70} />
                        </td>
                        <td>
                          <button
                            className="view-button"
                            type="button"
                            onClick={() => onTransaction(transaction)}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Network size={24} />
              <strong>No directly linked transactions returned</strong>
              <span>Ring metadata is available, but the API did not return matching transaction IDs/accounts.</span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px",
          }}
        >
          <button
            type="button"
            className="refresh-button"
            onClick={() => {
              onClose();
              if (onActivity) onActivity();
            }}
          >
            <Activity size={14} />
            View Full Ring Activity
          </button>
        </div>

        <div className="recommendation" style={{ marginTop: "18px" }}>
          <div className="recommendation-icon">
            <ShieldAlert size={18} />
          </div>
          <div>
            <span>RECOMMENDED ACTION</span>
            <strong>{action}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function RingMetric({ label, value }) {
  return (
    <div
      style={{
        padding: "13px",
        border: "1px solid #243047",
        borderRadius: "10px",
        background: "rgba(15,23,42,0.65)",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#64748b",
          fontSize: "9px",
          letterSpacing: "0.08em",
          marginBottom: "5px",
        }}
      >
        {label}
      </span>
      <strong style={{ color: "#e2e8f0", fontSize: "15px" }}>
        {value}
      </strong>
    </div>
  );
}

/* =====================================================
   RING ACTIVITY PAGE
===================================================== */

function RingActivityPage({
  transactions,
  rings,
  onTransaction,
  filter,
  setFilter,
}) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const ringIds = rings.map((ring, index) =>
    ring.ring_id || ring.id || `RING_${String(index + 1).padStart(3, "0")}`
  );

  const activities = (transactions || [])
    .filter((transaction) => {
      const ringId = String(transaction.ring_id || transaction.ring || "");
      const isFraud = transaction.is_fraud === true || transaction.is_fraud === 1;
      const risk = Number(transaction.risk_score || transaction.risk || (isFraud ? 94 : 18));
      const query = search.trim().toLowerCase();

      const matchesRing = filter === "all" || ringId === filter;
      const matchesRisk =
        riskFilter === "all" ||
        (riskFilter === "critical" && risk >= 85) ||
        (riskFilter === "high" && risk >= 70 && risk < 85) ||
        (riskFilter === "medium" && risk >= 40 && risk < 70);
      const matchesSearch =
        !query ||
        JSON.stringify(transaction).toLowerCase().includes(query);

      return ringId && matchesRing && matchesRisk && matchesSearch;
    })
    .sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });

  const totalPages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = activities.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, riskFilter, search, transactions.length]);

  const totalAmount = activities.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );

  const criticalCount = activities.filter((transaction) => {
    const fraud = transaction.is_fraud === true || transaction.is_fraud === 1;
    return Number(transaction.risk_score || transaction.risk || (fraud ? 94 : 18)) >= 85;
  }).length;

  return (
    <div className="rings-page">
      <div className="page-intro">
        <div>
          <div className="panel-label">REAL-TIME FRAUD INTELLIGENCE</div>
          <h2>Ring Activity</h2>
          <p>
            Transaction activity connected to detected fraud rings. Monitor
            coordinated behaviour, risk scores, amounts and timestamps in one place.
          </p>
        </div>

        <div className="ring-count">
          <Activity size={18} />
          <strong>{activities.length}</strong>
          <span>ring activities</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        <RingMetric label="ACTIVE RINGS" value={filter === "all" ? ringIds.length : 1} />
        <RingMetric label="ACTIVITIES" value={activities.length} />
        <RingMetric label="CRITICAL" value={criticalCount} />
        <RingMetric label="TOTAL AMOUNT" value={`₹${totalAmount.toLocaleString("en-IN")}`} />
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div className="search-box" style={{ flex: "1 1 260px" }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Search transaction, account, ring, device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            minHeight: "40px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid #243047",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <option value="all">All Fraud Rings</option>
          {ringIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{
            minHeight: "40px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid #243047",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <option value="all">All Risk Levels</option>
          <option value="critical">Critical (85+)</option>
          <option value="high">High (70–84)</option>
          <option value="medium">Medium (40–69)</option>
        </select>
      </div>

      <Panel
        title="RING ACTIVITY STREAM"
        subtitle="Newest coordinated transactions first"
        icon={<Activity size={16} />}
        full
      >
        {visible.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>RING</th>
                  <th>TRANSACTION</th>
                  <th>ACCOUNT</th>
                  <th>DEVICE</th>
                  <th>AMOUNT</th>
                  <th>RISK</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((transaction, index) => {
                  const id = transaction.transaction_id || transaction.id || `TXN-${start + index + 1}`;
                  const ringId = transaction.ring_id || transaction.ring || "UNKNOWN";
                  const account = transaction.account_id || transaction.account || "Unknown";
                  const device = transaction.device_id || transaction.device || "Unknown";
                  const amount = Number(transaction.amount || 0);
                  const fraud = transaction.is_fraud === true || transaction.is_fraud === 1;
                  const risk = Number(transaction.risk_score || transaction.risk || (fraud ? 94 : 18));
                  const timestamp = transaction.timestamp
                    ? new Date(transaction.timestamp).toLocaleString("en-IN")
                    : "—";

                  return (
                    <tr key={`${id}-${index}`}>
                      <td>
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>{timestamp}</span>
                      </td>
                      <td>
                        <span className="mono">{ringId}</span>
                      </td>
                      <td><strong>{id}</strong></td>
                      <td><span className="mono">{account}</span></td>
                      <td><span className="mono">{device}</span></td>
                      <td><strong>₹{amount.toLocaleString("en-IN")}</strong></td>
                      <td><RiskBadge score={risk} /></td>
                      <td><StatusBadge fraud={fraud || risk >= 70} /></td>
                      <td>
                        <button
                          type="button"
                          className="view-button"
                          onClick={() => onTransaction(transaction)}
                          aria-label={`Open ${id}`}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Activity size={25} />
            <strong>No ring activity found</strong>
            <span>Try another ring, risk level or search term.</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "14px 4px 2px",
            color: "#94a3b8",
            fontSize: "12px",
          }}
        >
          <span>
            Showing {activities.length ? start + 1 : 0}-{Math.min(start + PAGE_SIZE, activities.length)} of {activities.length}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="view-button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ opacity: safePage <= 1 ? 0.4 : 1 }}
            >
              Previous
            </button>
            <span style={{ minWidth: "80px", textAlign: "center" }}>
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="view-button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ opacity: safePage >= totalPages ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* =====================================================
   RING LIST
===================================================== */

function RingList({
  rings,
}) {
  return (
    <div className="ring-list">

      {rings
        .slice(0, 4)
        .map(
          (ring, index) => {
            const id =
              ring.ring_id ||
              ring.id ||
              `RING_${String(
                index + 1
              ).padStart(
                3,
                "0"
              )}`;

            const pattern =
              ring.pattern ||
              ring.type ||
              "COMMON_DESTINATION";

            const risk =
              ring.confidence ||
              94 -
                index * 5;

            return (
              <div
                className="ring-row"
                key={id}
              >

                <div className="ring-number">
                  {String(
                    index + 1
                  ).padStart(
                    2,
                    "0"
                  )}
                </div>

                <div className="ring-info">

                  <strong>
                    {id}
                  </strong>

                  <span>
                    {formatPattern(
                      pattern
                    )}
                  </span>

                </div>

                <div className="ring-risk">

                  <span>
                    Risk
                  </span>

                  <strong>
                    {risk}
                  </strong>

                </div>

              </div>
            );
          }
        )}

    </div>
  );
}

/* =====================================================
   INTERACTIVE ACCOUNTS PAGE
===================================================== */

function AccountsPage({
  accounts = [],
}) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("risk");
  const [page, setPage] = useState(1);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const PAGE_SIZE = 20;

  /* -----------------------------------------------------
     NORMALIZE ACCOUNT DATA
  ----------------------------------------------------- */

  const safeAccounts = Array.isArray(accounts)
    ? accounts
    : [];

  /* -----------------------------------------------------
     FILTER
  ----------------------------------------------------- */

  const filteredAccounts = safeAccounts.filter((account) => {
    const accountId = String(
      account.account_id ||
        account.id ||
        ""
    ).toLowerCase();

    const riskLevel = String(
      account.risk_level ||
        ""
    ).toUpperCase();

    const searchValue = search
      .toLowerCase()
      .trim();

    const matchesSearch =
      !searchValue ||
      accountId.includes(searchValue);

    const matchesRisk =
      riskFilter === "ALL" ||
      riskLevel === riskFilter;

    return (
      matchesSearch &&
      matchesRisk
    );
  });

  /* -----------------------------------------------------
     SORT
  ----------------------------------------------------- */

  const sortedAccounts = [
    ...filteredAccounts,
  ].sort((a, b) => {
    if (sortBy === "risk") {
      return (
        Number(b.risk_score || 0) -
        Number(a.risk_score || 0)
      );
    }

    if (sortBy === "transactions") {
      return (
        Number(b.transaction_count || 0) -
        Number(a.transaction_count || 0)
      );
    }

    if (sortBy === "amount") {
      return (
        Number(b.total_amount || 0) -
        Number(a.total_amount || 0)
      );
    }

    if (sortBy === "fraud") {
      return (
        Number(b.fraud_transactions || 0) -
        Number(a.fraud_transactions || 0)
      );
    }

    return String(
      a.account_id || ""
    ).localeCompare(
      String(b.account_id || "")
    );
  });

  /* -----------------------------------------------------
     PAGINATION
  ----------------------------------------------------- */

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedAccounts.length /
        PAGE_SIZE
    )
  );

  const safePage = Math.min(
    page,
    totalPages
  );

  const start =
    (safePage - 1) *
    PAGE_SIZE;

  const visibleAccounts =
    sortedAccounts.slice(
      start,
      start + PAGE_SIZE
    );

  /* -----------------------------------------------------
     RESET PAGE WHEN FILTER CHANGES
  ----------------------------------------------------- */

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleRiskChange = (value) => {
    setRiskFilter(value);
    setPage(1);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setPage(1);
  };

  /* -----------------------------------------------------
     RISK COLOR
  ----------------------------------------------------- */

  const getRiskColor = (score) => {
    const value = Number(score || 0);

    if (value >= 80) {
      return "#ff4d67";
    }

    if (value >= 50) {
      return "#f5b942";
    }

    return "#35d07f";
  };

  const getRiskLabel = (account) => {
    const score = Number(
      account.risk_score || 0
    );

    if (score >= 80) {
      return "HIGH";
    }

    if (score >= 50) {
      return "MEDIUM";
    }

    return "LOW";
  };

  /* -----------------------------------------------------
     FORMAT MONEY
  ----------------------------------------------------- */

  const formatAmount = (amount) => {
    return `₹${Number(
      amount || 0
    ).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  };

  /* -----------------------------------------------------
     ACCOUNT DETAIL MODAL
  ----------------------------------------------------- */

  const AccountDetail = () => {
    if (!selectedAccount) {
      return null;
    }

    const score = Number(
      selectedAccount.risk_score || 0
    );

    const risk =
      selectedAccount.risk_level ||
      getRiskLabel(selectedAccount);

    return (
      <div
        onClick={() =>
          setSelectedAccount(null)
        }
        style={{
          position: "fixed",
          inset: 0,
          background:
            "rgba(0,0,0,0.72)",
          backdropFilter:
            "blur(5px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          onClick={(e) =>
            e.stopPropagation()
          }
          style={{
            width: "min(720px, 95vw)",
            background:
              "#0d1421",
            border:
              "1px solid #23314a",
            borderRadius: "18px",
            padding: "28px",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.55)",
          }}
        >

          {/* HEADER */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              marginBottom: "25px",
            }}
          >

            <div>
              <div
                style={{
                  color: "#7191bd",
                  fontSize: "11px",
                  letterSpacing:
                    "1.8px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                ACCOUNT INVESTIGATION
              </div>

              <h2
                style={{
                  margin: 0,
                  color: "#f4f7fb",
                  fontSize: "26px",
                }}
              >
                {selectedAccount.account_id}
              </h2>

              <div
                style={{
                  color: "#71819b",
                  marginTop: "6px",
                  fontSize: "13px",
                }}
              >
                Account risk intelligence
              </div>
            </div>

            <button
              onClick={() =>
                setSelectedAccount(null)
              }
              style={{
                border:
                  "1px solid #29374f",
                background:
                  "#111b2a",
                color: "#9eabc0",
                borderRadius: "9px",
                width: "36px",
                height: "36px",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>

          </div>

          {/* RISK HEADER */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              padding: "18px",
              borderRadius: "13px",
              background:
                "#111a29",
              border:
                "1px solid #22314a",
              marginBottom: "18px",
            }}
          >

            <div>
              <div
                style={{
                  color: "#72829a",
                  fontSize: "11px",
                  letterSpacing:
                    "1.2px",
                  marginBottom: "7px",
                }}
              >
                RISK SCORE
              </div>

              <strong
                style={{
                  color:
                    getRiskColor(score),
                  fontSize: "34px",
                }}
              >
                {score}
              </strong>
                <span
                  style={{
                    color: "#697991",
                    fontSize: "14px",
                    marginLeft: "5px",
                  }}
                >
                  / 99
                </span>
            </div>

            <div
              style={{
                padding:
                  "8px 14px",
                borderRadius: "20px",
                background:
                  `${getRiskColor(score)}18`,
                color:
                  getRiskColor(score),
                border:
                  `1px solid ${getRiskColor(score)}45`,
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              {String(risk).toUpperCase()}
            </div>

          </div>

          {/* STATS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, 1fr)",
              gap: "12px",
            }}
          >

            <div
              style={{
                background:
                  "#111a29",
                border:
                  "1px solid #22314a",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  color: "#6f819d",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                TRANSACTIONS
              </div>

              <strong
                style={{
                  color: "#f1f5fb",
                  fontSize: "22px",
                }}
              >
                {selectedAccount.transaction_count || 0}
              </strong>
            </div>

            <div
              style={{
                background:
                  "#111a29",
                border:
                  "1px solid #22314a",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  color: "#6f819d",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                TOTAL AMOUNT
              </div>

              <strong
                style={{
                  color: "#f1f5fb",
                  fontSize: "22px",
                }}
              >
                {formatAmount(
                  selectedAccount.total_amount
                )}
              </strong>
            </div>

            <div
              style={{
                background:
                  "#111a29",
                border:
                  "1px solid #22314a",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  color: "#6f819d",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                FRAUD TRANSACTIONS
              </div>

              <strong
                style={{
                  color:
                    Number(
                      selectedAccount.fraud_transactions || 0
                    ) > 0
                      ? "#ff4d67"
                      : "#35d07f",
                  fontSize: "22px",
                }}
              >
                {selectedAccount.fraud_transactions || 0}
              </strong>
            </div>

            <div
              style={{
                background:
                  "#111a29",
                border:
                  "1px solid #22314a",
                borderRadius: "12px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  color: "#6f819d",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                AVERAGE RISK
              </div>

              <strong
                style={{
                  color: "#f1f5fb",
                  fontSize: "22px",
                }}
              >
                {Number(
                  selectedAccount.average_risk_score || 0
                ).toFixed(2)}
              </strong>
            </div>

          </div>

          {/* INVESTIGATION MESSAGE */}

          <div
            style={{
              marginTop: "18px",
              padding: "15px",
              borderRadius: "11px",
              background:
                score >= 80
                  ? "rgba(255,77,103,0.08)"
                  : "rgba(53,208,127,0.07)",
              border:
                score >= 80
                  ? "1px solid rgba(255,77,103,0.22)"
                  : "1px solid rgba(53,208,127,0.18)",
              color:
                score >= 80
                  ? "#ff8b9b"
                  : "#7fe5a7",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            {score >= 80
              ? "⚠ This account requires investigation because its transaction behaviour indicates elevated fraud risk."
              : score >= 50
              ? "This account should be monitored for unusual behavioural changes."
              : "No major account-level fraud indicators detected."}
          </div>

        </div>
      </div>
    );
  };

  /* -----------------------------------------------------
     EMPTY STATE
  ----------------------------------------------------- */

  if (
    safeAccounts.length === 0
  ) {
    return (
      <Panel
        title="ACCOUNT RISK INTELLIGENCE"
        subtitle="Accounts ranked according to behavioural and network risk"
        icon={<Users size={16} />}
        full
      >
        <div
          style={{
            minHeight: "350px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <Users
            size={40}
            style={{
              opacity: 0.35,
            }}
          />

          <strong>
            No account data available
          </strong>

          <span
            style={{
              color: "#72819a",
              fontSize: "13px",
            }}
          >
            Waiting for backend account data.
          </span>
        </div>
      </Panel>
    );
  }

  /* -----------------------------------------------------
     MAIN PAGE
  ----------------------------------------------------- */

  return (
    <>
      <Panel
        title="ACCOUNT RISK INTELLIGENCE"
        subtitle="Accounts ranked according to behavioural and network risk"
        icon={<Users size={16} />}
        full
      >

        {/* CONTROLS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 180px 180px",
            gap: "10px",
            marginBottom: "18px",
          }}
        >

          {/* SEARCH */}

          <div
            style={{
              position: "relative",
            }}
          >
            <input
              value={search}
              onChange={(e) =>
                handleSearchChange(
                  e.target.value
                )
              }
              placeholder="Search account ID..."
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                background:
                  "#0c1422",
                border:
                  "1px solid #22314a",
                borderRadius: "10px",
                padding:
                  "12px 14px",
                color: "#eef3fa",
                outline: "none",
                fontSize: "13px",
              }}
            />
          </div>

          {/* RISK FILTER */}

          <select
            value={riskFilter}
            onChange={(e) =>
              handleRiskChange(
                e.target.value
              )
            }
            style={{
              background:
                "#0c1422",
              border:
                "1px solid #22314a",
              borderRadius: "10px",
              padding:
                "12px 14px",
              color: "#dce5f2",
              outline: "none",
            }}
          >
            <option value="ALL">
              All Risk Levels
            </option>
            <option value="HIGH">
              High Risk
            </option>
            <option value="MEDIUM">
              Medium Risk
            </option>
            <option value="LOW">
              Low Risk
            </option>
          </select>

          {/* SORT */}

          <select
            value={sortBy}
            onChange={(e) =>
              handleSortChange(
                e.target.value
              )
            }
            style={{
              background:
                "#0c1422",
              border:
                "1px solid #22314a",
              borderRadius: "10px",
              padding:
                "12px 14px",
              color: "#dce5f2",
              outline: "none",
            }}
          >
            <option value="risk">
              Sort: Highest Risk
            </option>
            <option value="transactions">
              Sort: Transactions
            </option>
            <option value="amount">
              Sort: Total Amount
            </option>
            <option value="fraud">
              Sort: Fraud Count
            </option>
            <option value="name">
              Sort: Account ID
            </option>
          </select>

        </div>

        {/* SUMMARY */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: "15px",
            color: "#73839b",
            fontSize: "12px",
          }}
        >
          <span>
            Showing{" "}
            <strong
              style={{
                color: "#dce5f2",
              }}
            >
              {sortedAccounts.length}
            </strong>{" "}
            matching accounts
          </span>

          <span>
            Total accounts:{" "}
            <strong
              style={{
                color: "#dce5f2",
              }}
            >
              {safeAccounts.length}
            </strong>
          </span>
        </div>

        {/* ACCOUNT TABLE */}

        <div
          style={{
            border:
              "1px solid #1d2a3e",
            borderRadius: "13px",
            overflow: "hidden",
          }}
        >

          {/* HEADER */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.2fr 0.9fr 1fr 1fr 0.9fr 0.7fr",
              padding:
                "13px 16px",
              background:
                "#101a2a",
              color: "#71839f",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing:
                "1px",
              textTransform:
                "uppercase",
            }}
          >
            <span>Account</span>
            <span>Risk</span>
            <span>Transactions</span>
            <span>Total Amount</span>
            <span>Fraud</span>
            <span>Status</span>
          </div>

          {/* ROWS */}

          {visibleAccounts.map(
            (account, index) => {
              const id =
                account.account_id ||
                account.id ||
                `A${String(
                  start + index + 1
                ).padStart(4, "0")}`;

              const score = Number(
                account.risk_score || 0
              );

              const risk =
                account.risk_level ||
                getRiskLabel(account);

              const riskColor =
                getRiskColor(score);

              return (
                <div
                  key={id}
                  onClick={() =>
                    setSelectedAccount(
                      account
                    )
                  }
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.2fr 0.9fr 1fr 1fr 0.9fr 0.7fr",
                    alignItems: "center",
                    padding:
                      "16px",
                    borderTop:
                      "1px solid #1a2639",
                    cursor:
                      "pointer",
                    transition:
                      "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "#111d2e";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "transparent";
                  }}
                >

                  {/* ACCOUNT */}

                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius:
                          "9px",
                        background:
                          "#15233a",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        color: "#6ea0ff",
                      }}
                    >
                      <UserRound
                        size={16}
                      />
                    </div>

                    <div>
                      <strong
                        style={{
                          display:
                            "block",
                          color:
                            "#e8eef7",
                          fontSize:
                            "13px",
                        }}
                      >
                        {id}
                      </strong>

                      <span
                        style={{
                          color:
                            "#657792",
                          fontSize:
                            "11px",
                        }}
                      >
                        Account
                      </span>
                    </div>
                  </div>

                  {/* RISK */}

                  <div>
                    <strong
                      style={{
                        color:
                          riskColor,
                        fontSize:
                          "15px",
                      }}
                    >
                      {score}
                    </strong>

                    <span
                      style={{
                        color:
                          "#64758e",
                        fontSize:
                          "11px",
                        marginLeft:
                          "4px",
                      }}
                    >
                      / 99
                    </span>
                  </div>

                  {/* TRANSACTIONS */}

                  <div
                    style={{
                      color:
                        "#d9e2ef",
                      fontSize:
                        "13px",
                    }}
                  >
                    {account.transaction_count || 0}
                  </div>

                  {/* AMOUNT */}

                  <div
                    style={{
                      color:
                        "#d9e2ef",
                      fontSize:
                        "13px",
                    }}
                  >
                    {formatAmount(
                      account.total_amount
                    )}
                  </div>

                  {/* FRAUD */}

                  <div
                    style={{
                      color:
                        Number(
                          account.fraud_transactions || 0
                        ) > 0
                          ? "#ff5c75"
                          : "#55d98a",
                      fontWeight:
                        700,
                    }}
                  >
                    {account.fraud_transactions || 0}
                  </div>

                  {/* STATUS */}

                  <div>
                    <span
                      style={{
                        display:
                          "inline-block",
                        padding:
                          "5px 8px",
                        borderRadius:
                          "6px",
                        background:
                          `${riskColor}15`,
                        color:
                          riskColor,
                        border:
                          `1px solid ${riskColor}35`,
                        fontSize:
                          "10px",
                        fontWeight:
                          700,
                      }}
                    >
                      {String(
                        risk
                      ).toUpperCase()}
                    </span>
                  </div>

                </div>
              );
            }
          )}

          {/* NO FILTER RESULT */}

          {visibleAccounts.length === 0 && (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#73839b",
              }}
            >
              <Users
                size={35}
                style={{
                  opacity: 0.35,
                  marginBottom:
                    "10px",
                }}
              />

              <div>
                No accounts match
                your filters.
              </div>
            </div>
          )}

        </div>

        {/* PAGINATION */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginTop: "18px",
          }}
        >

          <span
            style={{
              color: "#65758d",
              fontSize: "12px",
            }}
          >
            Showing{" "}
            {sortedAccounts.length === 0
              ? 0
              : start + 1}
            -
            {Math.min(
              start + PAGE_SIZE,
              sortedAccounts.length
            )}{" "}
            of{" "}
            {sortedAccounts.length}
          </span>

          <div
            style={{
              display: "flex",
              gap: "7px",
              alignItems: "center",
            }}
          >

            <button
              onClick={() =>
                setPage((p) =>
                  Math.max(
                    1,
                    p - 1
                  )
                )
              }
              disabled={
                safePage <= 1
              }
              style={{
                padding:
                  "8px 13px",
                border:
                  "1px solid #26354d",
                background:
                  "#101a29",
                color:
                  safePage <= 1
                    ? "#43516a"
                    : "#cbd7e7",
                borderRadius:
                  "7px",
                cursor:
                  safePage <= 1
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Previous
            </button>

            <span
              style={{
                color: "#9baac0",
                fontSize: "12px",
                minWidth: "70px",
                textAlign:
                  "center",
              }}
            >
              Page{" "}
              {safePage} /{" "}
              {totalPages}
            </span>

            <button
              onClick={() =>
                setPage((p) =>
                  Math.min(
                    totalPages,
                    p + 1
                  )
                )
              }
              disabled={
                safePage >=
                totalPages
              }
              style={{
                padding:
                  "8px 13px",
                border:
                  "1px solid #26354d",
                background:
                  "#101a29",
                color:
                  safePage >=
                  totalPages
                    ? "#43516a"
                    : "#cbd7e7",
                borderRadius:
                  "7px",
                cursor:
                  safePage >=
                  totalPages
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Next
            </button>

          </div>

        </div>

      </Panel>

      <AccountDetail />

    </>
  );
}



/* =====================================================
   ACCOUNT LIST
===================================================== */

function AccountList({
  accounts,
}) {
  return (
    <div className="account-list">

      {accounts
        .slice(0, 5)
        .map(
          (
            account,
            index
          ) => {
            const id =
              account.account_id ||
              account.id ||
              `A${String(
                index + 1
              ).padStart(
                4,
                "0"
              )}`;

            const score =
              Number(
                account.risk_score ||
                  account.risk ||
                  85
              );

            return (
              <div
                className="account-row"
                key={id}
              >

                <div className="account-avatar small">

                  <UserRound
                    size={14}
                  />

                </div>

                <div className="account-main">

                  <strong>
                    {id}
                  </strong>

                  <span>
                    Account risk score
                    {": "}
                    {score}
                  </span>

                </div>

                <RiskBadge
                  score={
                    score
                  }
                />

              </div>
            );
          }
        )}

    </div>
  );
}

/* =====================================================
   PIPELINE
===================================================== */

function Pipeline() {
  const steps = [
    {
      icon: Database,
      title:
        "Transaction ingestion",
      status:
        "ACTIVE",
    },
    {
      icon: Activity,
      title:
        "Anomaly detection",
      status:
        "ACTIVE",
    },
    {
      icon: Network,
      title:
        "Graph relationship analysis",
      status:
        "ACTIVE",
    },
    {
      icon: GitBranch,
      title:
        "Fraud ring detection",
      status:
        "ACTIVE",
    },
    {
      icon: ShieldCheck,
      title:
        "Risk decision engine",
      status:
        "READY",
    },
  ];

  return (
    <div className="pipeline">

      {steps.map(
        (step, index) => {
          const Icon =
            step.icon;

          return (
            <div
              className="pipeline-step"
              key={
                step.title
              }
            >

              <div className="pipeline-icon">

                <Icon
                  size={15}
                />

              </div>

              <div className="pipeline-info">

                <strong>
                  {step.title}
                </strong>

                <span>
                  {step.status}
                </span>

              </div>

              {index <
                steps.length -
                  1 && (
                <div className="pipeline-line" />
              )}

            </div>
          );
        }
      )}

    </div>
  );
}

/* =====================================================
   PANEL
===================================================== */

function Panel({
  title,
  subtitle,
  icon,
  children,
  wide,
  full,
}) {
  return (
    <div
      className={`panel content-panel ${
        wide
          ? "wide-panel"
          : ""
      } ${
        full
          ? "full-panel"
          : ""
      }`}
    >

      <div className="panel-heading">

        <div>

          <div className="panel-label">
            {title}
          </div>

          <h3>
            {subtitle}
          </h3>

        </div>

        <div className="panel-heading-icon">
          {icon}
        </div>

      </div>

      {children}

    </div>
  );
}

/* =====================================================
   TRANSACTION MODAL
===================================================== */

function TransactionModal({
  transaction,
  onClose,
}) {
  const risk =
    Number(
      transaction.risk_score ||
        transaction.risk ||
        20
    );

  const isFraud =
    transaction.is_fraud ===
      true ||
    transaction.is_fraud ===
      1 ||
    risk >= 70;

  const explanations =
    Array.isArray(
      transaction.explanation
    )
      ? transaction.explanation
      : [
          isFraud
            ? "Transaction is connected to suspicious network activity."
            : "Transaction behaviour appears normal.",

          isFraud
            ? "Related entities show suspicious connections."
            : "No strong graph anomalies detected.",

          isFraud
            ? "Account behaviour requires investigation."
            : "Account behaviour remains within expected limits.",
        ];

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >

      <div
        className="investigation-modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        <div className="modal-header">

          <div>

            <div className="panel-label">
              TRANSACTION INVESTIGATION
            </div>

            <h2>
              {transaction.transaction_id ||
                transaction.id ||
                "Transaction"}
            </h2>

          </div>

          <button
            className="close-button"
            onClick={onClose}
          >

            <X size={19} />

          </button>

        </div>

        <div className="modal-risk">

          <div
            className={`large-risk-circle ${
              isFraud
                ? "danger"
                : ""
            }`}
          >

            <strong>
              {risk}
            </strong>

            <span>
              /100
            </span>

          </div>

          <div>

            <span className="panel-label">
              AI RISK SCORE
            </span>

            <h3>
              {risk >= 85
                ? "CRITICAL RISK"
                : risk >= 70
                ? "HIGH RISK"
                : risk >= 40
                ? "MEDIUM RISK"
                : "LOW RISK"}
            </h3>

            <p>
              Confidence based on
              transaction, account and
              graph-level intelligence.
            </p>

          </div>

        </div>

        <div className="detail-grid">

          <Detail
            icon={
              <UserRound
                size={15}
              />
            }
            label="ACCOUNT"
            value={
              transaction.account_id ||
              transaction.account ||
              "Unknown"
            }
          />

          <Detail
            icon={
              <Smartphone
                size={15}
              />
            }
            label="DEVICE"
            value={
              transaction.device_id ||
              transaction.device ||
              "Unknown"
            }
          />

          <Detail
            icon={
              <Store
                size={15}
              />
            }
            label="MERCHANT"
            value={
              transaction.merchant_id ||
              transaction.merchant ||
              "Unknown"
            }
          />

          <Detail
            icon={
              <MapPin
                size={15}
              />
            }
            label="LOCATION"
            value={
              transaction.location ||
              "Unknown"
            }
          />

          <Detail
            icon={
              <CircleDollarSign
                size={15}
              />
            }
            label="AMOUNT"
            value={`₹${Number(
              transaction.amount ||
                0
            ).toLocaleString(
              "en-IN"
            )}`}
          />

          <Detail
            icon={
              <Activity
                size={15}
              />
            }
            label="STATUS"
            value={
              isFraud
                ? "FLAGGED"
                : "NORMAL"
            }
          />

        </div>

        <div className="explanation-section">

          <div className="panel-label">
            WHY WAS THIS FLAGGED?
          </div>

          <div className="explanation-list">

            {explanations.map(
              (
                item,
                index
              ) => (
                <div
                  className="explanation"
                  key={index}
                >

                  <div>
                    {index + 1}
                  </div>

                  <span>
                    {item}
                  </span>

                </div>
              )
            )}

          </div>

        </div>

        <div className="recommendation">

          <div className="recommendation-icon">

            <ShieldAlert
              size={18}
            />

          </div>

          <div>

            <span>
              RECOMMENDED ACTION
            </span>

            <strong>
              {transaction.recommended_action ||
                (isFraud
                  ? "BLOCK TRANSACTION / MANUAL REVIEW"
                  : "ALLOW TRANSACTION")}
            </strong>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =====================================================
   DETAIL
===================================================== */

function Detail({
  icon,
  label,
  value,
}) {
  return (
    <div className="detail-item">

      <div className="detail-icon">
        {icon}
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
}

/* =====================================================
   HELPERS
===================================================== */

function formatNumber(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  );
}

function formatPattern(
  pattern
) {
  return String(
    pattern || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

export default App;