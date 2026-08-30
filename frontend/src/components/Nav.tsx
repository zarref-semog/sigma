import type React from "react";

interface NavProps {
  className: string;
  children: React.ReactNode;
}

export function Nav(props: NavProps) {
  return <nav className={props.className}>{props.children}</nav>;
}
