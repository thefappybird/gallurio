import * as React from "react";

type HrefObject = { pathname: string; query?: Record<string, string> };
type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | HrefObject;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, ...rest },
  ref
) {
  let stringHref: string;
  if (typeof href === "string") {
    stringHref = href;
  } else {
    stringHref = href.query
      ? `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      : href.pathname;
  }
  return (
    <a ref={ref} href={stringHref} {...rest}>
      {children}
    </a>
  );
});

export function usePathname() {
  return "/";
}

export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  };
}

export function redirect(_url: string): never {
  throw new Error(`redirect(${_url}) called in test`);
}

export function getPathname() {
  return "/";
}
