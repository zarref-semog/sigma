import type React from "react";

interface MainProps {
  children: React.ReactNode;
}

export function Main(props: MainProps) {
  return <main>{props.children}</main>;
}
