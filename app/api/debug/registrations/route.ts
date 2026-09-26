export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false }, { status: 404 })
  }

  const payload = await request.json().catch(() => ({}))
  console.info('[CampusConnect][terminal] Registration debug', payload)

  return Response.json({ ok: true })
}
