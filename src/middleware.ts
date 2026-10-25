import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // Refresh the session if it has expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // member_id lives in app_metadata, which only the server can set (see services/auth.ts).
  const isMember = Boolean(user?.app_metadata?.member_id);

  // /member/* needs a member session; /owner/* needs a non-member session
  // (the owner layout then confirms a staff_users row via getCurrentStaff).
  if (pathname.startsWith("/member") && !isMember) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/owner") && (!user || isMember)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     * - manifest, sw
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|images|sw.js|offline.html|manifest.json).*)",
  ],
};
