import type React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout(props: LayoutProps) {
  return <div className="layout">{props.children}</div>;
}
