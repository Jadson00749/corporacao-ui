/**
 * Camada de compatibilidade: expõe a API de navegação no estilo react-router-dom
 * em cima do TanStack Router, para manter o código das páginas inalterado.
 */
import * as React from "react";
import {
  Outlet,
  useRouter,
  useRouterState,
  useParams as useTanstackParams,
} from "@tanstack/react-router";

export { Outlet };

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export interface LinkProps extends AnchorProps {
  to: string;
  replace?: boolean;
  state?: unknown;
  end?: boolean;
  preventScrollReset?: boolean;
}

export interface NavLinkProps extends Omit<LinkProps, "className" | "children"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
  children?: React.ReactNode | ((props: { isActive: boolean; isPending: boolean }) => React.ReactNode);
}

function splitTo(to: string) {
  const [beforeHash, hash] = to.split("#");
  const [pathname, search] = (beforeHash ?? "").split("?");
  return { pathname: pathname || "/", search: search ? `?${search}` : "", hash: hash ?? "" };
}

export function useNavigate() {
  const router = useRouter();
  return React.useCallback(
    (to: string | number, options?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === "number") {
        router.history.go(to);
        return;
      }
      const { pathname, search, hash } = splitTo(to);
      void router.navigate({
        href: `${pathname}${search}${hash}`,
        replace: options?.replace,
      } as never);
    },
    [router],
  );
}

export function useLocation() {
  return useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      search: s.location.searchStr ?? "",
      hash: s.location.hash ? `#${s.location.hash.replace(/^#/, "")}` : "",
      state: s.location.state,
      key: s.location.pathname + (s.location.searchStr ?? ""),
    }),
  });
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return useTanstackParams({ strict: false } as never) as T;
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => void,
] {
  const router = useRouter();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = React.useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const setParams = React.useCallback(
    (next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => {
      const usp = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const qs = usp.toString();
      void router.navigate({
        href: qs ? `${pathname}?${qs}` : pathname,
        replace: options?.replace ?? false,
      } as never);
    },
    [router, pathname],
  );

  return [params, setParams];
}

function useIsActive(to: string, end?: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { pathname: target } = splitTo(to);
  if (end || target === "/") return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state: _state, end: _end, preventScrollReset: _prs, onClick, target, ...rest },
  ref,
) {
  const router = useRouter();
  const { pathname, search, hash } = splitTo(to);
  const href = `${pathname}${search}${hash}`;

  return (
    <a
      ref={ref}
      href={href}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (target && target !== "_self") return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (to.startsWith("http") || to.startsWith("mailto:") || to.startsWith("tel:")) return;
        event.preventDefault();
        if (to === "#") return;
        void router.navigate({ href, replace } as never);
      }}
      {...rest}
    />
  );
});

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, children, to, end, ...rest },
  ref,
) {
  const isActive = useIsActive(to, end);
  const renderProps = { isActive, isPending: false };

  return (
    <Link
      ref={ref}
      to={to}
      className={typeof className === "function" ? className(renderProps) : className}
      aria-current={isActive ? "page" : undefined}
      {...rest}
    >
      {typeof children === "function" ? children(renderProps) : children}
    </Link>
  );
});
