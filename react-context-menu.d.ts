import type { MouseEvent as ReactMouseEvent } from "react";

declare module "react" {
  export type ContextMenuEvent<T = Element> = ReactMouseEvent<T>;
}
