import type React from "react";

interface ContentProps {
  children: React.ReactNode;
}

export function Content(props: ContentProps) {
  return (
    <div className="content" style={{ padding: 24 }}>
      {props.children}
    </div>
  );
}
