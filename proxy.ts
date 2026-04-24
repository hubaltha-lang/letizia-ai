import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Redirect authenticated users away from auth page
  if (user && pathname === '/auth') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect root to dashboard or auth
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(user ? '/dashboard' : '/auth', request.url)
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/auth', '/dashboard/:path*', '/admin/:path*', '/admin'],
}
