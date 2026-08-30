import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router";
import { Login } from "./screens/LoginScreen";
import { Header } from "./components/Header";
import { Nav } from "./components/Nav";
import { Main } from "./components/Main";
import { Content } from "./components/Content";
import { Layout } from "./components/Layout";
import { AGVScreen } from "./screens/AGVScreen";
import { MissionScreen } from "./screens/MissionScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { SettingScreen } from "./screens/SettingScreen";
import { UserScreen } from "./screens/UserScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import dashboardIcon from "./assets/icons/dashboard-icon.svg";
import projectIcon from "./assets/icons/project-icon.svg";
import missionIcon from "./assets/icons/mission-stack-icon.svg";
import agvIcon from "./assets/icons/agv-icon.svg";
import userIcon from "./assets/icons/user-icon.svg";
import settingIcon from "./assets/icons/setting-icon.svg";
import type { UserRole } from "./api";

type AuthUser = { role?: UserRole };

const links = [
  { to: "/dashboard", label: "Painel", icon: dashboardIcon },
  { to: "/projects", label: "Projetos", icon: projectIcon, roles: ["admin", "designer"] },
  { to: "/missions", label: "Missões", icon: missionIcon, roles: ["admin", "operator"] },
  { to: "/agvs", label: "AGVs", icon: agvIcon, roles: ["admin", "maintenance"] },
  { to: "/users", label: "Usuários", icon: userIcon, roles: ["admin"] },
  { to: "/settings", label: "Configurações", icon: settingIcon, roles: ["admin"] },
];

function hasAccess(role: UserRole | undefined, roles?: string[]) {
  return !roles || Boolean(role && roles.includes(role));
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() =>
    Boolean(localStorage.getItem("sigma_token")),
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("sigma_user") || "null");
    } catch {
      return null;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unauthorized = () => {
      setAuthenticated(false);
      setCurrentUser(null);
    };
    window.addEventListener("sigma:unauthorized", unauthorized);
    return () => window.removeEventListener("sigma:unauthorized", unauthorized);
  }, []);

  function login(token: string, user: unknown) {
    localStorage.setItem("sigma_token", token);
    localStorage.setItem("sigma_user", JSON.stringify(user));
    setAuthenticated(true);
    setCurrentUser(user as AuthUser);
  }

  function logout() {
    localStorage.removeItem("sigma_token");
    localStorage.removeItem("sigma_user");
    setAuthenticated(false);
    setCurrentUser(null);
  }

  return (
    <BrowserRouter>
      {!authenticated ? (
        <Routes>
          <Route path="/login" element={<Login onLogin={login} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Layout>
          <Header>
            <button
              className="menu-toggle"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <div className="header-brand">
              <span className="header-title">SIGMA</span>
              <span className="header-description">
                Sistema Integrado de Gerenciamento
                <br />e Monitoramento de AGVs
              </span>
            </div>
            <button
              className="logout-button"
              onClick={logout}
              title="Sair"
              aria-label="Sair"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              </svg>
            </button>
          </Header>
          <Main>
            <Nav className={menuOpen ? "open" : ""}>
              <div className="links">
                <button
                  className="menu-toggle-back"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Fechar menu"
                >
                  {"<"}
                </button>
                {links
                  .filter((link) => hasAccess(currentUser?.role, link.roles))
                  .map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="nav-link-content">
                        <img src={link.icon} alt="" />
                        {link.label}
                      </span>
                    </NavLink>
                  ))}
              </div>
            </Nav>
            <Content>
              <Routes>
                <Route path="/dashboard" element={<DashboardScreen />} />
                {hasAccess(currentUser?.role, ["admin", "designer"]) && (
                  <Route path="/projects" element={<ProjectScreen />} />
                )}
                {hasAccess(currentUser?.role, ["admin", "operator"]) && (
                  <Route path="/missions" element={<MissionScreen />} />
                )}
                {hasAccess(currentUser?.role, ["admin", "maintenance"]) && (
                  <Route path="/agvs" element={<AGVScreen />} />
                )}
                {currentUser?.role === "admin" && (
                  <>
                    <Route path="/users" element={<UserScreen />} />
                    <Route path="/settings" element={<SettingScreen />} />
                  </>
                )}
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Routes>
            </Content>
          </Main>
        </Layout>
      )}
    </BrowserRouter>
  );
}
