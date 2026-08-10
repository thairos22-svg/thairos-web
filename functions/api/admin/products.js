// GET  /api/admin/products  -> lista todo (para llenar la tabla del panel)
// POST /api/admin/products  -> guarda cambios de precio y stock
// Protegido con una clave simple que vos elegis (variable ADMIN_KEY en Cloudflare).
// El panel manda esa clave en el header "x-admin-key" en cada pedido.

function autorizado(request, env) {
  const clave = request.headers.get('x-admin-key') || '';
  return env.ADMIN_KEY && clave === env.ADMIN_KEY;
}

export async function onRequestGet({ request, env }) {
  if (!autorizado(request, env)) {
    return new Response('No autorizado', { status: 401 });
  }

  const { results: products } = await env.DB.prepare(
    'SELECT id, category, price, active FROM products ORDER BY category, id'
  ).all();
  const { results: variants } = await env.DB.prepare(
    'SELECT product_id, size, stock FROM variants'
  ).all();

  const data = products.map((p) => {
    const sizes = {};
    for (const v of variants) {
      if (v.product_id === p.id) sizes[v.size] = v.stock;
    }
    return { name: p.id, category: p.category, price: p.price, active: p.active, sizes };
  });

  return Response.json(data);
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) {
    return new Response('No autorizado', { status: 401 });
  }

  const body = await request.json();
  // body esperado: { name, price, active, sizes: { S: 3, M: 0, ... } }
  if (!body || !body.name) {
    return new Response('Falta el nombre del producto', { status: 400 });
  }

  await env.DB.prepare(
    'UPDATE products SET price = ?, active = ? WHERE id = ?'
  ).bind(body.price, body.active ? 1 : 0, body.name).run();

  if (body.sizes) {
    for (const [size, stock] of Object.entries(body.sizes)) {
      await env.DB.prepare(
        'UPDATE variants SET stock = ? WHERE product_id = ? AND size = ?'
      ).bind(Number(stock) || 0, body.name, size).run();
    }
  }

  return Response.json({ ok: true });
}
