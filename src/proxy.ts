import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/auth/login"];

// The session lives in sb-<project>-auth-token, split into .0/.1/... chunks
// once it outgrows one cookie.
const hasSessionCookie = (request: NextRequest) =>
  request.cookies.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));

/**
 * The one place the session is refreshed. getUser() runs once per request,
 * before any page code; a refreshed token is written to the request (so the
 * render below sees it) and to the response (so the browser keeps it). Server
 * components then read a valid token and have nothing to refresh.
 */
export async function proxy(request: NextRequest) {
  // Read before getUser(): a failed refresh clears the session cookies
  // through setAll, and afterwards the request no longer shows there was one.
  const hadSession = hasSessionCookie(request);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Returning a new response object drops the refreshed session cookies set
  // above, so copy them across before redirecting.
  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // A session cookie with no user behind it is a session that could not be
  // refreshed; say so on the login page. No cookie at all is a first visit
  // or a sign-out, and gets the plain login page.
  if (!user && !isPublic) {
    return redirectTo("/auth/login", hadSession ? "?expired=1" : "");
  }
  if (user && isPublic) return redirectTo("/department");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};