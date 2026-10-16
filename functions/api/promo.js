// GET  /api/promo  -> publico. La web pregunta si la promo esta prendida.
// POST /api/promo  -> solo con la clave del panel. Prende, apaga y cambia el porcentaje.
//
// Los valores viven en una tabla "settings" que se crea sola la primera vez,
// asi que no hace falta correr ningun SQL a mano.

async function asegurarTabla(env) {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'
  ).run();
}

async function leerPromo(env) {
  await asegurarTabla(env);
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('promo_activa', 'promo_porcentaje')"
  ).all();

  const v = {};
  for (const r of results) v[r.key] = r.value;

  const porcentaje = Number(v.promo_porcentaje);
  return {
    activa: v.promo_activa === '1',
    porcentaje: porcentaje > 0 && porcentaje < 100 ? porcentaje : 10,
  };
}

export async function onRequestGet({ env }) {
  try {
    return Response.json(await leerPromo(env), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    // si algo falla, la web se comporta como si no hubiera promo
    return Response.json({ activa: false, porcentaje: 10 }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export async function onRequestPost({ request, env }) {
  const clave = request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || clave !== env.ADMIN_KEY) {
    return new Response('No autorizado', { status: 401 });
  }

  const body = await request.json();
  const porcentaje = Number(body.porcentaje);
  if (!(porcentaje > 0 && porcentaje < 100)) {
    return new Response('El porcentaje tiene que ser un numero entre 1 y 99', { status: 400 });
  }

  await asegurarTabla(env);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('promo_activa', ?) " +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(body.activa ? '1' : '0').run();
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('promo_porcentaje', ?) " +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(String(Math.round(porcentaje))).run();

  return Response.json(await leerPromo(env));
}
