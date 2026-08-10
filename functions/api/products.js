// GET /api/products
// Devuelve todos los productos activos con su stock por talle.
// Es publica: la usa la propia web para saber que mostrar disponible.

export async function onRequestGet({ env }) {
  const { results: products } = await env.DB.prepare(
    'SELECT id, category, price FROM products WHERE active = 1'
  ).all();

  const { results: variants } = await env.DB.prepare(
    'SELECT product_id, size, stock FROM variants'
  ).all();

  const data = products.map((p) => {
    const sizes = {};
    for (const v of variants) {
      if (v.product_id === p.id) sizes[v.size] = v.stock;
    }
    return { name: p.id, category: p.category, price: p.price, sizes };
  });

  return Response.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
