import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 클라이언트가 만드는 엔티티 id. 서버는 클라이언트 생성 id를 그대로 받는다. */
export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
