export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = localStorage.getItem("sigma_token");
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers }).then((response) => {
    if (response.status === 401) {
      localStorage.removeItem("sigma_token");
      localStorage.removeItem("sigma_user");
      window.dispatchEvent(new Event("sigma:unauthorized"));
    }
    return response;
  });
}

export function isAdmin() {
  return hasRole("admin");
}

export type UserRole =
  | "admin"
  | "maintenance"
  | "operator"
  | "designer"
  | "viewer";

export function hasRole(...roles: UserRole[]) {
  try {
    return roles.includes(
      JSON.parse(localStorage.getItem("sigma_user") || "null")?.role,
    );
  } catch {
    return false;
  }
}

export function canManage(resource: "agvs" | "missions" | "projects") {
  const roles: Record<typeof resource, UserRole> = {
    agvs: "maintenance",
    missions: "operator",
    projects: "designer",
  };
  return hasRole("admin", roles[resource]);
}
