import type React from "react";

interface HeaderProps {
  children: React.ReactNode;
}

export function Header(props: HeaderProps) {
  return <header>{props.children}</header>;
}
